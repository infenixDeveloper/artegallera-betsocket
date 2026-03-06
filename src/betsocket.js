const { Op } = require("sequelize");
const { betting, users, events, rounds, winners, usertransactions } = require("./db.js");
const { VerificationBetting, rejectPendingBetsForRound } = require("./crontab/VerificationBetting.js");
const bettingLog = require("./utils/bettingLogger.js");

let connectedUsers = 0;

/**
 * Condición para obtener apuestas a devolver en caso de TABLA (pendientes 0 y aceptadas 1).
 * Exportada para tests.
 */
function getDrawRefundWhere(eventId, roundId) {
  return {
    id_event: eventId,
    id_round: roundId,
    status: { [Op.in]: [0, 1] },
  };
}

module.exports = (io) => {
  setInterval(async () => {
    await VerificationBetting(io);
  }, 10000);

  io.on("connection", (socket) => {
    connectedUsers++;
    bettingLog.log(`[APUESTAS] Nueva conexión al socket de apuestas. Usuarios conectados: ${connectedUsers}`);
    console.log("New connection to bets socket. Connected users:", connectedUsers);

    socket.on("disconnect", () => {
      connectedUsers--;
      bettingLog.log(`[APUESTAS] Usuario desconectado. Usuarios conectados: ${connectedUsers}`);
      console.log("User disconnected from bets socket. Connected users:", connectedUsers);
    });

    socket.on('placeBet', async (data, callback) => {
      try {
        const { id_user, id_event, amount, team, id_round } = data;

        if (!id_user || !id_event || !amount || !team || !id_round) {
          if (typeof callback === "function") callback({ success: false, message: 'Faltan datos para realizar la apuesta' });
          return;
        }

        const round = await rounds.findByPk(id_round);
        if (!round) {
          if (typeof callback === "function") callback({ success: false, message: 'Ronda no encontrada.' });
          return;
        }
        if (round.is_betting_active === false) {
          bettingLog.log(`[APUESTAS] APUESTA RECHAZADA BOTONERA CERRADA | id_user=${id_user} id_round=${id_round} amount=${amount} team=${team}`);
          if (typeof callback === "function") callback({ success: false, message: 'La ronda está cerrada; no se aceptan más apuestas.' });
          return;
        }

        const user = await users.findOne({ where: { id: id_user } });

        if (!user) {
          if (typeof callback === "function") callback({ success: false, message: 'Usuario no encontrado' });
          return;
        }

        const { initial_balance } = user;
        if (initial_balance < amount) {
          if (typeof callback === "function") callback({ success: false, message: 'Saldo insuficiente' });
          return;
        }

        const newBet = await betting.create({
          id_user,
          id_event,
          amount,
          team,
          id_round,
          status: 0
        });

        await users.update(
          { initial_balance: initial_balance - amount },
          { where: { id: id_user } }
        );

        const roundRow = await rounds.findByPk(id_round);
        await usertransactions.create({
          id_user,
          id_event,
          id_round,
          round: roundRow ? roundRow.round : null,
          type_transaction: 'Apostando',
          amount,
          previous_balance: initial_balance,
          current_balance: initial_balance - amount,
          team,
          description: 'Apuesta realizada',
          id_betting: newBet.id
        });

        io.emit('newBet', newBet);

        bettingLog.log(`[APUESTAS] APUESTA RECIBIDA | id_betting=${newBet.id} id_user=${id_user} id_round=${id_round} team=${team} amount=${amount}`);

        const totalAmount = await betting.sum('amount', {
          where: { id_event, team, id_round, status: 1 }
        });

        io.emit("updatedTotalAmount", { team, totalAmount });
        if (typeof callback === "function") callback({ success: true, message: 'Apuesta realizada con éxito.' });

      } catch (error) {
        console.error('Error al realizar la apuesta:', error);
        bettingLog.error(`[APUESTAS] placeBet error: ${error.message}`);
        if (typeof callback === "function") callback({ success: false, message: 'Error al realizar la apuesta.' });
      }
    });

    socket.on("getBetStats", async ({ id_event, team, id_round, onlyAccepted }, callback) => {
      try {
        if (id_event == null || id_round == null || team == null || team === "") {
          if (typeof callback === "function") {
            callback({ success: false, message: "Faltan id_event, id_round o team" });
          }
          return;
        }
        const statusFilter = onlyAccepted === true ? 1 : [0, 1];
        const totalAmount = await betting.sum("amount", {
          where: {
            id_round, id_event, team, status: statusFilter
          },
        });
        if (typeof callback === "function") {
          callback({ success: true, totalAmount: totalAmount });
        }
      } catch (error) {
        bettingLog.error(`[APUESTAS] getBetStats error: ${error.message}`);
        console.error("Error al obtener estadísticas:", error);
        if (typeof callback === "function") {
          callback({ success: false, message: "Error al obtener estadísticas" });
        }
      }
    });

    socket.on("Statusbetting", async ({ id, amount, status }, callback) => {
      // try {
      //   const bet = await betting.findByPk(id);
      //   if (bet) {
      //     await bet.update({ amount, status });
      //     // io.emit("Statusbetting", { success: true, data: bet, message: "Apuesta actualizada con éxito" });
      //     callback({ success: true, data: bet, message: "Apuesta actualizada con éxito" });
      //   } else {
      //     // io.emit("Statusbetting", { success: false, message: "Apuesta no encontrada" });
      //     callback({ success: false, message: "Apuesta no encontrada" });
      //   }
      // } catch (error) {
      //   console.error("Error al actualizar la apuesta:", error);
      //   // io.emit("Statusbetting", { success: false, message: "Error al actualizar la apuesta" });
      //   callback({ success: false, message: "Error al actualizar la apuesta" });
      // }
    })

    socket.on("createRound", async ({ id_event }, callback) => {
      try {
        const lastRound = await rounds.findOne({
          order: [["id", "DESC"]],
          where: { id_event },
          limit: 1
        })

        const newRound = await rounds.create({
          Total_amount: 0,
          id_event,
          round: lastRound ? lastRound.round + 1 : 1,
          is_betting_active: false
        })

        callback({ success: true, data: newRound, message: "Ronda Creada con éxito" });
        io.emit("newRound", { success: true, data: newRound, message: "Ronda Creada con éxito" })

      } catch (error) {
        console.error(error);
        callback({
          success: false,
          message: "Error al crear la ronde",
          error: error
        });
      }
    })

    socket.on("getAllRoundsByEvent", async ({ id_event }, callback) => {
      try {
        if (id_event) {
          const round = await rounds.findAll({ where: { id_event } })

          if (round) {
            callback({
              success: true,
              data: round,
              message: "Rondas encontradas con éxito"
            })
          }
        }
      } catch (error) {
        console.error(error);
        callback({
          success: false,
          error,
          message: "Error al encontrar las rondas"
        })
      }
    })

    socket.on("getAllActiveRounds", async ({ id_event }, callback) => {
      try {
        if (id_event) {
          const activeRounds = await rounds.findAll({ where: { id_event, is_betting_active: true } });

          if (activeRounds) {
            callback({
              success: true,
              data: activeRounds,
              message: "Rondas activas encontradas con éxito"
            })
          }
        }
      } catch (error) {
        console.error(error);
        callback({
          success: false,
          message: "Error al encontrar las rondas activas"
        })
      }
    })

    socket.on("toggleEvent", async ({ id_event, isOpen, id_round }, callback) => {
      try {
        if (id_round) {
          const round = await rounds.findOne({
            where: {
              id: id_round,
            },
          });

          if (round) {
            if (isOpen === false) {
              bettingLog.log(`[APUESTAS] toggleEvent - Cerrando botonera id_round=${round.id} id_event=${id_event}`);
              await VerificationBetting(io);
              const [totalRojo, totalVerde] = await Promise.all([
                betting.sum('amount', { where: { id_round: round.id, team: 'red', status: 1 } }),
                betting.sum('amount', { where: { id_round: round.id, team: 'green', status: 1 } })
              ]);
              const equiv = totalRojo != null && totalVerde != null && Math.abs((totalRojo || 0) - (totalVerde || 0)) < 0.01;
              bettingLog.log(`[APUESTAS] BARRIDO CIERRE | id_round=${round.id} | aceptadas_rojo=$${(totalRojo || 0).toLocaleString('en-US')} aceptadas_verde=$${(totalVerde || 0).toLocaleString('en-US')} equivalente=${equiv ? 'Sí' : 'No'}`);
              const { rejectedCount } = await rejectPendingBetsForRound(round.id, io);
              bettingLog.log(`[APUESTAS] BARRIDO CIERRE FIN | id_round=${round.id} | rechazadas=${rejectedCount} devueltas=${rejectedCount}`);
              if (rejectedCount > 0) {
                io.emit("Statusbetting", {
                  status: "Apuestas cerradas",
                  message: `Se rechazaron ${rejectedCount} apuesta(s) pendiente(s) y se devolvió el monto.`
                });
              }
            } else {
              bettingLog.log(`[APUESTAS] BOTONERA ABIERTA | id_event=${id_event} id_round=${round.id} round=${round.round || '-'}`);
            }

            await round.update({ is_betting_active: isOpen });
            if (isOpen === false) {
              bettingLog.log(`[APUESTAS] BOTONERA CERRADA | id_event=${id_event} id_round=${round.id}`);
            }
            io.emit("isBettingActive", { success: true, data: round, message: isOpen ? "Ronda Activo" : "Ronda Inactivo" });

            const activeRounds = await rounds.findAll({ where: { id_event, is_betting_active: true } });

            if (activeRounds) {
              io.emit("getActiveRounds", { success: true, data: activeRounds, message: "Rondas activas encontradas con éxito" })
            }

            if (typeof callback === "function") {
              callback({
                success: true,
                message: isOpen ? "Ronda activa para apuestas." : "Ronda cerrada. Apuestas pendientes rechazadas y monto devuelto."
              });
            }
          } else {
            if (typeof callback === "function") {
              callback({ success: false, message: "Ronda no encontrada." });
            }
          }
        } else {
          if (typeof callback === "function") {
            callback({ success: false, message: "Evento no encontrado" });
          }
        }
      } catch (error) {
        bettingLog.error(`[APUESTAS] toggleEvent error: ${error.message}`);
        console.error("Error al procesar el evento:", error);
        if (typeof callback === "function") {
          callback({
            success: false,
            message: "Error al procesar el evento. Por favor, intente nuevamente.",
          });
        }
      }
    })

    socket.on("getRoundStatus", async ({ id_event, id }, callback) => {
      try {
        if (typeof id_event === 'undefined' || typeof id === 'undefined') {
          callback({ success: false, message: "Error al obtener getRoundStatus" });
        } else {
          const event = await events.findOne({ where: { id: id_event } });

          const round = await rounds.findAll({ where: { id, id_event } });
          callback({ success: true, data: { event, round } });

        }
      } catch (error) {
        console.error("Error al obtener estado del evento:", error);
        callback({
          success: false,
          message: "Error al obtener estado del evento.",
        });
      }
    });

    socket.on("selectWinner", async ({ id_event, id_round, team }, callback) => {
      try {
        // Normalizar IDs para evitar fallos por tipo (string vs number)
        const eventId = id_event != null ? Number(id_event) : null;
        const roundId = id_round != null ? Number(id_round) : null;

        // Obtener todas las apuestas para el evento y la ronda
        const getBets = async (condition) => betting.findAll({ where: condition, order: [['createdAt', 'ASC']] });

        // Actualizar el saldo inicial del usuario
        const updateUserBalance = async (id_user, amount) => {
          await users.increment('initial_balance', {
            by: amount,
            where: { id: id_user },
          });
        };

        bettingLog.log(`[APUESTAS] selectWinner - id_event=${eventId} id_round=${roundId} team=${team}`);

        // Procesar empate (TABLA): devolver apuestas pendientes (0) y aceptadas (1); nunca rechazadas (2)
        if (team === "draw") {
          if (eventId == null || roundId == null || isNaN(eventId) || isNaN(roundId)) {
            callback({ success: false, message: "id_event e id_round son obligatorios y deben ser válidos." });
            return;
          }

          const bets = await getBets(getDrawRefundWhere(eventId, roundId));
          const roundRow = await rounds.findByPk(roundId);

          const refundErrors = [];
          for (const bet of bets) {
            const uid = bet.id_user != null ? Number(bet.id_user) : null;
            const amt = bet.amount != null ? Number(bet.amount) : 0;
            if (uid == null || isNaN(uid) || amt <= 0) {
              refundErrors.push({ betId: bet.id, reason: "id_user o amount inválido" });
              bettingLog.log(`[APUESTAS] TABLA ERROR PAGO | id_betting=${bet.id} id_user=${uid} amount=${amt} | motivo=id_user o amount inválido`);
              continue;
            }
            try {
              const userBefore = await users.findByPk(uid);
              const previousBalance = userBefore ? userBefore.initial_balance : 0;
              await updateUserBalance(uid, amt);
              await usertransactions.create({
                id_user: uid,
                id_event: eventId,
                id_round: roundId,
                round: roundRow ? roundRow.round : null,
                type_transaction: 'Devolver',
                amount: amt,
                previous_balance: previousBalance,
                current_balance: previousBalance + amt,
                team: bet.team,
                description: 'Devolución por resultado TABLA',
                id_betting: bet.id
              });
              bettingLog.log(`[APUESTAS] TABLA DEVOLUCIÓN | id_betting=${bet.id} id_user=${uid} amount=${amt}`);
            } catch (err) {
              console.error(`Error devolviendo apuesta ${bet.id} (usuario ${uid}, monto ${amt}):`, err);
              refundErrors.push({ betId: bet.id, id_user: uid, error: err.message });
              bettingLog.log(`[APUESTAS] TABLA ERROR PAGO | id_betting=${bet.id} id_user=${uid} amount=${amt} | motivo=${err.message}`);
            }
          }

          if (refundErrors.length > 0) {
            bettingLog.warn(`[APUESTAS] Devolución TABLA: ${refundErrors.length} apuestas fallaron: ${JSON.stringify(refundErrors)}`);
            console.warn("Devolución TABLA: algunas apuestas fallaron:", refundErrors.length, refundErrors);
          }

          const redBets = bets.filter((b) => b.team === "red");
          const greenBets = bets.filter((b) => b.team === "green");
          const redTotal = redBets.reduce((sum, bet) => sum + (Number(bet.amount) || 0), 0);
          const greenTotal = greenBets.reduce((sum, bet) => sum + (Number(bet.amount) || 0), 0);

          const drawData = {
            id_event: eventId,
            id_round: roundId,
            team_winner: "draw",
            red_team_amount: redTotal,
            green_team_amount: greenTotal,
            total_amount: redTotal + greenTotal,
            earnings: 0,
          };

          const winner = await winners.create(drawData);
          await rounds.update({ id_winner: winner.id }, { where: { id: roundId } });
          await betting.update({ id_winner: winner.id }, { where: { id_event: eventId, id_round: roundId } });

          const totalUserAmount = await users.sum('initial_balance');
          await events.update({ total_amount: totalUserAmount }, { where: { id: eventId } });

          const round = await rounds.findByPk(roundId);
          const message = round ? `EL RESULTADO DE LA PELEA ${round.round} ES TABLA` : "TABLA";

          bettingLog.log(`[APUESTAS] SELECTWINNER TABLA | id_round=${roundId} | devueltas=${bets.length - refundErrors.length} errores=${refundErrors.length}`);
          io.emit("winner", { success: true, message, team: "TABLA" });

          callback({
            success: true,
            message: refundErrors.length === 0
              ? "Se ha procesado correctamente el resultado de empate y las apuestas."
              : `Empate procesado. Devoluciones aplicadas con ${refundErrors.length} advertencia(s).`,
          });

          return;
        }

        // Obtener apuestas por equipo (usar eventId/roundId normalizados)
        const redBets = await getBets({ id_event: eventId, id_round: roundId, team: "red", status: 1 });
        const greenBets = await getBets({ id_event: eventId, id_round: roundId, team: "green", status: 1 });

        // Calcular sumas totales de apuestas
        const redTotal = redBets.reduce((sum, bet) => sum + bet.amount, 0);
        const greenTotal = greenBets.reduce((sum, bet) => sum + bet.amount, 0);

        // Registrar al equipo ganador
        const winnerData = {
          id_event: eventId,
          id_round: roundId,
          team_winner: team,
          red_team_amount: redTotal,
          green_team_amount: greenTotal,
          total_amount: team === "red" ? redTotal * 2 : greenTotal * 2,
          earnings: team === "red" ? redTotal * 0.1 : greenTotal * 0.1,
        };

        const winner = await winners.create(winnerData);

        if (winner) {
          await rounds.update({ id_winner: winner.id }, { where: { id: roundId } });
          await betting.update({ id_winner: winner.id }, { where: { id_event: eventId, id_round: roundId } });
        }

        const round = await rounds.findByPk(roundId);

        // Devolver monto de apuesta + 90% a los ganadores
        const winningBets = team === "red" ? redBets : greenBets;
        const noPagados = [];
        let totalPagado = 0;
        for (const bet of winningBets) {
          const payout = bet.amount + (bet.amount * 0.9);
          try {
            const userBefore = await users.findByPk(bet.id_user);
            const previousBalance = userBefore ? userBefore.initial_balance : 0;
            await updateUserBalance(bet.id_user, payout);
            await usertransactions.create({
              id_user: bet.id_user,
              id_event: eventId,
              id_round: roundId,
              round: round ? round.round : null,
              type_transaction: 'Ganancia',
              amount: payout,
              previous_balance: previousBalance,
              current_balance: previousBalance + payout,
              team: bet.team,
              description: 'Ganancia por apuesta ganadora',
              id_betting: bet.id
            });
            await betting.update({ status: 1 }, { where: { id: bet.id } });
            totalPagado += payout;
            bettingLog.log(`[APUESTAS] GANANCIA PAGADA | id_betting=${bet.id} id_user=${bet.id_user} team=${bet.team} amount_apuesta=${bet.amount} payout=${payout}`);
          } catch (err) {
            console.error(`Error pagando ganancia apuesta ${bet.id} (usuario ${bet.id_user}):`, err);
            noPagados.push({ id_betting: bet.id, id_user: bet.id_user, amount: bet.amount, motivo: err.message });
            bettingLog.log(`[APUESTAS] GANANCIA NO PAGADA | id_betting=${bet.id} id_user=${bet.id_user} team=${bet.team} amount=${bet.amount} | motivo=${err.message}`);
          }
        }
        const totalUserAmount = await users.sum('initial_balance');
        await events.update({ total_amount: totalUserAmount }, { where: { id: eventId } });

        const message = team === "red" ? `EL GANADOR DE LA PELEA ${round.round} ES EL COLOR ROJO` : `EL GANADOR DE LA PELEA ${round.round} ES EL COLOR VERDE`;
        bettingLog.log(`[APUESTAS] SELECTWINNER | id_round=${roundId} ganador=${team} | total_ganadores=${winningBets.length} total_pagado=$${totalPagado.toLocaleString('en-US')} no_pagados=${noPagados.length}${noPagados.length ? ' ' + JSON.stringify(noPagados) : ''}`);
        io.emit("winner", { success: true, message, team: team === "draw" ? "TABLA" : team === "red" ? "ROJO" : "VERDE" });

        callback({
          success: true,
          message: "Se ha procesado correctamente el ganador y las apuestas.",
        });

      } catch (error) {
        bettingLog.error(`[APUESTAS] selectWinner error: ${error.message}`);
        console.error(error);
        callback({
          success: false,
          message: "Error al procesar las apuestas y actualizar los saldos.",
        });
      }
    });

    socket.on("add-balance", async ({ id_user, amount }, callback) => {
      try {
        if (id_user && amount) {
          const user = await users.findOne({ where: { id: id_user } });
          const lastEvent = await events.findOne({ order: [["id", "DESC"]] });

          if (user) {
            const { initial_balance } = user;
            const { total_amount } = lastEvent;
            const newBalance = initial_balance + amount;

            await users.update(
              { initial_balance: newBalance },
              { where: { id: id_user } }
            );

            await events.update(
              { total_amount: total_amount + amount },
              { where: { id: lastEvent.id } }
            );

            await usertransactions.create({
              id_user,
              id_event: lastEvent.id,
              type_transaction: 'Recarga',
              amount,
              previous_balance: initial_balance,
              current_balance: newBalance,
              description: 'Recarga de saldo'
            });

            callback({ success: true, message: "Saldo actualizado correctamente." });
            io.emit("new-balance", { success: true, message: "Saldo actualizado correctamente." });
          } else {
            callback({ success: false, message: "Usuario no encontrado." });
          }
        } else {
          callback({ success: false, message: "Faltan datos para actualizar el saldo." });
        }
      } catch (error) {
        console.error(error);
        callback({ success: false, message: "Error al actualizar el saldo." });
      }
    });

    socket.on("withdraw-balance", async ({ id_user, amount }, callback) => {
      try {
        if (id_user && amount) {
          const user = await users.findOne({ where: { id: id_user } });
          const lastEvent = await events.findOne({ order: [["id", "DESC"]] });

          if (user) {
            const { initial_balance } = user;
            const { total_amount } = lastEvent;

            if (initial_balance < amount) {
              return callback({ success: false, message: "Saldo insuficiente." });
            }

            const newBalance = initial_balance - amount;

            await users.update(
              { initial_balance: newBalance },
              { where: { id: id_user } }
            );

            await events.update(
              { total_amount: total_amount - amount },
              { where: { id: lastEvent.id } }
            );

            await usertransactions.create({
              id_user,
              id_event: lastEvent.id,
              type_transaction: 'Retiro',
              amount,
              previous_balance: initial_balance,
              current_balance: newBalance,
              description: 'Retiro de saldo'
            });

            callback({ success: true, message: "Saldo actualizado correctamente." });
            io.emit("new-balance", { success: true, message: "Saldo actualizado correctamente." });
          } else {
            callback({ success: false, message: "Usuario no encontrado." });
          }
        } else {
          callback({ success: false, message: "Faltan datos para actualizar el saldo." });
        }
      } catch (error) {
        console.error(error);
        callback({ success: false, message: "Error al actualizar el saldo." });
      }
    });

    // Evento para obtener el valor del contador de usuarios conectados
    socket.on('getConnectedUsers', (callback) => {
      callback({ connectedUsers });
    });

    socket.on("user-amount", async ({ id_user, id_round }, callback) => {
      try {
        const bets = await betting.findAll({ where: { id_user, id_round, status: 1 } });

        const totalRed = bets.filter((bet) => bet.team === "red").reduce((sum, bet) => sum + bet.amount, 0);
        const totalGreen = bets.filter((bet) => bet.team === "green").reduce((sum, bet) => sum + bet.amount, 0);


        callback({ success: true, red: totalRed, green: totalGreen });
      } catch (error) {
        console.error("Error al obtener el monto total:", error);
        callback({ success: false, message: "Error al obtener el monto total." });
      }
    });
  });
};

module.exports.getDrawRefundWhere = getDrawRefundWhere;