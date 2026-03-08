const { betting, users, events, rounds, winners, usertransactions } = require("./db.js");
const { VerificationBetting, VerificationBettingRound } = require("./crontab/VerificationBetting.js");
const bettingLog = require("./utils/bettingLogger.js");

let connectedUsers = 0;

module.exports = (io) => {
  setInterval(async () => {
    await VerificationBetting(io);
  }, 15000);

  io.on("connection", (socket) => {
    connectedUsers++;
    bettingLog.log(`[APUESTAS] Nueva conexión al socket de apuestas. Usuarios conectados: ${connectedUsers}`);

    socket.on("disconnect", () => {
      connectedUsers--;
      bettingLog.log(`[APUESTAS] Usuario desconectado. Usuarios conectados: ${connectedUsers}`);
    });

    socket.on('placeBet', async (data, callback) => {
      try {
        const { id_user, id_event, amount, team, id_round } = data;

        if (!id_user || !id_event || !amount || !team || !id_round) {
          bettingLog.log(`[APUESTAS] placeBet rechazada: faltan datos | id_user=${id_user} id_event=${id_event} id_round=${id_round} team=${team} amount=${amount}`);
          return { success: false, message: 'Faltan datos para realizar la apuesta' };
        }

        const user = await users.findOne({ where: { id: id_user } });

        if (!user) {
          bettingLog.log(`[APUESTAS] placeBet rechazada: usuario no encontrado | id_user=${id_user}`);
          return { success: false, message: 'Usuario no encontrado' };
        }

        const { initial_balance } = user;
        if (initial_balance < amount) {
          bettingLog.log(`[APUESTAS] placeBet rechazada: saldo insuficiente | id_user=${id_user} initial_balance=${initial_balance} amount=${amount}`);
          return { success: false, message: 'Saldo insuficiente' };
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

        const totalAmount = await betting.sum('amount', {
          where: { id_event, team, id_round, status: 1 }
        });

        io.emit("updatedTotalAmount", { team, totalAmount });
        bettingLog.log(`[APUESTAS] APUESTA RECIBIDA | id_betting=${newBet.id} id_user=${id_user} id_round=${id_round} team=${team} amount=${amount}`);
        callback({ success: true, message: 'Apuesta realizada con éxito.' });

      } catch (error) {
        bettingLog.error(`[APUESTAS] placeBet error: ${error.message}`);
        console.error('Error al realizar la apuesta:', error);
      }
    });

    socket.on("getBetStats", async ({ id_event, team, id_round }, callback) => {
      try {
        const totalAmount = await betting.sum("amount", {
          where: {
            id_round, id_event, team, status: [0, 1]
          },
        });
        callback({ success: true, totalAmount: totalAmount });
      } catch (error) {
        bettingLog.error(`[APUESTAS] getBetStats error: ${error.message}`);
        console.error("Error al obtener estadísticas:", error);
        callback({ success: false, message: "Error al obtener estadísticas" });
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

        bettingLog.log(`[APUESTAS] Ronda creada | id_round=${newRound.id} id_event=${id_event} round=${newRound.round}`);
        callback({ success: true, data: newRound, message: "Ronda Creada con éxito" });
        io.emit("newRound", { success: true, data: newRound, message: "Ronda Creada con éxito" })

      } catch (error) {
        bettingLog.error(`[APUESTAS] createRound error: ${error.message}`);
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
            await round.update({ is_betting_active: isOpen });
            if (isOpen) {
              bettingLog.log(`[APUESTAS] BOTONERA ABIERTA | id_event=${id_event} id_round=${round.id} round=${round.round || '-'}`);
            } else {
              bettingLog.log(`[APUESTAS] BOTONERA CERRADA | id_event=${id_event} id_round=${round.id}`);
              await VerificationBettingRound(round.id, io);
            }
            io.emit("isBettingActive", { success: true, data: round, message: isOpen ? "Ronda Activo" : "Ronda Inactivo" });

            const activeRounds = await rounds.findAll({ where: { id_event, is_betting_active: true } });

            if (activeRounds) {
              io.emit("getActiveRounds", { success: true, data: activeRounds, message: "Rondas activas encontradas con éxito" })
            }

          }
        } else {
          callback({ success: false, message: "Evento no encontrado" });
        }
      } catch (error) {
        bettingLog.error(`[APUESTAS] toggleEvent error: ${error.message}`);
        console.error("Error al procesar el evento:", error);

        callback({
          success: false,
          message: "Error al procesar el evento. Por favor, intente nuevamente.",
        });
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
        // Obtener todas las apuestas para el evento y la ronda
        const getBets = async (condition) => betting.findAll({ where: condition, order: [['createdAt', 'ASC']] });

        // Actualizar el saldo inicial del usuario
        const updateUserBalance = async (id_user, amount) => {
          await users.increment('initial_balance', {
            by: amount,
            where: { id: id_user },
          });
        };

        // Procesar empate
        if (team === "draw") {
          const bets = await getBets({ id_event, id_round, status: 1 });
          const roundRow = await rounds.findByPk(id_round);

          for (const bet of bets) {
            const userBefore = await users.findByPk(bet.id_user);
            const previousBalance = userBefore ? userBefore.initial_balance : 0;
            await updateUserBalance(bet.id_user, bet.amount);
            await usertransactions.create({
              id_user: bet.id_user,
              id_event,
              id_round,
              round: roundRow ? roundRow.round : null,
              type_transaction: 'Devolver',
              amount: bet.amount,
              previous_balance: previousBalance,
              current_balance: previousBalance + bet.amount,
              team: bet.team,
              description: 'Devolución por resultado TABLA',
              id_betting: bet.id
            });
          }

          const redBets = await getBets({ id_event, id_round, team: "red", status: 1 });
          const greenBets = await getBets({ id_event, id_round, team: "green", status: 1 });

          const redTotal = redBets.reduce((sum, bet) => sum + bet.amount, 0);
          const greenTotal = greenBets.reduce((sum, bet) => sum + bet.amount, 0);

          const drawData = {
            id_event,
            id_round,
            team_winner: "draw",
            red_team_amount: redTotal, // Puedes agregar valores simbólicos para empate
            green_team_amount: greenTotal,
            total_amount: redTotal + greenTotal,
            earnings: 0, // No hay ganancias en un empate
          };

          const winner = await winners.create(drawData); // Ajusta si usas otra tabla
          await rounds.update({ id_winner: winner.id }, { where: { id: id_round } });

          const round = await rounds.findByPk(id_round);
          const message = `EL RESULTADO DE LA PELEA ${round.round} ES TABLA`;
          bettingLog.log(`[APUESTAS] SELECTWINNER TABLA | id_round=${id_round} devueltas=${bets.length} redTotal=${redTotal} greenTotal=${greenTotal}`);

          io.emit("winner", { success: true, message, team: "TABLA" });

          callback({
            success: true,
            message: "Se ha procesado correctamente el resultado de empate y las apuestas.",
          });

          return;
        }

        // Obtener apuestas por equipo
        const redBets = await getBets({ id_event, id_round, team: "red", status: 1 });
        const greenBets = await getBets({ id_event, id_round, team: "green", status: 1 });

        // Calcular sumas totales de apuestas
        const redTotal = redBets.reduce((sum, bet) => sum + bet.amount, 0);
        const greenTotal = greenBets.reduce((sum, bet) => sum + bet.amount, 0);

        // Registrar al equipo ganador
        const winnerData = {
          id_event,
          id_round,
          team_winner: team,
          red_team_amount: redTotal,
          green_team_amount: greenTotal,
          total_amount: team === "red" ? redTotal * 2 : greenTotal * 2,
          earnings: team === "red" ? redTotal * 0.1 : greenTotal * 0.1,
        };

        const winner = await winners.create(winnerData);

        if (winner) {
          const r = await rounds.update({ id_winner: winner.id }, { where: { id: id_round } });
          console.log(id_round, r);

          await betting.update({ id_winner: winner.id }, { where: { id_event, id_round } });
        }


        const round = await rounds.findByPk(id_round);

        // Devolver monto de apuesta + 90% a los ganadores
        const winningBets = team === "red" ? redBets : greenBets;
        let totalPagado = 0;
        for (const bet of winningBets) {
          const payout = bet.amount + (bet.amount * 0.9);
          const userBefore = await users.findByPk(bet.id_user);
          const previousBalance = userBefore ? userBefore.initial_balance : 0;
          await updateUserBalance(bet.id_user, payout);
          await usertransactions.create({
            id_user: bet.id_user,
            id_event,
            id_round,
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
        }
        const totalUserAmount = await users.sum('initial_balance')
        await events.update({ total_amount: totalUserAmount }, { where: { id: id_event } })

        const message = team === "draw" ? `EL RESULTADO DE LA PELEA ${round.round} ES TABLA` : team === "red" ? `EL GANADOR DE LA PELEA ${round.round} ES EL COLOR ROJO` : `EL GANADOR DE LA PELEA ${round.round} ES EL COLOR VERDE`;
        bettingLog.log(`[APUESTAS] SELECTWINNER | id_round=${id_round} ganador=${team} total_ganadores=${winningBets.length} total_pagado=$${totalPagado.toLocaleString('en-US')}`);
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

            await users.update(
              { initial_balance: initial_balance + amount },
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
              current_balance: initial_balance + amount,
              description: 'Recarga de saldo'
            });

            bettingLog.log(`[APUESTAS] Recarga de saldo | id_user=${id_user} amount=${amount} previous_balance=${initial_balance} new_balance=${initial_balance + amount}`);
            callback({ success: true, message: "Saldo actualizado correctamente." });
            io.emit("new-balance", { success: true, message: "Saldo actualizado correctamente." });
          } else {
            callback({ success: false, message: "Usuario no encontrado." });
          }
        } else {
          callback({ success: false, message: "Faltan datos para actualizar el saldo." });
        }
      } catch (error) {
        bettingLog.error(`[APUESTAS] add-balance error: ${error.message}`);
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

            await users.update(
              { initial_balance: initial_balance - amount },
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
              current_balance: initial_balance - amount,
              description: 'Retiro de saldo'
            });

            bettingLog.log(`[APUESTAS] Retiro de saldo | id_user=${id_user} amount=${amount} previous_balance=${initial_balance} new_balance=${initial_balance - amount}`);
            callback({ success: true, message: "Saldo actualizado correctamente." });
            io.emit("new-balance", { success: true, message: "Saldo actualizado correctamente." });
          } else {
            callback({ success: false, message: "Usuario no encontrado." });
          }
        } else {
          callback({ success: false, message: "Faltan datos para actualizar el saldo." });
        }
      } catch (error) {
        bettingLog.error(`[APUESTAS] withdraw-balance error: ${error.message}`);
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
        bettingLog.error(`[APUESTAS] user-amount error: ${error.message}`);
        console.error("Error al obtener el monto total:", error);
        callback({ success: false, message: "Error al obtener el monto total." });
      }
    });
  });
};