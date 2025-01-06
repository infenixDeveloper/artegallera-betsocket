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

const evaluateBets = async (round, bet, io) => {

    const oppositeTeam = bet.team === 'red' ? 'green' : 'red';

    // Obtener todas las apuestas de ambos equipos (estatus 0 y 1)
    const teamBets = await betting.findAll({
        where: {
            id_round: round.id,
            team: bet.team,
            status: [0, 1] // Apuestas del equipo actual
        }
    });

    const oppositeBets = await betting.findAll({
        where: {
            id_round: round.id,
            team: oppositeTeam,
            status: [0, 1] // Apuestas del equipo contrario
        }
    });

    // Calcular el monto total de los pozos de ambos equipos
    const totalTeamAmount = teamBets.reduce((sum, bet) => sum + bet.amount, 0);
    const totalOppositeAmount = oppositeBets.reduce((sum, bet) => sum + bet.amount, 0);

    // Verificar si la apuesta desnivela aún más los pozos
    if (totalTeamAmount > totalOppositeAmount && (totalTeamAmount + bet.amount) > totalOppositeAmount) {
        // Rechazar la apuesta
        //await updateBetStatus([bet], 2); // Rechazada
        //await updateUserBalance(bet.id_user, bet.amount); // Devolver dinero

        // Emitir la información de la apuesta rechazada
        io.emit('Statusbetting', {
            status: 'rejected',
            bet,
            message: 'La apuesta fue rechazada porque desbalancea el pozo total.'
        });

        return;
    }

    // Condición 1: Usuario vs. Usuario
    const exactMatch = oppositeBets.find(oppositeBet => oppositeBet.amount === bet.amount && oppositeBet.status === 0);
    if (exactMatch) {
        await updateBetStatus([bet, exactMatch], 1); // Marcar ambas apuestas como aceptadas

        // Emitir la información de las apuestas aceptadas
        io.emit('Statusbetting', {
            status: 'accepted',
            bets: [bet, exactMatch],
            message: 'Apuesta aceptada contra otro jugador.'
        });

        return;
    }

    // Condición 2: Usuario vs. Grupo
    let groupMatch = [];
    let totalAmount = 0;
    for (const oppositeBet of oppositeBets.filter(b => b.status === 0)) {
        if (totalAmount + oppositeBet.amount <= bet.amount) {
            groupMatch.push(oppositeBet);
            totalAmount += oppositeBet.amount;
        }
        if (totalAmount === bet.amount) {
            await updateBetStatus([bet, ...groupMatch], 1); // Marcar apuestas como aceptadas

            // Emitir la información de las apuestas aceptadas
            io.emit('Statusbetting', {
                status: 'accepted',
                bets: [bet, ...groupMatch],
                message: 'Apuesta aceptada contra un grupo de jugadores.'
            });

            return;
        }
    }

    // Condición 3: Usuario vs. Pozo
    if (totalOppositeAmount >= bet.amount) {
        let selectedBets = [];
        let accumulatedAmount = 0;

        for (const oppositeBet of oppositeBets) {
            selectedBets.push(oppositeBet);
            accumulatedAmount += oppositeBet.amount;

            if (accumulatedAmount >= bet.amount) {
                break;
            }
        }

        if (accumulatedAmount >= bet.amount) {
            await updateBetStatus([bet, ...selectedBets], 1); // Marcar apuestas como aceptadas

            // Emitir la información de las apuestas aceptadas
            io.emit('Statusbetting', {
                status: 'accepted',
                bets: [bet, ...selectedBets],
                message: 'Apuesta aceptada contra el pozo total.'
            });

            return;
        }
    }

    // Si ninguna condición se cumple, rechazar la apuesta
    //await updateBetStatus([bet], 2); // Rechazada
    //await updateUserBalance(bet.id_user, bet.amount); // Devolver dinero

    // Emitir la información de la apuesta rechazada
    io.emit('Statusbetting', {
        status: 'rejected',
        bet,
        message: 'La apuesta fue rechazada porque no cumplió ninguna condición.'
    });
};

const processRoundBets = async (round, io) => {
    console.log(`Procesando apuestas para la ronda ID: ${round.id}`);
    const bets = await betting.findAll({ where: { id_round: round.id, status: 0 } });

    // Ordenar las apuestas por monto (descendente) para priorizar apuestas grandes
    const sortedBets = bets.sort((a, b) => b.amount - a.amount);

    for (const bet of sortedBets) {
        await evaluateBets(round, bet, io);
    }
};


const VerificationBetting = async (io) => {
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
            await processRoundBets(round, io);
        }
    } catch (error) {
        console.error('Error in VerificationBetting:', error);
    }
};

// Configurar cron job para ejecutar la verificación periódicamente
// cron.schedule('*/20 * * * * *', async () => {
//     console.log('Ejecutando verificación de apuestas...');
//     try {
//         await VerificationBetting();
//     } catch (error) {
//         console.error('Error en cron job:', error);
//     }
// });

module.exports = VerificationBetting;
