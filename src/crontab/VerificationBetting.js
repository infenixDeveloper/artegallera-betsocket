const { betting, events, rounds, users, marriedbetting, sequelize } = require('../db');
const bettingLog = require('../utils/bettingLogger.js');

/**
 * CONSTANTES DE ESTADO DE APUESTAS
 * 0: Pendiente
 * 1: Aceptada
 * 2: Rechazada
 */
const BET_STATUS = {
    PENDING: 0,
    ACCEPTED: 1,
    REJECTED: 2
};

/**
 * CLASE: BettingStatusUpdater
 * Responsabilidad: Actualizar estados de apuestas en lote
 * Principio: Single Responsibility Principle (SRP)
 */
class BettingStatusUpdater {
    /**
     * Actualiza el estado de múltiples apuestas en una sola operación
     * @param {Array<number>} betIds - IDs de las apuestas a actualizar
     * @param {number} status - Nuevo estado (0: pendiente, 1: aceptada, 2: rechazada)
     * @param {Object} transaction - Transacción de Sequelize
     * @returns {Promise<void>}
     */
    static async updateBulk(betIds, status, transaction) {
        if (!betIds || betIds.length === 0) {
            console.log('No hay apuestas para actualizar');
            return;
        }

        try {
            await betting.update(
                { status },
                { where: { id: betIds }, transaction }
            );
            console.log(`✓ Actualizadas ${betIds.length} apuestas al estado ${status}`);
        } catch (error) {
            console.error(`✗ Error al actualizar apuestas:`, error);
            throw error;
        }
    }
}

/**
 * CLASE: BalanceManager
 * Responsabilidad: Gestionar balances de usuarios cuando se rechazan apuestas
 * Principio: Single Responsibility Principle (SRP)
 */
class BalanceManager {
    /**
     * Restaura el balance de usuarios cuyas apuestas fueron rechazadas
     * @param {Array<Object>} bets - Apuestas rechazadas
     * @param {Object} io - Socket.io instance
     * @param {Object} transaction - Transacción de Sequelize
     * @returns {Promise<void>}
     */
    static async restoreRejectedBets(bets, io, transaction) {
        if (!bets || bets.length === 0) return;

        try {
            for (const bet of bets) {
                const user = await users.findOne(
                    { where: { id: bet.id_user } },
                    { transaction }
                );

                if (!user) {
                    console.warn(`Usuario ${bet.id_user} no encontrado para la apuesta ${bet.id}`);
                    continue;
                }

                const newBalance = user.initial_balance + bet.amount;
                await users.update(
                    { initial_balance: newBalance },
                    { where: { id: bet.id_user }, transaction }
                );

                // Actualizar estado de la apuesta a rechazada
                await BettingStatusUpdater.updateBulk([bet.id], BET_STATUS.REJECTED, transaction);

                bettingLog.log(`[APUESTAS] RECHAZO AL CIERRE | id_betting=${bet.id} id_user=${bet.id_user} team=${bet.team} amount=${bet.amount} | motivo=Sin emparejar`);

                // Notificar al usuario (corregido: usar bet.amount en lugar de amountTotal)
                io.emit('Statusbetting', {
                    status: "rejected",
                    redBet: bet.team === "red" ? bet : {},
                    greenBet: bet.team === "green" ? bet : {},
                    message: `Su apuesta de $${bet.amount.toLocaleString('en-US')} fue declinada`
                });
            }
        } catch (error) {
            console.error(`✗ Error al restaurar balances de usuarios:`, error);
            throw error;
        }
    }
}

/**
 * CLASE: NotificationService
 * Responsabilidad: Enviar notificaciones de estado de apuestas
 * Principio: Single Responsibility Principle (SRP)
 */
class NotificationService {
    /**
     * Notifica que una apuesta fue aceptada
     * @param {Object} bet - Apuesta aceptada
     * @param {Object} io - Socket.io instance
     */
    static notifyAccepted(bet, io) {
        io.emit('Statusbetting', {
            status: "accepted",
            redBet: bet.team === "red" ? bet : {},
            greenBet: bet.team === "green" ? bet : {},
            message: `Su apuesta de $${bet.amount.toLocaleString('en-US')} se realizó con éxito`
        });
    }

    /**
     * Notifica que dos apuestas fueron emparejadas
     * @param {Object} bet1 - Primera apuesta
     * @param {Object} bet2 - Segunda apuesta
     * @param {Object} io - Socket.io instance
     */
    static notifyMatched(bet1, bet2, io) {
        io.emit('Statusbetting', {
            status: "accepted",
            redBet: bet1.team === "red" ? bet1 : bet2.team === "red" ? bet2 : {},
            greenBet: bet1.team === "green" ? bet1 : bet2.team === "green" ? bet2 : {},
            message: `Su apuesta de $${bet1.amount.toLocaleString('en-US')} se realizó con éxito`
        });
    }
}

/**
 * CLASE: MarriedBettingService
 * Responsabilidad: Crear registros de apuestas emparejadas
 * Principio: Single Responsibility Principle (SRP)
 */
class MarriedBettingService {
    /**
     * Crea un registro de emparejamiento entre dos apuestas
     * @param {Object} bet1 - Primera apuesta
     * @param {Object} bet2 - Segunda apuesta
     * @param {Object} transaction - Transacción de Sequelize
     * @returns {Promise<Object>}
     */
    static async createMarriage(bet1, bet2, transaction) {
        try {
            return await marriedbetting.create({
                id_betting_one: bet1.id,
                id_betting_two: bet2.id,
                id_event: bet1.id_event,
                id_round: bet1.id_round
            }, { transaction });
        } catch (error) {
            console.error(`✗ Error al crear emparejamiento:`, error);
            throw error;
        }
    }
}

/**
 * CLASE: ExactMatchStrategy
 * Responsabilidad: Emparejar apuestas con montos exactamente iguales (1:1)
 * Principio: Single Responsibility Principle (SRP) y Open/Closed Principle (OCP)
 * Prioridad: ALTA - Se ejecuta primero para maximizar emparejamientos simples
 */
class ExactMatchStrategy {
    /**
     * Encuentra y empareja apuestas con montos exactamente iguales
     * @param {Array<Object>} redBets - Apuestas del equipo rojo
     * @param {Array<Object>} greenBets - Apuestas del equipo verde
     * @param {Object} io - Socket.io instance
     * @param {Object} transaction - Transacción de Sequelize
     * @returns {Promise<{matchedAmount: number, matchedCount: number}>}
     */
    static async match(redBets, greenBets, io, transaction) {
        const matchedRedIds = [];
        const matchedGreenIds = [];
        let matchedAmount = 0;
        let matchedCount = 0;

        // Crear una copia para no modificar el array original
        const availableGreenBets = [...greenBets];

        for (const redBet of redBets) {
            // Buscar coincidencia exacta en apuestas verdes disponibles
            const matchingIndex = availableGreenBets.findIndex(
                greenBet => greenBet.amount === redBet.amount
            );

            if (matchingIndex !== -1) {
                const matchingBet = availableGreenBets[matchingIndex];

                // Registrar emparejamiento
                matchedRedIds.push(redBet.id);
                matchedGreenIds.push(matchingBet.id);
                matchedAmount += redBet.amount;
                matchedCount++;

                // Crear registro de emparejamiento
                await MarriedBettingService.createMarriage(redBet, matchingBet, transaction);

                // Notificar a ambos usuarios
                NotificationService.notifyMatched(redBet, matchingBet, io);

                // Remover de la lista de disponibles
                availableGreenBets.splice(matchingIndex, 1);
            }
        }

        // Actualizar estados en lote
        if (matchedRedIds.length > 0) {
            await BettingStatusUpdater.updateBulk(matchedRedIds, BET_STATUS.ACCEPTED, transaction);
        }
        if (matchedGreenIds.length > 0) {
            await BettingStatusUpdater.updateBulk(matchedGreenIds, BET_STATUS.ACCEPTED, transaction);
        }

        return {
            matchedAmount,
            matchedCount,
            remainingRedBets: redBets.filter(bet => !matchedRedIds.includes(bet.id)),
            remainingGreenBets: availableGreenBets
        };
    }
}

/**
 * CLASE: LargeBetMatchStrategy
 * Responsabilidad: Emparejar apuestas grandes con múltiples apuestas pequeñas
 * Principio: Single Responsibility Principle (SRP) y Open/Closed Principle (OCP)
 * Prioridad: MEDIA - Se ejecuta después de coincidencias exactas
 */
class LargeBetMatchStrategy {
    /**
     * Intenta emparejar una apuesta grande con múltiples apuestas del equipo opuesto
     * @param {Object} largeBet - Apuesta grande a emparejar
     * @param {Array<Object>} oppositeBets - Apuestas del equipo opuesto (ordenadas desc)
     * @param {Object} io - Socket.io instance
     * @param {Object} transaction - Transacción de Sequelize
     * @returns {Promise<{matched: boolean, matchedAmount: number, matchedBets: Array<Object>}>}
     */
    static async match(largeBet, oppositeBets, io, transaction) {
        let remainingAmount = largeBet.amount;
        const matchedBets = [];
        const matchedBetObjects = [];

        // Intentar emparejar con apuestas del equipo opuesto
        for (const bet of oppositeBets) {
            if (remainingAmount <= 0) break;

            // Solo emparejar si la apuesta cabe en el monto restante
            if (bet.amount <= remainingAmount) {
                matchedBets.push(bet.id);
                matchedBetObjects.push(bet);
                remainingAmount -= bet.amount;
            }
        }

        // Si se emparejó completamente, aceptar todas las apuestas
        if (remainingAmount === 0 && matchedBets.length > 0) {
            // Aceptar la apuesta grande
            await BettingStatusUpdater.updateBulk([largeBet.id], BET_STATUS.ACCEPTED, transaction);
            NotificationService.notifyAccepted(largeBet, io);

            // Aceptar las apuestas emparejadas
            await BettingStatusUpdater.updateBulk(matchedBets, BET_STATUS.ACCEPTED, transaction);

            // Crear registros de emparejamiento
            for (const matchedBet of matchedBetObjects) {
                await MarriedBettingService.createMarriage(largeBet, matchedBet, transaction);
                NotificationService.notifyAccepted(matchedBet, io);
            }

            return {
                matched: true,
                matchedAmount: largeBet.amount,
                matchedBets: matchedBetObjects
            };
        }

        return {
            matched: false,
            matchedAmount: 0,
            matchedBets: []
        };
    }
}

/**
 * CLASE: SmallBetsMatchStrategy
 * Responsabilidad: Emparejar múltiples apuestas pequeñas con una apuesta grande
 * Principio: Single Responsibility Principle (SRP) y Open/Closed Principle (OCP)
 * Prioridad: BAJA - Se ejecuta después de intentar emparejar apuestas grandes
 */
class SmallBetsMatchStrategy {
    /**
     * Intenta emparejar múltiples apuestas pequeñas con una apuesta grande del equipo opuesto
     * @param {Array<Object>} smallBets - Apuestas pequeñas (ordenadas desc)
     * @param {Array<Object>} oppositeBets - Apuestas grandes del equipo opuesto (ordenadas desc)
     * @param {Object} io - Socket.io instance
     * @param {Object} transaction - Transacción de Sequelize
     * @returns {Promise<{matchedAmount: number, matchedPairs: Array<{small: Object, large: Object}>}>}
     */
    static async match(smallBets, oppositeBets, io, transaction) {
        let totalMatchedAmount = 0;
        const matchedPairs = [];
        const usedSmallBetIds = new Set();
        const usedOppositeBetIds = new Set();

        // Para cada apuesta pequeña, buscar una apuesta grande que la pueda absorber
        for (const smallBet of smallBets) {
            if (usedSmallBetIds.has(smallBet.id)) continue;

            // Buscar la apuesta grande más pequeña que pueda absorber esta apuesta pequeña
            for (const largeBet of oppositeBets) {
                if (usedOppositeBetIds.has(largeBet.id)) continue;
                if (smallBet.amount > largeBet.amount) continue; // La apuesta grande debe ser >= pequeña

                // Si la apuesta grande puede absorber la pequeña, emparejarlas
                if (smallBet.amount <= largeBet.amount) {
                    // Verificar si la apuesta grande ya está parcialmente emparejada
                    // Por simplicidad, asumimos que una apuesta grande solo puede emparejarse una vez
                    // En un sistema más complejo, se podría dividir la apuesta grande
                    usedSmallBetIds.add(smallBet.id);
                    usedOppositeBetIds.add(largeBet.id);
                    matchedPairs.push({ small: smallBet, large: largeBet });
                    totalMatchedAmount += smallBet.amount;
                    break;
                }
            }
        }

        // Procesar todos los emparejamientos encontrados
        for (const pair of matchedPairs) {
            await BettingStatusUpdater.updateBulk([pair.small.id], BET_STATUS.ACCEPTED, transaction);
            await BettingStatusUpdater.updateBulk([pair.large.id], BET_STATUS.ACCEPTED, transaction);
            await MarriedBettingService.createMarriage(pair.small, pair.large, transaction);
            NotificationService.notifyMatched(pair.small, pair.large, io);
        }

        return {
            matchedAmount: totalMatchedAmount,
            matchedPairs
        };
    }
}

/**
 * CLASE: BettingMatcher
 * Responsabilidad: Orquestar el proceso de emparejamiento siguiendo las prioridades
 * Principio: Single Responsibility Principle (SRP) y Dependency Inversion Principle (DIP)
 */
class BettingMatcher {
    /**
     * Procesa el emparejamiento de apuestas para una ronda siguiendo las prioridades:
     * 1. Coincidencias exactas (1:1)
     * 2. Apuestas grandes con múltiples pequeñas
     * 3. Múltiples pequeñas con una grande
     * @param {Object} round - Ronda a procesar
     * @param {Object} io - Socket.io instance
     * @param {Object} transaction - Transacción de Sequelize
     * @returns {Promise<{totalMatchedAmount: number, rejectedBets: Array<Object>}>}
     */
    static async processRound(round, io, transaction) {
        bettingLog.log(`[APUESTAS] VerificationBetting - Procesando emparejamiento ronda ID: ${round.id}`);
        console.log(`\n🔄 Procesando emparejamiento para la ronda ID: ${round.id}`);

        // Obtener todas las apuestas pendientes de la ronda
        const allPendingBets = await betting.findAll({
            where: { id_round: round.id, status: BET_STATUS.PENDING },
            transaction,
            order: [['amount', 'DESC']] // Ordenar por monto descendente
        });

        if (allPendingBets.length === 0) {
            bettingLog.log(`[APUESTAS] VerificationBetting - Ronda ${round.id}: no hay apuestas pendientes`);
            console.log('  ✓ No hay apuestas pendientes');
            return { totalMatchedAmount: 0, rejectedBets: [] };
        }

        // Separar por equipos
        const redBets = allPendingBets.filter(bet => bet.team === 'red');
        const greenBets = allPendingBets.filter(bet => bet.team === 'green');

        bettingLog.log(`[APUESTAS] VerificationBetting - Ronda ${round.id}: ${redBets.length} rojas, ${greenBets.length} verdes pendientes`);
        console.log(`  📊 Apuestas pendientes: ${redBets.length} rojas, ${greenBets.length} verdes`);

        let totalMatchedAmount = 0;
        let currentRedBets = [...redBets];
        let currentGreenBets = [...greenBets];

        // PRIORIDAD 1: Coincidencias exactas (1:1)
        console.log('  🎯 Prioridad 1: Buscando coincidencias exactas...');
        const exactMatchResult = await ExactMatchStrategy.match(
            currentRedBets,
            currentGreenBets,
            io,
            transaction
        );
        totalMatchedAmount += exactMatchResult.matchedAmount;
        currentRedBets = exactMatchResult.remainingRedBets;
        currentGreenBets = exactMatchResult.remainingGreenBets;
        bettingLog.log(`[APUESTAS] VerificationBetting - Ronda ${round.id}: coincidencias exactas ${exactMatchResult.matchedCount} pares, $${exactMatchResult.matchedAmount.toLocaleString('en-US')}`);
        console.log(`  ✓ Coincidencias exactas: ${exactMatchResult.matchedCount} pares, $${exactMatchResult.matchedAmount.toLocaleString('en-US')}`);

        // PRIORIDAD 2: Emparejar apuestas grandes con múltiples pequeñas
        console.log('  🎯 Prioridad 2: Emparejando apuestas grandes...');
        let largeBetMatchedAmount = 0;
        const processedBetIds = new Set();

        // Ordenar apuestas por monto descendente
        const sortedRedBets = [...currentRedBets].sort((a, b) => b.amount - a.amount);
        const sortedGreenBets = [...currentGreenBets].sort((a, b) => b.amount - a.amount);

        // Procesar apuestas rojas grandes
        for (const redBet of sortedRedBets) {
            if (processedBetIds.has(redBet.id)) continue;

            // Obtener apuestas verdes disponibles (no procesadas)
            const availableGreenBets = sortedGreenBets.filter(
                bet => !processedBetIds.has(bet.id)
            );

            const matchResult = await LargeBetMatchStrategy.match(
                redBet,
                availableGreenBets,
                io,
                transaction
            );

            if (matchResult.matched) {
                largeBetMatchedAmount += matchResult.matchedAmount;
                processedBetIds.add(redBet.id);
                matchResult.matchedBets.forEach(bet => processedBetIds.add(bet.id));
            }
        }

        // Procesar apuestas verdes grandes
        for (const greenBet of sortedGreenBets) {
            if (processedBetIds.has(greenBet.id)) continue;

            const availableRedBets = sortedRedBets.filter(
                bet => !processedBetIds.has(bet.id)
            );

            const matchResult = await LargeBetMatchStrategy.match(
                greenBet,
                availableRedBets,
                io,
                transaction
            );

            if (matchResult.matched) {
                largeBetMatchedAmount += matchResult.matchedAmount;
                processedBetIds.add(greenBet.id);
                matchResult.matchedBets.forEach(bet => processedBetIds.add(bet.id));
            }
        }

        totalMatchedAmount += largeBetMatchedAmount;
        bettingLog.log(`[APUESTAS] VerificationBetting - Ronda ${round.id}: apuestas grandes emparejadas $${largeBetMatchedAmount.toLocaleString('en-US')}`);
        console.log(`  ✓ Apuestas grandes emparejadas: $${largeBetMatchedAmount.toLocaleString('en-US')}`);

        // Actualizar listas de apuestas disponibles
        currentRedBets = currentRedBets.filter(bet => !processedBetIds.has(bet.id));
        currentGreenBets = currentGreenBets.filter(bet => !processedBetIds.has(bet.id));

        // PRIORIDAD 3: Manejar desbalance - Aceptar todas las apuestas del equipo con menor total
        console.log('  🎯 Prioridad 3: Manejando desbalance de apuestas...');
        
        // Calcular totales de apuestas pendientes por equipo
        const remainingRedTotal = currentRedBets.reduce((sum, bet) => sum + bet.amount, 0);
        const remainingGreenTotal = currentGreenBets.reduce((sum, bet) => sum + bet.amount, 0);
        
        console.log(`  📊 Totales pendientes: ROJO $${remainingRedTotal.toLocaleString('en-US')}, VERDE $${remainingGreenTotal.toLocaleString('en-US')}`);
        
        let imbalanceMatchedAmount = 0;
        const acceptedBetIds = new Set();
        
        if (remainingRedTotal > 0 && remainingGreenTotal > 0) {
            if (remainingRedTotal > remainingGreenTotal) {
                // ROJO tiene más: aceptar todas las VERDES y solo el equivalente en ROJO
                console.log(`  ✓ ROJO tiene más. Aceptando todas las VERDES ($${remainingGreenTotal.toLocaleString('en-US')}) y $${remainingGreenTotal.toLocaleString('en-US')} de ROJO`);
                
                // Aceptar todas las apuestas verdes
                const greenBetIds = currentGreenBets.map(bet => bet.id);
                if (greenBetIds.length > 0) {
                    await BettingStatusUpdater.updateBulk(greenBetIds, BET_STATUS.ACCEPTED, transaction);
                    for (const greenBet of currentGreenBets) {
                        NotificationService.notifyAccepted(greenBet, io);
                        acceptedBetIds.add(greenBet.id);
                    }
                }
                
                // Aceptar apuestas rojas hasta completar el monto verde (ordenadas de mayor a menor)
                const sortedRedBets = [...currentRedBets].sort((a, b) => b.amount - a.amount);
                let redAmountToAccept = remainingGreenTotal;
                const redBetsToAccept = [];
                
                for (const redBet of sortedRedBets) {
                    if (redAmountToAccept <= 0) break;
                    
                    if (redBet.amount <= redAmountToAccept) {
                        redBetsToAccept.push(redBet.id);
                        acceptedBetIds.add(redBet.id);
                        redAmountToAccept -= redBet.amount;
                    }
                }
                
                if (redBetsToAccept.length > 0) {
                    await BettingStatusUpdater.updateBulk(redBetsToAccept, BET_STATUS.ACCEPTED, transaction);
                    for (const redBet of sortedRedBets) {
                        if (acceptedBetIds.has(redBet.id)) {
                            NotificationService.notifyAccepted(redBet, io);
                        }
                    }
                }
                
                imbalanceMatchedAmount = remainingGreenTotal; // Monto del equipo menor (consistente con otras estrategias)
                
            } else if (remainingGreenTotal > remainingRedTotal) {
                // VERDE tiene más: aceptar todas las ROJAS y solo el equivalente en VERDE
                console.log(`  ✓ VERDE tiene más. Aceptando todas las ROJAS ($${remainingRedTotal.toLocaleString('en-US')}) y $${remainingRedTotal.toLocaleString('en-US')} de VERDE`);
                
                // Aceptar todas las apuestas rojas
                const redBetIds = currentRedBets.map(bet => bet.id);
                if (redBetIds.length > 0) {
                    await BettingStatusUpdater.updateBulk(redBetIds, BET_STATUS.ACCEPTED, transaction);
                    for (const redBet of currentRedBets) {
                        NotificationService.notifyAccepted(redBet, io);
                        acceptedBetIds.add(redBet.id);
                    }
                }
                
                // Aceptar apuestas verdes hasta completar el monto rojo (ordenadas de mayor a menor)
                const sortedGreenBets = [...currentGreenBets].sort((a, b) => b.amount - a.amount);
                let greenAmountToAccept = remainingRedTotal;
                const greenBetsToAccept = [];
                
                for (const greenBet of sortedGreenBets) {
                    if (greenAmountToAccept <= 0) break;
                    
                    if (greenBet.amount <= greenAmountToAccept) {
                        greenBetsToAccept.push(greenBet.id);
                        acceptedBetIds.add(greenBet.id);
                        greenAmountToAccept -= greenBet.amount;
                    }
                }
                
                if (greenBetsToAccept.length > 0) {
                    await BettingStatusUpdater.updateBulk(greenBetsToAccept, BET_STATUS.ACCEPTED, transaction);
                    for (const greenBet of sortedGreenBets) {
                        if (acceptedBetIds.has(greenBet.id)) {
                            NotificationService.notifyAccepted(greenBet, io);
                        }
                    }
                }
                
                imbalanceMatchedAmount = remainingRedTotal; // Monto del equipo menor (consistente con otras estrategias)
                
            } else {
                // Totales iguales: aceptar todas las apuestas
                console.log(`  ✓ Totales iguales. Aceptando todas las apuestas`);
                
                const allBetIds = [...currentRedBets, ...currentGreenBets].map(bet => bet.id);
                if (allBetIds.length > 0) {
                    await BettingStatusUpdater.updateBulk(allBetIds, BET_STATUS.ACCEPTED, transaction);
                    for (const bet of [...currentRedBets, ...currentGreenBets]) {
                        NotificationService.notifyAccepted(bet, io);
                        acceptedBetIds.add(bet.id);
                    }
                }
                
                imbalanceMatchedAmount = remainingRedTotal; // Monto del equipo menor (consistente con otras estrategias)
            }
            
            totalMatchedAmount += imbalanceMatchedAmount;
            console.log(`  ✓ Desbalance manejado: $${imbalanceMatchedAmount.toLocaleString('en-US')} emparejado`);
        }

        // Obtener apuestas restantes que no se pudieron emparejar (solo las que deben rechazarse)
        const remainingBets = await betting.findAll({
            where: {
                id_round: round.id,
                status: BET_STATUS.PENDING
            },
            transaction
        });

        bettingLog.log(`[APUESTAS] VerificationBetting - Ronda ${round.id}: total emparejado $${totalMatchedAmount.toLocaleString('en-US')}, sin emparejar: ${remainingBets.length}`);
        console.log(`  📊 Total emparejado: $${totalMatchedAmount.toLocaleString('en-US')}`);
        console.log(`  ⚠️  Apuestas sin emparejar: ${remainingBets.length}`);

        return {
            totalMatchedAmount,
            rejectedBets: remainingBets
        };
    }
}

/**
 * FUNCIÓN PRINCIPAL: VerificationBetting
 * Procesa el emparejamiento de apuestas para la ronda activa
 * @param {Object} io - Socket.io instance
 * @returns {Promise<void>}
 */
exports.VerificationBetting = async (io) => {
    let transaction = null;
    try {
        const activeRound = await rounds.findOne({ where: { is_betting_active: true } });

        if (!activeRound) {
            bettingLog.log(`[APUESTAS] CRON 10s - No hay ronda activa (is_betting_active: true)`);
            console.log("⚠️  No hay ronda activa para apuestas");
            return;
        }

        transaction = await sequelize.transaction();
        // Usar la ronda con apuestas abiertas directamente (sin exigir que el evento esté is_active)
        const roundToProcess = await rounds.findByPk(activeRound.id, { transaction });

        if (!roundToProcess) {
            bettingLog.warn(`[APUESTAS] VerificationBetting - Ronda ${activeRound.id} no encontrada`);
            await transaction.rollback();
            return;
        }

        const [pendientesRojo, pendientesVerde] = await Promise.all([
            betting.count({ where: { id_round: roundToProcess.id, status: BET_STATUS.PENDING, team: 'red' }, transaction }),
            betting.count({ where: { id_round: roundToProcess.id, status: BET_STATUS.PENDING, team: 'green' }, transaction })
        ]);
        bettingLog.log(`[APUESTAS] CRON EMPAREJAMIENTO | id_round=${roundToProcess.id} | pendientes rojo=${pendientesRojo} verde=${pendientesVerde}`);

        // Procesar emparejamiento
        const result = await BettingMatcher.processRound(roundToProcess, io, transaction);

        const acceptedCount = await betting.count({ where: { id_round: roundToProcess.id, status: BET_STATUS.ACCEPTED }, transaction });

        // Las apuestas no emparejadas se mantienen pendientes (no se rechazan automáticamente)
        // Esto permite que puedan ser emparejadas en futuras ejecuciones

        await transaction.commit();
        bettingLog.log(`[APUESTAS] CRON EMPAREJAMIENTO FIN | id_round=${roundToProcess.id} | aceptadas=${acceptedCount} pendientes_sin_emparejar=${result.rejectedBets.length} total_emparejado=$${result.totalMatchedAmount.toLocaleString('en-US')}`);
        io.emit('Statusbetting', {
            status: "Verificación completada con éxito",
            matchedAmount: result.totalMatchedAmount,
            rejectedCount: result.rejectedBets.length
        });
        console.log(`✅ Verificación completada: $${result.totalMatchedAmount.toLocaleString('en-US')} emparejado`);

    } catch (error) {
        bettingLog.error(`[APUESTAS] VerificationBetting error: ${error.message}`);
        console.error("✗ Error en la verificación de apuestas:", error);
        if (transaction) {
            await transaction.rollback();
        }
        throw error;
    }
};

/**
 * FUNCIÓN: rejectPendingBetsForRound
 * Barrido al cerrar la ronda: rechaza todas las apuestas en estado pendiente (0) y devuelve el monto.
 * No depende del evento activo; se ejecuta siempre que se cierra la botonera de la ronda.
 * @param {number} id_round - ID de la ronda
 * @param {Object} io - Socket.io instance
 * @returns {Promise<{ rejectedCount: number }>}
 */
const rejectPendingBetsForRound = async (id_round, io) => {
    let transaction = null;
    try {
        transaction = await sequelize.transaction();

        const round = await rounds.findOne({
            where: { id: id_round },
            transaction
        });

        if (!round) {
            bettingLog.warn(`[APUESTAS] rejectPendingBetsForRound - Ronda ${id_round} no encontrada`);
            console.log(`⚠️  Ronda ${id_round} no encontrada`);
            await transaction.rollback();
            return { rejectedCount: 0 };
        }

        const pendingBets = await betting.findAll({
            where: {
                id_round: id_round,
                status: BET_STATUS.PENDING
            },
            transaction
        });

        if (pendingBets.length > 0) {
            bettingLog.log(`[APUESTAS] rejectPendingBetsForRound - Rechazando ${pendingBets.length} apuestas pendientes en ronda ${id_round}`);
            console.log(`  🚫 Rechazando ${pendingBets.length} apuestas pendientes al cerrar ronda ${id_round}`);
            await BalanceManager.restoreRejectedBets(pendingBets, io, transaction);
        }

        await transaction.commit();
        return { rejectedCount: pendingBets.length };
    } catch (error) {
        bettingLog.error(`[APUESTAS] rejectPendingBetsForRound error: ${error.message}`);
        console.error('✗ Error en barrido de apuestas pendientes:', error);
        if (transaction) {
            await transaction.rollback();
        }
        throw error;
    }
};

/**
 * FUNCIÓN: VerificationBettingRound
 * Procesa el emparejamiento de apuestas para una ronda específica y rechaza las no emparejadas
 * @param {number} id_round - ID de la ronda a procesar
 * @param {Object} io - Socket.io instance
 * @returns {Promise<void>}
 */
const VerificationBettingRound = async (id_round, io) => {
    let transaction = null;
    try {
        transaction = await sequelize.transaction();
        const activeEvent = await events.findOne({ where: { is_active: true } });

        if (!activeEvent) {
            io.emit('Statusbetting', { status: "No hay eventos activos" });
            console.log("⚠️  No hay eventos activos");
            await transaction.rollback();
            return;
        }

        const roundToProcess = await rounds.findOne({
            where: { id_event: activeEvent.id, id: id_round },
            transaction
        });

        if (!roundToProcess) {
            io.emit('Statusbetting', { status: "No hay rondas activas" });
            console.log("⚠️  No hay rondas activas");
            await transaction.rollback();
            return;
        }

        // Procesar emparejamiento
        const result = await BettingMatcher.processRound(roundToProcess, io, transaction);

        // Rechazar apuestas no emparejadas y devolver balances
        if (result.rejectedBets.length > 0) {
            console.log(`  🚫 Rechazando ${result.rejectedBets.length} apuestas no emparejadas`);
            await BalanceManager.restoreRejectedBets(result.rejectedBets, io, transaction);
        }

        await transaction.commit();
        io.emit('Statusbetting', {
            status: "Verificación completada con éxito",
            matchedAmount: result.totalMatchedAmount,
            rejectedCount: result.rejectedBets.length
        });
        console.log(`✅ Verificación completada: $${result.totalMatchedAmount.toLocaleString('en-US')} emparejado, ${result.rejectedBets.length} rechazadas`);

    } catch (error) {
        console.error("✗ Error en la verificación de apuestas:", error);
        if (transaction) {
            await transaction.rollback();
        }
        throw error;
    }
};

exports.VerificationBettingRound = VerificationBettingRound;
exports.rejectPendingBetsForRound = rejectPendingBetsForRound;

// Exportar clases para testing
exports.BettingMatcher = BettingMatcher;
exports.ExactMatchStrategy = ExactMatchStrategy;
exports.LargeBetMatchStrategy = LargeBetMatchStrategy;
exports.SmallBetsMatchStrategy = SmallBetsMatchStrategy;
exports.BET_STATUS = BET_STATUS;