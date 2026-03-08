# Instructivo: script refund-pending-bets

## Qué hace

Devuelve a los usuarios el monto de las **apuestas pendientes** (status 0) que aún no fueron emparejadas ni rechazadas por el sistema. Cada apuesta se marca como **rechazada** (status 2), se suma el monto al `initial_balance` del usuario y se registra una transacción tipo **"Devolver"** en `usertransactions` con la descripción "Devolución manual - apuesta pendiente (script temporal)".

Útil cuando quedan apuestas en estado pendiente tras un evento (por ejemplo, por cierre inesperado o intervención manual) y se quiere devolver el dinero de forma controlada.

---

## Uso

Desde la **raíz del proyecto** `artegallera-betsocket`:

```bash
node scripts/refund-pending-bets.js <id_event> [--round <id_round>] [--user <id_user>] [--dry-run]
```

- **`<id_event>`** (obligatorio): ID del evento. Siempre debe ser el primer argumento.
- **`--round <id_round>`** (opcional): filtrar solo apuestas de esa ronda dentro del evento.
- **`--user <id_user>`** (opcional): filtrar solo apuestas de ese usuario dentro del evento.
- **`--dry-run`** (opcional): muestra qué apuestas se devolverían y el total, **sin modificar la base de datos**.

---

## Parámetros

| Parámetro   | Obligatorio | Descripción |
|------------|-------------|-------------|
| `<id_event>` | Sí (primer argumento) | ID del evento. |
| `--round <id_round>` | No | ID de la ronda. Si se omite, se incluyen todas las rondas del evento. |
| `--user <id_user>` | No | ID del usuario. Si se omite, se incluyen todos los usuarios. |
| `--dry-run` | No | Vista previa: no aplica cambios en la BD. |

---

## Ejemplos

```bash
# 1) Vista previa: todas las apuestas pendientes del evento 5 (sin aplicar)
node scripts/refund-pending-bets.js 5 --dry-run

# 2) Devolver todas las pendientes del evento 5
node scripts/refund-pending-bets.js 5

# 3) Solo las pendientes del evento 5 y la ronda 12
node scripts/refund-pending-bets.js 5 --round 12
node scripts/refund-pending-bets.js 5 --round 12 --dry-run

# 4) Solo las pendientes del evento 5 del usuario 147
node scripts/refund-pending-bets.js 5 --user 147

# 5) Evento 5, ronda 12 y usuario 147 (máximo filtro)
node scripts/refund-pending-bets.js 5 --round 12 --user 147
node scripts/refund-pending-bets.js 5 --round 12 --user 147 --dry-run
```

---

## Salida

- **Cabecera**: evento (y ronda/usuario si se usaron filtros) y modo (DRY-RUN o EJECUCIÓN REAL).
- **Si hay apuestas**:
  - En **dry-run**: por cada apuesta, `id_betting`, `id_user`, `id_round`, pelea (número de ronda), `team`, `amount`; al final el total a devolver.
  - En **ejecución real**: por cada apuesta procesada, confirmación con `id_betting`, `id_user` y monto devuelto; al final el número de apuestas procesadas y, si hubo, la cantidad de errores.
- **Si no hay apuestas** con status 0 para los filtros indicados, se muestra un mensaje y el script termina sin cambios.

---

## Requisitos

- Archivo **`.env`** en la raíz de `artegallera-betsocket` (con la configuración de base de datos).
- Base de datos accesible (misma que usa el servicio betsocket).

---

## Códigos de salida

- **0**: ejecución correcta (o dry-run sin errores).
- **1**: error fatal (por ejemplo, base de datos no disponible); en modo ejecución real se hace rollback de la transacción.

---

## Notas

- Siempre es recomendable ejecutar primero con `--dry-run` para revisar qué apuestas se devolverían.
- Las devoluciones se ejecutan dentro de una única transacción. Si una apuesta falla (por ejemplo, usuario no encontrado), se registra el error y se sigue con las demás; al final se hace commit, por lo que las devoluciones aplicadas en ese run quedan guardadas. Solo si ocurre un error fatal antes del commit se hace rollback de toda la transacción.
