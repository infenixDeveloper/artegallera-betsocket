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
    console.log(resultado);

    if (resultado.length > 0) {
        for (const betId of resultado) {
            await betting.update({ status: 1 }, { where: { id: betId } });

            const updatedRedBet = await betting.findOne({ where: { id: betId } });
            const updatedGreenBet = await betting.findOne({ where: { id: betId } });

            io.emit("Statusbetting", {
                status: "accepted",
                redBet: updatedRedBet,
                greenBet: updatedGreenBet,
                message: `Su apuesta de $${updatedRedBet.amount || updatedGreenBet.amount} se realizo con éxito`
            });
        }
    }
};

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

            const updatedRedBet = await betting.findOne({ where: { id: redBet.id } });
            const updatedGreenBet = await betting.findOne({ where: { id: matchingBet.id } });

            io.emit("Statusbetting", {
                status: "accepted",
                redBet: updatedRedBet,
                greenBet: updatedGreenBet,
                message: `Su apuesta de $${redBet.amount} se realizo con éxito`
            });
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

            io.emit("Statusbetting", {
                status: "rejected",
                redBet: bet,
                greenBet: bet,
                message: `Su apuesta de $${bet.amount} fue declinada`
            });
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

        await evaluateBetsAmountEquels(activeRounds[0], io)
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
