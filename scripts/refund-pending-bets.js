#!/usr/bin/env node
/**
 * Script temporal (solo terminal): devuelve montos de apuestas con status 0 (pendiente).
 * Opción --dry-run solo imprime lo que se haría.
 *
 * Uso (por evento; opcionalmente por ronda y/o usuario):
 *   node scripts/refund-pending-bets.js <id_event> [--round <id_round>] [--user <id_user>] [--dry-run]
 *
 * Ejemplos:
 *   Por evento (todas las pendientes del evento):
 *     node scripts/refund-pending-bets.js 5
 *     node scripts/refund-pending-bets.js 5 --dry-run
 *   Por evento y ronda:
 *     node scripts/refund-pending-bets.js 5 --round 12
 *     node scripts/refund-pending-bets.js 5 --round 12 --dry-run
 *   Por evento y usuario:
 *     node scripts/refund-pending-bets.js 5 --user 147
 *   Por evento, ronda y usuario:
 *     node scripts/refund-pending-bets.js 5 --round 12 --user 147 --dry-run
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const path = require("path");
const dbPath = path.join(__dirname, "..", "src", "db.js");
const { betting, users, usertransactions, rounds, sequelize } = require(dbPath);

const BET_STATUS_PENDING = 0;
const BET_STATUS_REJECTED = 2;

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const idEventArg = args[0];

  if (!idEventArg || isNaN(Number(idEventArg))) {
    console.error("Uso: node scripts/refund-pending-bets.js <id_event> [--round <id_round>] [--user <id_user>] [--dry-run]");
    console.error("Ejemplos:");
    console.error("  node scripts/refund-pending-bets.js 5 --dry-run");
    console.error("  node scripts/refund-pending-bets.js 5 --round 12 --user 147");
    process.exit(1);
  }

  let id_round = null;
  let id_user = null;
  const roundIdx = args.indexOf("--round");
  if (roundIdx !== -1 && args[roundIdx + 1] != null && !args[roundIdx + 1].startsWith("--")) {
    const val = Number(args[roundIdx + 1]);
    if (!isNaN(val)) id_round = val;
  }
  const userIdx = args.indexOf("--user");
  if (userIdx !== -1 && args[userIdx + 1] != null && !args[userIdx + 1].startsWith("--")) {
    const val = Number(args[userIdx + 1]);
    if (!isNaN(val)) id_user = val;
  }

  return {
    id_event: Number(idEventArg),
    id_round,
    id_user,
    dryRun,
  };
}

async function run() {
  const { id_event, id_round, id_user, dryRun } = parseArgs();

  const where = { id_event, status: BET_STATUS_PENDING };
  if (id_round != null) where.id_round = id_round;
  if (id_user != null) where.id_user = id_user;

  console.log("\n--- Devolución de apuestas pendientes (status 0) ---");
  console.log("Evento ID:", id_event);
  if (id_round != null) console.log("Ronda ID:", id_round);
  if (id_user != null) console.log("Usuario ID:", id_user);
  console.log("Modo:", dryRun ? "DRY-RUN (no se modificará la BD)" : "EJECUCIÓN REAL");
  console.log("");

  let transaction;

  try {
    const pendingBets = await betting.findAll({
      where,
      order: [["id", "ASC"]],
    });

    if (pendingBets.length === 0) {
      console.log("No hay apuestas con status 0 para los filtros indicados (evento" + (id_round != null ? ", ronda" : "") + (id_user != null ? ", usuario" : "") + ").");
      return;
    }

    console.log(`Apuestas pendientes encontradas: ${pendingBets.length}\n`);

    if (dryRun) {
      let totalAmount = 0;
      for (const bet of pendingBets) {
        const roundRow = await rounds.findByPk(bet.id_round);
        totalAmount += Number(bet.amount);
        console.log(
          `  [DRY-RUN] id_betting=${bet.id} id_user=${bet.id_user} id_round=${bet.id_round} pelea=${roundRow ? roundRow.round : "?"} team=${bet.team} amount=${bet.amount}`
        );
      }
      console.log(`\nTotal a devolver: $${totalAmount}`);
      console.log("Ejecuta sin --dry-run para aplicar los cambios.");
      return;
    }

    transaction = await sequelize.transaction();

    let processed = 0;
    const errors = [];

    for (const bet of pendingBets) {
      try {
        const user = await users.findByPk(bet.id_user, { transaction });
        if (!user) {
          errors.push({ betId: bet.id, reason: `Usuario ${bet.id_user} no encontrado` });
          continue;
        }

        const previousBalance = Number(user.initial_balance);
        const amount = Number(bet.amount);
        const currentBalance = previousBalance + amount;

        await users.update(
          { initial_balance: currentBalance },
          { where: { id: bet.id_user }, transaction }
        );

        await betting.update(
          { status: BET_STATUS_REJECTED },
          { where: { id: bet.id }, transaction }
        );

        const roundRow = await rounds.findByPk(bet.id_round, { transaction });
        await usertransactions.create(
          {
            id_user: bet.id_user,
            id_event: bet.id_event,
            id_round: bet.id_round,
            round: roundRow ? roundRow.round : null,
            type_transaction: "Devolver",
            amount,
            previous_balance: previousBalance,
            current_balance: currentBalance,
            team: bet.team,
            description: "Devolución manual - apuesta pendiente (script temporal)",
            id_betting: bet.id,
          },
          { transaction }
        );

        processed++;
        console.log(`  ✓ id_betting=${bet.id} id_user=${bet.id_user} amount=$${amount} devuelto.`);
      } catch (err) {
        errors.push({ betId: bet.id, error: err.message });
        console.error(`  ✗ id_betting=${bet.id}:`, err.message);
      }
    }

    await transaction.commit();

    console.log(`\nProcesadas: ${processed} apuestas.`);
    if (errors.length > 0) {
      console.log("Errores:", errors.length);
    }
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("Error fatal:", error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
