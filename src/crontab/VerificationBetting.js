const { betting, events, rounds, users } = require('../db.js');

// Actualiza el estado de las apuestas
const updateBetsStatus = async (bets, status) => {
    try {
        for (const bet of bets) {
            await betting.update({ status }, { where: { id: bet.id } });
        }
    } catch (error) {
        console.error('Error updating bets status:', error);
    }
};

// Actualiza el balance del usuario
const updateUserBalance = async (userId, amount) => {
    try {
        let userData = await users.findOne({ where: { id: userId } });
        if (userData) {
            let newBalance = userData.initial_balance + amount;
            await users.update(
                { initial_balance: newBalance },
                { where: { id: userId } }
            );
        } else {
            console.error('User not found:', userId);
        }
    } catch (error) {
        console.error('Error updating user balance:', error);
    }
};

// Declina la apuesta y devuelve el monto al usuario
const declineBet = async (bet) => {
    await betting.update({ status: 2 }, { where: { id: bet.id } });
    await updateUserBalance(bet.id_user, bet.amount);
};

// Compara el monto de una apuesta con el monto de cada una de las apuestas del equipo contrario
const compareBetWithOppositeTeam = async (bet, oppositeTeamBets) => {
    let remainingAmount = bet.amount;
    for (const oppositeBet of oppositeTeamBets) {
        if (remainingAmount <= 0) break;

        if (oppositeBet.amount <= remainingAmount) {
            await betting.update({ status: 1 }, { where: { id: oppositeBet.id } });
            remainingAmount -= oppositeBet.amount;
        } else {
            await betting.update({ status: 1 }, { where: { id: oppositeBet.id } });
            remainingAmount = 0;
        }
    }
    return remainingAmount;
};

// Procesa las apuestas
const processBets = async (round, team, oppositeTeam, io) => {
    try {
        const teamBets = await betting.findAll({ where: { id_round: round.id, team, status: 0 } });
        const oppositeTeamBets = await betting.findAll({ where: { id_round: round.id, team: oppositeTeam, status: 0 } });

        for (const bet of teamBets) {
            const remainingAmount = await compareBetWithOppositeTeam(bet, oppositeTeamBets);

            if (remainingAmount > 0) {
                await declineBet(bet);
                io.emit('Statusbetting', { id: bet.id_user, amount: bet.amount, status: "rechazada" });
            } else {
                await betting.update({ status: 1 }, { where: { id: bet.id } });
                io.emit('Statusbetting', { message: "Apuesta registrada con éxito", status: "aceptada" });
                io.emit('getBetStats', { id_event: bet.id_event , team:bet.team, id_round : round.id });
            }
        }
    } catch (error) {
        console.error('Error processing bets:', error);
    }
};

// Función principal de verificación de apuestas
const VerificationBetting = async (io) => {
    try {
        const event = await events.findOne({ where: { is_active: true } });
        if (event) {
            const roundAll = await rounds.findAll({ where: { id_event: event.id, is_betting_active: true } });
            if (roundAll.length > 0) {
                for (const round of roundAll) {

                    // Obtener todas las apuestas activas
                    const betsInProcess = await betting.findAll({ where: { id_round: round.id, status: 0 } });

                    for (const bet of betsInProcess) {

                        // Obtener las apuestas del equipo contrario
                        const oppositeTeam = bet.team === 'red' ? 'green' : 'red';
                        const oppositeTeamBets = await betting.findAll({ where: { id_round: round.id, team: oppositeTeam, status: 0 } });

                        // Calcular el total de apuestas del equipo contrario
                        let totalOppositeTeamAmount = oppositeTeamBets.reduce((sum, oppositeBet) => sum + oppositeBet.amount, 0);

                        // Verificar si la apuesta actual puede ser aceptada o debe ser rechazada
                        if (bet.amount <= totalOppositeTeamAmount || totalOppositeTeamAmount === 0) {

                            // Aceptar apuesta y actualizar estado
                            await betting.update({ status: 1 }, { where: { id: bet.id } });
                            io.emit('Statusbetting', { message: "Apuesta registrada con éxito", status: "aceptada" });
                            io.emit('getBetStats', { id_event: event.id , team:bet.team, id_round : round.id });

                            // Procesar las apuestas del equipo contrario
                            await processBets(round, bet.team, oppositeTeam, io);

                        } else {

                            // Si no se puede empatar la apuesta se rechaza
                            await declineBet(bet);
                            io.emit('Statusbetting', { id: bet.id_user, amount: bet.amount, status: "rechazada" });
                        }
                    }
                }
            } else {
                io.emit('Statusbetting', { message: "No hay rondas activas", status: "error" });
            }
        } else {
            io.emit('Statusbetting', { message: "No hay eventos activos", status: "error" });
        }
    } catch (error) {
        console.error('Error in VerificationBetting:', error);
    }
};

module.exports = VerificationBetting;
