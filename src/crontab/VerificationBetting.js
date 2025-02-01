const { betting, events, rounds, users, marriedbetting, sequelize } = require('../db');

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
            const user = await users.findOne({ where: { id: bet.id_user }, transaction });
            const newBalance = user.initial_balance + bet.amount;

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

const processMatchingBets = async (redBets, greenBets, io, transaction) => {
    const matchedRedBets = [];
    const matchedGreenBets = [];

    for (const redBet of redBets) {
        const matchingBet = greenBets.find(greenBet => greenBet.amount === redBet.amount);

        if (matchingBet) {
            matchedRedBets.push(redBet.id);
            matchedGreenBets.push(matchingBet.id);
            greenBets = greenBets.filter(greenBet => greenBet.id !== matchingBet.id);
            io.emit('Statusbetting', { status: "accepted", redBet, greenBet: matchingBet, message: `Su apuesta de $${redBet.amount.toLocaleString('en-US')} se realizo con éxito` });
            await marriedbetting.create({ id_betting_one: redBet.id, id_betting_two: matchingBet.id, id_event: redBet.id_event, id_round: redBet.id_round }, { transaction });
        }
    }

    await updateBetStatusBulk(matchedRedBets, 1, transaction);
    await updateBetStatusBulk(matchedGreenBets, 1, transaction);
};

const evaluateBetsAmountEquels = async (round, io, transaction) => {
    console.log(`Evaluando apuestas para la ronda ID: ${round.id}`);
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
            await processMatchingBets(redBets, greenBets, io, transaction);
        }
    } catch (error) {
        console.error(`Error evaluando apuestas para la ronda ID: ${round.id}`, error);
        throw error; // Propaga el error para manejarlo en el nivel principal.
    }
};

const matchHighestBet = async (highestBet, io, transaction) => {
    try {
        const oppositeTeam = highestBet.team === 'red' ? 'green' : 'red';

        const oppositeBets = await betting.findAll({
            where: { id_round: highestBet.id_round, team: oppositeTeam, status: 0 },
            transaction
        });

        let remainingAmount = highestBet.amount;
        const matchedBets = [];
        const matchedBet = [];
        for (const bet of oppositeBets) {
            if (remainingAmount <= 0) break;

            if (bet.amount <= remainingAmount) {
                matchedBets.push(bet.id);
                matchedBet.push(bet);
                remainingAmount -= bet.amount;
            }
        }

        if (remainingAmount === 0) {
            await updateBetStatusBulk([highestBet.id], 1, transaction);
            io.emit('Statusbetting', { status: "accepted", redBet: highestBet.team === "red" ? highestBet : {}, greenBet: highestBet.team === "green" ? highestBet : {}, message: `Su apuesta de $${highestBet.amount.toLocaleString('en-US')} se realizo con éxito` });

            await updateBetStatusBulk(matchedBets, 1, transaction);
            for (const bet of matchedBet) {
                await marriedbetting.create({ id_betting_one: highestBet.id, id_betting_two: bet.id, id_event: highestBet.id_event, id_round: highestBet.id_round }, { transaction });
                io.emit('Statusbetting', { status: "accepted", redBet: bet.team === "red" ? bet : {}, greenBet: bet.team === "green" ? bet : {}, message: `Su apuesta de $${bet.amount.toLocaleString('en-US')} se realizo con éxito` });

            }
        } else {
            await updateBetStatusBulk([highestBet.id], 0, transaction);
        }
    } catch (error) {
        console.error("Error en matchHighestBet:", error);
        throw error; // Propaga el error.
    }
};

const matchHighestBet2 = async (highestBet, io, transaction) => {
    try {
        const oppositeTeam = highestBet.team === 'red' ? 'green' : 'red';

        const oppositeBets = await betting.findAll({
            where: { id_round: highestBet.id_round, team: oppositeTeam, status: 0 },
            transaction
        });

        let remainingAmount = highestBet.amount;
        const matchedBets = [];
        const matchedBet = [];
        for (const bet of oppositeBets) {
            if (remainingAmount <= 0) break;

            if (bet.amount <= remainingAmount) {
                matchedBets.push(bet.id);
                matchedBet.push(bet);
                remainingAmount -= bet.amount;
            }
        }

        if (remainingAmount === 0) {
            await updateBetStatusBulk([highestBet.id], 1, transaction);
            io.emit('Statusbetting', { status: "accepted", redBet: highestBet.team === "red" ? highestBet : {}, greenBet: highestBet.team === "green" ? highestBet : {}, message: `Su apuesta de $${highestBet.amount.toLocaleString('en-US')} se realizo con éxito` });

            await updateBetStatusBulk(matchedBets, 1, transaction);
            for (const bet of matchedBet) {
                await marriedbetting.create({ id_betting_one: highestBet.id, id_betting_two: bet.id, id_event: highestBet.id_event, id_round: highestBet.id_round }, { transaction });
                io.emit('Statusbetting', { status: "accepted", redBet: bet.team === "red" ? bet : {}, greenBet: bet.team === "green" ? bet : {}, message: `Su apuesta de $${bet.amount.toLocaleString('en-US')} se realizo con éxito` });

            }
        } else {
            await updateBetStatusBulk([highestBet.id], 2, transaction);
            await updateBalances([highestBet], io, transaction)
        }
    } catch (error) {
        console.error("Error en matchHighestBet:", error);
        throw error; // Propaga el error.
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

exports.VerificationBetting = async (io) => {
    try {
        const id_round = await rounds.findOne({ where: { is_betting_active: true } });
        if (id_round) {
            const transaction = await sequelize.transaction();
            const activeEvent = await events.findOne({ where: { is_active: true } });

            if (!activeEvent) {
                io.emit('Statusbetting', { status: "No hay eventos activos" });
                console.log("No hay eventos activos");
                await transaction.rollback();
                return;
            }

            const activeRounds = await rounds.findAll({ where: { id_event: activeEvent.id, id: id_round?.id } });

            if (!activeRounds.length) {
                io.emit('Statusbetting', { status: "No hay rondas activas" });
                console.log("No hay rondas activas");
                await transaction.rollback();
                return;
            }

            for (const round of activeRounds) {
                // Procesar las apuestas restantes
                let remainingBets = await betting.findAll({
                    where: { id_round: round.id, status: 0 },
                    transaction
                });

                for (let index = 0; index < remainingBets.length; index++) {
                    const highestAmount = await findHighestRemainingBet(round, transaction);
                    if (highestAmount) {
                        await matchHighestBet(highestAmount, io, transaction);
                    }
                }

                remainingBets = await betting.findAll({
                    where: { id_round: round.id, status: 0 },
                    transaction
                });

                // Evaluar apuestas iguales
                await evaluateBetsAmountEquels(round, io, transaction);

                // await updateBalances(remainingBets, io, transaction)

            }

            await transaction.commit();
            io.emit('Statusbetting', { status: "Verificación completada con éxito" });
        }
    } catch (error) {
        console.error("Error en la verificación de apuestas:", error);
        await transaction.rollback();
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

        // let redBetsAmount = await betting.sum("amount", { where: { id_round, team: "red" } });
        // let greenBetsAmount = await betting.sum("amount", { where: { id_round, team: "green" } });

        // if (redBetsAmount === greenBetsAmount) {

        //     let remainingBets = await betting.findAll({
        //         where: { id_round, status: [0, 1] },
        //         transaction
        //     });

        //     for (const bet of remainingBets) {
        //         await updateBetStatusBulk([bet.id], 1, transaction);
        //         io.emit('Statusbetting', { status: "accepted", redBet: bet, greenBet: bet, message: `Su apuesta de $${bet.amount.toLocaleString('en-US')} se realizo con éxito` });
        //     }
        // }

        for (const round of activeRounds) {

            // Evaluar apuestas iguales

            // Procesar las apuestas restantes
            let remainingBets = await betting.findAll({
                where: { id_round: round.id, status: 0 },
                transaction
            });

            for (let index = 0; index < remainingBets.length; index++) {
                const highestAmount = await findHighestRemainingBet(round, transaction);
                if (highestAmount) {
                    await matchHighestBet2(highestAmount, io, transaction);
                }
            }

            remainingBets = await betting.findAll({
                where: { id_round: round.id, status: 0 },
                transaction
            });

            // Evaluar apuestas iguales
            await evaluateBetsAmountEquels(round, io, transaction);


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