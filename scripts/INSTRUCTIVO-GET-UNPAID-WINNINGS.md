# Instructivo: comando get-unpaid-winnings

## Qué hace

Obtiene la lista de **jugadores a los que no se les pagó la ganancia** cuando se declaró un ganador en una ronda y evento concretos. Considera apuestas **aceptadas** (status 1) del equipo ganador que no tienen una transacción de tipo **Ganancia** asociada.

---

## Uso

Desde la **raíz del proyecto** `artegallera-betsocket`:

```bash
node scripts/get-unpaid-winnings.js <id_event> <id_round>
```

O con parámetros nombrados:

```bash
node scripts/get-unpaid-winnings.js --id_event=<número> --id_round=<número>
```

---

## Ejemplos

```bash
# Evento 72, ronda 3966
node scripts/get-unpaid-winnings.js 72 3966

# Con flags
node scripts/get-unpaid-winnings.js --id_event=72 --id_round=3966
```

---

## Salida

- **Si hay jugadores sin pago:** se listan `id_betting`, `id_user`, `amount`, `payout_esperado` y nombre/usuario, más un total en dinero.
- **Si todos fueron pagados:** mensaje `Todos los ganadores fueron pagados.`
- **Si la ronda no tiene ganador declarado:** `La ronda no tiene ganador declarado.`
- **Si el resultado fue TABLA:** `Ronda con resultado TABLA; no aplica pago de ganancia.`
- **Si no hay apuestas aceptadas del ganador:** `No hay apuestas aceptadas del equipo ganador.`

---

## Requisitos

- Tener configurado el archivo `.env` en la raíz del proyecto.
- Base de datos accesible (misma configuración que el resto de la app).

---

## Códigos de salida

- `0`: ejecución correcta (con o sin jugadores sin pago).
- `1`: error de parámetros (falta id_event o id_round), ronda no encontrada o error interno.
