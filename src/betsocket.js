const { betting, users, events, rounds, winners } = require("./db.js");
const { VerificationBetting, VerificationBettingRound } = require("./crontab/VerificationBetting.js");

let connectedUsers = 0;

module.exports = (io) => {
  setInterval(async () => {
    await VerificationBetting(io);
  }, 20000);

  io.on("connection", (socket) => {
    connectedUsers++;
    console.log("New connection to bets socket. Connected users:", connectedUsers);

    socket.on("disconnect", () => {
      connectedUsers--;
      console.log("User disconnected from bets socket. Connected users:", connectedUsers);
    });

    socket.on('placeBet', async (data, callback) => {
      try {
        const { id_user, id_event, amount, team, id_round } = data;

        if (!id_user || !id_event || !amount || !team || !id_round) {
          return { success: false, message: 'Faltan datos para realizar la apuesta' };
        }

        const user = await users.findOne({ where: { id: id_user } });

        if (!user) {
          return { success: false, message: 'Usuario no encontrado' };
        }

        const { initial_balance } = user;
        if (initial_balance < amount) {
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

        io.emit('newBet', newBet);

        const totalAmount = await betting.sum('amount', {
          where: { id_event, team, id_round, status: 1 }
        });

        io.emit("updatedTotalAmount", { team, totalAmount });
        callback({ success: true, message: 'Apuesta realizada con éxito.' });

      } catch (error) {
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
        console.error("Error al obtener estadísticas:", error);
        callback({ success: false, message: "Error al obtener estadísticas" });
      }
    });

    socket.on("Statusbetting", async ({ id, amount, status }, callback) => {
      try {
        const bet = await betting.findByPk(id);
        if (bet) {
          await bet.update({ amount, status });
          // io.emit("Statusbetting", { success: true, data: bet, message: "Apuesta actualizada con éxito" });
          callback({ success: true, data: bet, message: "Apuesta actualizada con éxito" });
        } else {
          // io.emit("Statusbetting", { success: false, message: "Apuesta no encontrada" });
          callback({ success: false, message: "Apuesta no encontrada" });
        }
      } catch (error) {
        console.error("Error al actualizar la apuesta:", error);
        // io.emit("Statusbetting", { success: false, message: "Error al actualizar la apuesta" });
        callback({ success: false, message: "Error al actualizar la apuesta" });
      }
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
            await round.update({ is_betting_active: isOpen });
            io.emit("isBettingActive", { success: true, data: round, message: isOpen ? "Ronda Activo" : "Ronda Inactivo" });

            const activeRounds = await rounds.findAll({ where: { id_event, is_betting_active: true } });

            if (activeRounds) {
              io.emit("getActiveRounds", { success: true, data: activeRounds, message: "Rondas activas encontradas con éxito" })
            }

            if (isOpen === false) {
              await VerificationBettingRound(round.id, io);
            }

          }
        } else {
          callback({ success: false, message: "Evento no encontrado" });
        }
      } catch (error) {
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

          const round = await rounds.findAll({ where: { id_event } });
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

          for (const { id_user, amount } of bets) {
            await updateUserBalance(id_user, amount); // Solo se devuelve el monto inicial
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
        for (const bet of winningBets) {
          const payout = bet.amount + (bet.amount * 0.9);
          await updateUserBalance(bet.id_user, payout);
          await betting.update({ status: 1 }, { where: { id: bet.id } });
        }
        const totalUserAmount = await users.sum('initial_balance')
        await events.update({ total_amount: totalUserAmount }, { where: { id: id_event } })

        // Emitir y devolver resultado
        const message = team === "draw" ? `EL RESULTADO DE LA PELEA ${round.round} ES TABLA` : team === "red" ? `EL GANADOR DE LA PELEA ${round.round} ES EL COLOR ROJO` : `EL GANADOR DE LA PELEA ${round.round} ES EL COLOR VERDE`;
        io.emit("winner", { success: true, message, team: team === "draw" ? "TABLA" : team === "red" ? "ROJO" : "VERDE" });

        callback({
          success: true,
          message: "Se ha procesado correctamente el ganador y las apuestas.",
        });

      } catch (error) {
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

            await users.update(
              { initial_balance: initial_balance - amount },
              { where: { id: id_user } }
            );

            await events.update(
              { total_amount: total_amount - amount },
              { where: { id: lastEvent.id } }
            );

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