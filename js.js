







// socket.on("selectWinner", async ({ id_event, id_round, team }, callback) => {

//     try {
//         const has_wiiner = await winners.findOne({ where: { id_event, id_round } })
//         if (has_wiiner) {
//             return callback({
//                 success: true,
//                 message: "Esta ronda ya tiene un ganador",
//             });
//         }
//         // Obtener todas las apuestas para el evento y la ronda
//         const getBets = async (condition) => betting.findAll({ where: condition, order: [['createdAt', 'ASC']] });

//         // Actualizar el saldo inicial del usuario y actualizar el estado
//         const updateUserBalanceAndStatus2 = async ({ id_user, amount, id_round, id_betting }) => {
//             const user = await users.findByPk(id_user)
//             const round = await rounds.findByPk(id_round)
//             const newBalance = parseInt(initial_balance + amount)
//             if (user) return;
//             await users.increment('initial_balance', {
//                 by: amount,
//                 where: { id: id_user },
//             });
//             // Actualiza el status
//             await betting.update(
//                 { status: 2 },
//                 {
//                     where: { id_user, id_event: round.id_event, id_round },
//                     transaction: t,
//                 }
//             );

//             await usertransactions.create({
//                 id_user,
//                 type_transaction: 'Devolver',
//                 amount: amount,
//                 previous_balance: user?.initial_balance,
//                 current_balance: newBalance,
//                 description: 'Resultado en empate devolviendo dinero de apuestas con estado 1 y 0',
//                 round: round?.round,
//                 id_betting: id_betting
//             })


//         };
//         // Actualizar el saldo inicial del usuario
//         const updateUserBalance = async (bet, round) => {
//             const user = await users.findByPk(bet.id_user)
//             const payout = bet.amount + (bet.amount * 0.9);
//             if (user) return;
//             console.log("antes de la ganacia ", payout, user.username);


//             await usertransactions.create({
//                 id_user: bet.id_user,
//                 id_event: bet.id_event,
//                 type_transaction: 'Ganacia',
//                 amount: bet.amount,
//                 team: bet.team,
//                 id_betting: bet.id,
//                 previous_balance: user?.initial_balance,
//                 current_balance: Number(payout),
//                 description: 'Se le deposita al cliente su base + 90% de su base',
//                 round: round.round,

//             })

//             await users.increment('initial_balance', {
//                 by: amount,
//                 where: { id: id_user },
//             });
//         };

//         const betsStatus0And1 = await getBets({
//             where: {
//                 id_event,
//                 id_round,
//                 status: { [Op.in]: [0, 1] } // Filtra status 0 o 1
//             }
//         });
//         const bestStatus0 = betsStatus0And1.filter((bet) => bet.status === 0)
//         for (const { id_user, amount, id_round, id } of bestStatus0) {
//             await updateUserBalanceAndStatus2({ id_user, amount, id_round, id_betting: id }); // Solo se devuelve el monto inicial
//         }

//         // Procesar empate
//         if (team === "draw") {
//             // const bets = await getBets({ id_event, id_round, status: 1 });
//             const bestStatus1 = betsStatus0And1.filter((bet) => bet.status === 1)

//             for (const { id_user, amount, id_round, id } of bestStatus1) {
//                 await updateUserBalanceAndStatus2({ id_user, amount, id_round, id_betting: id }); // Solo se devuelve el monto inicial
//             }

//             const redBets = await getBets({ id_event, id_round, team: "red", status: 1 });
//             const greenBets = await getBets({ id_event, id_round, team: "green", status: 1 });

//             const redTotal = redBets.reduce((sum, bet) => sum + bet.amount, 0);
//             const greenTotal = greenBets.reduce((sum, bet) => sum + bet.amount, 0);

//             const drawData = {
//                 id_event,
//                 id_round,
//                 team_winner: "draw",
//                 red_team_amount: redTotal, // Puedes agregar valores simbólicos para empate
//                 green_team_amount: greenTotal,
//                 total_amount: redTotal + greenTotal,
//                 earnings: 0, // No hay ganancias en un empate
//             };

//             const winner = await winners.create(drawData); // Ajusta si usas otra tabla
//             await rounds.update({ id_winner: winner.id }, { where: { id: id_round } });

//             const round = await rounds.findByPk(id_round);
//             const message = `EL RESULTADO DE LA PELEA ${round.round} ES TABLA`;

//             io.emit("winner", { success: true, message, team: "TABLA" });

//             callback({
//                 success: true,
//                 message: "Se ha procesado correctamente el resultado de empate y las apuestas.",
//             });

//             return;
//         }

//         // Obtener apuestas por equipo
//         const redBets = await getBets({ id_event, id_round, team: "red", status: 1 });
//         const greenBets = await getBets({ id_event, id_round, team: "green", status: 1 });

//         // Calcular sumas totales de apuestas
//         const redTotal = redBets.reduce((sum, bet) => sum + bet.amount, 0);
//         const greenTotal = greenBets.reduce((sum, bet) => sum + bet.amount, 0);

//         // Registrar al equipo ganador
//         const winnerData = {
//             id_event,
//             id_round,
//             team_winner: team,
//             red_team_amount: redTotal,
//             green_team_amount: greenTotal,
//             total_amount: team === "red" ? redTotal * 2 : greenTotal * 2,
//             earnings: team === "red" ? redTotal * 0.1 : greenTotal * 0.1,
//         };

//         const winner = await winners.create(winnerData);

//         if (winner) {
//             const r = await rounds.update({ id_winner: winner.id }, { where: { id: id_round } });
//             console.log(id_round, r);

//             await betting.update({ id_winner: winner.id }, { where: { id_event, id_round } });
//         }


//         const round = await rounds.findByPk(id_round);

//         // Devolver monto de apuesta + 90% a los ganadores
//         const winningBets = team === "red" ? redBets : greenBets;
//         for (const bet of winningBets) {

//             await updateUserBalance(bet, round);
//             await betting.update({ status: 1 }, { where: { id: bet.id } });
//         }
//         const totalUserAmount = await users.sum('initial_balance')
//         await events.update({ total_amount: totalUserAmount }, { where: { id: id_event } })

//         // Emitir y devolver resultado
//         const message = team === "draw" ? `EL RESULTADO DE LA PELEA ${round.round} ES TABLA` : team === "red" ? `EL GANADOR DE LA PELEA ${round.round} ES EL COLOR ROJO` : `EL GANADOR DE LA PELEA ${round.round} ES EL COLOR VERDE`;
//         io.emit("winner", { success: true, message, team: team === "draw" ? "TABLA" : team === "red" ? "ROJO" : "VERDE" });

//         callback({
//             success: true,
//             message: "Se ha procesado correctamente el ganador y las apuestas.",
//         });

//     } catch (error) {
//         console.error(error);
//         callback({
//             success: false,
//             message: "Error al procesar las apuestas y actualizar los saldos.",
//         });
//     }
// });