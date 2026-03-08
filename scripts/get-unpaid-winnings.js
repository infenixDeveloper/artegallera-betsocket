#!/usr/bin/env node
/**
 * Comando: Obtener jugadores a los que no se les pagó la ganancia en una ronda/evento.
 *
 * INSTRUCTIVO DE USO
 * ===================
 *
 * 1. Ubicación: desde la raíz del proyecto artegallera-betsocket.
 *
 * 2. Sintaxis:
 *      node scripts/get-unpaid-winnings.js <id_event> <id_round>
 *    o con parámetros nombrados:
 *      node scripts/get-unpaid-winnings.js --id_event=<número> --id_round=<número>
 *
 * 3. Ejemplos:
 *      node scripts/get-unpaid-winnings.js 72 3966
 *      node scripts/get-unpaid-winnings.js --id_event=72 --id_round=3966
 *
 * 4. Salida:
 *    - Lista de jugadores (id_user, id_betting, amount, payout_esperado) que tenían
 *      apuesta aceptada en el equipo ganador pero no tienen transacción "Ganancia".
 *    - Si la ronda no tiene ganador o es TABLA, se indica y no se listan jugadores.
 *
 * 5. Requisitos: .env configurado y base de datos accesible.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const path = require("path");
const dbPath = path.join(__dirname, "..", "src", "db.js");
const { betting, rounds, winners, usertransactions, users } = require(dbPath);

function parseArgs() {
  const args = process.argv.slice(2);
  let id_event = null;
  let id_round = null;
  for (const arg of args) {
    if (arg.startsWith("--id_event=")) id_event = arg.split("=")[1];
    if (arg.startsWith("--id_round=")) id_round = arg.split("=")[1];
  }
  if (!id_event && args[0] && !args[0].startsWith("--")) id_event = args[0];
  if (!id_round && args[1] && !args[1].startsWith("--")) id_round = args[1];
  return {
    id_event: id_event != null ? Number(id_event) : null,
    id_round: id_round != null ? Number(id_round) : null,
  };
}

async function run() {
  const { id_event, id_round } = parseArgs();

  if (!id_event || !id_round || isNaN(id_event) || isNaN(id_round)) {
    console.error("Uso: node scripts/get-unpaid-winnings.js <id_event> <id_round>");
    console.error("  o: node scripts/get-unpaid-winnings.js --id_event=<n> --id_round=<n>");
    console.error("Ejemplo: node scripts/get-unpaid-winnings.js 72 3966");
    process.exit(1);
  }

  const round = await rounds.findByPk(id_round);
  if (!round) {
    console.error("Ronda no encontrada:", id_round);
    process.exit(1);
  }

  const winnerRecord = round.id_winner ? await winners.findByPk(round.id_winner) : null;
  if (!winnerRecord) {
    console.log("La ronda no tiene ganador declarado.");
    process.exit(0);
  }

  const team_winner = winnerRecord.team_winner;
  if (team_winner === "draw") {
    console.log("Ronda con resultado TABLA; no aplica pago de ganancia.");
    process.exit(0);
  }

  const winningBets = await betting.findAll({
    where: { id_event, id_round, team: team_winner, status: 1 },
    order: [["id", "ASC"]],
  });

  if (winningBets.length === 0) {
    console.log("No hay apuestas aceptadas del equipo ganador.");
    process.exit(0);
  }

  const paidRows = await usertransactions.findAll({
    where: {
      id_event,
      id_round,
      type_transaction: "Ganancia",
      id_betting: winningBets.map((b) => b.id),
    },
    attributes: ["id_betting"],
    raw: true,
  });
  const paidBetIds = new Set(paidRows.filter((r) => r.id_betting != null).map((r) => r.id_betting));

  const unpaidBets = winningBets.filter((b) => !paidBetIds.has(b.id));
  if (unpaidBets.length === 0) {
    console.log("Todos los ganadores fueron pagados.");
    process.exit(0);
  }

  const userIds = [...new Set(unpaidBets.map((b) => b.id_user))];
  const userList = await users.findAll({ where: { id: userIds }, raw: true });
  const userMap = new Map(userList.map((u) => [u.id, u]));

  console.log("\n--- Jugadores sin pago de ganancia ---");
  console.log(`Evento: ${id_event}  Ronda: ${id_round}  Ganador: ${team_winner}\n`);
  let total = 0;
  unpaidBets.forEach((bet) => {
    const payout = bet.amount + bet.amount * 0.9;
    total += payout;
    const u = userMap.get(bet.id_user) || {};
    const userName = u.name || u.email || u.username || String(bet.id_user);
    console.log(`  id_betting=${bet.id}  id_user=${bet.id_user}  amount=${bet.amount}  payout_esperado=${payout.toFixed(2)}  user=${userName}`);
  });
  console.log(`\nTotal: ${unpaidBets.length} jugador(es) sin pago, $${total.toLocaleString("en-US")}\n`);

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
