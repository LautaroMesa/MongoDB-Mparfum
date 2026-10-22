// =====================================================================
// MPARFUM - Script 06: colección de series temporales (MongoDB 5.0+)
// Uso: mongosh "mongodb://localhost:27017" scripts/06_series_temporales.js
//
// eventos_web registra lo que hacen los visitantes de la tienda online:
// cada vista de producto, cada "agregar al carrito" y cada búsqueda.
// Es un caso típico de serie temporal: se insertan muchísimos datos
// ordenados por tiempo, se consultan por rangos de fechas y nunca se
// modifican. Se generan los últimos 30 días (~29.000 eventos).
// =====================================================================

db = db.getSiblingDB("mparfum");
db.eventos_web.drop();
db.eventos_web_normal.drop();

// Colección de series temporales:
//  - timeField: campo con la fecha del evento (obligatorio)
//  - metaField: datos que identifican "de qué" es la serie; MongoDB agrupa
//    en un mismo bucket los eventos con igual metaField y tiempo cercano
//  - granularity: cada cuánto llegan los datos (seconds | minutes | hours)
//  - expireAfterSeconds: los eventos se borran solos a los 180 días
db.createCollection("eventos_web", {
  timeseries: { timeField: "fecha", metaField: "meta", granularity: "minutes" },
  expireAfterSeconds: 60 * 60 * 24 * 180
});

// Generador con semilla fija (mismos datos en cada ejecución)
let semilla = 777;
const rnd = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
const elegir = (a) => a[Math.floor(rnd() * a.length)];

const productos = db.productos.find({ activo: true }, { _id: 1, nombre: 1, "rating.cantidad": 1 }).toArray();
const pesos = productos.map((p) => 1 + (p.rating?.cantidad || 0));
const totalPeso = pesos.reduce((s, x) => s + x, 0);
const productoAlAzar = () => { let r = rnd() * totalPeso; for (let i = 0; i < productos.length; i++) { r -= pesos[i]; if (r <= 0) return productos[i]; } return productos[0]; };
const busquedas = ["perfume mujer", "sauvage", "vainilla", "protector solar", "labial rojo", "good girl", "set regalo", "serum", "perfume hombre", "la vie est belle"];
const provincias = ["Mendoza", "Mendoza", "Mendoza", "San Juan", "Córdoba", "Buenos Aires", "Buenos Aires", "Santa Fe", "San Luis", "Neuquén"];
// Tráfico por hora del día (hora argentina): bajo de madrugada, pico a la noche
const traficoHora = [2, 1, 1, 1, 1, 2, 3, 5, 7, 8, 9, 10, 10, 9, 8, 8, 9, 10, 12, 14, 15, 14, 10, 5];

const ahora = Date.now();
// Medianoche en Mendoza (UTC-3) de hace n días
const inicioDia = (n) => { const d = new Date(ahora - n * 86400000); d.setUTCHours(3, 0, 0, 0); if (d.getTime() > ahora - n * 86400000) d.setTime(d.getTime() - 86400000); return d; };
const eventos = [];
for (let d = 30; d >= 1; d--) {
  for (let h = 0; h < 24; h++) {
    const cantidad = Math.round(traficoHora[h] * 5.5 * (0.8 + rnd() * 0.4));
    for (let k = 0; k < cantidad; k++) {
      const fecha = new Date(inicioDia(d).getTime() + h * 3600000 + Math.floor(rnd() * 3600000));
      const canal = rnd() < 0.7 ? "web" : "app";
      const r = rnd();
      if (r < 0.12) {
        eventos.push({ fecha, meta: { tipo: "busqueda", canal }, termino: elegir(busquedas), provincia: elegir(provincias) });
      } else {
        const p = productoAlAzar();
        const tipo = r < 0.88 ? "vista_producto" : "agregar_carrito";
        eventos.push({ fecha, meta: { tipo, canal, productoId: p._id }, segundos: NumberInt(5 + Math.floor(rnd() * 180)), provincia: elegir(provincias) });
      }
    }
  }
}
db.eventos_web.insertMany(eventos, { ordered: false });
// Copia en una colección común, sólo para comparar el espacio en disco
db.eventos_web_normal.insertMany(eventos.map((e) => ({ ...e })), { ordered: false });
// Índice secundario sobre la serie temporal (meta + tiempo)
db.eventos_web.createIndex({ "meta.productoId": 1, fecha: -1 });

print(`Eventos cargados: ${db.eventos_web.countDocuments()}`);

// ---------------------------------------------------------------------
print("\nST1. Visitas por día de la última semana (agrupando por fecha con $dateTrunc)");
db.eventos_web.aggregate([
  { $match: { fecha: { $gte: inicioDia(7) }, "meta.tipo": "vista_producto" } },
  { $group: { _id: { $dateTrunc: { date: "$fecha", unit: "day", timezone: "America/Argentina/Mendoza" } }, vistas: { $sum: 1 } } },
  { $sort: { _id: 1 } },
  { $project: { _id: 0, dia: { $dateToString: { date: "$_id", format: "%d/%m", timezone: "America/Argentina/Mendoza" } }, vistas: 1 } }
]).forEach((d) => printjson(d));

print("\nST2. Horas pico de la tienda (todas las visitas del mes)");
db.eventos_web.aggregate([
  { $group: { _id: { $hour: { date: "$fecha", timezone: "America/Argentina/Mendoza" } }, eventos: { $sum: 1 } } },
  { $sort: { eventos: -1 } }, { $limit: 5 },
  { $project: { _id: 0, hora: { $concat: [{ $toString: "$_id" }, ":00 h"] }, eventos: 1 } }
]).forEach((d) => printjson(d));

print("\nST3. Conversión: productos más vistos y cuántas veces se agregaron al carrito");
db.eventos_web.aggregate([
  { $match: { "meta.tipo": { $in: ["vista_producto", "agregar_carrito"] } } },
  { $group: { _id: "$meta.productoId", vistas: { $sum: { $cond: [{ $eq: ["$meta.tipo", "vista_producto"] }, 1, 0] } }, carritos: { $sum: { $cond: [{ $eq: ["$meta.tipo", "agregar_carrito"] }, 1, 0] } } } },
  { $sort: { vistas: -1 } }, { $limit: 5 },
  { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "p" } },
  { $project: { _id: 0, producto: { $first: "$p.nombre" }, vistas: 1, carritos: 1, conversion: { $concat: [{ $toString: { $round: [{ $multiply: [{ $divide: ["$carritos", "$vistas"] }, 100] }, 1] } }, "%"] } } }
]).forEach((d) => printjson(d));

print("\nST4. Qué se busca en el sitio (términos más buscados)");
db.eventos_web.aggregate([
  { $match: { "meta.tipo": "busqueda" } },
  { $sortByCount: "$termino" }, { $limit: 5 }
]).forEach((d) => printjson(d));

print("\nST5. Ventana móvil: promedio de visitas de los 3 días anteriores ($setWindowFields)");
db.eventos_web.aggregate([
  { $match: { "meta.tipo": "vista_producto", fecha: { $gte: inicioDia(10) } } },
  { $group: { _id: { $dateTrunc: { date: "$fecha", unit: "day", timezone: "America/Argentina/Mendoza" } }, vistas: { $sum: 1 } } },
  { $setWindowFields: { sortBy: { _id: 1 }, output: { promedio3dias: { $avg: "$vistas", window: { documents: [-3, -1] } } } } },
  { $project: { _id: 0, dia: { $dateToString: { date: "$_id", format: "%d/%m", timezone: "America/Argentina/Mendoza" } }, vistas: 1, promedio3dias: { $round: ["$promedio3dias", 0] } } }
]).forEach((d) => printjson(d));

// ---------------------------------------------------------------------
print("\nST6. Impacto de la compresión: serie temporal vs colección común");
db.adminCommand({ fsync: 1 }); // fuerza la escritura a disco para medir el tamaño real
const ts = db.runCommand({ collStats: "eventos_web" });
const normal = db.runCommand({ collStats: "eventos_web_normal" });
const kb = (b) => (b / 1024).toFixed(0) + " KB";
print(`   eventos_web (serie temporal): ${kb(ts.storageSize)} en disco`);
print(`   eventos_web_normal (común)  : ${kb(normal.storageSize)} en disco`);
print(`   La serie temporal ocupa un ${Math.round((1 - ts.storageSize / normal.storageSize) * 100)}% menos`);
if (ts.timeseries) print(`   Buckets internos: ${ts.timeseries.bucketCount} (cada bucket agrupa eventos del mismo meta y período)`);
db.eventos_web_normal.drop();
print("   (la colección común se borra: era sólo para comparar)");
