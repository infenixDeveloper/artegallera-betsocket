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

// const evaluateBets = async (round, io) => {
//     console.log(`Evaluando apuestas para la ronda ID: ${round.id}`);

//     // Obtener todas las apuestas pendientes de ambos equipos
//     let redBets = await betting.findAll({
//         where: {
//             id_round: round.id,
//             team: 'red',
//             status: 0, // Solo pendientes
//         },
//         order: [['createdAt', 'ASC']], // Ordenar por fecha de creación
//     });

//     let greenBets = await betting.findAll({
//         where: {
//             id_round: round.id,
//             team: 'green',
//             status: 0, // Solo pendientes
//         },
//         order: [['createdAt', 'ASC']], // Ordenar por fecha de creación
//     });

//     // Evaluar todas las apuestas pendientes
//     while (redBets.length > 0 && greenBets.length > 0) {
//         const redBet = redBets[0];
//         const greenBet = greenBets[0];

//         if (redBet.amount === greenBet.amount) {
//             // Emparejar apuestas con el mismo monto
//             await betting.update(
//                 { status: 1 }, // Estado aceptado
//                 { where: { id: [redBet.id, greenBet.id] } } // Actualizar ambas apuestas
//             );

//             // Emitir evento indicando el emparejamiento
//             io.emit('Statusbetting', {
//                 status: 'accepted',
//                 bets: [redBet, greenBet],
//                 message: `Apuestas emparejadas: Red (${redBet.amount}) y Green (${greenBet.amount}).`,
//             });

//             // Eliminar las apuestas emparejadas de las listas
//             redBets.shift();
//             greenBets.shift();
//         } else {
//             // Si los montos no coinciden, eliminar solo la apuesta más antigua
//             if (redBet.createdAt <= greenBet.createdAt) {
//                 // Emitir evento para la apuesta pendiente del equipo rojo
//                 io.emit('Statusbetting', {
//                     status: 'pending',
//                     bet: redBet,
//                     message: `Apuesta pendiente en equipo rojo: ${redBet.amount}.`,
//                 });
//                 redBets.shift(); // Eliminar la apuesta pendiente de rojo
//             } else {
//                 // Emitir evento para la apuesta pendiente del equipo verde
//                 io.emit('Statusbetting', {
//                     status: 'pending',
//                     bet: greenBet,
//                     message: `Apuesta pendiente en equipo verde: ${greenBet.amount}.`,
//                 });
//                 greenBets.shift(); // Eliminar la apuesta pendiente de verde
//             }
//         }
//     }

//     // Procesar apuestas que quedan pendientes después de evaluar
//     for (const bet of redBets) {
//         io.emit('Statusbetting', {
//             status: 'pending',
//             bet,
//             message: `Apuesta pendiente en equipo rojo: ${bet.amount}.`,
//         });
//     }

//     for (const bet of greenBets) {
//         io.emit('Statusbetting', {
//             status: 'pending',
//             bet,
//             message: `Apuesta pendiente en equipo verde: ${bet.amount}.`,
//         });
//     }
// };
/*
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

    // Convertir las listas en mapas para una evaluación más eficiente
    let redAmounts = new Map();
    let greenAmounts = new Map();

    // Llenar los mapas con las apuestas
    for (const bet of redBets) {
        redAmounts.set(bet.amount, (redAmounts.get(bet.amount) || []).concat(bet));
    }

    for (const bet of greenBets) {
        greenAmounts.set(bet.amount, (greenAmounts.get(bet.amount) || []).concat(bet));
    }

    // Emparejar apuestas por montos
    let matchedBets = [];
    for (const [amount, redList] of redAmounts) {
        if (greenAmounts.has(amount)) {
            const greenList = greenAmounts.get(amount);

            // Emparejar mientras haya apuestas en ambos lados
            while (redList.length > 0 && greenList.length > 0) {
                const redBet = redList.shift();
                const greenBet = greenList.shift();

                matchedBets.push({ redBet, greenBet });

                // Actualizar el estado de las apuestas a aceptadas
                await betting.update(
                    { status: 1 }, // Estado aceptado
                    { where: { id: [redBet.id, greenBet.id] } }
                );

                // Emitir evento indicando el emparejamiento
                io.emit('Statusbetting', {
                    status: 'accepted',
                    bets: [redBet, greenBet],
                    message: `Apuestas emparejadas: Red (${redBet.amount}) y Green (${greenBet.amount}).`,
                });
            }

            // Actualizar el mapa de apuestas verdes si quedó alguna sin emparejar
            if (greenList.length === 0) {
                greenAmounts.delete(amount);
            } else {
                greenAmounts.set(amount, greenList);
            }
        }
    }

    // Emitir eventos para las apuestas pendientes
    const remainingRedBets = [].concat(...Array.from(redAmounts.values()));
    const remainingGreenBets = [].concat(...Array.from(greenAmounts.values()));

    for (const bet of remainingRedBets) {
        io.emit('Statusbetting', {
            status: 'pending',
            bet,
            message: `Apuesta pendiente en equipo rojo: ${bet.amount}.`,
        });
    }

    for (const bet of remainingGreenBets) {
        io.emit('Statusbetting', {
            status: 'pending',
            bet,
            message: `Apuesta pendiente en equipo verde: ${bet.amount}.`,
        });
    }

    console.log(`Evaluación completa para la ronda ID: ${round.id}`);
};*/
const yocontraelmundo = async () => {
    const smallerTeam = redBets.length < greenBets.length ? "red" : "green";
    const largerTeam = greenBets.length > redBets.length ? "green" : "red";

    const amountTotalLargerTeam = largerTeam === "green"
        ? greenBets.reduce((total, bet) => total + bet.amount, 0)
        : redBets.reduce((total, bet) => total + bet.amount, 0);

    const amountTotalSmallerTeam = smallerTeam === "green"
        ? greenBets.reduce((total, bet) => total + bet.amount, 0)
        : redBets.reduce((total, bet) => total + bet.amount, 0);

    console.log("smallerTeam:", smallerTeam);
    console.log("largerTeam:", largerTeam);

    console.log("amountTotalLargerTeam:", amountTotalLargerTeam);
    console.log("amountTotalSmallerTeam:", amountTotalSmallerTeam);

    if (team === "red") {

        for (const betR of redBets) {

        }
    } else {
        for (const betG of greenBets) {

        }
    }
}

// Función que genera todas las combinaciones de sumas de 2 o más elementos de un array
function obtenerSumasCombinadasConIds(arr) {
    const sumas = new Map(); // Usamos un Map para almacenar la suma y las IDs involucradas

    for (let i = 1; i <= arr.length; i++) { // Combinaciones de 1 o más elementos
        const generarCombinaciones = (start, combo, ids) => {
            if (combo.length === i) {
                const suma = combo.reduce((acc, val) => acc + val, 0);
                sumas.set(suma, [...(sumas.get(suma) || []), ids]);
                return;
            }

            for (let j = start; j < arr.length; j++) {
                generarCombinaciones(j + 1, [...combo, arr[j].amount], [...ids, arr[j].id]);
            }
        };

        generarCombinaciones(0, [], []);
    }

    return sumas;
}

function encontrarSumaComunConIds(array1, array2) {
    const sumasArray1 = obtenerSumasCombinadasConIds(array1);
    const sumasArray2 = obtenerSumasCombinadasConIds(array2);

    let resultado = [];

    // Buscar la suma común más alta y devolver los IDs combinados
    for (const [suma, combinaciones1] of sumasArray1.entries()) {
        if (sumasArray2.has(suma)) {
            const combinaciones2 = sumasArray2.get(suma);
            // Combinar las IDs de ambas combinaciones que logran la suma
            combinaciones1.forEach(ids1 => {
                combinaciones2.forEach(ids2 => {
                    resultado = [...ids1, ...ids2];
                });
            });
            break; // Nos quedamos con la primera coincidencia
        }
    }

    return resultado;
}

const evaluateGroupBet = async (redBets, greenBets, io) => {
    const redAmounts = redBets.map(bet => ({ amount: bet.amount, id: bet.id }));
    const greenAmounts = greenBets.map(bet => ({ amount: bet.amount, id: bet.id }));

    const resultado = encontrarSumaComunConIds(redAmounts, greenAmounts);

    if (resultado.length > 0) {
        for (const bet of resultado) {
            await betting.update({ status: 1 }, { where: { id: bet } });
        }
    }
};

// Ejemplo de uso:
// evaluateGroupBet(round, 500, 'green', io);



const evaluateBetsAmountEquels = async (round, io) => {
    console.log(`Evaluando apuestas para la ronda ID: ${round.id}`);

    // Obtener todas las apuestas pendientes de ambos equipos
    let redBets = await betting.findAll({
        where: {
            id_round: round.id,
            team: 'red',
            status: 0, // Solo pendientes
        }
    });

    let greenBets = await betting.findAll({
        where: {
            id_round: round.id,
            team: 'green',
            status: 0, // Solo pendientes
        }
    });

    // Extraer el id y amount de ambas apuestas
    let redBetsArray = redBets.map(bet => ({ id: bet.id, amount: bet.amount }));
    let greenBetsArray = greenBets.map(bet => ({ id: bet.id, amount: bet.amount }));

    // Ordenar las apuestas por amount de mayor a menor
    redBetsArray.sort((a, b) => b.amount - a.amount);
    greenBetsArray.sort((a, b) => b.amount - a.amount);

    // Recorrer las apuestas del equipo rojo y buscar en el equipo verde
    for (const redBet of redBetsArray) {
        const matchingBet = greenBetsArray.find(greenBet => greenBet.amount === redBet.amount);

        if (matchingBet) {
            console.log(`Se encontró una apuesta igual: Rojo ID ${redBet.id} (${redBet.amount}) <-> Verde ID ${matchingBet.id} (${matchingBet.amount})`);
            await updateBetStatus([redBet], 1);
            await updateBetStatus([matchingBet], 1);
            // Si deseas eliminar la apuesta verde encontrada para evitar duplicados en futuras búsquedas:
            greenBetsArray = greenBetsArray.filter(greenBet => greenBet.id !== matchingBet.id);
        }
    }

    redBets = await betting.findAll({
        where: {
            id_round: round.id,
            team: 'red',
            status: 0, // Solo pendientes
        }
    });

    greenBets = await betting.findAll({
        where: {
            id_round: round.id,
            team: 'green',
            status: 0, // Solo pendientes
        }
    });

    if (redBets.length > 0 && greenBets.length > 0) {
        await evaluateGroupBet(redBets, greenBets, io)

        redBets = await betting.findAll({
            where: {
                id_round: round.id,
                team: 'red',
                status: 0, // Solo pendientes
            }
        });

        greenBets = await betting.findAll({
            where: {
                id_round: round.id,
                team: 'green',
                status: 0, // Solo pendientes
            }
        });
        if (redBets.length > 0 && greenBets.length > 0) {
            await evaluateGroupBet(redBets, greenBets, io)
        }
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

    await evaluateBetsAmountEquels(round, io);

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
            status: [1] // Apuestas aceptadas
        }
    }) || 0;
    let greenAmount = await betting.sum("amount", {
        where: {
            id_round: round.id,
            team: "green",
            status: [1] // Apuestas aceptadas
        }
    }) || 0;


    if (redAmount === greenAmount) {
        for (const bet of teamBets) {
            await updateBetStatus([bet], 2);
            await updateUserBalance(bet.id_user, bet.amount);
        }
    }
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
            await evaluateBetsAmountEquels(round, io)
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
