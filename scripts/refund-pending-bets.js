#!/usr/bin/env node
/**
 * Script temporal (solo terminal): devuelve montos de apuestas con status 0 (pendiente)
 * para un evento dado. Opción --dry-run solo imprime lo que se haría.
 *
 * Uso:
 *   node scripts/refund-pending-bets.js <id_event> [--dry-run]
 *
 * Ejemplo:
 *   node scripts/refund-pending-bets.js 5
 *   node scripts/refund-pending-bets.js 5 --dry-run
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
  const idEvent = args.find((a) => !a.startsWith("--") && a !== "--dry-run");

  if (!idEvent || isNaN(Number(idEvent))) {
    console.error("Uso: node scripts/refund-pending-bets.js <id_event> [--dry-run]");
    console.error("Ejemplo: node scripts/refund-pending-bets.js 5 --dry-run");
    process.exit(1);
  }

  return { id_event: Number(idEvent), dryRun };
}

async function run() {
  const { id_event, dryRun } = parseArgs();

  console.log("\n--- Devolución de apuestas pendientes (status 0) ---");
  console.log("Evento ID:", id_event);
  console.log("Modo:", dryRun ? "DRY-RUN (no se modificará la BD)" : "EJECUCIÓN REAL");
  console.log("");

  let transaction;

  try {
    const pendingBets = await betting.findAll({
      where: { id_event, status: BET_STATUS_PENDING },
      order: [["id", "ASC"]],
    });

    if (pendingBets.length === 0) {
      console.log("No hay apuestas con status 0 para este evento.");
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
