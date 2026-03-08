const { betting, events, rounds, users, marriedbetting, usertransactions, sequelize } = require('../db');
const bettingLog = require('../utils/bettingLogger.js');

/**
 * Actualiza el estado de varias apuestas en lote.
 * Estados: 0 pendiente, 1 aceptada, 2 rechazada.
 */
const updateBetStatusBulk = async (betIds, status, transaction) => {
    try {
        await betting.update({ status }, { where: { id: betIds }, transaction });
        bettingLog.log(`[APUESTAS] VerificationBetting - actualizadas ${betIds.length} apuestas al estado ${status} (ids: ${betIds.join(', ')})`);
        console.log(`Actualizadas ${betIds.length} apuestas al estado ${status}`);
    } catch (error) {
        bettingLog.error(`[APUESTAS] VerificationBetting - updateBetStatusBulk error: ${error.message}`);
        console.error(`Error al actualizar apuestas:`, error);
        throw error;
    }
};

/**
 * Restaura el saldo de usuarios cuyas apuestas fueron rechazadas (sin emparejar) y las marca como status 2.
 */
const updateBalances = async (bets, io, transaction) => {
    try {
        let amountTotal = 0;
        for (const bet of bets) {
            const user = await users.findOne({ where: { id: bet.id_user }, transaction });
            const previousBalance = user.initial_balance;
            const newBalance = previousBalance + bet.amount;

            await users.update({ initial_balance: newBalance }, { where: { id: bet.id_user }, transaction });
            amountTotal += bet.amount;
            await updateBetStatusBulk([bet.id], 2, transaction);

            const roundRow = await rounds.findByPk(bet.id_round, { transaction });
            await usertransactions.create({
                id_user: bet.id_user,
                id_event: bet.id_event,
                id_round: bet.id_round,
                round: roundRow ? roundRow.round : null,
                type_transaction: 'Devolver',
                amount: bet.amount,
                previous_balance: previousBalance,
                current_balance: newBalance,
                team: bet.team,
                description: 'Devolución por apuesta rechazada (sin emparejar)',
                id_betting: bet.id
            }, { transaction });

            bettingLog.log(`[APUESTAS] VerificationBetting - apuesta rechazada y devolución | id_betting=${bet.id} id_user=${bet.id_user} id_round=${bet.id_round} team=${bet.team} amount=$${bet.amount.toLocaleString('en-US')}`);
            io.emit('Statusbetting', { status: "rejected", redBet: bet.team === "red" ? bet : {}, greenBet: bet.team === "green" ? bet : {}, message: `Su apuesta de $${amountTotal.toLocaleString('en-US')} fue declinada` });
        }

    } catch (error) {
        bettingLog.error(`[APUESTAS] VerificationBetting - updateBalances error: ${error.message}`);
        console.error(`Error al actualizar balances de usuarios:`, error);
        throw error;
    }
};

/**
 * Empareja apuestas rojas y verdes con el mismo monto (coincidencia exacta) y crea marriedbetting.
 */
const processMatchingBets = async (redBets, greenBets, io, transaction) => {
    const matchedRedBets = [];
    const matchedGreenBets = [];

    for (const redBet of redBets) {
        const matchingBet = greenBets.find(greenBet => greenBet.amount === redBet.amount);

        if (matchingBet) {
            matchedRedBets.push(redBet.id);
            matchedGreenBets.push(matchingBet.id);
            greenBets = greenBets.filter(greenBet => greenBet.id !== matchingBet.id);
            bettingLog.log(`[APUESTAS] VerificationBetting - emparejamiento exacto | id_red=${redBet.id} id_green=${matchingBet.id} id_round=${redBet.id_round} amount=$${redBet.amount.toLocaleString('en-US')}`);
            io.emit('Statusbetting', { status: "accepted", redBet, greenBet: matchingBet, message: `Su apuesta de $${redBet.amount.toLocaleString('en-US')} se realizo con éxito` });
            await marriedbetting.create({ id_betting_one: redBet.id, id_betting_two: matchingBet.id, id_event: redBet.id_event, id_round: redBet.id_round }, { transaction });
        }
    }

    await updateBetStatusBulk(matchedRedBets, 1, transaction);
    await updateBetStatusBulk(matchedGreenBets, 1, transaction);
};

/**
 * Evalúa apuestas pendientes de la ronda y empareja las que tienen monto exacto igual (rojo/verde).
 */
const evaluateBetsAmountEquels = async (round, io, transaction) => {
    bettingLog.log(`[APUESTAS] VerificationBetting - evaluando montos iguales ronda id_round=${round.id}`);
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
        bettingLog.error(`[APUESTAS] VerificationBetting - evaluateBetsAmountEquels id_round=${round.id} error: ${error.message}`);
        console.error(`Error evaluando apuestas para la ronda ID: ${round.id}`, error);
        throw error; // Propaga el error para manejarlo en el nivel principal.
    }
};

/**
 * Intenta emparejar la apuesta de mayor monto con apuestas del equipo contrario (suma de montos).
 * Si cubre el monto total, acepta todas; si no, deja la apuesta en pendiente (0).
 */
const matchHighestBet = async (highestBet, io, transaction) => {
    try {
        const oppositeTeam = highestBet.team === 'red' ? 'green' : 'red';

        const oppositeBets = await betting.findAll({
            where: { id_round: highestBet.id_round, team: oppositeTeam, status: 0 },
            transaction,
            order: [['amount', 'DESC']] // Ordena de mayor a menor
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
            bettingLog.log(`[APUESTAS] VerificationBetting - apuesta grande emparejada (matchHighestBet) | id_betting=${highestBet.id} id_round=${highestBet.id_round} team=${highestBet.team} amount=$${highestBet.amount.toLocaleString('en-US')} pares=${matchedBet.length}`);
            io.emit('Statusbetting', { status: "accepted", redBet: highestBet.team === "red" ? highestBet : {}, greenBet: highestBet.team === "green" ? highestBet : {}, message: `Su apuesta de $${highestBet.amount.toLocaleString('en-US')} se realizo con éxito` });

            await updateBetStatusBulk(matchedBets, 1, transaction);
            for (const bet of matchedBet) {
                await marriedbetting.create({ id_betting_one: highestBet.id, id_betting_two: bet.id, id_event: highestBet.id_event, id_round: highestBet.id_round }, { transaction });
                io.emit('Statusbetting', { status: "accepted", redBet: bet.team === "red" ? bet : {}, greenBet: bet.team === "green" ? bet : {}, message: `Su apuesta de $${bet.amount.toLocaleString('en-US')} se realizo con éxito` });

            }
        } else {
            await updateBetStatusBulk([highestBet.id], 0, transaction);
            bettingLog.log(`[APUESTAS] VerificationBetting - apuesta grande sin emparejar (queda pendiente) | id_betting=${highestBet.id} id_round=${highestBet.id_round} amount=$${highestBet.amount.toLocaleString('en-US')}`);
        }
    } catch (error) {
        bettingLog.error(`[APUESTAS] VerificationBetting - matchHighestBet error: ${error.message}`);
        console.error("Error en matchHighestBet:", error);
        throw error; // Propaga el error.
    }
};

/**
 * Igual que matchHighestBet pero si no se cubre el monto, rechaza la apuesta (2) y devuelve el saldo al usuario.
 */
const matchHighestBet2 = async (highestBet, io, transaction) => {
    try {
        const oppositeTeam = highestBet.team === 'red' ? 'green' : 'red';

        const oppositeBets = await betting.findAll({
            where: { id_round: highestBet.id_round, team: oppositeTeam, status: 0 },
            transaction,
            order: [['amount', 'DESC']] // Ordena de mayor a menor
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
            bettingLog.log(`[APUESTAS] VerificationBetting - apuesta grande emparejada (matchHighestBet2) | id_betting=${highestBet.id} id_round=${highestBet.id_round} team=${highestBet.team} amount=$${highestBet.amount.toLocaleString('en-US')} pares=${matchedBet.length}`);
            io.emit('Statusbetting', { status: "accepted", redBet: highestBet.team === "red" ? highestBet : {}, greenBet: highestBet.team === "green" ? highestBet : {}, message: `Su apuesta de $${highestBet.amount.toLocaleString('en-US')} se realizo con éxito` });

            await updateBetStatusBulk(matchedBets, 1, transaction);
            for (const bet of matchedBet) {
                await marriedbetting.create({ id_betting_one: highestBet.id, id_betting_two: bet.id, id_event: highestBet.id_event, id_round: highestBet.id_round }, { transaction });
                io.emit('Statusbetting', { status: "accepted", redBet: bet.team === "red" ? bet : {}, greenBet: bet.team === "green" ? bet : {}, message: `Su apuesta de $${bet.amount.toLocaleString('en-US')} se realizo con éxito` });

            }
        } else {
            await updateBetStatusBulk([highestBet.id], 2, transaction);
            bettingLog.log(`[APUESTAS] VerificationBetting - apuesta grande rechazada (sin emparejar) | id_betting=${highestBet.id} id_user=${highestBet.id_user} id_round=${highestBet.id_round} amount=$${highestBet.amount.toLocaleString('en-US')}`);
            await updateBalances([highestBet], io, transaction)
        }
    } catch (error) {
        bettingLog.error(`[APUESTAS] VerificationBetting - matchHighestBet2 error: ${error.message}`);
        console.error("Error en matchHighestBet:", error);
        throw error; // Propaga el error.
    }
};


/**
 * Devuelve la apuesta pendiente (status 0) de mayor monto en la ronda, o null si no hay ninguna.
 */
const findHighestRemainingBet = async (round, transaction) => {
    const remainingBets = await betting.findAll({
        where: { id_round: round.id, status: 0 },
        transaction
    });

    if (remainingBets.length === 0) return null;

    const highestBet = remainingBets.reduce((maxBet, bet) => bet.amount > maxBet.amount ? bet : maxBet, remainingBets[0]);
    return highestBet;
};

/**
 * Verificación periódica (cada 10s desde betsocket): empareja apuestas de la ronda con botonera activa.
 * Usa matchHighestBet (apuestas sin emparejar quedan pendientes) y evaluateBetsAmountEquels.
 */
exports.VerificationBetting = async (io) => {
    let transaction = null;
    try {
        const id_round = await rounds.findOne({ where: { is_betting_active: true } });
        if (id_round) {
            transaction = await sequelize.transaction();
            const activeEvent = await events.findOne({ where: { is_active: true } });

            if (!activeEvent) {
                bettingLog.warn(`[APUESTAS] VerificationBetting - no hay eventos activos; rollback`);
                io.emit('Statusbetting', { status: "No hay eventos activos" });
                console.log("No hay eventos activos");
                await transaction.rollback();
                return;
            }

            const activeRounds = await rounds.findAll({ where: { id_event: activeEvent.id, id: id_round?.id } });

            if (!activeRounds.length) {
                bettingLog.warn(`[APUESTAS] VerificationBetting - no hay rondas activas para evento ${activeEvent.id}; rollback`);
                io.emit('Statusbetting', { status: "No hay rondas activas" });
                console.log("No hay rondas activas");
                await transaction.rollback();
                return;
            }

            bettingLog.log(`[APUESTAS] VerificationBetting - iniciando ciclo id_round=${id_round.id} id_event=${activeEvent.id}`);

            for (const round of activeRounds) {
                // Procesar las apuestas restantes (mayor monto primero; sin emparejar quedan en 0)
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

                // Evaluar apuestas con monto exacto igual (rojo/verde)
                await evaluateBetsAmountEquels(round, io, transaction);
            }

            await transaction.commit();
            bettingLog.log(`[APUESTAS] VerificationBetting - ciclo completado con éxito id_round=${id_round.id}`);
            io.emit('Statusbetting', { status: "Verificación completada con éxito" });
        }
    } catch (error) {
        bettingLog.error(`[APUESTAS] VerificationBetting error: ${error.message}`);
        console.error("Error en la verificación de apuestas:", error);
        if (transaction) {
            await transaction.rollback();
        }
    }
};

/**
 * Verificación para una ronda concreta (ej. al cerrar botonera): matchHighestBet2 (rechaza y devuelve si no empareja)
 * y luego rechaza y devuelve el saldo a las apuestas que sigan pendientes.
 */
const VerificationBettingRound = async (id_round, io) => {
    let transaction = null;
    try {
        transaction = await sequelize.transaction();
        const activeEvent = await events.findOne({ where: { is_active: true } });

        if (!activeEvent) {
            bettingLog.warn(`[APUESTAS] VerificationBettingRound - no hay eventos activos id_round=${id_round}; rollback`);
            io.emit('Statusbetting', { status: "No hay eventos activos" });
            console.log("No hay eventos activos");
            await transaction.rollback();
            return;
        }

        const activeRounds = await rounds.findAll({ where: { id_event: activeEvent.id, id: id_round } });

        if (!activeRounds.length) {
            bettingLog.warn(`[APUESTAS] VerificationBettingRound - no hay rondas activas id_round=${id_round} id_event=${activeEvent.id}; rollback`);
            io.emit('Statusbetting', { status: "No hay rondas activas" });
            console.log("No hay rondas activas");
            await transaction.rollback();
            return;
        }

        bettingLog.log(`[APUESTAS] VerificationBettingRound - iniciando id_round=${id_round} id_event=${activeEvent.id}`);

        for (const round of activeRounds) {
            // Procesar apuestas por mayor monto; las no emparejadas se rechazan y se devuelve el saldo (matchHighestBet2)
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

            // Emparejar montos exactos rojo/verde
            await evaluateBetsAmountEquels(round, io, transaction);

            // Rechazar y devolver saldo a las que sigan pendientes
            remainingBets = await betting.findAll({ where: { id_round: round.id, status: 0 }, transaction });
            if (remainingBets.length > 0) {
                bettingLog.log(`[APUESTAS] VerificationBettingRound - rechazando ${remainingBets.length} apuestas pendientes restantes id_round=${round.id}`);
                await updateBalances(remainingBets, io, transaction);
            }
        }

        await transaction.commit();
        bettingLog.log(`[APUESTAS] VerificationBettingRound - completado con éxito id_round=${id_round}`);
        io.emit('Statusbetting', { status: "Verificación completada con éxito" });
    } catch (error) {
        bettingLog.error(`[APUESTAS] VerificationBettingRound id_round=${id_round} error: ${error.message}`);
        console.error("Error en la verificación de apuestas:", error);
        if (transaction) {
            await transaction.rollback();
        }
    }
};

exports.VerificationBettingRound = VerificationBettingRound;