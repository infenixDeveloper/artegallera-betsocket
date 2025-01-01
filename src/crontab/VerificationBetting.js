var cron = require('node-cron');
const { betting, events, rounds,users} = require('../db');

const updateBetsStatus = async (bets) => {
    for (const bet of bets) {
        await betting.update({ status: 1 }, { where: { id: bet.id } });
    }
};

const updateUserBalance = async (user, amount) => {
    let UserData = await users.findOne({ where: { id: user } });
    let newBalance = UserData.initial_balance + amount;
    await users.update(
        { initial_balance: newBalance },
        { where: { id: user } }
    );
}

const processBets = async (round, team, oppositeTeam) => {
    const teamBets = await betting.findAll({ where: { id_round: round.id, team, status: 0 } });
    const oppositeTeamBets = await betting.findAll({ where: { id_round: round.id, team: oppositeTeam, status: 0 } });

    let totalTeamAmount = teamBets.reduce((sum, bet) => sum + bet.amount, 0);
    let totalOppositeTeamAmount = oppositeTeamBets.reduce((sum, bet) => sum + bet.amount, 0);

    if (totalTeamAmount > totalOppositeTeamAmount) {
        let selectedBets = [];
        let totalAmount = 0;

        for (const bet of teamBets) {
            if (totalAmount + bet.amount <= totalTeamAmount) {
                selectedBets.push(bet);
                totalAmount += bet.amount;
            }
        }

        await updateBetsStatus(selectedBets);
        await updateBetsStatus(oppositeTeamBets);
    }
};

const VerificationBetting = async () => {
    try {
        const event = await events.findOne({ where: { is_active: true } });

        if (event) {
            const roundAll = await rounds.findAll({ where: { id_event: event.id, is_betting_active: true } });

            if (roundAll) {
                for (const round of roundAll) {
                    const maxBetRound = await betting.max('amount', { where: { id_round: round.id, status: 1 } });
                    const minBetRound = await betting.min('amount', { where: { id_round: round.id, status: 1 } });

                    const bets = await betting.findAll({ where: { id_round: round.id, status: 0 } });
                    console.log(bets.length);
                    for (const bet of bets) {
                        if (maxBetRound === null || minBetRound === null) {
                            await processBets(round, 'red', 'green');
                            await processBets(round, 'green', 'red');
                        } else {
                            if (bet.amount >= minBetRound && bet.amount <= maxBetRound) {
                                const oppositeTeam = bet.team === 'red' ? 'green' : 'red';
                                const oppositeTeamBets = await betting.findAll({ where: { id_round: round.id, team: oppositeTeam, status: 1 } });
                                const teamBets = await betting.findAll({ where: { id_round: round.id, team: bet.team, status: 1 } });

                                let totalOppositeTeamAmount = oppositeTeamBets.reduce((sum, oppositeBet) => sum + oppositeBet.amount, 0);
                                let totalTeamBets = teamBets.reduce((sum, teamBet) => sum + teamBet.amount, 0);

                                if (bet.amount + totalTeamBets <= totalOppositeTeamAmount) {
                                    await betting.update({ status: 1 }, { where: { id: bet.id } });
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
                                }else {
                                    bet.status = 2;
                                    await bet.save();
                                    await updateUserBalance(bet.id_user, bet.amount);

                                    //await processBets(round, 'red', 'green');
                                    //await processBets(round, 'green', 'red');
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error in VerificationBetting:', error);
    }
};


cron.schedule('*/2 * * * *', async () => {
    console.log('running a task every minute');
    await VerificationBetting();
});
