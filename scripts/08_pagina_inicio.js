// =====================================================================
// MPARFUM - Script 08: colección pagina_inicio (portada de la tienda)
// Uso: mongosh "mongodb://localhost:27017" scripts/08_pagina_inicio.js
//
// Guarda todo lo que ve el cliente apenas entra al sitio, tomando como
// referencia la portada de una perfumería online (Juleriaque):
// encabezado (logo, menú, buscador, cuenta, favoritos, carrito), banner
// principal, campañas, promociones, productos destacados, tendencias,
// marcas, secciones por categoría, envíos, medios de pago y accesos.
//
// Diseño: UN DOCUMENTO POR BLOQUE de la página (patrón polimórfico).
// Todos comparten: clave, tipo, titulo, orden, activo, vigencia y canales;
// el resto de los campos depende del tipo de bloque. El sitio lee los
// bloques activos y vigentes, ordenados por "orden", y los dibuja.
//
// Los bloques "tendencias" y "seccion_categoria" se CALCULAN a partir de
// pedidos, eventos_web y reseñas (patrón computed) con actualizarPortada().
// =====================================================================

db = db.getSiblingDB("mparfum");
db.pagina_inicio.drop();

// ---------------------------------------------------------------------
// Colección con validador
// ---------------------------------------------------------------------
db.createCollection("pagina_inicio", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["clave", "tipo", "titulo", "orden", "activo"],
      properties: {
        clave: { bsonType: "string", description: "identificador único del bloque" },
        tipo: {
          enum: ["encabezado", "banner_principal", "campanas", "promociones", "productos_destacados",
                 "tendencias", "marcas", "seccion_categoria", "info_envios", "medios_pago", "accesos"]
        },
        titulo: { bsonType: "string" },
        orden: { bsonType: "int", minimum: 0, description: "posición en la página (de arriba hacia abajo)" },
        activo: { bsonType: "bool" },
        vigencia: {
          bsonType: "object",
          properties: { desde: { bsonType: "date" }, hasta: { bsonType: "date" } }
        },
        canales: { bsonType: "array", items: { enum: ["web", "app"] } },
        actualizado: { bsonType: "date" }
      }
    }
  }
});

const ahora = new Date();
const dias = (n) => new Date(ahora.getTime() + n * 86400000);
const prod = (nombre) => {
  const p = db.productos.findOne({ nombre, activo: true }, { _id: 1, nombre: 1, "marca.nombre": 1, variantes: 1 });
  if (!p) throw new Error(`No existe el producto "${nombre}"`);
  return { productoId: p._id, nombre: p.nombre, marca: p.marca.nombre, precioDesde: Math.min(...p.variantes.map((v) => v.precio)) };
};

// ---------------------------------------------------------------------
// Bloques de la portada (de arriba hacia abajo)
// ---------------------------------------------------------------------
const bloques = [
  // 0. Encabezado: logo, barra de anuncios, buscador, menú e íconos
  {
    clave: "encabezado", tipo: "encabezado", titulo: "Encabezado del sitio", orden: 0, activo: true, canales: ["web", "app"],
    logo: { texto: "Mparfum", imagen: "/img/logo-mparfum.svg", alt: "Mparfum perfumería y cosmética online", enlace: "#/" },
    barraAnuncios: [
      "Envío gratis desde $150.000",
      "Hasta 6 cuotas sin interés",
      "Retiro gratis en puntos de Mendoza, San Juan, Córdoba y CABA"
    ],
    buscador: {
      placeholder: "Buscá perfumes, marcas, notas como vainilla…",
      sugerencias: ["perfume mujer", "sauvage", "protector solar", "labial rojo", "set regalo"]
    },
    menu: [
      { texto: "Fragancias", categoria: "fragancias" },
      { texto: "Maquillaje", categoria: "maquillaje" },
      { texto: "Cuidado de la piel", categoria: "tratamiento" },
      { texto: "Cuerpo y baño", categoria: "cuerpo" },
      { texto: "Cabello", categoria: "cabello" },
      { texto: "Sets de regalo", categoria: "sets", resaltado: true },
      { texto: "Marcas", enlace: "#/catalogo" }
    ],
    iconos: [
      { tipo: "cuenta", texto: "Ingresar", enlace: "#/cuenta" },
      { tipo: "favoritos", texto: "Favoritos", enlace: "#/cuenta" },
      { tipo: "carrito", texto: "Carrito", enlace: "#/carrito" }
    ]
  },

  // 1. Banner principal: carrusel de imágenes grandes, cada una con su vigencia
  {
    clave: "banner-principal", tipo: "banner_principal", titulo: "Banner principal", orden: 1, activo: true, canales: ["web", "app"],
    rotacionSegundos: NumberInt(6),
    slides: [
      { titulo: "Día de la Madre", subtitulo: "15% off en fragancias de mujer y sets de regalo", textoBoton: "Ver regalos",
        enlace: "#/catalogo?tipo=set", imagen: "/img/banners/dia-madre-2026.jpg", colores: ["#7a2e4f", "#1f1823"],
        promocion: "MADRE2026", vigencia: { desde: ISODate("2026-10-01T03:00:00Z"), hasta: ISODate("2026-10-20T02:59:59Z") } },
      { titulo: "Fragancias de primavera", subtitulo: "Notas frescas y florales para esta temporada", textoBoton: "Descubrir",
        enlace: "#/catalogo?tipo=fragancia", imagen: "/img/banners/primavera-2026.jpg", colores: ["#3f6f5f", "#1f1823"],
        vigencia: { desde: ISODate("2026-09-21T03:00:00Z"), hasta: ISODate("2026-12-20T02:59:59Z") } },
      { titulo: "10% off en tu compra online", subtitulo: "Usá el cupón BIENVENIDA10 en la web o la app", textoBoton: "Comprar ahora",
        enlace: "#/catalogo", imagen: "/img/banners/bienvenida.jpg", colores: ["#a5803a", "#1f1823"],
        promocion: "BIENVENIDA10", vigencia: { desde: ISODate("2025-01-01T03:00:00Z"), hasta: ISODate("2026-12-31T02:59:59Z") } },
      { titulo: "CyberMonday", subtitulo: "Hasta 25% off en todo el sitio", textoBoton: "Ver ofertas",
        enlace: "#/catalogo", imagen: "/img/banners/cyber-2026.jpg", colores: ["#3d4a63", "#1f1823"],
        promocion: "CYBER2026", vigencia: { desde: ISODate("2026-11-02T03:00:00Z"), hasta: ISODate("2026-11-05T02:59:59Z") } }
    ]
  },

  // 2. Campañas publicitarias de marcas y lanzamientos
  {
    clave: "campanas", tipo: "campanas", titulo: "Lanzamientos y campañas", orden: 2, activo: true, canales: ["web", "app"],
    items: [
      { marca: "Yves Saint Laurent", titulo: "Libre: la libertad de la lavanda", imagen: "/img/campanas/ysl-libre.jpg", enlace: "#/catalogo?marca=ysl" },
      { marca: "Dior", titulo: "Sauvage: el más elegido", imagen: "/img/campanas/dior-sauvage.jpg", enlace: "#/catalogo?marca=dior" },
      { marca: "La Roche-Posay", titulo: "Protección solar para el verano", imagen: "/img/campanas/lrp-anthelios.jpg", enlace: "#/catalogo?marca=la-roche-posay" }
    ]
  },

  // 3. Promociones y descuentos (referencian la colección promociones)
  {
    clave: "promociones-home", tipo: "promociones", titulo: "Promociones y descuentos", orden: 3, activo: true, canales: ["web", "app"],
    items: [
      { codigo: "BIENVENIDA10", destacado: "10% OFF", texto: "En tu compra por la web o la app" },
      { codigo: "6CUOTAS", destacado: "6 cuotas", texto: "Sin interés con tarjetas de crédito" },
      { codigo: "DERMO5000", destacado: "$5.000 OFF", texto: "En dermocosmética La Roche-Posay y Vichy" },
      { codigo: "CYBER2026", destacado: "Hasta 25% OFF", texto: "CyberMonday del 2 al 4 de noviembre" }
    ]
  },

  // 4. Productos destacados: elegidos a mano por el equipo comercial
  {
    clave: "destacados", tipo: "productos_destacados", titulo: "Productos destacados", orden: 4, activo: true, canales: ["web", "app"],
    criterio: "seleccion_manual",
    productos: [
      { ...prod("N°5"), etiqueta: "Clásico" },
      { ...prod("Libre"), etiqueta: "Lanzamiento" },
      { ...prod("Oud Wood"), etiqueta: "Nicho" },
      { ...prod("Advanced Night Repair Sérum"), etiqueta: "Best seller" },
      { ...prod("Matte Lipstick"), etiqueta: "Best seller" },
      { ...prod("Set Good Girl EDP 80 ml + Body Lotion"), etiqueta: "Edición limitada" }
    ]
  },

  // 5. Tendencias: se calcula con actualizarPortada()
  {
    clave: "tendencias", tipo: "tendencias", titulo: "Tendencias: lo más elegido del mes", orden: 5, activo: true, canales: ["web", "app"],
    criterio: "calculado", periodoDias: NumberInt(30), productos: []
  },

  // 6. Marcas
  {
    clave: "marcas-home", tipo: "marcas", titulo: "Nuestras marcas", orden: 6, activo: true, canales: ["web", "app"],
    marcas: ["chanel", "dior", "lancome", "ysl", "carolina-herrera", "tom-ford", "mac", "estee-lauder", "la-roche-posay", "kerastase"]
      .map((id) => ({ marcaId: id, nombre: db.marcas.findOne({ _id: id }).nombre, logo: `/img/marcas/${id}.svg` }))
  },

  // 7 a 10. Secciones por categoría (productos calculados con actualizarPortada())
  ...[
    ["seccion-fragancias", "fragancias", "Fragancias", "Perfumes de mujer, hombre y unisex"],
    ["seccion-maquillaje", "maquillaje", "Maquillaje", "Bases, labiales, máscaras y sombras"],
    ["seccion-piel", "tratamiento", "Cuidado de la piel", "Cremas, sérums, limpiadores y protectores solares"],
    ["seccion-cabello", "cabello", "Cuidado capilar", "Aceites y tratamientos para el cabello"]
  ].map(([clave, categoria, titulo, bajada], i) => ({
    clave, tipo: "seccion_categoria", titulo, bajada, orden: NumberInt(7 + i), activo: true, canales: ["web", "app"],
    categoria,
    subcategorias: db.categorias.find({ padre: categoria }, { _id: 1, nombre: 1 }).sort({ orden: 1 }).toArray().map((c) => ({ categoria: c._id, nombre: c.nombre })),
    cantidad: NumberInt(4), productos: []
  })),

  // 11. Información sobre envíos
  {
    clave: "envios", tipo: "info_envios", titulo: "Envíos y retiros", orden: 11, activo: true, canales: ["web", "app"],
    items: [
      { icono: "camion", titulo: "Envío gratis", texto: "En compras desde $150.000 a todo el país. Si no, $6.500." },
      { icono: "tienda", titulo: "Retiro sin cargo", texto: "En 6 puntos de retiro de Mendoza, San Juan, Córdoba y CABA." },
      { icono: "reloj", titulo: "Entrega en 24 a 72 h", texto: "Despachamos desde el depósito más cercano a tu provincia." },
      { icono: "paquete", titulo: "Seguimiento online", texto: "Seguí tu pedido con el número o el código de Andreani, OCA o Correo Argentino." }
    ],
    envioGratisDesde: NumberInt(150000), costoEnvio: NumberInt(6500)
  },

  // 12. Medios de pago
  {
    clave: "medios-pago", tipo: "medios_pago", titulo: "Medios de pago", orden: 12, activo: true, canales: ["web", "app"],
    medios: [
      { medio: "credito", nombre: "Tarjetas de crédito", detalle: "Visa, Mastercard, American Express", cuotasSinInteres: NumberInt(6) },
      { medio: "debito", nombre: "Tarjetas de débito", detalle: "Visa Débito, Maestro" },
      { medio: "mercadopago", nombre: "Mercado Pago", detalle: "Dinero en cuenta y cuotas" },
      { medio: "transferencia", nombre: "Transferencia bancaria", detalle: "Se confirma en 24 h hábiles" }
    ],
    beneficios: ["6 cuotas sin interés con todos los bancos", "10% off con el cupón BIENVENIDA10"]
  },

  // 13. Accesos a otras secciones (pie de página)
  {
    clave: "accesos", tipo: "accesos", titulo: "Accesos rápidos", orden: 13, activo: true, canales: ["web", "app"],
    grupos: [
      { titulo: "Tienda", enlaces: [{ texto: "Fragancias", enlace: "#/catalogo?tipo=fragancia" }, { texto: "Maquillaje", enlace: "#/catalogo?tipo=maquillaje" }, { texto: "Cuidado de la piel", enlace: "#/catalogo?tipo=tratamiento" }, { texto: "Sets de regalo", enlace: "#/catalogo?tipo=set" }] },
      { titulo: "Ayuda", enlaces: [{ texto: "Seguimiento de envío", enlace: "#/seguimiento" }, { texto: "Mi cuenta", enlace: "#/cuenta" }, { texto: "Puntos de retiro", enlace: "#/carrito" }, { texto: "Cambios y devoluciones", enlace: "#/" }] },
      { titulo: "Mparfum", enlaces: [{ texto: "Club Mparfum", enlace: "#/cuenta" }, { texto: "Panel de administración", enlace: "#/admin" }] }
    ]
  }
];
for (const b of bloques) { b.orden = NumberInt(b.orden); b.actualizado = ahora; }
db.pagina_inicio.insertMany(bloques);

// Promoción del CyberMonday (aparece en la portada; empieza el 2/11)
db.promociones.updateOne(
  { codigo: "CYBER2026" },
  { $setOnInsert: { codigo: "CYBER2026", descripcion: "CyberMonday 2026: 25% off en todo el sitio", tipo: "porcentaje", valor: NumberInt(25),
                    vigencia: { desde: ISODate("2026-11-02T03:00:00Z"), hasta: ISODate("2026-11-05T02:59:59Z") }, aplicaA: { canales: ["web", "app"] } } },
  { upsert: true }
);

// ---------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------
db.pagina_inicio.createIndex({ clave: 1 }, { unique: true, name: "ux_clave" });
db.pagina_inicio.createIndex({ activo: 1, orden: 1 }, { name: "ix_activo_orden" });   // armar la portada
db.pagina_inicio.createIndex({ tipo: 1 }, { name: "ix_tipo" });

// ---------------------------------------------------------------------
// actualizarPortada(): recalcula los bloques calculados (patrón computed)
//  - tendencias: ventas de los últimos 30 días + vistas en eventos_web
//  - seccion_categoria: los productos mejor puntuados de cada categoría
//  - productos_destacados: refresca nombre y precio de la selección manual
// Se puede volver a ejecutar cuando se quiera (por ejemplo, una vez por día)
// ---------------------------------------------------------------------
function actualizarPortada() {
  const hoy = new Date();
  const t = db.pagina_inicio.findOne({ tipo: "tendencias" });
  const desde = new Date(Math.max(...db.pedidos.find({}, { fecha: 1 }).sort({ fecha: -1 }).limit(1).toArray().map((p) => p.fecha.getTime())) - t.periodoDias * 86400000);
  const hayEventos = db.getCollectionNames().includes("eventos_web");
  const tendencias = db.pedidos.aggregate([
    { $match: { fecha: { $gte: desde }, estado: { $ne: "cancelado" } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.productoId", ventas: { $sum: "$items.cantidad" } } },
    ...(hayEventos ? [{ $lookup: { from: "eventos_web", localField: "_id", foreignField: "meta.productoId", as: "ev",
          pipeline: [{ $match: { "meta.tipo": "vista_producto" } }, { $count: "n" }] } },
        { $set: { vistas: { $ifNull: [{ $first: "$ev.n" }, 0] } } }] : [{ $set: { vistas: 0 } }]),
    { $set: { puntaje: { $add: [{ $multiply: ["$ventas", 3] }, "$vistas"] } } },
    { $sort: { puntaje: -1 } }, { $limit: 8 },
    { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "p", pipeline: [{ $match: { activo: true } }] } },
    { $unwind: "$p" },
    { $project: { _id: 0, productoId: "$_id", nombre: "$p.nombre", marca: "$p.marca.nombre", precioDesde: { $min: "$p.variantes.precio" }, ventas: 1, vistas: 1, puntaje: 1 } }
  ]).toArray();
  db.pagina_inicio.updateOne({ tipo: "tendencias" }, { $set: { productos: tendencias, actualizado: hoy } });

  db.pagina_inicio.find({ tipo: "seccion_categoria" }).forEach((s) => {
    const productos = db.productos.aggregate([
      { $match: { activo: true, "categoria.ruta": s.categoria } },
      { $sort: { "rating.promedio": -1, "rating.cantidad": -1 } }, { $limit: s.cantidad },
      { $project: { _id: 0, productoId: "$_id", nombre: 1, marca: "$marca.nombre", precioDesde: { $min: "$variantes.precio" }, rating: "$rating.promedio" } }
    ]).toArray();
    db.pagina_inicio.updateOne({ _id: s._id }, { $set: { productos, actualizado: hoy } });
  });

  const d = db.pagina_inicio.findOne({ tipo: "productos_destacados" });
  const frescos = d.productos.map((x) => {
    const p = db.productos.findOne({ _id: x.productoId }, { nombre: 1, "marca.nombre": 1, variantes: 1 });
    return { ...x, nombre: p.nombre, marca: p.marca.nombre, precioDesde: Math.min(...p.variantes.map((v) => v.precio)) };
  });
  db.pagina_inicio.updateOne({ _id: d._id }, { $set: { productos: frescos, actualizado: hoy } });
  return `Portada actualizada: ${tendencias.length} tendencias${hayEventos ? " (ventas + vistas)" : " (sólo ventas; falta eventos_web)"}`;
}
print(actualizarPortada());


// ---------------------------------------------------------------------
// CONSULTAS DE LA PORTADA
// ---------------------------------------------------------------------
function titulo(t) { print(`\n${"=".repeat(70)}\n${t}\n${"=".repeat(70)}`); }

titulo("P1. Lo que ve el cliente al entrar: bloques activos y vigentes, en orden");
const vigente = { activo: true, $and: [
  { $or: [{ "vigencia.desde": { $exists: false } }, { "vigencia.desde": { $lte: ahora } }] },
  { $or: [{ "vigencia.hasta": { $exists: false } }, { "vigencia.hasta": { $gte: ahora } }] }
] };
db.pagina_inicio.find(vigente, { _id: 0, orden: 1, tipo: 1, titulo: 1 }).sort({ orden: 1 })
  .forEach((b) => print(`  ${String(b.orden).padStart(2)}. ${b.titulo.padEnd(34)} (${b.tipo})`));

titulo("P2. Banner principal: sólo las imágenes vigentes hoy");
db.pagina_inicio.aggregate([
  { $match: { tipo: "banner_principal", activo: true } },
  { $unwind: "$slides" },
  { $match: { "slides.vigencia.desde": { $lte: ahora }, "slides.vigencia.hasta": { $gte: ahora } } },
  { $project: { _id: 0, titulo: "$slides.titulo", promocion: "$slides.promocion", hasta: "$slides.vigencia.hasta" } }
]).forEach((d) => printjson(d));

titulo("P3. Promociones de la portada con su vigencia real ($lookup a promociones)");
db.pagina_inicio.aggregate([
  { $match: { tipo: "promociones" } },
  { $unwind: "$items" },
  { $lookup: { from: "promociones", localField: "items.codigo", foreignField: "codigo", as: "promo" } },
  { $unwind: "$promo" },
  { $project: { _id: 0, codigo: "$items.codigo", destacado: "$items.destacado",
      estado: { $switch: { branches: [
        { case: { $lt: [ahora, "$promo.vigencia.desde"] }, then: "próximamente" },
        { case: { $gt: [ahora, "$promo.vigencia.hasta"] }, then: "vencida" } ], default: "vigente" } } } }
]).forEach((d) => printjson(d));

titulo("P4. Tendencias del mes (bloque calculado)");
db.pagina_inicio.findOne({ tipo: "tendencias" }).productos.slice(0, 5)
  .forEach((p) => print(`  ${p.nombre.padEnd(30)} ${p.marca.padEnd(20)} ventas ${String(p.ventas).padStart(4)}  vistas ${String(p.vistas).padStart(5)}`));

titulo("P5. Productos destacados con precio y stock al día ($lookup a productos)");
db.pagina_inicio.aggregate([
  { $match: { tipo: "productos_destacados" } },
  { $unwind: "$productos" },
  { $lookup: { from: "productos", localField: "productos.productoId", foreignField: "_id", as: "p" } },
  { $unwind: "$p" },
  { $project: { _id: 0, producto: "$p.nombre", etiqueta: "$productos.etiqueta", precioDesde: { $min: "$p.variantes.precio" },
      stockTotal: { $sum: { $map: { input: "$p.variantes", in: { $sum: "$$this.stock.cantidad" } } } } } }
]).forEach((d) => printjson(d));

titulo("P6. Secciones por categoría con sus productos");
db.pagina_inicio.find({ tipo: "seccion_categoria" }, { _id: 0, titulo: 1, "productos.nombre": 1 }).sort({ orden: 1 })
  .forEach((s) => print(`  ${s.titulo.padEnd(20)} ${s.productos.map((p) => p.nombre).join(" · ")}`));

titulo("P7. Ocultar un bloque sin borrarlo y volver a mostrarlo");
db.pagina_inicio.updateOne({ clave: "campanas" }, { $set: { activo: false } });
print("  bloques visibles con campañas ocultas: " + db.pagina_inicio.countDocuments(vigente));
db.pagina_inicio.updateOne({ clave: "campanas" }, { $set: { activo: true } });
print("  bloques visibles otra vez:             " + db.pagina_inicio.countDocuments(vigente));

titulo("P8. La página completa en una sola agregación: bloques vigentes + productos con precio y stock al día");
const armarPortada = () => db.pagina_inicio.aggregate([
  { $match: vigente },
  { $sort: { orden: 1 } },
  { $lookup: { from: "productos", localField: "productos.productoId", foreignField: "_id", as: "detalle",
      pipeline: [{ $project: { nombre: 1, precioDesde: { $min: "$variantes.precio" },
        stock: { $sum: { $map: { input: "$variantes", in: { $sum: "$$this.stock.cantidad" } } } } } }] } },
  { $project: { _id: 0, orden: 1, titulo: 1, tipo: 1, productos: "$detalle" } }
]).toArray();
armarPortada().forEach((b) => print(`  ${String(b.orden).padStart(2)}. ${b.titulo.padEnd(36)} ${b.productos.length ? b.productos.length + " productos" : ""}`));
let t0 = Date.now(); for (let i = 0; i < 500; i++) armarPortada();
print(`  Tiempo promedio para armar la portada: ${((Date.now() - t0) / 500).toFixed(2)} ms`);

print(`\nColección pagina_inicio creada con ${db.pagina_inicio.countDocuments()} bloques.`);
