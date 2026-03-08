# Instructivo: comando get-rejected-not-refunded

## Qué hace

Lista **apuestas rechazadas** (status 2) que **no tienen registro de devolución** (transacción tipo "Devolver" asociada a la apuesta). Sirve para detectar posibles fallos del sistema en los que el monto no fue devuelto al usuario.

Desde que el cierre de botonera registra la transacción "Devolver" al rechazar, cualquier rechazo sin esa transacción se considera posible fallo de devolución.

---

## Uso

Desde la **raíz del proyecto** `artegallera-betsocket`:

**Solo listar** (filtros opcionales):

```bash
node scripts/get-rejected-not-refunded.js [--dry-run] [--id_event=<n>] [--id_round=<n>] [--id_user=<n>]
```

**Aplicar la devolución** (requiere evento, ronda y usuario):

```bash
node scripts/get-rejected-not-refunded.js --refund --id_event=<n> --id_round=<n> --id_user=<n> [--dry-run]
```

- **--dry-run**: vista previa (no aplica cambios). Con `--refund` muestra qué se devolvería sin ejecutar.
- **--refund**: ejecuta la devolución. **Obligatorios** en este modo: `--id_event`, `--id_round` y `--id_user`.

---

## Parámetros

| Parámetro   | Descripción              | Ejemplo        |
|------------|---------------------------|----------------|
| `id_event` | Filtrar por evento        | `--id_event=72` |
| `id_round` | Filtrar por ronda         | `--id_round=3966` |
| `id_user`  | Filtrar por usuario       | `--id_user=5` |

---

## Ejemplos

```bash
# 1) Vista previa: qué se devolvería para evento, ronda y usuario (sin aplicar)
node scripts/get-rejected-not-refunded.js --dry-run --id_event=72 --id_round=4039 --id_user=204

# 2) Aplicar la devolución (evento 72, ronda 4039, usuario 204)
node scripts/get-rejected-not-refunded.js --refund --id_event=72 --id_round=4039 --id_user=204

# 3) Refund con dry-run: ver qué se devolvería sin ejecutar
node scripts/get-rejected-not-refunded.js --refund --id_event=72 --id_round=4039 --id_user=204 --dry-run

# Solo listar (sin devolver)
node scripts/get-rejected-not-refunded.js --id_event=72 --id_round=3966
node scripts/get-rejected-not-refunded.js --dry-run --id_user=5
```

---

## Salida

Para cada apuesta se muestra:

- **evento** – id del evento  
- **ronda** – id de la ronda  
- **id_user** – id del usuario  
- **user** – nombre o email del usuario  
- **id_betting** – id de la apuesta  
- **team** – equipo (red/green)  
- **amount** – monto apostado (a devolver)

Al final se muestra el total de apuestas y la suma en dinero.

---

## Requisitos

- `.env` configurado en la raíz del proyecto.
- Base de datos accesible.

---

## Códigos de salida

- `0`: ejecución correcta.
- `1`: error de ejecución (ej. base de datos).
