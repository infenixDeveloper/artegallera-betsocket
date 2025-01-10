// var cron = require('node-cron');
const { betting, events, rounds, users } = require('../db');

const updateBetStatus = async (bets, status) => {
    for (const bet of bets) {
        console.log(`Actualizando apuesta ID: ${bet.id} a estado: ${status}`);
        await betting.update({ status }, { where: { id: bet.id } });
    }
};

const updateUserBalance = async (user, amount) => {
    const userData = await users.findOne({ where: { id: user } });
    const newBalance = userData.initial_balance + amount;
    console.log(`Devolviendo saldo al usuario ID: ${user}. Saldo anterior: ${userData.initial_balance}, Nuevo saldo: ${newBalance}`);
    await users.update(
        { initial_balance: newBalance },
        { where: { id: user } }
    );
};

// const evaluateBets = async (round, bet, io) => {

//     const oppositeTeam = bet.team === 'red' ? 'green' : 'red';

//     // Obtener todas las apuestas de ambos equipos (estatus 0 y 1)
//     const teamBets = await betting.findAll({
//         where: {
//             id_round: round.id,
//             team: bet.team,
//             status: [0, 1] // Apuestas del equipo actual
//         }
//     });

//     const oppositeBets = await betting.findAll({
//         where: {
//             id_round: round.id,
//             team: oppositeTeam,
//             status: [0, 1] // Apuestas del equipo contrario
//         }
//     });

//     // Calcular el monto total de los pozos de ambos equipos
//     const totalTeamAmount = teamBets.reduce((sum, bet) => sum + bet.amount, 0);
//     const totalOppositeAmount = oppositeBets.reduce((sum, bet) => sum + bet.amount, 0);

//     // Verificar si la apuesta desnivela aún más los pozos
//     if (totalTeamAmount > totalOppositeAmount && (totalTeamAmount + bet.amount) > totalOppositeAmount) {
//         // Rechazar la apuesta
//         //await updateBetStatus([bet], 2); // Rechazada
//         //await updateUserBalance(bet.id_user, bet.amount); // Devolver dinero

//         // Emitir la información de la apuesta rechazada
//         io.emit('Statusbetting', {
//             status: 'rejected',
//             bet,
//             message: 'La apuesta fue rechazada porque desbalancea el pozo total.'
//         });

//         return;
//     }

//     // Condición 1: Usuario vs. Usuario
//     const exactMatch = oppositeBets.find(oppositeBet => oppositeBet.amount === bet.amount && oppositeBet.status === 0);
//     if (exactMatch) {
//         await updateBetStatus([bet, exactMatch], 1); // Marcar ambas apuestas como aceptadas

//         // Emitir la información de las apuestas aceptadas
//         io.emit('Statusbetting', {
//             status: 'accepted',
//             bets: [bet, exactMatch],
//             message: 'Apuesta aceptada contra otro jugador.'
//         });

//         return;
//     }

//     // Condición 2: Usuario vs. Grupo
//     let groupMatch = [];
//     let totalAmount = 0;
//     for (const oppositeBet of oppositeBets.filter(b => b.status === 0)) {
//         if (totalAmount + oppositeBet.amount <= bet.amount) {
//             groupMatch.push(oppositeBet);
//             totalAmount += oppositeBet.amount;
//         }
//         if (totalAmount === bet.amount) {
//             await updateBetStatus([bet, ...groupMatch], 1); // Marcar apuestas como aceptadas

//             // Emitir la información de las apuestas aceptadas
//             io.emit('Statusbetting', {
//                 status: 'accepted',
//                 bets: [bet, ...groupMatch],
//                 message: 'Apuesta aceptada contra un grupo de jugadores.'
//             });

//             return;
//         }
//     }

//     // Condición 3: Usuario vs. Pozo
//     if (totalOppositeAmount >= bet.amount) {
//         let selectedBets = [];
//         let accumulatedAmount = 0;

//         for (const oppositeBet of oppositeBets) {
//             selectedBets.push(oppositeBet);
//             accumulatedAmount += oppositeBet.amount;

//             if (accumulatedAmount >= bet.amount) {
//                 break;
//             }
//         }

//         if (accumulatedAmount >= bet.amount) {
//             await updateBetStatus([bet, ...selectedBets], 1); // Marcar apuestas como aceptadas

//             // Emitir la información de las apuestas aceptadas
//             io.emit('Statusbetting', {
//                 status: 'accepted',
//                 bets: [bet, ...selectedBets],
//                 message: 'Apuesta aceptada contra el pozo total.'
//             });

//             return;
//         }
//     }

//     // Si ninguna condición se cumple, rechazar la apuesta
//     //await updateBetStatus([bet], 2); // Rechazada
//     //await updateUserBalance(bet.id_user, bet.amount); // Devolver dinero

//     // Emitir la información de la apuesta rechazada
//     io.emit('Statusbetting', {
//         status: 'rejected',
//         bet,
//         message: 'La apuesta fue rechazada porque no cumplió ninguna condición.'
//     });
// };



// const evaluateBets = async (round, io) => {
//     const oppositeTeam = bet.team === 'red' ? 'green' : 'red';

//     // Obtener todas las apuestas del equipo actual y contrario
//     const teamBets = await betting.findAll({
//         where: {
//             id_round: round.id,
//             team: bet.team,
//             status: 0,
//         },
//     });

//     const oppositePendingBets = await betting.findAll({
//         where: {
//             id_round: round.id,
//             team: oppositeTeam,
//             status: 0, // Solo apuestas pendientes
//         },
//     });

//     // Calcular los pozos sumando apuestas aceptadas y pendientes
//     // const teamPot = teamBets.reduce((sum, currentBet) => sum + currentBet.amount, 0);
//     // const oppositeTeamPot = oppositeTeamBets.reduce((sum, currentBet) => sum + currentBet.amount, 0);

//     // Intentar emparejar la nueva apuesta con alguna pendiente del equipo contrario
//     const matchingBet = await betting.findOne({
//         where: {
//             id_round: round.id,
//             team: oppositeTeam,
//             amount: bet.amount, // Coincidencia exacta del monto
//             status: 0, // Solo apuestas pendientes
//         },
//         order: [['createdAt', 'ASC']], // Tomar la apuesta más antigua
//     });

//     if (matchingBet) {
//         // Cambiar el estado de ambas apuestas a "aceptadas"
//         await betting.update(
//             { status: 1 }, // Estado aceptado
//             { where: { id: [bet.id, matchingBet.id] } } // Actualizar ambas apuestas
//         );

//         // Emitir evento indicando que las apuestas fueron emparejadas y aceptadas
//         io.emit('Statusbetting', {
//             status: 'accepted',
//             bets: [bet, matchingBet],
//             message: 'Apuestas iguales emparejadas y aceptadas.',
//         });

//         return; // Finalizar el proceso para esta apuesta
//     }
//     // // Verificar si el pozo contrario puede cubrir la apuesta actual

//     // // if (teamPot + bet.amount <= oppositeTeamPot) {

//     // //     // Aceptar la apuesta porque no desbalancea el pozo
//     // //     await updateBetStatus([bet], 1);

//     // //     io.emit('Statusbetting', {
//     // //         status: 'accepted',
//     // //         bet,
//     // //         message: 'Apuesta aceptada porque el pozo contrario puede cubrirla.'
//     // //     });

//     // //     return; // Finalizar el proceso para esta apuesta
//     // // }

//     // // Si no se cumplen las condiciones, dejar la apuesta en estado pendiente
//     io.emit('Statusbetting', {
//         status: 'pending',
//         bet,
//         message: 'Apuesta pendiente. No hay emparejamiento ni suficiente pozo contrario para cubrirla.'
//     });
// };

const evaluateBets = async (round, io) => {
    console.log(`Evaluando apuestas para la ronda ID: ${round.id}`);

    // Obtener todas las apuestas pendientes de ambos equipos
    let redBets = await betting.findAll({
        where: {
            id_round: round.id,
            team: 'red',
            status: 0, // Solo pendientes
        },
        order: [['createdAt', 'ASC']], // Ordenar por fecha de creación
    });

    let greenBets = await betting.findAll({
        where: {
            id_round: round.id,
            team: 'green',
            status: 0, // Solo pendientes
        },
        order: [['createdAt', 'ASC']], // Ordenar por fecha de creación
    });

    // Evaluar todas las apuestas pendientes
    while (redBets.length > 0 && greenBets.length > 0) {
        const redBet = redBets[0];
        const greenBet = greenBets[0];

        if (redBet.amount === greenBet.amount) {
            // Emparejar apuestas con el mismo monto
            await betting.update(
                { status: 1 }, // Estado aceptado
                { where: { id: [redBet.id, greenBet.id] } } // Actualizar ambas apuestas
            );

            // Emitir evento indicando el emparejamiento
            io.emit('Statusbetting', {
                status: 'accepted',
                bets: [redBet, greenBet],
                message: `Apuestas emparejadas: Red (${redBet.amount}) y Green (${greenBet.amount}).`,
            });

            // Eliminar las apuestas emparejadas de las listas
            redBets.shift();
            greenBets.shift();
        } else {
            // Si los montos no coinciden, eliminar solo la apuesta más antigua
            if (redBet.createdAt <= greenBet.createdAt) {
                // Emitir evento para la apuesta pendiente del equipo rojo
                io.emit('Statusbetting', {
                    status: 'pending',
                    bet: redBet,
                    message: `Apuesta pendiente en equipo rojo: ${redBet.amount}.`,
                });
                redBets.shift(); // Eliminar la apuesta pendiente de rojo
            } else {
                // Emitir evento para la apuesta pendiente del equipo verde
                io.emit('Statusbetting', {
                    status: 'pending',
                    bet: greenBet,
                    message: `Apuesta pendiente en equipo verde: ${greenBet.amount}.`,
                });
                greenBets.shift(); // Eliminar la apuesta pendiente de verde
            }
        }
    }

    // Procesar apuestas que quedan pendientes después de evaluar
    for (const bet of redBets) {
        io.emit('Statusbetting', {
            status: 'pending',
            bet,
            message: `Apuesta pendiente en equipo rojo: ${bet.amount}.`,
        });
    }

    for (const bet of greenBets) {
        io.emit('Statusbetting', {
            status: 'pending',
            bet,
            message: `Apuesta pendiente en equipo verde: ${bet.amount}.`,
        });
    }
};




const processBetsRound = async (round, io) => {
    console.log(`Procesando apuestas para la ronda ID: ${round.id}`);
    const bets = await betting.findAll({ where: { id_round: round.id, status: 0 } });

    // Ordenar las apuestas por monto (descendente) para priorizar apuestas grandes
    // const sortedBets = bets.sort((a, b) => b.amount - a.amount);

    await evaluateBetsRound(round, io);

};

// const processRoundBets = async (round, io) => {
//     console.log(`Procesando apuestas para la ronda ID: ${round.id}`);
//     // const bets = await betting.findAll({ where: { id_round: round.id, status: 0 } });

//     // Ordenar las apuestas por monto (descendente) para priorizar apuestas grandes
//     // const sortedBets = bets.sort((a, b) => b.amount - a.amount);


//     await evaluateBets(round, io);

// };

const evaluateBetsRound = async (round, io) => {
    // Obtener todas las apuestas de la ronda actual con status 0 (en proceso)
    const teamBets = await betting.findAll({
        where: {
            id_round: round.id,
            status: 0// Apuestas pendientes
        }
    });

    // Obtener el monto acumulado para el equipo RED con status 1 (ya aceptadas)
    let redAmount = await betting.sum("amount", {
        where: {
            id_round: round.id,
            team: "red",
            status: [0, 1] // Apuestas aceptadas
        }
    }) || 0;

    // Obtener el monto acumulado para el equipo GREEN con status 1 (ya aceptadas)
    let greenAmount = await betting.sum("amount", {
        where: {
            id_round: round.id,
            team: "green",
            status: [0, 1] // Apuestas aceptadas
        }
    }) || 0;

    let redAmount1 = await betting.sum("amount", {
        where: {
            id_round: round.id,
            team: "red",
            status: 1 // Apuestas aceptadas
        }
    }) || 0;

    // Obtener el monto acumulado para el equipo GREEN con status 0 (ya aceptadas)
    let greenAmount1 = await betting.sum("amount", {
        where: {
            id_round: round.id,
            team: "green",
            status: 1 // Apuestas aceptadas
        }
    }) || 0;

    // Calcular las apuestas en proceso (status: 0) por equipo
    const redBets = teamBets.sort((a, b) => a.amount - b.amount).filter(bet => bet.team === "red");
    const greenBets = teamBets.sort((a, b) => a.amount - b.amount).filter(bet => bet.team === "green");

    // Determinar cuál es el equipo con menor monto acumulado
    const smallerTeam = redAmount < greenAmount ? "red" : "green";
    const largerTeam = redAmount > greenAmount ? "red" : "green";
    const smallerTeam1 = redAmount1 < greenAmount1 ? "red" : "green";

    let smallerTeamBets = smallerTeam === "red" ? redBets : greenBets;
    let largerTeamAmount = smallerTeam === "red" ? greenAmount : redAmount;
    let smallerTeamAmount = smallerTeam === "red" ? redAmount : greenAmount;
    let largerTeamAmount1 = smallerTeam === "red" ? greenAmount1 : redAmount1;

    // Calcular la diferencia entre los montos acumulados
    let remainingAmount = largerTeamAmount1;

    // Evaluar apuestas en proceso del equipo con menor monto
    if (smallerTeamBets.length > 0) {
        for (const bet of smallerTeamBets) {
            await updateBetStatus([bet], 1); // Marcar apuesta como aceptada
        }
    }

    // Evaluar apuestas en proceso del equipo contrario si hay monto restante
    let remainingOppositeBets = smallerTeam === "red" ? greenBets : redBets;

    if (remainingOppositeBets.length > 0) {
        for (const bet of remainingOppositeBets) {
            console.log(remainingAmount, largerTeamAmount1, bet.amount);

            if (remainingAmount === smallerTeamAmount) {
                break;
            }

            if ((remainingAmount + bet.amount) < smallerTeamAmount) {
                await updateBetStatus([bet], 1); // Aceptar apuesta
                remainingAmount += bet.amount
            } else {
                remainingAmount = (remainingAmount + bet.amount) - smallerTeamAmount;

                const difference = bet.amount > remainingAmount ? bet.amount - remainingAmount : remainingAmount - bet.amount;
                console.log("---", remainingAmount, difference);

                if (difference === 0) {
                    await updateBetStatus([bet], 1); // Aceptar apuesta completamente
                } else if (difference > 0) {
                    console.log(difference, remainingAmount);

                    //busca una apuesta que tenga el monto igual al que falta
                    const matchingBet = await betting.findOne({
                        where: {
                            id_round: round.id,
                            team: largerTeam,
                            amount: difference,
                            status: [0,1],
                        }
                    });

                    if (matchingBet) {
                        await updateBetStatus([bet, matchingBet], 2); // Aceptar ambas apuestas
                    }else{
                        const bettingLargerTeam= await betting.findAll({
                            where: {
                                id_round: round.id,
                                team: largerTeam,
                                status: 1,
                            }
                        })
                        let aux = 0;
                        let auxId = [];
                        for(const bets1 of bettingLargerTeam){
                            if(aux < difference){
                                if(bets1.amount < difference){
                                    aux += bets1.amount;
                                    auxId.push(bets1);
                                }
                            }else if(aux === difference){
                                for(const bt of auxId){
                                    await updateBetStatus([bt], 2); // Aceptar ambas apuestas
                                }
                                break;
                            }else{
                                await updateBetStatus([bet], 2);
                            }
                        }
                    }

                    //await betting.update({ amount: difference, status: 1 }, { where: { id: bet.id } });
                    //await updateUserBalance(bet.id_user, remainingAmount); // Devolver la diferencia
                    io.emit('Statusbetting', {
                        status: 'partially_accepted',
                        bet,
                        acceptedAmount: remainingAmount,
                        returnedAmount: difference,
                        message: 'Apuesta parcialmente aceptada para igualar el pozo contrario.'
                    });
                }

                remainingAmount = 0;
                break;
            }
        }
    } else {
        // No hay apuestas en proceso para el equipo contrario
        console.log(`No hay apuestas pendientes para el equipo contrario (${smallerTeam === "red" ? "green" : "red"})`);
    }

    // Rechazar apuestas no procesadas
    const remainingUnprocessedBets = await betting.findAll({
        where: {
            id_round: round.id,
            status: 0 // Apuestas pendientes
        }
    });

    for (const remainingBet of remainingUnprocessedBets) {
        await updateBetStatus([remainingBet], 2); // Rechazar apuesta
        await updateUserBalance(remainingBet.id_user, remainingBet.amount); // Devolver dinero
    }

    // Emitir evento al finalizar el procesamiento
    io.emit('Statusbetting', {
        status: 'processed',
        message: `Apuestas del equipo ${smallerTeam} procesadas y aceptadas hasta igualar el monto del equipo ${largerTeam}.`
    });
};

exports.VerificationBetting = async (io) => {
    try {
        const activeEvent = await events.findOne({ where: { is_active: true } });

        if (!activeEvent) {
            io.emit('Statusbetting', { id: 0, amount: 0, status: "No hay eventos activos" });
            console.log("No hay eventos activos");
            return;
        }

        const activeRounds = await rounds.findAll({ where: { id_event: activeEvent.id, is_betting_active: true } });

        if (!activeRounds.length) {
            io.emit('Statusbetting', { id: 0, amount: 0, status: "No hay rondas activas" });
            console.log("No hay rondas activas");
            return;
        }

        for (const round of activeRounds) {
            await evaluateBets(round, io);
        }
    } catch (error) {
        console.error('Error in VerificationBetting:', error);
    }
};

exports.VerificationBettingRound = async (io) => {
    try {
        const activeEvent = await events.findOne({ where: { is_active: true } });

        if (!activeEvent) {
            io.emit('Statusbetting', { id: 0, amount: 0, status: "No hay eventos activos" });
            console.log("No hay eventos activos");
            return;
        }

        const activeRounds = await rounds.findAll({ where: { id_event: activeEvent.id, is_betting_active: true } });

        if (!activeRounds.length) {
            io.emit('Statusbetting', { id: 0, amount: 0, status: "No hay rondas activas" });
            console.log("No hay rondas activas");
            return;
        }

        for (const round of activeRounds) {
            await processBetsRound(round, io);
        }
    } catch (error) {
        console.error('Error in VerificationBetting:', error);
    }
}
