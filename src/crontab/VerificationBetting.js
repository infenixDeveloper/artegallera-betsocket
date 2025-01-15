const { betting, events, rounds, users, sequelize } = require('../db');

const updateBetStatusBulk = async (betIds, status, transaction) => {
    try {
        await betting.update({ status }, { where: { id: betIds }, transaction });
        console.log(`Actualizadas ${betIds.length} apuestas al estado ${status}`);
    } catch (error) {
        console.error(`Error al actualizar apuestas:`, error);
        throw error;
    }
};

const updateBalances = async (bets, transaction) => {
    try {
        const updates = bets.map(async (bet) => {
            const user = await users.findOne({ where: { id: bet.id_user }, transaction });
            const newBalance = user.initial_balance + bet.amount;
            await users.update({ initial_balance: newBalance }, { where: { id: bet.id_user }, transaction });
        });
        await Promise.all(updates);
    } catch (error) {
        console.error(`Error al actualizar balances de usuarios:`, error);
        throw error;
    }
};

const processMatchingBets = async (redBets, greenBets, transaction) => {
    const matchedRedBets = [];
    const matchedGreenBets = [];

    for (const redBet of redBets) {
        const matchingBet = greenBets.find(greenBet => greenBet.amount === redBet.amount);

        if (matchingBet) {
            matchedRedBets.push(redBet.id);
            matchedGreenBets.push(matchingBet.id);
            greenBets = greenBets.filter(greenBet => greenBet.id !== matchingBet.id);
        }
    }

    await updateBetStatusBulk(matchedRedBets, 1, transaction);
    await updateBetStatusBulk(matchedGreenBets, 1, transaction);
};

const evaluateBetsAmountEquels = async (round, io) => {
    console.log(`Evaluando apuestas para la ronda ID: ${round.id}`);

    const transaction = await sequelize.transaction();
    try {
        const redBets = await betting.findAll({
            where: { id_round: round.id, team: 'red', status: 0 },
            transaction
        });

        const greenBets = await betting.findAll({
            where: { id_round: round.id, team: 'green', status: 0 },
            transaction
        });

        if (redBets.length && greenBets.length) {
            await processMatchingBets(redBets, greenBets, transaction);
        }

        const remainingBets = await betting.findAll({
            where: { id_round: round.id, status: 0 },
            transaction
        });

        for (let index = 0; index < remainingBets.length; index++) {
            const highestAmount = await findHighestRemainingBet(round, transaction);
            await matchHighestBet(highestAmount, transaction)
        }

        await transaction.commit();

        io.emit("Statusbetting", {
            status: "evaluated",
            message: "Apuestas evaluadas con éxito."
        });
    } catch (error) {
        console.error(`Error evaluando apuestas para la ronda ID: ${round.id}`, error);
        await transaction.rollback();
    }
};

const findHighestRemainingBet = async (round, transaction) => {
    // Buscar las apuestas restantes con status 0
    const remainingBets = await betting.findAll({
        where: { id_round: round.id, status: 0 },
        transaction
    });

    if (remainingBets.length === 0) return null;

    // Obtener la apuesta con el monto más alto de las apuestas restantes
    const highestBet = remainingBets.reduce((maxBet, bet) => bet.amount > maxBet.amount ? bet : maxBet, remainingBets[0]);
    return highestBet;
};

const matchHighestBet = async (highestBet, transaction) => {
    const oppositeTeam = highestBet.team === 'red' ? 'green' : 'red';

    const oppositeBets = await betting.findAll({
        where: { id_round: highestBet.id_round, team: oppositeTeam, status: 0 },
        transaction
    });

    let remainingAmount = highestBet.amount;
    const matchedBets = [];

    for (const bet of oppositeBets) {
        if (remainingAmount <= 0) break;
        console.log(bet.amount, "=", remainingAmount);

        if (bet.amount <= remainingAmount) {
            matchedBets.push(bet.id);
            remainingAmount -= bet.amount;
        }
    }

    if (remainingAmount === 0) {
        await updateBetStatusBulk([highestBet.id], 1, transaction);
        await updateBetStatusBulk(matchedBets, 1, transaction);
    }
};



exports.VerificationBetting = async (io) => {
    try {
        const activeEvent = await events.findOne({ where: { is_active: true } });

        if (!activeEvent) {
            io.emit('Statusbetting', { status: "No hay eventos activos" });
            console.log("No hay eventos activos");
            return;
        }

        const activeRounds = await rounds.findAll({ where: { id_event: activeEvent.id, is_betting_active: true } });

        if (!activeRounds.length) {
            io.emit('Statusbetting', { status: "No hay rondas activas" });
            console.log("No hay rondas activas");
            return;
        }

        for (const round of activeRounds) {
            await evaluateBetsAmountEquels(round, io);
        }
    } catch (error) {
        console.error("Error en la verificación de apuestas:", error);
    }
};
