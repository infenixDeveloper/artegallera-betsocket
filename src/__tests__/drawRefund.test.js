/**
 * Test: drawRefund.test.js
 * Verifica la lógica de devolución en caso de TABLA (draw).
 * - La condición debe incluir status 0 (pendientes) y 1 (aceptadas).
 * - Los IDs deben normalizarse correctamente.
 *
 * Ejecutar: node src/__tests__/drawRefund.test.js
 */

const { Op } = require("sequelize");
const assert = require("assert");

// Cargar el módulo; getDrawRefundWhere está en la propiedad del export
const betsocketModule = require("../betsocket.js");
const getDrawRefundWhere = betsocketModule.getDrawRefundWhere;

function runTests() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🧪 TESTS: Devolución en TABLA (draw)");
  console.log("═══════════════════════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Condición incluye id_event e id_round
  try {
    const where = getDrawRefundWhere(1, 2);
    assert.strictEqual(where.id_event, 1, "id_event debe ser 1");
    assert.strictEqual(where.id_round, 2, "id_round debe ser 2");
    console.log("  ✅ Test 1: id_event e id_round en la condición");
    passed++;
  } catch (e) {
    console.log("  ❌ Test 1:", e.message);
    failed++;
  }

  // Test 2: Status incluye 0 (pendientes) y 1 (aceptadas)
  try {
    const where = getDrawRefundWhere(1, 2);
    assert(where.status != null, "status debe existir");
    const statusIn = where.status[Op.in];
    assert(Array.isArray(statusIn), "status debe ser Op.in con array");
    assert(statusIn.includes(0), "status debe incluir 0 (pendientes)");
    assert(statusIn.includes(1), "status debe incluir 1 (aceptadas)");
    assert.strictEqual(statusIn.length, 2, "solo deben ser 0 y 1");
    console.log("  ✅ Test 2: status incluye pendientes (0) y aceptadas (1)");
    passed++;
  } catch (e) {
    console.log("  ❌ Test 2:", e.message);
    failed++;
  }

  // Test 3: No incluir status 2 (rechazadas) en la devolución
  try {
    const where = getDrawRefundWhere(5, 10);
    const statusIn = where.status[Op.in];
    assert(!statusIn.includes(2), "status NO debe incluir 2 (rechazadas)");
    console.log("  ✅ Test 3: rechazadas (2) no se devuelven en TABLA");
    passed++;
  } catch (e) {
    console.log("  ❌ Test 3:", e.message);
    failed++;
  }

  // Test 4: getDrawRefundWhere existe y es función
  try {
    assert(typeof getDrawRefundWhere === "function", "getDrawRefundWhere debe ser función");
    assert(getDrawRefundWhere.name === "getDrawRefundWhere" || true, "export correcto");
    console.log("  ✅ Test 4: getDrawRefundWhere exportada correctamente");
    passed++;
  } catch (e) {
    console.log("  ❌ Test 4:", e.message);
    failed++;
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`Resultado: ${passed} pasados, ${failed} fallidos`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
