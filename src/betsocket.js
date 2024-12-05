const { betting, users, events, rounds } = require("./db");

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
          where: { id_event, team }
        });

        io.emit("updatedTotalAmount", { team, totalAmount });
        callback({ success: true, message: 'Apuesta realizada con éxito.' });

      } catch (error) {
        console.error('Error al realizar la apuesta:', error);
      }
    });

    socket.on("getBetStats", async ({ id_event, team }, callback) => {
      try {
        const totalAmount = await betting.sum("amount", {
          where: { id_event, team },
        });
        callback({ success: true, totalAmount: totalAmount || 0 });
      } catch (error) {
        console.error("Error al obtener estadísticas:", error);
        callback({ success: false, message: "Error al obtener estadísticas" });
      }
    });

    socket.on("toggleEvent", async ({ id_event, isOpen, id_round }, callback) => {
      try {
        const event = await events.findOne({
          where: { id: id_event },
        });

        if (event) {
          await event.update({ is_betting_active: isOpen });

          io.emit("isBettingActive", { success: true, data: event, message: isOpen ? "Evento Activo" : "Evento Inactivo" });

          if (event.is_betting_active) {
            const newRound = await rounds.create({
              Total_amount: 0,
              id_event,
            })
            io.emit("newRound", { success: true, data: newRound, message: "Nueva Ronda Creada" })
          } else {
            const lastRound = await rounds.findOne({
              order: [["id", "DESC"]],
              limit: 1
            })

            const totalAmount = await betting.sum('amount', {
              where: { id_event, id_round }
            });

            await lastRound.update({ Total_amount: totalAmount }, { where: { id: lastRound.id } })

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
    });

    socket.on("getEventStatus", async ({ id_event }, callback) => {
      try {
        const event = await events.findOne({
          where: { id: id_event },
        });

        if (event) {
          const round = await rounds.findOne({
            where: { id_event },
            order: [["id", "DESC"]],
            limit: 1,
          });

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
      try {
        if (team === "red") {
          io.emit("winner", { success: true, message: "GANADOR EQUIPO ROJO" })
        } else if (team === "green") {
          io.emit("winner", { success: true, message: "GANADOR EQUIPO VERDE" })
        }
      } catch (error) {
        console.error(error);
        callback({
          success: false,
          message: "Error al selecionar el ganador",
        });
      }
    })
  });

};

