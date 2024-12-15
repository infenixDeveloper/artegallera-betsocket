const { where } = require("sequelize");
const { betting, users, events, rounds, winners } = require("./db");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("New connection to bets socket");

    socket.on("disconnect", () => {
      console.log("User disconnected from bets socket");
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
          id_round
        });

        await users.update(
          { initial_balance: initial_balance - amount },
          { where: { id: id_user } }
        );

        io.emit('newBet', newBet);

        const totalAmount = await betting.sum('amount', {
          where: { id_event, team, id_round }
        });

        io.emit("updatedTotalAmount", { team, totalAmount });
        callback({ success: true, message: 'Apuesta realizada con éxito.' });

      } catch (error) {
        console.error('Error al realizar la apuesta:', error);
      }
    });

    socket.on("getBetStats", async ({ id_event, team, id_round }, callback) => {
      console.log(id_event, team, id_round);

      try {
        const totalAmount = await betting.sum("amount", {
          where: {
            id_round, id_event, team
          },
        });
        callback({ success: true, totalAmount: totalAmount || 0 });
      } catch (error) {
        console.error("Error al obtener estadísticas:", error);
        callback({ success: false, message: "Error al obtener estadísticas" });
      }
    });

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
        const event = await events.findOne({
          where: { id: id_event },
        });

        if (event) {
          const round = await rounds.findByPk(id);

          callback({
            success: true,
            data: {
              event,
              round,
            },
          });

        } else {
          callback({ success: false, message: "Evento no encontrado" });
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
      console.log(id_event, id_round, team);

      try {
        // Obtener todas las apuestas para el evento y la ronda
        const getBets = async (condition) => betting.findAll({ where: condition });

        // Actualizar el saldo inicial del usuario
        const updateUserBalance = async (id_user, amount) => {
          await users.increment('initial_balance', {
            by: amount,
            where: { id: id_user },
          });
        };

        // Procesar empate
        if (team === "draw") {
          const bets = await getBets({ id_event, id_round });

          for (const { id_user, amount } of bets) {
            await updateUserBalance(id_user, amount);
          }

          return callback({
            success: true,
            message: "Empate procesado correctamente.",
          });
        }

        // Obtener apuestas del equipo ganador
        const bets = await getBets({ id_event, id_round, team });
        if (bets.length === 0) {
          return callback({
            success: false,
            message: "No hay apuestas que coincidan con el ganador seleccionado.",
          });
        }

        // Calcular apuestas totales y por equipo
        const [redBets, greenBets, totalAmount] = await Promise.all([
          betting.sum('amount', { where: { id_event, id_round, team: "red" } }),
          betting.sum('amount', { where: { id_event, id_round, team: "green" } }),
          betting.sum('amount', { where: { id_event, id_round } }),
        ]);

        // Registrar al equipo ganador
        await winners.create({
          id_event,
          id_round,
          team_winner: team,
          red_team_amount: redBets,
          green_team_amount: greenBets,
          total_amount: totalAmount,
          earnings: totalAmount * 0.05,
        });

        // Procesar retornos para las apuestas ganadoras
        for (const { id_user, amount } of bets) {
          const totalReturn = amount * 1.9; // 100% de la apuesta + 90% de ganancia
          await updateUserBalance(id_user, totalReturn);
        }

        // Emitir y devolver resultado
        const message = team === "red" ? "GANADOR EQUIPO ROJO" : "GANADOR EQUIPO VERDE";
        io.emit("winner", { success: true, message });

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

  });
};

