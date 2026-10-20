// =====================================================================
// MPARFUM - Script 04: medición de desempeño de consultas e índices
// Uso: mongosh "mongodb://localhost:27017" scripts/04_desempeño_indices.js
//
// Cada consulta se ejecuta con explain("executionStats") dos veces:
//   - SIN índice: forzando un recorrido completo con hint({$natural: 1})
//   - CON índice: dejando que el optimizador elija (o con el índice indicado)
// Se informan documentos/claves examinados, documentos devueltos y tiempo.
// Para diferencias más notorias cargar más pedidos:
//   mongosh --eval "var CANT_PEDIDOS=200000" scripts/01_carga_datos.js
// =====================================================================

db = db.getSiblingDB("mparfum");
const REPETICIONES = 5;

// Recorre el plan ganador y devuelve la secuencia de etapas (ej: LIMIT <- FETCH <- IXSCAN)
function etapas(plan) {
  const res = [];
  while (plan) {
    res.push(plan.stage + (plan.indexName ? `(${plan.indexName})` : ""));
    plan = plan.inputStage || (plan.inputStages && plan.inputStages[0]);
  }
  return res.join(" <- ");
}

function resumen(exp) {
  // En agregaciones el plan puede venir dentro de la primera etapa ($cursor)
  const base = exp.executionStats ? exp : exp.stages[0].$cursor;
  const st = base.executionStats;
  const plan = base.queryPlanner.winningPlan.queryPlan || base.queryPlanner.winningPlan;
  return { plan: etapas(plan), docsExaminados: st.totalDocsExamined, clavesExaminadas: st.totalKeysExamined, devueltos: st.nReturned, ms: st.executionTimeMillis };
}

// Ejecuta varias veces y se queda con el menor tiempo (evita ruido de caché)
function medir(fnExplain) {
  let mejor;
  for (let i = 0; i < REPETICIONES; i++) {
    const r = resumen(fnExplain());
    if (!mejor || r.ms < mejor.ms) mejor = r;
  }
  return mejor;
}

const filas = [];
function comparar(id, descripcion, sinIndice, conIndice) {
  const a = medir(sinIndice), b = medir(conIndice);
  filas.push({ id, descripcion, a, b });
  print(`\n${id}. ${descripcion}`);
  print(`   SIN índice: ${a.plan}`);
  print(`               docs=${a.docsExaminados}  claves=${a.clavesExaminadas}  devueltos=${a.devueltos}  ${a.ms} ms`);
  print(`   CON índice: ${b.plan}`);
  print(`               docs=${b.docsExaminados}  claves=${b.clavesExaminadas}  devueltos=${b.devueltos}  ${b.ms} ms`);
}

print(`Pedidos en la colección: ${db.pedidos.estimatedDocumentCount()}`);

// --- Datos de prueba para los filtros ---
const clienteFrecuente = db.pedidos.aggregate([{ $group: { _id: "$cliente._id", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 }]).next()._id;
const emailEjemplo = db.clientes.findOne({}, { email: 1 }).email;
const numeroEjemplo = db.pedidos.find({}, { numero: 1 }).sort({ numero: -1 }).limit(1).next().numero - 1234;
const productoPoco = db.productos.findOne({ nombre: "Naked3 Paleta de Sombras" })._id;
const mesDesde = ISODate("2026-09-01T03:00:00Z"), mesHasta = ISODate("2026-10-01T03:00:00Z");

// P1 - Historial de pedidos de un cliente (índice compuesto que además resuelve el sort)
const q1 = { "cliente._id": clienteFrecuente };
comparar("P1", "Últimos 10 pedidos de un cliente (find + sort por fecha)",
  () => db.pedidos.find(q1).sort({ fecha: -1 }).limit(10).hint({ $natural: 1 }).explain("executionStats"),
  () => db.pedidos.find(q1).sort({ fecha: -1 }).limit(10).explain("executionStats"));

// P2 - Búsqueda por número de pedido (índice único)
comparar("P2", "Pedido por número (igualdad sobre índice único)",
  () => db.pedidos.find({ numero: numeroEjemplo }).hint({ $natural: 1 }).explain("executionStats"),
  () => db.pedidos.find({ numero: numeroEjemplo }).explain("executionStats"));

// P3 - Pedidos de un mes ya entregados (rango sobre fecha)
const q3 = { fecha: { $gte: mesDesde, $lt: mesHasta }, estado: "entregado" };
comparar("P3", "Pedidos entregados en septiembre 2026 (rango de fechas)",
  () => db.pedidos.find(q3).hint({ $natural: 1 }).explain("executionStats"),
  () => db.pedidos.find(q3).explain("executionStats"));

// P4 - Cola de despacho del depósito: regla ESR
const q4 = { estado: { $in: ["pagado", "preparando"] }, deposito: "DEP-MZA" };
comparar("P4", "Cola de despacho del Depósito Cuyo ordenada por fecha",
  () => db.pedidos.find(q4).sort({ fecha: 1 }).hint({ $natural: 1 }).explain("executionStats"),
  () => db.pedidos.find(q4).sort({ fecha: 1 }).explain("executionStats"));

// P5 - Pedidos que contienen un producto (índice multikey sobre items.productoId)
comparar("P5", "Pedidos que incluyen la paleta Naked3 (índice multikey)",
  () => db.pedidos.find({ "items.productoId": productoPoco }).hint({ $natural: 1 }).explain("executionStats"),
  () => db.pedidos.find({ "items.productoId": productoPoco }).explain("executionStats"));

// P6 - Consulta cubierta: el índice contiene todo lo que se proyecta (0 documentos leídos)
comparar("P6", "Login: existe el email? (consulta cubierta por el índice)",
  () => db.clientes.find({ email: emailEjemplo }, { _id: 0, email: 1 }).hint({ $natural: 1 }).explain("executionStats"),
  () => db.clientes.find({ email: emailEjemplo }, { _id: 0, email: 1 }).explain("executionStats"));

// P7 - Agregación: el $match inicial aprovecha el índice de fecha
const pipeline7 = [
  { $match: { fecha: { $gte: mesDesde, $lt: mesHasta }, estado: { $ne: "cancelado" } } },
  { $group: { _id: "$canal", total: { $sum: "$total" } } }
];
comparar("P7", "Agregación: facturación de septiembre 2026 por canal",
  () => db.pedidos.explain("executionStats").aggregate(pipeline7, { hint: { $natural: 1 } }),
  () => db.pedidos.explain("executionStats").aggregate(pipeline7));

// ---------------------------------------------------------------------
// Experimento ESR: mismo filtro que P4 con un índice mal ordenado
// (fecha primero = Range/Sort antes que Equality) vs el índice correcto.
// ---------------------------------------------------------------------
print("\n--- Experimento ESR (Equality, Sort, Range) sobre la consulta P4 ---");
const malo = medir(() => db.pedidos.find(q4).sort({ fecha: 1 }).hint("ix_fecha_estado").explain("executionStats"));
const bueno = medir(() => db.pedidos.find(q4).sort({ fecha: 1 }).hint("ix_estado_deposito_fecha").explain("executionStats"));
print(`   {fecha, estado}            -> claves=${malo.clavesExaminadas}  docs=${malo.docsExaminados}  ${malo.ms} ms  [${malo.plan}]`);
print(`   {estado, deposito, fecha}  -> claves=${bueno.clavesExaminadas}  docs=${bueno.docsExaminados}  ${bueno.ms} ms  [${bueno.plan}]`);

// ---------------------------------------------------------------------
// Texto: índice de texto vs. expresión regular sin anclar
// ---------------------------------------------------------------------
print("\n--- Buscador: $text vs $regex ---");
const tx = medir(() => db.productos.find({ $text: { $search: "vainilla" } }).explain("executionStats"));
const rx = medir(() => db.productos.find({ $or: [{ nombre: /vainilla/i }, { descripcion: /vainilla/i }, { etiquetas: /vainilla/i }] }).explain("executionStats"));
print(`   $text  -> docs=${tx.docsExaminados}  devueltos=${tx.devueltos}  [${tx.plan}]`);
print(`   $regex -> docs=${rx.docsExaminados}  devueltos=${rx.devueltos}  [${rx.plan}]`);

// ---------------------------------------------------------------------
print("\n=========================== RESUMEN ===========================");
print("Consulta | Docs examinados (sin -> con) | Tiempo ms (sin -> con)");
for (const f of filas) {
  print(`${f.id.padEnd(8)} | ${String(f.a.docsExaminados).padStart(7)} -> ${String(f.b.docsExaminados).padEnd(17)} | ${String(f.a.ms).padStart(5)} -> ${f.b.ms}`);
}

// Uso real de cada índice desde que arrancó el servidor
print("\nUso de índices de 'pedidos' ($indexStats):");
db.pedidos.aggregate([{ $indexStats: {} }, { $project: { _id: 0, name: 1, usos: "$accesses.ops" } }, { $sort: { usos: -1 } }])
  .forEach((d) => print(`   ${d.name.padEnd(26)} ${d.usos}`));
