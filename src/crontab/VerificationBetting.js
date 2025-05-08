const { betting, events, rounds, users, marriedbetting, sequelize, usertransactions } = require('../db');

const updateBetStatusBulk = async (betIds, status, transaction) => {
    try {
        await betting.update({ status }, { where: { id: betIds }, transaction });
        console.log(`Actualizadas ${betIds.length} apuestas al estado ${status}`);
    } catch (error) {
        console.error(`Error al actualizar apuestas:`, error);
        throw error;
    }
};

const updateBalances = async (bets, io, transaction) => {
    try {
        let amountTotal = 0;
        for (const bet of bets) {
            const user = await users.findOne({ where: { id: bet?.id_user }, transaction });
            const newBalance = user?.initial_balance + bet?.amount;
            const round = await rounds.findOne({ where: { id: bet?.id_round }, transaction });

            await usertransactions.create({
                id_user: bet?.id_user,
                type_transaction: 'Devolver',
                amount: bet.amount,
                previous_balance: user?.initial_balance,
                current_balance: Number(newBalance),
                description: 'Se devuelve el dinero de la apuesta rechazada.',
                round: bet?.id_round,
                id_betting: bet?.id,
                team: bet?.team,
                id_event: bet?.id_event,
                round: round?.round,
                id_round: round?.id

            })

            await users.update({ initial_balance: newBalance }, { where: { id: bet.id_user }, transaction });
            amountTotal += bet.amount;
            await updateBetStatusBulk([bet.id], 2, transaction);
            io.emit('Statusbetting', { status: "rejected", redBet: bet.team === "red" ? bet : {}, greenBet: bet.team === "green" ? bet : {}, message: `Su apuesta de $${amountTotal.toLocaleString('en-US')} fue declinada` });
        }

    } catch (error) {
        console.error(`Error al actualizar balances de usuarios:`, error);
        throw error;
    }
};

function findMatchingBets(bettors, referenceBettor, team) {
    // Filtrar apostadores del team Rojo
    let otherGroup = bettors.filter(b => b.team === team);

    // Buscar combinaciones que sumen el monto del apostador de referencia
    let targetAmount = referenceBettor.amount;
    let results = [];

    function findCombinations(index, currentSum, currentCombination) {
        if (currentSum === targetAmount) {
            results.push([...currentCombination]);
            return;
        }
        if (currentSum > targetAmount || index >= otherGroup.length) {
            return;
        }

        // Incluir el apostador actual en la combinación
        findCombinations(index + 1, currentSum + otherGroup[index].amount, [...currentCombination, otherGroup[index]]);

        // Omitir el apostador actual y probar con el siguiente
        findCombinations(index + 1, currentSum, currentCombination);
    }

    findCombinations(0, 0, []);
    return results;
}


const processMatchingBets = async (redBets, greenBets, io, transaction) => {

    // Se ordenan
    redBets.sort((a, b) => a.amount - b.amount);
    greenBets.sort((a, b) => a.amount - b.amount);

    let successMatchIds = [];

    // Se buscan las combinaciones que hagan match rojos
    for (let i = 0; i < redBets.length; i++) {
        const redBet = redBets[i];

        const matchingBets = findMatchingBets(greenBets, redBet, "green");


        if (matchingBets.length == 0) {
            continue;
        }

        const matchedGreen = matchingBets[0];



        io.emit('Statusbetting', {
            status: "accepted",
            redBet,
            greenBet: matchedGreen,
            message: `Su apuesta de $${redBet.amount.toLocaleString('en-US')} se realizó con éxito.`
        });
        for (let i = 0; i < matchedGreen.length; i++) {
            const green = matchedGreen[i];

            io.emit('Statusbetting', {
                status: "accepted",
                redBet: green,
                greenBet: [redBet],
                message: `Su apuesta de $${green.amount.toLocaleString('en-US')} se realizó con éxito.`
            });
        }

        // Guardamos la relación entre las apuestas emparejadas
        const toInsert = matchedGreen.map(bet => ({
            id_betting_one: redBet.id,
            id_betting_two: bet.id,
            id_event: redBet.id_event,
            id_round: redBet.id_round
        }));

        await marriedbetting.bulkCreate(toInsert, { transaction });

        // Guardo los que fueron exitosos
        successMatchIds.push(redBet.id, ...matchedGreen.map(bet => bet.id));
        greenBets = greenBets.filter(bet => !matchedGreen.map(bet => bet.id).includes(bet.id));
    }

    redBets = redBets.filter(bet => !successMatchIds.includes(bet.id))
    // Se buscan las combinaciones que hagan match verde


    for (let i = 0; i < greenBets.length; i++) {
        const greenBet = greenBets[i];

        const matchingBets = findMatchingBets(redBets, greenBet, "red");


        if (matchingBets.length == 0) {
            continue;
        }

        const matchedRed = matchingBets[0];



        io.emit('Statusbetting', {
            status: "accepted",
            redBet: greenBet,
            greenBet: matchedRed,
            message: `Su apuesta de $${greenBet.amount.toLocaleString('en-US')} se realizó con éxito.`
        });
        for (let i = 0; i < matchedRed.length; i++) {
            const red = matchedRed[i];

            io.emit('Statusbetting', {
                status: "accepted",
                redBet: red,
                greenBet: [greenBet],
                message: `Su apuesta de $${red.amount.toLocaleString('en-US')} se realizó con éxito.`
            });
        }

        // Guardamos la relación entre las apuestas emparejadas
        const toInsert = matchedRed.map(bet => ({
            id_betting_one: greenBet.id,
            id_betting_two: bet.id,
            id_event: greenBet.id_event,
            id_round: greenBet.id_round
        }));

        await marriedbetting.bulkCreate(toInsert, { transaction });

        // Guardo los que fueron exitosos
        successMatchIds.push(greenBet.id, ...matchedRed.map(bet => bet.id));
        redBets = redBets.filter(bet => !matchedRed.map(bet => bet.id).includes(bet.id));
    }

    if (successMatchIds.length > 0) {
        await updateBetStatusBulk(successMatchIds, 1, transaction);
    }
}

const evaluateBetsAmountEquels = async (round, io, transaction) => {
    console.log(`Evaluando apuestas para la ronda ID: ${round.id}`);
    try {
        const betsAll = await betting.findAll({
            where: { id_round: round.id, status: 0 },
            transaction
        });
        const redBets = betsAll.filter((bet) => bet.team === 'red')
        const greenBets = betsAll.filter((bet) => bet.team === 'green')



        if (redBets.length && greenBets.length) {

            await processMatchingBets(redBets, greenBets, io, transaction);

        }

    } catch (error) {
        console.error(`Error evaluando apuestas para la ronda ID: ${round.id}`, error);
        throw error; // Propaga el error para manejarlo en el nivel principal.
    }
};



// const matchHighestBet2 = async (highestBet, io, transaction) => {
//     try {
//         const oppositeTeam = highestBet.team === 'red' ? 'green' : 'red';

//         const oppositeBets = await betting.findAll({
//             where: { id_round: highestBet.id_round, team: oppositeTeam, status: 0 },
//             transaction,
//             order: [['amount', 'DESC']] // Ordena de mayor a menor
//         });

//         let remainingAmount = highestBet.amount;
//         const matchedBets = [];
//         const matchedBet = [];
//         for (const bet of oppositeBets) {
//             if (remainingAmount <= 0) break;

//             if (bet.amount <= remainingAmount) {
//                 matchedBets.push(bet.id);
//                 matchedBet.push(bet);
//                 remainingAmount -= bet.amount;
//             }
//         }

//         if (remainingAmount === 0) {
//             await updateBetStatusBulk([highestBet.id], 1, transaction);
//             io.emit('Statusbetting', { status: "accepted", redBet: highestBet.team === "red" ? highestBet : {}, greenBet: highestBet.team === "green" ? highestBet : {}, message: `Su apuesta de $${highestBet.amount.toLocaleString('en-US')} se realizo con éxito` });

//             await updateBetStatusBulk(matchedBets, 1, transaction);
//             for (const bet of matchedBet) {
//                 await marriedbetting.create({ id_betting_one: highestBet.id, id_betting_two: bet.id, id_event: highestBet.id_event, id_round: highestBet.id_round }, { transaction });
//                 io.emit('Statusbetting', { status: "accepted", redBet: bet.team === "red" ? bet : {}, greenBet: bet.team === "green" ? bet : {}, message: `Su apuesta de $${bet.amount.toLocaleString('en-US')} se realizo con éxito` });

//             }
//         } else {
//             await updateBetStatusBulk([highestBet.id], 2, transaction);
//             await updateBalances([highestBet], io, transaction)
//         }
//     } catch (error) {
//         console.error("Error en matchHighestBet:", error);
//         throw error; // Propaga el error.
//     }
// };


// const findHighestRemainingBet = async (round, transaction) => {
//     // Buscar las apuestas restantes con status 0
//     const remainingBets = await betting.findAll({
//         where: { id_round: round.id, status: 0 },
//         transaction
//     });

//     if (remainingBets.length === 0) return null;

//     // Obtener la apuesta con el monto más alto de las apuestas restantes
//     const highestBet = remainingBets.reduce((maxBet, bet) => bet.amount > maxBet.amount ? bet : maxBet, remainingBets[0]);
//     return highestBet;
// };

// exports.VerificationBetting = async (io) => {
//     try {
//         const transaction = await sequelize.transaction();
//         const activeEvent = await events.findOne({ where: { is_active: true } });
//         if (!activeEvent) {
//             io.emit('Statusbetting', { status: "No hay eventos activos" });
//             console.log("No hay eventos activos");
//             await transaction.rollback();
//             return;
//         }
//         const roundsList = await rounds.findAll({ where: { is_betting_active: true, id_event: activeEvent.id } });

//         if (!roundsList.length) {
//             io.emit('Statusbetting', { status: "No hay rondas activas" });
//             console.log("No hay rondas activas");
//             await transaction.rollback();
//             return;
//         }

//         for (let i = 0; i < roundsList.length; i++) {
//             const round = roundsList[i]
//             await evaluateBetsAmountEquels(round, io, transaction);
//         }

//         // const activeRounds = await rounds.findAll({ where: { id_event: activeEvent.id, id: id_round?.id } });
//         await transaction.commit();
//         io.emit('Statusbetting', { status: "Verificación completada con éxito" });
//     } catch (error) {
//         console.error("Error en la verificación de apuestas:", error);
//         await transaction.rollback();
//     }
// };
exports.VerificationBetting = async (io) => {
    const transaction = await sequelize.transaction();
    
    try {
        const { id } = await events.findOne({ where: { is_active: true } });
        console.log(307);

        if (!id) {
            io.emit('Statusbetting', { status: "No hay eventos activos" });
            console.log("No hay eventos activos");
            return await transaction.rollback();  // Sale temprano sin hacer rollback aquí
        }
        console.log(314, id);

        const roundsList = await rounds.findAll({
            where: { is_betting_active: true, id_event: id }
        });
        console.log(315);

        if (!roundsList.length) {
            io.emit('Statusbetting', { status: "No hay rondas activas" });
            console.log("No hay rondas activas");
            return await transaction.rollback();  // Sale temprano sin hacer rollback aquí
        }
        console.log(326);


        for (let i = 0; i < roundsList.length; i++) {
            const round = roundsList[i];
            await evaluateBetsAmountEquels(round, io, transaction)
        }

        await transaction.commit();
        io.emit('Statusbetting', { status: "Verificación completada con éxito" });
    } catch (error) {
        console.error("Error en la verificación de apuestas:", error);
        await transaction.rollback();
        // io.emit('Statusbetting', { status: "Error en la verificación de apuestas" });  // Informar del error al cliente
    }
};



const VerificationBettingRound = async (id_round, io) => {
    try {
        const transaction = await sequelize.transaction();
        const activeEvent = await events.findOne({ where: { is_active: true } });

        if (!activeEvent) {
            io.emit('Statusbetting', { status: "No hay eventos activos" });
            console.log("No hay eventos activos");
            await transaction.rollback();
            return;
        }

        const activeRounds = await rounds.findAll({ where: { id_event: activeEvent.id, id: id_round } });

        if (!activeRounds.length) {
            io.emit('Statusbetting', { status: "No hay rondas activas" });
            console.log("No hay rondas activas");
            await transaction.rollback();
            return;
        }


        for (const round of activeRounds) {
            // Evaluar apuestas iguales
            await evaluateBetsAmountEquels(round, io, transaction);

            const remainingBets = await betting.findAll({
                where: { id_round: round.id, status: 0 },
                transaction
            });

            await updateBalances(remainingBets, io, transaction)
        }

        await transaction.commit();
        io.emit('Statusbetting', { status: "Verificación completada con éxito" });
    } catch (error) {
        console.error("Error en la verificación de apuestas:", error);
        await transaction.rollback();
    }
};

exports.VerificationBettingRound = VerificationBettingRound;