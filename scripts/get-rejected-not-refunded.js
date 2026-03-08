#!/usr/bin/env node
/**
 * Comando: Listar apuestas rechazadas (status 2) que no tienen registro de devolución
 * (transacción "Devolver") — posible fallo del sistema al devolver el monto.
 *
 * INSTRUCTIVO DE USO
 * ===================
 *
 * 1. Ubicación: desde la raíz del proyecto artegallera-betsocket.
 *
 * 2. Sintaxis:
 *      Listar:  node scripts/get-rejected-not-refunded.js [--dry-run] [--id_event=<n>] [--id_round=<n>] [--id_user=<n>]
 *      Devolver: node scripts/get-rejected-not-refunded.js --refund --id_event=<n> --id_round=<n> --id_user=<n> [--dry-run]
 *
 * 3. --dry-run: vista previa (listar qué se devolvería; con --refund no aplica la devolución).
 *
 * 4. --refund: ejecuta la devolución. Requiere --id_event, --id_round y --id_user.
 *
 * 5. Ejemplos:
 *      node scripts/get-rejected-not-refunded.js --dry-run --id_event=72 --id_round=4039 --id_user=204
 *      node scripts/get-rejected-not-refunded.js --refund --id_event=72 --id_round=4039 --id_user=204
 *      node scripts/get-rejected-not-refunded.js --refund --id_event=72 --id_round=4039 --id_user=204 --dry-run
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const path = require("path");
const dbPath = path.join(__dirname, "..", "src", "db.js");
const { betting, usertransactions, users, rounds, sequelize } = require(dbPath);

const BET_STATUS_REJECTED = 2;

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const refund = args.includes("--refund");
  let id_event = null;
  let id_round = null;
  let id_user = null;
  for (const arg of args) {
    if (arg === "--dry-run" || arg === "--refund") continue;
    if (arg.startsWith("--id_event=")) id_event = arg.split("=")[1];
    if (arg.startsWith("--id_round=")) id_round = arg.split("=")[1];
    if (arg.startsWith("--id_user=")) id_user = arg.split("=")[1];
  }
  return {
    dryRun,
    refund,
    id_event: id_event != null ? Number(id_event) : null,
    id_round: id_round != null ? Number(id_round) : null,
    id_user: id_user != null ? Number(id_user) : null,
  };
}

async function run() {
  const { dryRun, refund, id_event, id_round, id_user } = parseArgs();

  if (refund && (!id_event || !id_round || !id_user || isNaN(id_event) || isNaN(id_round) || isNaN(id_user))) {
    console.error("Con --refund son obligatorios: --id_event, --id_round y --id_user.");
    console.error("Ejemplo: node scripts/get-rejected-not-refunded.js --refund --id_event=72 --id_round=4039 --id_user=204");
    process.exit(1);
  }

  const where = { status: BET_STATUS_REJECTED };
  if (id_event != null && !isNaN(id_event)) where.id_event = id_event;
  if (id_round != null && !isNaN(id_round)) where.id_round = id_round;
  if (id_user != null && !isNaN(id_user)) where.id_user = id_user;

  const rejectedBets = await betting.findAll({
    where,
    order: [
      ["id_event", "ASC"],
      ["id_round", "ASC"],
      ["id", "ASC"],
    ],
  });

  if (rejectedBets.length === 0) {
    console.log("No hay apuestas rechazadas con los filtros indicados.");
    process.exit(0);
  }

  const betIds = rejectedBets.map((b) => b.id);
  const refundedBetIds = new Set(
    (
      await usertransactions.findAll({
        where: {
          type_transaction: "Devolver",
          id_betting: betIds,
        },
        attributes: ["id_betting"],
        raw: true,
      })
    )
      .filter((t) => t.id_betting != null)
      .map((t) => t.id_betting)
  );

  const notRefunded = rejectedBets.filter((b) => !refundedBetIds.has(b.id));
  if (notRefunded.length === 0) {
    console.log("Todas las apuestas rechazadas tienen registro de devolución.");
    process.exit(0);
  }

  const userIds = [...new Set(notRefunded.map((b) => b.id_user))];
  const userList = await users.findAll({ where: { id: userIds }, raw: true });
  const userMap = new Map(userList.map((u) => [u.id, u]));

  if (refund) {
    if (dryRun) {
      console.log("\n[DRY RUN] Se devolvería el monto de las siguientes apuestas (no se realizó ninguna acción):\n");
      let total = 0;
      notRefunded.forEach((bet) => {
        total += Number(bet.amount);
        const u = userMap.get(bet.id_user) || {};
        const userName = u.name || u.email || u.username || String(bet.id_user);
        console.log(`  evento=${bet.id_event}  ronda=${bet.id_round}  id_user=${bet.id_user}  user=${userName}  id_betting=${bet.id}  team=${bet.team}  amount=${bet.amount}`);
      });
      console.log(`\nTotal: ${notRefunded.length} apuesta(s), $${total.toLocaleString("en-US")}`);
      console.log("(Ejecute sin --dry-run para aplicar la devolución.)\n");
      process.exit(0);
    }

    let transaction = null;
    try {
      transaction = await sequelize.transaction();
      let processed = 0;
      for (const bet of notRefunded) {
        const user = await users.findByPk(bet.id_user, { transaction });
        if (!user) {
          console.error(`  ✗ id_betting=${bet.id}: usuario ${bet.id_user} no encontrado.`);
          continue;
        }
        const previousBalance = Number(user.initial_balance);
        const amount = Number(bet.amount);
        const currentBalance = previousBalance + amount;

        await users.update(
          { initial_balance: currentBalance },
          { where: { id: bet.id_user }, transaction }
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
            description: "Devolución manual - apuesta rechazada sin devolución (script get-rejected-not-refunded)",
            id_betting: bet.id,
          },
          { transaction }
        );

        processed++;
        console.log(`  ✓ id_betting=${bet.id} id_user=${bet.id_user} amount=$${amount.toLocaleString("en-US")} devuelto.`);
      }
      await transaction.commit();
      console.log(`\nDevolución aplicada: ${processed} apuesta(s).\n`);
    } catch (err) {
      if (transaction) await transaction.rollback();
      console.error("Error al aplicar la devolución:", err.message);
      process.exit(1);
    }
    process.exit(0);
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Apuestas que se listarían como rechazadas sin devolución (no se realiza ninguna acción):\n");
  } else {
    console.log("\n--- Apuestas rechazadas sin devolución (posible fallo del sistema) ---\n");
  }
  let total = 0;
  notRefunded.forEach((bet) => {
    total += Number(bet.amount);
    const u = userMap.get(bet.id_user) || {};
    const userName = u.name || u.email || u.username || String(bet.id_user);
    console.log(`  evento=${bet.id_event}  ronda=${bet.id_round}  id_user=${bet.id_user}  user=${userName}  id_betting=${bet.id}  team=${bet.team}  amount=${bet.amount}`);
  });
  console.log(`\nTotal: ${notRefunded.length} apuesta(s), $${total.toLocaleString("en-US")} sin devolución`);
  if (dryRun) {
    console.log("(Ejecute sin --dry-run para el mismo listado en modo normal. Use --refund para aplicar la devolución.)\n");
  } else {
    console.log("");
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
