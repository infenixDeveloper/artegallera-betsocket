# Lógica de negocio — Sistema de apuestas (ArteGallera BetSocket)

Documento que describe el flujo de apuestas, verificación y liquidación en el módulo de apuestas.

---

## 1. Estados de una apuesta

| Valor | Estado      | Descripción |
|------:|------------|-------------|
| **0** | Pendiente  | Apuesta registrada; aún no emparejada con el equipo contrario. |
| **1** | Aceptada   | Apuesta emparejada (rojo ↔ verde); queda confirmada. |
| **2** | Rechazada  | No hubo contraparte; se devuelve el saldo al usuario. |

---

## 2. Flujo general

1. **Ronda con botonera abierta** (`is_betting_active: true`): los usuarios pueden apostar (rojo o verde).
2. **Cada 15 segundos** se ejecuta `VerificationBetting`: intenta emparejar apuestas pendientes; las no emparejadas siguen en estado 0.
3. **Al cerrar la botonera** se ejecuta `VerificationBettingRound`: empareja lo posible; lo que quede pendiente se rechaza y se devuelve el saldo.
4. **Selección de ganador** (`selectWinner`): se pagan ganancias a apuestas aceptadas (status 1) del equipo ganador; en empate se devuelve el monto a todos.

---

## 3. Realizar una apuesta (`placeBet` — betsocket.js)

- **Entrada:** `id_user`, `id_event`, `id_round`, `team` (red/green), `amount`.
- **Validaciones:**
  - Datos obligatorios presentes.
  - Usuario existe.
  - `initial_balance >= amount`.
- **Acciones:**
  1. Crear registro en `betting` con `status: 0`.
  2. Descontar `amount` del `initial_balance` del usuario.
  3. Crear `usertransactions` tipo "Apostando".
  4. Emitir `newBet` y `updatedTotalAmount` por socket.

La apuesta queda **pendiente** hasta que la verificación la empareje o la rechace.

---

## 4. Verificación periódica (cada 15 s) — `VerificationBetting`

**Archivo:** `VerificationBetting.js`  
**Disparo:** `setInterval` en `betsocket.js` cada 15 segundos.

### 4.1 Condiciones para ejecutar

- Existe una ronda con `is_betting_active: true`.
- Existe un evento activo (`events.is_active: true`).
- Se trabaja solo sobre la ronda activa de ese evento.

Si no hay evento activo o no hay ronda activa, se hace rollback y no se modifican apuestas.

### 4.2 Proceso por ronda

1. **Obtener apuestas pendientes** de la ronda (`status: 0`).
2. **Procesar por monto descendente** (mayor primero):
   - `findHighestRemainingBet`: obtiene la apuesta pendiente de mayor monto.
   - `matchHighestBet`: intenta cubrir esa apuesta con apuestas del equipo contrario (sumando montos).
     - Si el monto se cubre exactamente: se aceptan todas (status 1), se crean `marriedbetting` y se emite `Statusbetting` "accepted".
     - Si no se cubre: la apuesta grande **sigue pendiente** (status 0).
   - Se repite hasta que no queden apuestas pendientes o ya no se pueda emparejar ninguna.
3. **Emparejar montos exactos:** `evaluateBetsAmountEquels`:
   - Apuestas rojas y verdes pendientes con el **mismo monto** se emparejan 1 a 1.
   - Se crean `marriedbetting` y se marcan como aceptadas (1).

Todas las operaciones van en una **transacción**: si algo falla, se hace rollback.

---

## 5. Verificación al cerrar la ronda — `VerificationBettingRound`

**Disparo:** al cerrar la botonera en `toggleEvent` (betsocket.js), cuando `isOpen === false`.

### 5.1 Diferencia con la verificación periódica

- Usa **`matchHighestBet2`** en lugar de `matchHighestBet`:
  - Si la apuesta de mayor monto **no** se puede cubrir con el equipo contrario, se **rechaza** (status 2) y se **devuelve el saldo** (`updateBalances`).
- Después de emparejar (montos exactos y por suma), **todas las apuestas que sigan pendientes** se rechazan y se devuelve el saldo con `updateBalances`.

### 5.2 Proceso por ronda

1. Misma idea que la verificación periódica, pero con `matchHighestBet2` (rechazo + devolución si no hay emparejamiento).
2. `evaluateBetsAmountEquels` para montos exactos rojo/verde.
3. Obtener de nuevo las apuestas pendientes de la ronda.
4. Si hay pendientes: `updateBalances(remainingBets, io, transaction)` → status 2, devolución de saldo, transacción "Devolución por apuesta rechazada (sin emparejar)".

---

## 6. Emparejamiento de apuestas (detalle)

### 6.1 Emparejamiento por monto exacto (`processMatchingBets` / `evaluateBetsAmountEquels`)

- Para cada apuesta roja pendiente se busca una verde con **el mismo `amount`**.
- Si hay coincidencia: se crea `marriedbetting` (id_betting_one, id_betting_two, id_event, id_round), ambas pasan a status 1 y se emite `Statusbetting` "accepted".

### 6.2 Emparejamiento por suma (`matchHighestBet` / `matchHighestBet2`)

- Se toma la apuesta pendiente de **mayor monto**.
- Del equipo contrario se toman apuestas pendientes ordenadas por `amount` DESC.
- Se van sumando montos del equipo contrario hasta cubrir el monto de la apuesta grande:
  - Si `remainingAmount === 0`: la apuesta grande y las usadas pasan a 1, se crean `marriedbetting` (la grande emparejada con cada una de las usadas) y se emiten los `Statusbetting`.
  - Si no se cubre:
    - **matchHighestBet:** la apuesta grande sigue en 0.
    - **matchHighestBet2:** la apuesta grande pasa a 2 y se llama `updateBalances` para devolver el saldo.

---

## 7. Devolución por apuesta rechazada (`updateBalances`)

- Para cada apuesta en la lista (rechazadas o a rechazar):
  1. Sumar `bet.amount` al `initial_balance` del usuario.
  2. Marcar la apuesta con status 2 (`updateBetStatusBulk`).
  3. Crear `usertransactions` con tipo "Devolver", descripción "Devolución por apuesta rechazada (sin emparejar)".
  4. Emitir `Statusbetting` con status "rejected".

---

## 8. Cierre de ronda (botonera) — `toggleEvent`

- **Abrir** (`isOpen: true`): se actualiza `round.is_betting_active = true`; se emite estado y lista de rondas activas.
- **Cerrar** (`isOpen: false`):
  1. `round.is_betting_active = false`.
  2. Se llama **`VerificationBettingRound(round.id, io)`** (rechazo + devolución de lo no emparejado).
  3. Se emite estado y rondas activas.

---

## 9. Selección de ganador (`selectWinner` — betsocket.js)

- **Entrada:** `id_event`, `id_round`, `team` (red / green / draw).

### 9.1 Si `team === "draw"`

- Todas las apuestas con status 1 de la ronda: se devuelve el monto a cada usuario (`initial_balance += amount`), se crea transacción "Devolución por resultado TABLA".
- Se crea registro en `winners` con `team_winner: "draw"` y se asocia a la ronda.
- Se emite `winner` con mensaje de TABLA.

### 9.2 Si hay ganador (red o green)

- Se suman montos de apuestas aceptadas (status 1) por equipo.
- Se crea `winners` con totales y `earnings` (10% del total del equipo ganador).
- Se actualiza `round.id_winner` y `betting.id_winner` para la ronda.
- Para cada apuesta ganadora: pago = `amount + (amount * 0.9)`; se incrementa `initial_balance`, se crea transacción "Ganancia por apuesta ganadora".
- Se actualiza `events.total_amount` con la suma de saldos de usuarios.
- Se emite `winner` con el color ganador.

---

## 10. Resumen de eventos Socket relevantes

| Evento (cliente → servidor) | Uso |
|-----------------------------|-----|
| `placeBet`                  | Registrar apuesta (rojo/verde) en una ronda. |
| `getBetStats`               | Obtener total apostado por equipo/ronda (status 0 y 1). |
| `createRound`               | Crear nueva ronda para un evento. |
| `getAllRoundsByEvent`       | Listar rondas del evento. |
| `getAllActiveRounds`        | Rondas con botonera abierta. |
| `toggleEvent`               | Abrir/cerrar botonera; al cerrar dispara VerificationBettingRound. |
| `getRoundStatus`            | Estado del evento y la ronda. |
| `selectWinner`              | Declarar ganador (red/green/draw) y liquidar. |
| `user-amount`               | Monto apostado por usuario en la ronda (rojo/verde, status 1). |

| Evento (servidor → cliente) | Uso |
|-----------------------------|-----|
| `newBet`                    | Nueva apuesta registrada. |
| `updatedTotalAmount`        | Total actualizado por equipo. |
| `Statusbetting`             | Apuesta aceptada, rechazada o mensaje de estado (verificación/eventos activos). |
| `isBettingActive`           | Cambio de estado de la botonera. |
| `getActiveRounds`           | Lista actualizada de rondas activas. |
| `winner`                    | Resultado de la ronda (ROJO / VERDE / TABLA). |
| `new-balance`               | Actualización de saldo (recarga/retiro). |

---

## 11. Tablas y conceptos clave

- **betting:** Apuestas (id_user, id_event, id_round, team, amount, status, id_winner).
- **marriedbetting:** Pares de apuestas emparejadas (id_betting_one, id_betting_two, id_event, id_round).
- **usertransactions:** Movimientos de saldo (Apostando, Devolver, Ganancia, Recarga, Retiro).
- **rounds:** Rondas por evento; `is_betting_active` controla si se puede apostar.
- **winners:** Resultado por ronda (team_winner, totales, earnings).

Este documento refleja la lógica implementada en `VerificationBetting.js` y `betsocket.js` a fecha de su elaboración.
