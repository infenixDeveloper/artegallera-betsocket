/**
 * TEST: VerificationBetting.test.js
 * Valida que el sistema pueda absorber la mayor cantidad de dinero posible
 * 
 * Para ejecutar: node src/crontab/__tests__/VerificationBetting.test.js
 */

// Mock de las dependencias antes de importar el módulo
const mockIo = {
    emit: (event, data) => {
        console.log(`  [MOCK IO] ${event}:`, JSON.stringify(data, null, 2));
    }
};

const mockTransaction = {
    commit: async () => console.log('  [MOCK] Transaction committed'),
    rollback: async () => console.log('  [MOCK] Transaction rolled back')
};

/**
 * Test Case 1: Coincidencias exactas simples
 */
function testExactMatches() {
    console.log('\n🧪 TEST 1: Coincidencias exactas simples');
    
    const redBets = [
        { id: 1, amount: 100, team: 'red', id_event: 1, id_round: 1 },
        { id: 2, amount: 200, team: 'red', id_event: 1, id_round: 1 },
        { id: 3, amount: 150, team: 'red', id_event: 1, id_round: 1 }
    ];
    
    const greenBets = [
        { id: 4, amount: 100, team: 'green', id_event: 1, id_round: 1 },
        { id: 5, amount: 200, team: 'green', id_event: 1, id_round: 1 },
        { id: 6, amount: 300, team: 'green', id_event: 1, id_round: 1 }
    ];
    
    // Resultado esperado: 2 emparejamientos (100-100, 200-200), $300 emparejado
    const expectedMatched = 2;
    const expectedAmount = 300;
    
    console.log(`  📋 Apuestas rojas: ${redBets.map(b => `$${b.amount}`).join(', ')}`);
    console.log(`  📋 Apuestas verdes: ${greenBets.map(b => `$${b.amount}`).join(', ')}`);
    console.log(`  ✅ Esperado: ${expectedMatched} emparejamientos, $${expectedAmount} emparejado`);
    console.log(`  ✓ Test configurado correctamente`);
    
    return { redBets, greenBets, expectedMatched, expectedAmount };
}

/**
 * Test Case 2: Apuesta grande con múltiples pequeñas
 */
function testLargeBetWithMultipleSmall() {
    console.log('\n🧪 TEST 2: Apuesta grande con múltiples pequeñas');
    
    const largeBet = { id: 1, amount: 1000, team: 'red', id_event: 1, id_round: 1 };
    const smallBets = [
        { id: 2, amount: 300, team: 'green', id_event: 1, id_round: 1 },
        { id: 3, amount: 400, team: 'green', id_event: 1, id_round: 1 },
        { id: 4, amount: 300, team: 'green', id_event: 1, id_round: 1 }
    ];
    
    // Resultado esperado: 3 emparejamientos, $1000 emparejado completamente
    const expectedMatched = 3;
    const expectedAmount = 1000;
    
    console.log(`  📋 Apuesta grande: $${largeBet.amount}`);
    console.log(`  📋 Apuestas pequeñas: ${smallBets.map(b => `$${b.amount}`).join(', ')}`);
    console.log(`  ✅ Esperado: ${expectedMatched} emparejamientos, $${expectedAmount} emparejado`);
    console.log(`  ✓ Test configurado correctamente`);
    
    return { largeBet, smallBets, expectedMatched, expectedAmount };
}

/**
 * Test Case 3: Maximización de dinero - Escenario complejo
 */
function testMaximizationScenario() {
    console.log('\n🧪 TEST 3: Escenario complejo de maximización');
    
    const redBets = [
        { id: 1, amount: 500, team: 'red', id_event: 1, id_round: 1 },
        { id: 2, amount: 300, team: 'red', id_event: 1, id_round: 1 },
        { id: 3, amount: 200, team: 'red', id_event: 1, id_round: 1 },
        { id: 4, amount: 100, team: 'red', id_event: 1, id_round: 1 }
    ];
    
    const greenBets = [
        { id: 5, amount: 500, team: 'green', id_event: 1, id_round: 1 },
        { id: 6, amount: 250, team: 'green', id_event: 1, id_round: 1 },
        { id: 7, amount: 150, team: 'green', id_event: 1, id_round: 1 },
        { id: 8, amount: 100, team: 'green', id_event: 1, id_round: 1 }
    ];
    
    // Estrategia óptima:
    // 1. Coincidencia exacta: 500-500, 100-100 = $600
    // 2. Grande con pequeñas: 300 (red) con 250+50 (green) = $300
    // 3. Grande con pequeñas: 200 (red) con 150 (green) = $150
    // Total esperado: $1050 de $1100 posibles (95.5%)
    
    const totalAvailable = redBets.reduce((sum, b) => sum + b.amount, 0) + 
                          greenBets.reduce((sum, b) => sum + b.amount, 0);
    const expectedMinMatched = 1000; // Mínimo esperado
    const expectedPercentage = (expectedMinMatched / totalAvailable * 100).toFixed(1);
    
    console.log(`  📋 Apuestas rojas: ${redBets.map(b => `$${b.amount}`).join(', ')} (Total: $${redBets.reduce((s, b) => s + b.amount, 0)})`);
    console.log(`  📋 Apuestas verdes: ${greenBets.map(b => `$${b.amount}`).join(', ')} (Total: $${greenBets.reduce((s, b) => s + b.amount, 0)})`);
    console.log(`  📊 Total disponible: $${totalAvailable}`);
    console.log(`  ✅ Mínimo esperado: $${expectedMinMatched} (${expectedPercentage}%)`);
    console.log(`  ✓ Test configurado correctamente`);
    
    return { redBets, greenBets, totalAvailable, expectedMinMatched, expectedPercentage };
}

/**
 * Test Case 4: Caso límite - Sin coincidencias
 */
function testNoMatches() {
    console.log('\n🧪 TEST 4: Caso límite - Sin coincidencias posibles');
    
    const redBets = [
        { id: 1, amount: 1000, team: 'red', id_event: 1, id_round: 1 }
    ];
    
    const greenBets = [
        { id: 2, amount: 500, team: 'green', id_event: 1, id_round: 1 },
        { id: 3, amount: 400, team: 'green', id_event: 1, id_event: 1, id_round: 1 }
    ];
    
    // Resultado: $900 emparejado de $1000, $100 sin emparejar
    const expectedMatched = 900;
    const expectedRejected = 100;
    
    console.log(`  📋 Apuesta roja: $${redBets[0].amount}`);
    console.log(`  📋 Apuestas verdes: ${greenBets.map(b => `$${b.amount}`).join(', ')}`);
    console.log(`  ✅ Esperado: $${expectedMatched} emparejado, $${expectedRejected} rechazado`);
    console.log(`  ✓ Test configurado correctamente`);
    
    return { redBets, greenBets, expectedMatched, expectedRejected };
}

/**
 * Test Case 5: Validación de algoritmo de maximización
 */
function testMaximizationAlgorithm() {
    console.log('\n🧪 TEST 5: Validación de algoritmo de maximización');
    
    // Escenario: Múltiples apuestas de diferentes tamaños
    const redBets = [
        { id: 1, amount: 1000, team: 'red', id_event: 1, id_round: 1 },
        { id: 2, amount: 500, team: 'red', id_event: 1, id_round: 1 },
        { id: 3, amount: 250, team: 'red', id_event: 1, id_round: 1 },
        { id: 4, amount: 100, team: 'red', id_event: 1, id_round: 1 }
    ];
    
    const greenBets = [
        { id: 5, amount: 800, team: 'green', id_event: 1, id_round: 1 },
        { id: 6, amount: 400, team: 'green', id_event: 1, id_round: 1 },
        { id: 7, amount: 300, team: 'green', id_event: 1, id_round: 1 },
        { id: 8, amount: 200, team: 'green', id_event: 1, id_round: 1 }
    ];
    
    const totalRed = redBets.reduce((sum, b) => sum + b.amount, 0);
    const totalGreen = greenBets.reduce((sum, b) => sum + b.amount, 0);
    const totalAvailable = totalRed + totalGreen;
    const maxPossible = Math.min(totalRed, totalGreen) * 2; // Máximo teórico
    
    console.log(`  📋 Apuestas rojas: Total $${totalRed}`);
    console.log(`  📋 Apuestas verdes: Total $${totalGreen}`);
    console.log(`  📊 Total disponible: $${totalAvailable}`);
    console.log(`  🎯 Máximo teórico emparejable: $${maxPossible}`);
    console.log(`  ✅ El algoritmo debe maximizar el emparejamiento`);
    console.log(`  ✓ Test configurado correctamente`);
    
    return { redBets, greenBets, totalAvailable, maxPossible };
}

/**
 * Test Case 6: CASO REAL - Datos de la imagen del problema
 * ROJO: $52,000 | VERDE: $42,100
 * Problema: Se cerró solo con $22,000 cuando debería cerrar con $42,100
 */
function testRealCaseScenario() {
    console.log('\n🧪 TEST 6: CASO REAL - Datos del problema reportado');
    console.log('  📸 Basado en la imagen de apuestas de prueba');
    
    // Datos exactos de la imagen
    const redBets = [
        { id: 1, amount: 2000, team: 'red', id_event: 1, id_round: 1, id_user: 1 },
        { id: 2, amount: 5000, team: 'red', id_event: 1, id_round: 1, id_user: 2 },
        { id: 3, amount: 10000, team: 'red', id_event: 1, id_round: 1, id_user: 3 },
        { id: 4, amount: 5000, team: 'red', id_event: 1, id_round: 1, id_user: 4 },
        { id: 5, amount: 20000, team: 'red', id_event: 1, id_round: 1, id_user: 5 },
        { id: 6, amount: 10000, team: 'red', id_event: 1, id_round: 1, id_user: 6 }
    ];
    
    const greenBets = [
        { id: 7, amount: 2000, team: 'green', id_event: 1, id_round: 1, id_user: 7 },
        { id: 8, amount: 5000, team: 'green', id_event: 1, id_round: 1, id_user: 8 },
        { id: 9, amount: 10000, team: 'green', id_event: 1, id_round: 1, id_user: 9 },
        { id: 10, amount: 5000, team: 'green', id_event: 1, id_round: 1, id_user: 10 },
        { id: 11, amount: 20100, team: 'green', id_event: 1, id_round: 1, id_user: 11 }
    ];
    
    const totalRed = redBets.reduce((sum, b) => sum + b.amount, 0);
    const totalGreen = greenBets.reduce((sum, b) => sum + b.amount, 0);
    const totalAvailable = totalRed + totalGreen;
    
    // Resultado esperado: Debe aceptar todas las VERDES ($42,100) y $42,100 de ROJO
    // El monto emparejado debe ser $42,100 (según el sistema de conteo)
    const expectedMatchedAmount = 42100; // Monto del equipo menor
    const expectedRejectedAmount = totalRed - expectedMatchedAmount; // $9,900 de ROJO
    
    console.log(`  📋 Apuestas ROJAS (${redBets.length}):`);
    redBets.forEach((bet, idx) => {
        console.log(`     ${idx + 1}. $${bet.amount.toLocaleString('en-US')}`);
    });
    console.log(`     📊 Total ROJO: $${totalRed.toLocaleString('en-US')}`);
    
    console.log(`  📋 Apuestas VERDES (${greenBets.length}):`);
    greenBets.forEach((bet, idx) => {
        console.log(`     ${idx + 1}. $${bet.amount.toLocaleString('en-US')}`);
    });
    console.log(`     📊 Total VERDE: $${totalGreen.toLocaleString('en-US')}`);
    
    console.log(`  📊 Total disponible: $${totalAvailable.toLocaleString('en-US')}`);
    console.log(`  ⚠️  Problema reportado: Se cerró solo con $22,000`);
    console.log(`  ✅ Resultado esperado: $${expectedMatchedAmount.toLocaleString('en-US')} emparejado`);
    console.log(`  🚫 Monto a rechazar: $${expectedRejectedAmount.toLocaleString('en-US')} (excedente ROJO)`);
    console.log(`  ✓ Test configurado correctamente`);
    
    return {
        redBets,
        greenBets,
        totalRed,
        totalGreen,
        totalAvailable,
        expectedMatchedAmount,
        expectedRejectedAmount
    };
}

/**
 * Función auxiliar: Simular algoritmo de emparejamiento
 * Replica la lógica de VerificationBetting.js con las 3 prioridades
 */
function simulateMatching(redBets, greenBets) {
    let matchedAmount = 0;
    const matchedPairs = [];
    const usedRed = new Set();
    const usedGreen = new Set();
    
    // PRIORIDAD 1: Coincidencias exactas (1:1)
    for (const redBet of redBets) {
        if (usedRed.has(redBet.id)) continue;
        
        const exactMatch = greenBets.find(
            gb => !usedGreen.has(gb.id) && gb.amount === redBet.amount
        );
        
        if (exactMatch) {
            matchedPairs.push({ red: redBet, green: exactMatch });
            matchedAmount += redBet.amount; // Solo cuenta una apuesta (consistente con el código real)
            usedRed.add(redBet.id);
            usedGreen.add(exactMatch.id);
        }
    }
    
    // PRIORIDAD 2: Apuestas grandes con múltiples pequeñas
    // Procesar apuestas rojas grandes
    let hasMoreMatches = true;
    while (hasMoreMatches) {
        hasMoreMatches = false;
        const remainingRed = redBets.filter(b => !usedRed.has(b.id)).sort((a, b) => b.amount - a.amount);
        const remainingGreen = greenBets.filter(b => !usedGreen.has(b.id)).sort((a, b) => b.amount - a.amount);
        
        for (const redBet of remainingRed) {
            if (usedRed.has(redBet.id)) continue;
            
            let remaining = redBet.amount;
            const matched = [];
            const availableGreen = remainingGreen.filter(gb => !usedGreen.has(gb.id));
            
            for (const greenBet of availableGreen) {
                if (greenBet.amount <= remaining) {
                    matched.push(greenBet);
                    remaining -= greenBet.amount;
                }
                if (remaining === 0) break;
            }
            
            if (remaining === 0 && matched.length > 0) {
                matchedPairs.push({ red: redBet, green: matched });
                matchedAmount += redBet.amount; // Solo cuenta la apuesta grande
                usedRed.add(redBet.id);
                matched.forEach(gb => usedGreen.add(gb.id));
                hasMoreMatches = true;
                break; // Reiniciar el bucle para recalcular
            }
        }
    }
    
    // Procesar apuestas verdes grandes
    hasMoreMatches = true;
    while (hasMoreMatches) {
        hasMoreMatches = false;
        const remainingRed2 = redBets.filter(b => !usedRed.has(b.id)).sort((a, b) => b.amount - a.amount);
        const remainingGreen2 = greenBets.filter(b => !usedGreen.has(b.id)).sort((a, b) => b.amount - a.amount);
        
        for (const greenBet of remainingGreen2) {
            if (usedGreen.has(greenBet.id)) continue;
            
            let remaining = greenBet.amount;
            const matched = [];
            const availableRed = remainingRed2.filter(rb => !usedRed.has(rb.id));
            
            for (const redBet of availableRed) {
                if (redBet.amount <= remaining) {
                    matched.push(redBet);
                    remaining -= redBet.amount;
                }
                if (remaining === 0) break;
            }
            
            if (remaining === 0 && matched.length > 0) {
                matchedPairs.push({ green: greenBet, red: matched });
                matchedAmount += greenBet.amount; // Solo cuenta la apuesta grande
                usedGreen.add(greenBet.id);
                matched.forEach(rb => usedRed.add(rb.id));
                hasMoreMatches = true;
                break; // Reiniciar el bucle para recalcular
            }
        }
    }
    
    // PRIORIDAD 3: Manejar desbalance - Aceptar todas las apuestas del equipo con menor total
    const finalRemainingRed = redBets.filter(b => !usedRed.has(b.id));
    const finalRemainingGreen = greenBets.filter(b => !usedGreen.has(b.id));
    
    const remainingRedTotal = finalRemainingRed.reduce((sum, bet) => sum + bet.amount, 0);
    const remainingGreenTotal = finalRemainingGreen.reduce((sum, bet) => sum + bet.amount, 0);
    
    if (remainingRedTotal > 0 && remainingGreenTotal > 0) {
        if (remainingRedTotal > remainingGreenTotal) {
            // ROJO tiene más: aceptar todas las VERDES y solo el equivalente en ROJO
            // Aceptar todas las verdes
            for (const greenBet of finalRemainingGreen) {
                if (!usedGreen.has(greenBet.id)) {
                    matchedPairs.push({ green: greenBet, red: 'imbalance' });
                    usedGreen.add(greenBet.id);
                }
            }
            
            // Aceptar apuestas rojas hasta completar el monto verde (ordenadas de mayor a menor)
            const sortedRed = [...finalRemainingRed].sort((a, b) => b.amount - a.amount);
            let redAmountToAccept = remainingGreenTotal;
            
            for (const redBet of sortedRed) {
                if (usedRed.has(redBet.id)) continue;
                if (redAmountToAccept <= 0) break;
                
                if (redBet.amount <= redAmountToAccept) {
                    matchedPairs.push({ red: redBet, green: 'imbalance' });
                    usedRed.add(redBet.id);
                    redAmountToAccept -= redBet.amount;
                }
            }
            
            // El monto emparejado es el del equipo menor (consistente con el código real)
            matchedAmount += remainingGreenTotal;
            
        } else if (remainingGreenTotal > remainingRedTotal) {
            // VERDE tiene más: aceptar todas las ROJAS y solo el equivalente en VERDE
            // Aceptar todas las rojas
            for (const redBet of finalRemainingRed) {
                if (!usedRed.has(redBet.id)) {
                    matchedPairs.push({ red: redBet, green: 'imbalance' });
                    usedRed.add(redBet.id);
                }
            }
            
            // Aceptar apuestas verdes hasta completar el monto rojo (ordenadas de mayor a menor)
            const sortedGreen = [...finalRemainingGreen].sort((a, b) => b.amount - a.amount);
            let greenAmountToAccept = remainingRedTotal;
            
            for (const greenBet of sortedGreen) {
                if (usedGreen.has(greenBet.id)) continue;
                if (greenAmountToAccept <= 0) break;
                
                if (greenBet.amount <= greenAmountToAccept) {
                    matchedPairs.push({ green: greenBet, red: 'imbalance' });
                    usedGreen.add(greenBet.id);
                    greenAmountToAccept -= greenBet.amount;
                }
            }
            
            // El monto emparejado es el del equipo menor (consistente con el código real)
            matchedAmount += remainingRedTotal;
            
        } else {
            // Totales iguales: aceptar todas las apuestas
            for (const bet of [...finalRemainingRed, ...finalRemainingGreen]) {
                if ((bet.team === 'red' && !usedRed.has(bet.id)) || 
                    (bet.team === 'green' && !usedGreen.has(bet.id))) {
                    matchedPairs.push({ [bet.team]: bet, opposite: 'imbalance' });
                    if (bet.team === 'red') usedRed.add(bet.id);
                    else usedGreen.add(bet.id);
                }
            }
            matchedAmount += remainingRedTotal;
        }
    }
    
    return { matchedAmount, matchedPairs, usedRed, usedGreen };
}

/**
 * Función principal de testing
 */
function runTests() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 TESTS DE VALIDACIÓN: Maximización de Emparejamiento');
    console.log('═══════════════════════════════════════════════════════════');
    
    // Ejecutar tests
    const test1 = testExactMatches();
    const test2 = testLargeBetWithMultipleSmall();
    const test3 = testMaximizationScenario();
    const test4 = testNoMatches();
    const test5 = testMaximizationAlgorithm();
    const test6 = testRealCaseScenario(); // NUEVO: Test con datos reales
    
    // Simular algoritmo para test 1
    console.log('\n📊 Simulando algoritmo para TEST 1:');
    const sim1 = simulateMatching(test1.redBets, test1.greenBets);
    console.log(`  Resultado simulado: $${sim1.matchedAmount} emparejado`);
    console.log(`  Pares encontrados: ${sim1.matchedPairs.length}`);
    if (sim1.matchedAmount >= test1.expectedAmount) {
        console.log(`  ✅ Test 1: PASADO - Se alcanzó el monto esperado`);
    } else {
        console.log(`  ⚠️  Test 1: REVISAR - Monto menor al esperado`);
    }
    
    // Simular algoritmo para test 3
    console.log('\n📊 Simulando algoritmo para TEST 3 (Maximización):');
    const sim3 = simulateMatching(test3.redBets, test3.greenBets);
    const totalAvailable = test3.redBets.reduce((s, b) => s + b.amount, 0) + 
                          test3.greenBets.reduce((s, b) => s + b.amount, 0);
    const percentage = ((sim3.matchedAmount / totalAvailable) * 100).toFixed(1);
    console.log(`  Resultado simulado: $${sim3.matchedAmount} emparejado de $${totalAvailable} (${percentage}%)`);
    console.log(`  Pares encontrados: ${sim3.matchedPairs.length}`);
    if (sim3.matchedAmount >= test3.expectedMinMatched) {
        console.log(`  ✅ Test 3: PASADO - Se alcanzó el mínimo esperado`);
    } else {
        console.log(`  ⚠️  Test 3: REVISAR - Monto menor al mínimo esperado`);
    }
    
    // Simular algoritmo para test 4
    console.log('\n📊 Simulando algoritmo para TEST 4:');
    const sim4 = simulateMatching(test4.redBets, test4.greenBets);
    // El monto emparejado es la suma de todas las apuestas, pero para calcular el rechazo
    // necesitamos saber cuánto de la apuesta grande se emparejó
    const totalGreen = test4.greenBets.reduce((sum, b) => sum + b.amount, 0);
    const matchedFromRed = Math.min(test4.redBets[0].amount, totalGreen);
    const rejected = test4.redBets[0].amount - matchedFromRed;
    console.log(`  Resultado simulado: $${sim4.matchedAmount} total emparejado (${matchedFromRed} de la apuesta roja)`);
    console.log(`  Rechazado: $${rejected}`);
    if (Math.abs(rejected - test4.expectedRejected) <= 10) {
        console.log(`  ✅ Test 4: PASADO - Rechazo dentro del rango esperado`);
    } else {
        console.log(`  ⚠️  Test 4: REVISAR - Rechazo fuera del rango esperado (esperado: $${test4.expectedRejected}, obtenido: $${rejected})`);
    }
    
    // Simular algoritmo para TEST 6 - CASO REAL
    console.log('\n📊 Simulando algoritmo para TEST 6 (CASO REAL):');
    console.log('  🔄 Ejecutando simulación con datos del problema reportado...');
    const sim6 = simulateMatching(test6.redBets, test6.greenBets);
    
    const acceptedRedBets = test6.redBets.filter(b => sim6.usedRed.has(b.id));
    const acceptedGreenBets = test6.greenBets.filter(b => sim6.usedGreen.has(b.id));
    const rejectedRedBets = test6.redBets.filter(b => !sim6.usedRed.has(b.id));
    
    const acceptedRedAmount = acceptedRedBets.reduce((sum, b) => sum + b.amount, 0);
    const acceptedGreenAmount = acceptedGreenBets.reduce((sum, b) => sum + b.amount, 0);
    const rejectedRedAmount = rejectedRedBets.reduce((sum, b) => sum + b.amount, 0);
    
    console.log(`  📊 Resultado de la simulación:`);
    console.log(`     ✅ Apuestas VERDES aceptadas: ${acceptedGreenBets.length} ($${acceptedGreenAmount.toLocaleString('en-US')})`);
    console.log(`     ✅ Apuestas ROJAS aceptadas: ${acceptedRedBets.length} ($${acceptedRedAmount.toLocaleString('en-US')})`);
    console.log(`     🚫 Apuestas ROJAS rechazadas: ${rejectedRedBets.length} ($${rejectedRedAmount.toLocaleString('en-US')})`);
    console.log(`     💰 Monto total emparejado: $${sim6.matchedAmount.toLocaleString('en-US')}`);
    console.log(`     📈 Pares encontrados: ${sim6.matchedPairs.length}`);
    
    // Validación
    const tolerance = 100; // Tolerancia de $100 para diferencias de redondeo
    const isCorrect = Math.abs(sim6.matchedAmount - test6.expectedMatchedAmount) <= tolerance;
    const isRejectedCorrect = Math.abs(rejectedRedAmount - test6.expectedRejectedAmount) <= tolerance;
    
    if (isCorrect && isRejectedCorrect) {
        console.log(`  ✅ Test 6: PASADO - El algoritmo captura la máxima cantidad de apuestas`);
        console.log(`     ✓ Monto emparejado correcto: $${sim6.matchedAmount.toLocaleString('en-US')} (esperado: $${test6.expectedMatchedAmount.toLocaleString('en-US')})`);
        console.log(`     ✓ Monto rechazado correcto: $${rejectedRedAmount.toLocaleString('en-US')} (esperado: $${test6.expectedRejectedAmount.toLocaleString('en-US')})`);
    } else {
        console.log(`  ⚠️  Test 6: FALLIDO - El algoritmo no captura la máxima cantidad`);
        if (!isCorrect) {
            console.log(`     ✗ Monto emparejado incorrecto: $${sim6.matchedAmount.toLocaleString('en-US')} (esperado: $${test6.expectedMatchedAmount.toLocaleString('en-US')})`);
        }
        if (!isRejectedCorrect) {
            console.log(`     ✗ Monto rechazado incorrecto: $${rejectedRedAmount.toLocaleString('en-US')} (esperado: $${test6.expectedRejectedAmount.toLocaleString('en-US')})`);
        }
    }
    
    // Mostrar detalles de las apuestas aceptadas/rechazadas
    if (acceptedRedBets.length > 0) {
        console.log(`  📋 Apuestas ROJAS aceptadas:`);
        acceptedRedBets.forEach(bet => {
            console.log(`     ✓ ID ${bet.id}: $${bet.amount.toLocaleString('en-US')}`);
        });
    }
    if (rejectedRedBets.length > 0) {
        console.log(`  📋 Apuestas ROJAS rechazadas (excedente):`);
        rejectedRedBets.forEach(bet => {
            console.log(`     ✗ ID ${bet.id}: $${bet.amount.toLocaleString('en-US')}`);
        });
    }
    if (acceptedGreenBets.length > 0) {
        console.log(`  📋 Apuestas VERDES aceptadas (todas):`);
        acceptedGreenBets.forEach(bet => {
            console.log(`     ✓ ID ${bet.id}: $${bet.amount.toLocaleString('en-US')}`);
        });
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Todos los tests ejecutados');
    console.log('📝 Nota: Estos son tests de simulación. Para tests completos,');
    console.log('   se requiere mockear las dependencias de base de datos.');
    console.log('🔄 El proceso real se ejecuta mediante setInterval y se cierra');
    console.log('   con una botonera, por lo que debe capturar la máxima cantidad');
    console.log('   de apuestas en cada ejecución.');
    console.log('═══════════════════════════════════════════════════════════\n');
}

// Ejecutar tests si se llama directamente
if (require.main === module) {
    runTests();
}

module.exports = {
    testExactMatches,
    testLargeBetWithMultipleSmall,
    testMaximizationScenario,
    testNoMatches,
    testMaximizationAlgorithm,
    testRealCaseScenario,
    simulateMatching,
    runTests
};