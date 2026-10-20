// =====================================================================
// MPARFUM - Script 03: consultas del e-commerce (CRUD y agregaciones avanzadas)
// Uso: mongosh "mongodb://localhost:27017" scripts/03_consultas.js
// =====================================================================

db = db.getSiblingDB("mparfum");
const TZ = "America/Argentina/Mendoza";
function titulo(n, texto) { print(`\n${"=".repeat(70)}\nC${n}. ${texto}\n${"=".repeat(70)}`); }
function mostrar(cursor) { cursor.forEach((d) => printjson(d)); }

// ---------------------------------------------------------------------
titulo(1, "Fragancias de mujer florales con alguna presentación entre $150.000 y $300.000");
// $elemMatch obliga a que la MISMA variante cumpla ambas condiciones de rango
mostrar(db.productos.find(
  {
    tipo: "fragancia", genero: "mujer",
    "atributos.familiaOlfativa": /floral/i,
    variantes: { $elemMatch: { precio: { $gte: 150000, $lte: 300000 } } }
  },
  { _id: 0, nombre: 1, "marca.nombre": 1, "atributos.familiaOlfativa": 1, "variantes.presentacion": 1, "variantes.precio": 1 }
).sort({ "marca.nombre": 1 }));

// ---------------------------------------------------------------------
titulo(2, "Fragancias de hombre ordenadas por 'precio desde' (variante más barata)");
mostrar(db.productos.aggregate([
  { $match: { tipo: "fragancia", genero: "hombre", activo: true } },
  { $project: { _id: 0, nombre: 1, marca: "$marca.nombre", concentracion: "$atributos.concentracion", precioDesde: { $min: "$variantes.precio" } } },
  { $sort: { precioDesde: 1 } }
]));

// ---------------------------------------------------------------------
titulo(3, "Maquillaje: cantidad de productos y tonos por subcategoría (usa la ruta materializada)");
mostrar(db.productos.aggregate([
  { $match: { "categoria.ruta": "maquillaje" } },
  { $group: { _id: "$categoria._id", productos: { $sum: 1 }, tonos: { $sum: { $size: "$variantes" } }, marcas: { $addToSet: "$marca.nombre" } } },
  { $lookup: { from: "categorias", localField: "_id", foreignField: "_id", as: "cat" } },
  { $project: { _id: 0, categoria: { $first: "$cat.nombre" }, productos: 1, tonos: 1, marcas: 1 } },
  { $sort: { productos: -1, categoria: 1 } }
]));

// ---------------------------------------------------------------------
titulo(4, "Buscador de la tienda: 'vainilla' (índice de texto con relevancia)");
mostrar(db.productos.find(
  { $text: { $search: "vainilla" }, activo: true },
  { _id: 0, nombre: 1, "marca.nombre": 1, tipo: 1, relevancia: { $meta: "textScore" } }
).sort({ relevancia: { $meta: "textScore" } }).limit(8));

// ---------------------------------------------------------------------
titulo(5, "'Mis pedidos': últimos 5 pedidos del cliente con más compras");
const top = db.pedidos.aggregate([{ $group: { _id: "$cliente._id", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 }]).next();
mostrar(db.pedidos.find(
  { "cliente._id": top._id },
  { _id: 0, numero: 1, fecha: 1, canal: 1, estado: 1, total: 1, cantItems: { $size: "$items" } }
).sort({ fecha: -1 }).limit(5));

// ---------------------------------------------------------------------
titulo(6, "Ventas mensuales de 2026 por canal (excluye cancelados)");
mostrar(db.pedidos.aggregate([
  { $match: { fecha: { $gte: ISODate("2026-01-01T03:00:00Z"), $lt: ISODate("2027-01-01T03:00:00Z") }, estado: { $ne: "cancelado" } } },
  { $group: { _id: { mes: { $dateToString: { format: "%Y-%m", date: "$fecha", timezone: TZ } }, canal: "$canal" }, pedidos: { $sum: 1 }, facturacion: { $sum: "$total" } } },
  { $group: { _id: "$_id.mes", canales: { $push: { k: "$_id.canal", v: "$facturacion" } }, pedidos: { $sum: "$pedidos" }, total: { $sum: "$facturacion" } } },
  { $project: { _id: 0, mes: "$_id", pedidos: 1, total: 1, porCanal: { $arrayToObject: "$canales" } } },
  { $sort: { mes: 1 } }
]));

// ---------------------------------------------------------------------
titulo(7, "Top 10 productos por facturación (últimos 12 meses)");
mostrar(db.pedidos.aggregate([
  { $match: { fecha: { $gte: ISODate("2025-10-19T00:00:00Z") }, estado: { $ne: "cancelado" } } },
  { $unwind: "$items" },
  { $group: { _id: "$items.productoId", unidades: { $sum: "$items.cantidad" }, facturacion: { $sum: { $multiply: ["$items.cantidad", "$items.precioUnitario"] } } } },
  { $sort: { facturacion: -1 } },
  { $limit: 10 },
  { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "p", pipeline: [{ $project: { nombre: 1, "marca.nombre": 1, tipo: 1 } }] } },
  { $unwind: "$p" },
  { $project: { _id: 0, producto: "$p.nombre", marca: "$p.marca.nombre", tipo: "$p.tipo", unidades: 1, facturacion: 1 } }
]));

// ---------------------------------------------------------------------
titulo(8, "Mejor puntuados (activos, al menos 50 reseñas) - usa el índice parcial");
mostrar(db.productos.find(
  { activo: true, "rating.promedio": { $gte: 4 }, "rating.cantidad": { $gte: 50 } },
  { _id: 0, nombre: 1, "marca.nombre": 1, rating: 1 }
).sort({ "rating.promedio": -1 }).limit(5));

// ---------------------------------------------------------------------
titulo(9, "Participación de cada rubro en la facturación 2026 (perfumes vs cosméticos)");
mostrar(db.pedidos.aggregate([
  { $match: { fecha: { $gte: ISODate("2026-01-01T03:00:00Z") }, estado: { $ne: "cancelado" } } },
  { $unwind: "$items" },
  { $group: { _id: "$items.tipo", facturacion: { $sum: { $multiply: ["$items.cantidad", "$items.precioUnitario"] } }, unidades: { $sum: "$items.cantidad" } } },
  { $setWindowFields: { sortBy: { facturacion: -1 }, output: { totalGeneral: { $sum: "$facturacion", window: { documents: ["unbounded", "unbounded"] } } } } },
  { $project: { _id: 0, rubro: "$_id", unidades: 1, facturacion: 1, porcentaje: { $round: [{ $multiply: [{ $divide: ["$facturacion", "$totalGeneral"] }, 100] }, 1] } } }
]));

// ---------------------------------------------------------------------
titulo(10, "Efectividad de cada promoción");
mostrar(db.pedidos.aggregate([
  { $match: { promocion: { $exists: true }, estado: { $ne: "cancelado" } } },
  { $group: { _id: "$promocion", pedidos: { $sum: 1 }, descuentoOtorgado: { $sum: "$descuento" }, ticketPromedio: { $avg: "$total" }, desde: { $min: "$fecha" }, hasta: { $max: "$fecha" } } },
  { $lookup: { from: "promociones", localField: "_id", foreignField: "codigo", as: "promo" } },
  { $project: { _id: 0, codigo: "$_id", descripcion: { $first: "$promo.descripcion" }, pedidos: 1, descuentoOtorgado: 1, ticketPromedio: { $round: ["$ticketPromedio", 0] } } },
  { $sort: { pedidos: -1 } }
]));

// ---------------------------------------------------------------------
titulo(11, "Cola de despacho del Depósito Cuyo: pedidos pagados o en preparación (más antiguos primero)");
mostrar(db.pedidos.find(
  { estado: { $in: ["pagado", "preparando"] }, deposito: "DEP-MZA" },
  { _id: 0, numero: 1, fecha: 1, estado: 1, "cliente.nombre": 1, "envio.tipo": 1, "envio.puntoRetiro": 1, "envio.direccion.ciudad": 1 }
).sort({ fecha: 1 }).limit(10));

// ---------------------------------------------------------------------
titulo(12, "Recomendación: quienes compraron 'Sauvage' también compraron...");
const sauvage = db.productos.findOne({ nombre: "Sauvage" }, { _id: 1 });
mostrar(db.pedidos.aggregate([
  { $match: { "items.productoId": sauvage._id } },
  { $unwind: "$items" },
  { $match: { "items.productoId": { $ne: sauvage._id } } },
  { $group: { _id: "$items.productoId", vecesJuntos: { $sum: 1 } } },
  { $sort: { vecesJuntos: -1 } },
  { $limit: 5 },
  { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "p" } },
  { $project: { _id: 0, producto: { $first: "$p.nombre" }, marca: { $first: "$p.marca.nombre" }, vecesJuntos: 1 } }
]));

// ---------------------------------------------------------------------
titulo(13, "Checkout: puntos de retiro más cercanos a la ubicación del cliente (Universidad de Mendoza)");
mostrar(db.depositos.aggregate([
  { $geoNear: { near: { type: "Point", coordinates: [-68.8535, -32.8829] }, distanceField: "distanciaMetros", maxDistance: 50000, query: { tipo: "punto_retiro" } } },
  { $project: { _id: 0, nombre: 1, "direccion.calle": 1, "direccion.ciudad": 1, horario: 1, distanciaKm: { $round: [{ $divide: ["$distanciaMetros", 1000] }, 2] } } }
]));

// ---------------------------------------------------------------------
titulo(14, "Reposición: variantes con 3 unidades o menos en cada depósito");
mostrar(db.productos.aggregate([
  { $match: { activo: true } },
  { $unwind: "$variantes" },
  { $unwind: "$variantes.stock" },
  { $match: { "variantes.stock.cantidad": { $lte: 3 } } },
  { $group: { _id: "$variantes.stock.deposito", aReponer: { $push: { producto: "$nombre", presentacion: "$variantes.presentacion", stock: "$variantes.stock.cantidad" } }, cantidad: { $sum: 1 } } },
  { $project: { cantidad: 1, primeros: { $slice: ["$aReponer", 4] } } },
  { $sort: { _id: 1 } }
]));

// ---------------------------------------------------------------------
titulo(15, "Árbol de categorías: descendientes de 'Maquillaje' ($graphLookup)");
mostrar(db.categorias.aggregate([
  { $match: { _id: "maquillaje" } },
  { $graphLookup: { from: "categorias", startWith: "$_id", connectFromField: "_id", connectToField: "padre", as: "descendientes", depthField: "profundidad" } },
  { $project: { _id: 0, nombre: 1, descendientes: { $sortArray: { input: { $map: { input: "$descendientes", in: { nombre: "$$this.nombre", profundidad: "$$this.profundidad", orden: "$$this.orden" } } }, sortBy: { orden: 1 } } } } }
]));

// ---------------------------------------------------------------------
titulo(16, "Notas olfativas más frecuentes en fragancias de mujer");
mostrar(db.productos.aggregate([
  { $match: { tipo: "fragancia", genero: "mujer" } },
  { $project: { notas: { $concatArrays: ["$atributos.notas.salida", "$atributos.notas.corazon", "$atributos.notas.fondo"] } } },
  { $unwind: "$notas" },
  { $group: { _id: "$notas", fragancias: { $sum: 1 } } },
  { $sort: { fragancias: -1, _id: 1 } },
  { $limit: 8 }
]));

// ---------------------------------------------------------------------
titulo(17, "Segmentación de clientes por gasto acumulado ($bucket)");
mostrar(db.pedidos.aggregate([
  { $match: { estado: { $ne: "cancelado" } } },
  { $group: { _id: "$cliente._id", gasto: { $sum: "$total" }, pedidos: { $sum: 1 } } },
  { $bucket: {
      groupBy: "$gasto",
      boundaries: [0, 500000, 1500000, 3000000, 6000000],
      default: "6M o más",
      output: { clientes: { $sum: 1 }, pedidosPromedio: { $avg: "$pedidos" }, gastoTotal: { $sum: "$gasto" } }
  } },
  { $project: { rango: "$_id", _id: 0, clientes: 1, gastoTotal: 1, pedidosPromedio: { $round: ["$pedidosPromedio", 1] } } }
]));

// ---------------------------------------------------------------------
titulo(18, "Filtros laterales del catálogo con $facet (una sola consulta)");
mostrar(db.productos.aggregate([
  { $match: { activo: true } },
  { $addFields: { precioDesde: { $min: "$variantes.precio" } } },
  { $facet: {
      porRubro: [{ $sortByCount: "$tipo" }],
      porMarca: [{ $sortByCount: "$marca.nombre" }, { $limit: 5 }],
      porPrecio: [{ $bucket: { groupBy: "$precioDesde", boundaries: [0, 50000, 100000, 200000, 400000], default: "400000+", output: { productos: { $sum: 1 } } } }]
  } }
]));

// ---------------------------------------------------------------------
titulo(19, "Promociones vigentes al 15/10/2026 aplicables a 'Good Girl' comprado por la web");
const gg = db.productos.findOne({ nombre: "Good Girl" });
const hoy = ISODate("2026-10-15T12:00:00Z");
mostrar(db.promociones.find({
  "vigencia.desde": { $lte: hoy }, "vigencia.hasta": { $gte: hoy },
  $and: [
    { $or: [{ "aplicaA.categorias": { $exists: false } }, { "aplicaA.categorias": gg.categoria._id }] },
    { $or: [{ "aplicaA.marcas": { $exists: false } }, { "aplicaA.marcas": gg.marca._id }] },
    { $or: [{ "aplicaA.canales": { $exists: false } }, { "aplicaA.canales": "web" }] }
  ]
}, { _id: 0, codigo: 1, descripcion: 1, tipo: 1, valor: 1 }));

// ---------------------------------------------------------------------
titulo(20, "Ticket promedio por provincia y nivel del club ($lookup a clientes)");
mostrar(db.pedidos.aggregate([
  { $match: { estado: { $ne: "cancelado" }, fecha: { $gte: ISODate("2026-01-01T03:00:00Z") } } },
  { $lookup: { from: "clientes", localField: "cliente._id", foreignField: "_id", as: "c", pipeline: [{ $project: { "club.nivel": 1 } }] } },
  { $group: { _id: { provincia: "$cliente.provincia", nivel: { $first: "$c.club.nivel" } }, ticketPromedio: { $avg: "$total" }, pedidos: { $sum: 1 } } },
  { $match: { pedidos: { $gte: 100 } } },
  { $project: { _id: 0, provincia: "$_id.provincia", nivel: "$_id.nivel", pedidos: 1, ticketPromedio: { $round: ["$ticketPromedio", 0] } } },
  { $sort: { provincia: 1, ticketPromedio: -1 } }
]));

// ---------------------------------------------------------------------
titulo(21, "Lista de deseos: productos más guardados en favoritos y cuántos se vendieron");
mostrar(db.clientes.aggregate([
  { $unwind: "$favoritos" },
  { $group: { _id: "$favoritos", clientesQueLoDesean: { $sum: 1 } } },
  { $sort: { clientesQueLoDesean: -1 } },
  { $limit: 5 },
  { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "p", pipeline: [{ $project: { nombre: 1, "marca.nombre": 1 } }] } },
  { $lookup: { from: "pedidos", localField: "_id", foreignField: "items.productoId", as: "ventas", pipeline: [{ $match: { fecha: { $gte: ISODate("2026-01-01T03:00:00Z") } } }, { $count: "n" }] } },
  { $project: { _id: 0, producto: { $first: "$p.nombre" }, marca: { $first: "$p.marca.nombre" }, clientesQueLoDesean: 1, pedidos2026: { $ifNull: [{ $first: "$ventas.n" }, 0] } } }
]));

// ---------------------------------------------------------------------
titulo(22, "Carritos abandonados (más de 3 días sin actividad): monto a recuperar con un mail de recordatorio");
const hace3dias = new Date(Date.now() - 3 * 86400000);
mostrar(db.carritos.aggregate([
  { $match: { actualizado: { $lt: hace3dias } } },
  { $set: { montoCarrito: { $sum: { $map: { input: "$items", in: { $multiply: ["$$this.precio", "$$this.cantidad"] } } } } } },
  { $lookup: { from: "clientes", localField: "clienteId", foreignField: "_id", as: "c", pipeline: [{ $project: { email: 1, "preferencias.aceptaNewsletter": 1 } }] } },
  { $match: { "c.preferencias.aceptaNewsletter": true } },
  { $facet: {
      resumen: [{ $group: { _id: null, carritos: { $sum: 1 }, montoTotal: { $sum: "$montoCarrito" }, promedio: { $avg: "$montoCarrito" } } }, { $project: { _id: 0, carritos: 1, montoTotal: 1, promedio: { $round: ["$promedio", 0] } } }],
      masAbandonados: [{ $unwind: "$items" }, { $group: { _id: "$items.nombre", veces: { $sum: 1 } } }, { $sort: { veces: -1 } }, { $limit: 3 }],
      paraContactar: [{ $sort: { montoCarrito: -1 } }, { $limit: 3 }, { $project: { _id: 0, email: { $first: "$c.email" }, montoCarrito: 1, actualizado: 1 } }]
  } }
]));

// ---------------------------------------------------------------------
titulo(23, "Logística: horas promedio entre el pago y la entrega por depósito y empresa de envío");
mostrar(db.pedidos.aggregate([
  { $match: { estado: "entregado", "envio.tipo": "domicilio", fecha: { $gte: ISODate("2026-01-01T03:00:00Z") } } },
  { $project: {
      deposito: 1, empresa: "$envio.empresa",
      pagado: { $first: { $filter: { input: "$historialEstados", cond: { $eq: ["$$this.estado", "pagado"] } } } },
      entregado: { $first: { $filter: { input: "$historialEstados", cond: { $eq: ["$$this.estado", "entregado"] } } } }
  } },
  { $group: { _id: { deposito: "$deposito", empresa: "$empresa" }, envios: { $sum: 1 }, horasPromedio: { $avg: { $dateDiff: { startDate: "$pagado.fecha", endDate: "$entregado.fecha", unit: "hour" } } } } },
  { $project: { _id: 0, deposito: "$_id.deposito", empresa: "$_id.empresa", envios: 1, horasPromedio: { $round: ["$horasPromedio", 1] } } },
  { $sort: { deposito: 1, horasPromedio: 1 } }
]));

// ---------------------------------------------------------------------
titulo(24, "Seguimiento de envío: el cliente consulta su pedido por código de tracking");
const unTracking = db.pedidos.findOne({ "envio.tracking": { $exists: true } }, { "envio.tracking": 1 }).envio.tracking;
mostrar(db.pedidos.find(
  { "envio.tracking": unTracking },
  { _id: 0, numero: 1, estado: 1, "envio.empresa": 1, "envio.tracking": 1, "envio.direccion.ciudad": 1, historialEstados: 1 }
));

// =====================================================================
// OPERACIONES DE ESCRITURA
// =====================================================================
titulo(25, "Confirmación de compra: reservar stock de una variante en el depósito con arrayFilters");
const sku = gg.variantes[0].sku;
const antes = db.productos.findOne({ "variantes.sku": sku }, { _id: 0, variantes: { $elemMatch: { sku } } }).variantes[0].stock.find((s) => s.deposito === "DEP-MZA");
// La condición "cantidad >= 1" en el filtro evita stock negativo (operación atómica sobre el documento)
const r = db.productos.updateOne(
  { "variantes": { $elemMatch: { sku, stock: { $elemMatch: { deposito: "DEP-MZA", cantidad: { $gte: 1 } } } } } },
  { $inc: { "variantes.$[v].stock.$[s].cantidad": NumberInt(-1) } },
  { arrayFilters: [{ "v.sku": sku }, { "s.deposito": "DEP-MZA" }] }
);
const despues = db.productos.findOne({ "variantes.sku": sku }, { _id: 0, variantes: { $elemMatch: { sku } } }).variantes[0].stock.find((s) => s.deposito === "DEP-MZA");
printjson({ sku, stockAntes: antes.cantidad, modificados: r.modifiedCount, stockDespues: despues.cantidad });

titulo(26, "Aumento de precios del 8% en fragancias de Puig (Rabanne, Carolina Herrera, JPG)");
const r2 = db.productos.updateMany(
  { tipo: "fragancia", "marca._id": { $in: ["rabanne", "carolina-herrera", "jpg"] } },
  [{ $set: { variantes: { $map: { input: "$variantes", in: { $mergeObjects: ["$$this", { precio: { $multiply: [{ $round: [{ $divide: [{ $multiply: ["$$this.precio", 1.08] }, 100] }, 0] }, 100] } }] } } } } }]
);
printjson({ productosActualizados: r2.modifiedCount });

titulo(27, "Recalcular el rating de todos los productos (patrón computed, $merge)");
db.reseñas.aggregate([
  { $group: { _id: "$productoId", promedio: { $avg: "$puntaje" }, cantidad: { $sum: 1 } } },
  { $project: { rating: { promedio: { $round: ["$promedio", 2] }, cantidad: { $toInt: "$cantidad" } } } },
  { $merge: { into: "productos", on: "_id", whenMatched: "merge", whenNotMatched: "discard" } }
]);
print("Ratings recalculados.");

titulo(28, "El validador rechaza un producto mal cargado");
try {
  db.productos.insertOne({ nombre: "Perfume sin datos", tipo: "perfume", variantes: [], activo: true });
} catch (e) {
  print(`Rechazado (código ${e.code}): ${e.errmsg || e.message}`);
}

titulo(29, "Transacción multi-documento: alta de pedido web + descuento de stock");
// Las transacciones requieren replica set. En un servidor standalone se informa y se omite.
if (db.hello().setName) {
  const sesion = db.getMongo().startSession();
  const sdb = sesion.getDatabase("mparfum");
  const cliente = sdb.clientes.findOne({}, { nombre: 1, apellido: 1, email: 1, direcciones: 1 });
  const v = gg.variantes[0];
  try {
    sesion.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    const st = sdb.productos.updateOne(
      { "variantes": { $elemMatch: { sku: v.sku, stock: { $elemMatch: { deposito: "DEP-MZA", cantidad: { $gte: 1 } } } } } },
      { $inc: { "variantes.$[v].stock.$[s].cantidad": NumberInt(-1) } },
      { arrayFilters: [{ "v.sku": v.sku }, { "s.deposito": "DEP-MZA" }] }
    );
    if (st.modifiedCount !== 1) throw new Error("Sin stock en el depósito");
    const ultimo = sdb.pedidos.find().sort({ numero: -1 }).limit(1).next().numero;
    sdb.pedidos.insertOne({
      numero: NumberInt(ultimo + 1), cliente: { _id: cliente._id, nombre: `${cliente.nombre} ${cliente.apellido}`, email: cliente.email, provincia: cliente.direcciones[0].provincia },
      fecha: new Date(), canal: "web", deposito: "DEP-MZA",
      items: [{ productoId: gg._id, sku: v.sku, nombre: `${gg.nombre} - ${v.presentacion}`, marca: gg.marca.nombre, tipo: gg.tipo, categoria: gg.categoria._id, cantidad: NumberInt(1), precioUnitario: v.precio }],
      subtotal: v.precio, descuento: 0, total: v.precio, pago: { medio: "mercadopago", cuotas: NumberInt(1) },
      envio: { tipo: "domicilio", costo: 0, empresa: "Andreani", direccion: cliente.direcciones[0] }, estado: "pagado", historialEstados: [{ estado: "pagado", fecha: new Date() }]
    });
    sesion.commitTransaction();
    print(`Pedido ${ultimo + 1} confirmado y stock descontado en una sola transacción.`);
  } catch (e) {
    sesion.abortTransaction();
    print(`Transacción abortada: ${e.message}`);
  } finally {
    sesion.endSession();
  }
} else {
  print("El servidor es standalone: iniciar mongod con --replSet rs0 y rs.initiate() para ejecutar la transacción.");
}
