// =====================================================================
// MPARFUM - Tienda online (API + sitio web) sobre la base MongoDB mparfum
// Uso:   npm install   (una sola vez)
//        npm start     -> abrir http://localhost:3000
// Variable opcional: MONGODB_URI (por defecto mongodb://localhost:27017)
// =====================================================================
const express = require("express");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const PUERTO = process.env.PORT || 3000;
const TZ = "America/Argentina/Mendoza";
const ENVIO_GRATIS_DESDE = 150000;
const COSTO_ENVIO = 6500;

const cliente = new MongoClient(URI);
let db, esReplicaSet = false;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Envuelve los handlers async para devolver el error como JSON
const ruta = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(e.status || 500).json({ error: e.message });
});
const error = (status, mensaje) => Object.assign(new Error(mensaje), { status });
const idValido = (id) => ObjectId.isValid(id) && String(new ObjectId(id)) === id;

// Campos que se muestran en las tarjetas del catálogo
const PROYECCION_TARJETA = {
  nombre: 1, tipo: 1, genero: 1, marca: 1, categoria: 1, rating: 1, etiquetas: 1,
  "atributos.familiaOlfativa": 1, "atributos.concentracion": 1,
  precioDesde: { $min: "$variantes.precio" },
  presentaciones: { $size: "$variantes" },
  disponible: { $gt: [{ $sum: { $map: { input: "$variantes", in: { $sum: "$$this.stock.cantidad" } } } }, 0] }
};

// ---------------------------------------------------------------------
// CATÁLOGO
// ---------------------------------------------------------------------

// Menú de categorías armado desde el árbol (padre + orden)
app.get("/api/categorias", ruta(async (req, res) => {
  const cats = await db.collection("categorias").find().sort({ orden: 1 }).toArray();
  const conteo = await db.collection("productos").aggregate([
    { $match: { activo: true } }, { $unwind: "$categoria.ruta" }, { $group: { _id: "$categoria.ruta", n: { $sum: 1 } } }
  ]).toArray();
  const n = Object.fromEntries(conteo.map((c) => [c._id, c.n]));
  const porId = Object.fromEntries(cats.map((c) => [c._id, { ...c, productos: n[c._id] || 0, hijos: [] }]));
  const raiz = [];
  for (const c of Object.values(porId)) (c.padre ? porId[c.padre].hijos : raiz).push(c);
  res.json(raiz);
}));

// Listado con filtros. Devuelve también los filtros disponibles ($facet)
app.get("/api/productos", ruta(async (req, res) => {
  const { q, tipo, genero, categoria, marca, precioMax, orden = "relevancia" } = req.query;
  const filtro = { activo: true };
  if (q) filtro.$text = { $search: q };
  if (tipo) filtro.tipo = tipo;
  if (genero) filtro.genero = genero;
  if (categoria) filtro["categoria.ruta"] = categoria;
  if (marca) filtro["marca._id"] = marca;

  const ordenes = {
    relevancia: q ? { score: -1 } : { "rating.cantidad": -1 },
    "precio-asc": { precioDesde: 1 },
    "precio-desc": { precioDesde: -1 },
    rating: { "rating.promedio": -1 },
    nombre: { nombre: 1 }
  };
  const pipeline = [
    { $match: filtro },
    { $project: { ...PROYECCION_TARJETA, ...(q ? { score: { $meta: "textScore" } } : {}) } },
    ...(precioMax ? [{ $match: { precioDesde: { $lte: Number(precioMax) } } }] : []),
    { $facet: {
        productos: [{ $sort: { ...(ordenes[orden] || ordenes.relevancia), _id: 1 } }],
        marcas: [{ $group: { _id: "$marca._id", nombre: { $first: "$marca.nombre" }, n: { $sum: 1 } } }, { $sort: { nombre: 1 } }],
        rubros: [{ $sortByCount: "$tipo" }],
        generos: [{ $sortByCount: "$genero" }]
    } }
  ];
  const [r] = await db.collection("productos").aggregate(pipeline).toArray();
  res.json(r);
}));

// Más vendidos de los últimos 90 días (para la portada)
app.get("/api/destacados", ruta(async (req, res) => {
  const desde = new Date(Date.now() - 90 * 86400000);
  const top = await db.collection("pedidos").aggregate([
    { $match: { fecha: { $gte: desde }, estado: { $ne: "cancelado" } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.productoId", unidades: { $sum: "$items.cantidad" } } },
    { $sort: { unidades: -1 } }, { $limit: 8 },
    { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "p", pipeline: [{ $project: PROYECCION_TARJETA }] } },
    { $unwind: "$p" }, { $replaceWith: { $mergeObjects: ["$p", { unidades: "$unidades" }] } }
  ]).toArray();
  res.json(top);
}));

// Ficha de producto: variantes con disponibilidad, reseñas y "también compraron"
app.get("/api/productos/:id", ruta(async (req, res) => {
  if (!idValido(req.params.id)) throw error(404, "Producto no encontrado");
  const _id = new ObjectId(req.params.id);
  const p = await db.collection("productos").findOne({ _id, activo: true });
  if (!p) throw error(404, "Producto no encontrado");
  p.variantes = p.variantes.map((v) => ({
    sku: v.sku, presentacion: v.presentacion, tono: v.tono, precio: v.precio, precioLista: v.precioLista,
    stock: v.stock.reduce((s, x) => s + x.cantidad, 0)
  }));
  const [reseñas, distribucion, tambien] = await Promise.all([
    db.collection("reseñas").aggregate([
      { $match: { productoId: _id } }, { $sort: { fecha: -1 } }, { $limit: 6 },
      { $lookup: { from: "clientes", localField: "clienteId", foreignField: "_id", as: "c", pipeline: [{ $project: { nombre: 1, apellido: 1, "direcciones.ciudad": 1 } }] } },
      { $project: { puntaje: 1, titulo: 1, comentario: 1, fecha: 1, compraVerificada: 1,
          autor: { $concat: [{ $first: "$c.nombre" }, " ", { $substrCP: [{ $first: "$c.apellido" }, 0, 1] }, "."] },
          ciudad: { $first: { $first: "$c.direcciones.ciudad" } } } }
    ]).toArray(),
    db.collection("reseñas").aggregate([{ $match: { productoId: _id } }, { $group: { _id: "$puntaje", n: { $sum: 1 } } }]).toArray(),
    db.collection("pedidos").aggregate([
      { $match: { "items.productoId": _id } }, { $sort: { fecha: -1 } }, { $limit: 2000 },
      { $unwind: "$items" }, { $match: { "items.productoId": { $ne: _id } } },
      { $group: { _id: "$items.productoId", veces: { $sum: 1 } } }, { $sort: { veces: -1 } }, { $limit: 4 },
      { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "p", pipeline: [{ $match: { activo: true } }, { $project: PROYECCION_TARJETA }] } },
      { $unwind: "$p" }, { $replaceWith: "$p" }
    ]).toArray()
  ]);
  p.distribucion = Object.fromEntries(distribucion.map((d) => [d._id, d.n]));
  res.json({ producto: p, reseñas, tambien });
}));

// ---------------------------------------------------------------------
// CLIENTES (login de demostración: se elige una cuenta existente)
// ---------------------------------------------------------------------
app.get("/api/clientes/demo", ruta(async (req, res) => {
  const lista = await db.collection("clientes").aggregate([
    { $match: { "club.nivel": { $in: ["black", "gold"] } } }, { $sort: { "club.puntos": -1 } }, { $limit: 6 },
    { $project: { nombre: 1, apellido: 1, email: 1, club: 1, provincia: { $first: "$direcciones.provincia" } } }
  ]).toArray();
  res.json(lista);
}));

app.get("/api/clientes/:email", ruta(async (req, res) => {
  const c = await db.collection("clientes").findOne({ email: req.params.email }, { projection: { dni: 0 } });
  if (!c) throw error(404, "No existe una cuenta con ese email");
  res.json(c);
}));

// "Mis pedidos": usa el índice ix_cliente_fecha (cliente._id + fecha)
app.get("/api/clientes/:email/pedidos", ruta(async (req, res) => {
  const c = await db.collection("clientes").findOne({ email: req.params.email }, { projection: { _id: 1 } });
  if (!c) throw error(404, "Cliente no encontrado");
  const pedidos = await db.collection("pedidos")
    .find({ "cliente._id": c._id }, { projection: { numero: 1, fecha: 1, estado: 1, total: 1, items: 1, envio: 1, canal: 1 } })
    .sort({ fecha: -1 }).limit(20).toArray();
  res.json(pedidos);
}));

// Lista de deseos: agregar o quitar ($addToSet / $pull)
app.post("/api/clientes/:email/favoritos", ruta(async (req, res) => {
  const { productoId, quitar } = req.body;
  if (!idValido(productoId)) throw error(400, "Producto inválido");
  const op = quitar ? { $pull: { favoritos: new ObjectId(productoId) } } : { $addToSet: { favoritos: new ObjectId(productoId) } };
  const r = await db.collection("clientes").findOneAndUpdate({ email: req.params.email }, op, { returnDocument: "after", projection: { favoritos: 1 } });
  if (!r) throw error(404, "Cliente no encontrado");
  res.json(r.favoritos);
}));

app.get("/api/clientes/:email/favoritos", ruta(async (req, res) => {
  const c = await db.collection("clientes").findOne({ email: req.params.email }, { projection: { favoritos: 1 } });
  if (!c) throw error(404, "Cliente no encontrado");
  const productos = await db.collection("productos").aggregate([
    { $match: { _id: { $in: c.favoritos || [] }, activo: true } }, { $project: PROYECCION_TARJETA }
  ]).toArray();
  res.json(productos);
}));

// ---------------------------------------------------------------------
// CHECKOUT
// ---------------------------------------------------------------------

// Puntos de retiro más cercanos ($geoNear sobre el índice 2dsphere)
app.get("/api/puntos-retiro", ruta(async (req, res) => {
  const lng = Number(req.query.lng ?? -68.8458), lat = Number(req.query.lat ?? -32.8895);
  const puntos = await db.collection("depositos").aggregate([
    { $geoNear: { near: { type: "Point", coordinates: [lng, lat] }, distanceField: "distancia", query: { tipo: "punto_retiro" } } },
    { $limit: 6 },
    { $project: { nombre: 1, direccion: 1, horario: 1, km: { $round: [{ $divide: ["$distancia", 1000] }, 1] } } }
  ]).toArray();
  res.json(puntos);
}));

// Valida un cupón contra la fecha de hoy y el contenido del carrito
async function evaluarCupon(codigo, items, canal) {
  if (!codigo) return { descuento: 0 };
  const hoy = new Date();
  const p = await db.collection("promociones").findOne({ codigo: codigo.toUpperCase().trim() });
  if (!p) throw error(400, "El cupón no existe");
  if (hoy < p.vigencia.desde || hoy > p.vigencia.hasta) throw error(400, "El cupón no está vigente");
  if (p.tipo === "cuotas_sin_interes") throw error(400, `${p.codigo} no es un descuento: habilita ${p.valor} cuotas sin interés con tarjeta de crédito`);
  const a = p.aplicaA || {};
  if (a.canales && !a.canales.includes(canal)) throw error(400, "El cupón no aplica a este canal");
  const aplica = items.filter((it) => (!a.categorias || a.categorias.some((c) => it.ruta.includes(c))) && (!a.marcas || a.marcas.includes(it.marcaId)));
  const base = aplica.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0);
  if (!base) throw error(400, "Ningún producto del carrito participa de este cupón");
  const descuento = p.tipo === "porcentaje" ? Math.round(base * p.valor / 100 / 100) * 100 : Math.min(p.valor, base);
  return { codigo: p.codigo, descripcion: p.descripcion, descuento };
}

// Precios siempre desde la base (nunca desde el navegador)
async function armarItems(itemsCarrito) {
  if (!Array.isArray(itemsCarrito) || !itemsCarrito.length) throw error(400, "El carrito está vacío");
  const skus = itemsCarrito.map((i) => i.sku);
  const prods = await db.collection("productos").find({ "variantes.sku": { $in: skus }, activo: true }).toArray();
  return itemsCarrito.map(({ sku, cantidad }) => {
    const p = prods.find((x) => x.variantes.some((v) => v.sku === sku));
    if (!p) throw error(400, `El producto ${sku} ya no está disponible`);
    const v = p.variantes.find((x) => x.sku === sku);
    const cant = Math.max(1, Math.min(5, parseInt(cantidad, 10) || 1));
    return { productoId: p._id, sku, nombre: `${p.nombre} - ${v.presentacion}`, marca: p.marca.nombre, marcaId: p.marca._id,
             tipo: p.tipo, categoria: p.categoria._id, ruta: p.categoria.ruta, cantidad: cant, precioUnitario: v.precio };
  });
}

// Resumen del carrito con cupón y envío (se usa antes de confirmar)
app.post("/api/carrito/cotizar", ruta(async (req, res) => {
  const items = await armarItems(req.body.items);
  const subtotal = items.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0);
  let cupon = { descuento: 0 }, errorCupon = null;
  try { cupon = await evaluarCupon(req.body.cupon, items, "web"); } catch (e) { errorCupon = e.message; }
  const envio = req.body.envio === "retiro" || subtotal - cupon.descuento >= ENVIO_GRATIS_DESDE ? 0 : COSTO_ENVIO;
  res.json({ subtotal, cupon, errorCupon, envio, total: subtotal - cupon.descuento + envio, envioGratisDesde: ENVIO_GRATIS_DESDE });
}));

// Confirmar compra: reserva el stock en el depósito regional y crea el pedido.
// Con replica set se hace en una transacción; si no, se compensa a mano.
app.post("/api/pedidos", ruta(async (req, res) => {
  const { email, envio: envioPedido = {}, pago = {}, cupon } = req.body;
  const c = await db.collection("clientes").findOne({ email });
  if (!c) throw error(400, "Ingresá con una cuenta para comprar");
  const items = await armarItems(req.body.items);
  const dir = c.direcciones.find((d) => d.principal) || c.direcciones[0];
  const depo = await db.collection("depositos").findOne({ tipo: "deposito", provinciasQueAbastece: dir.provincia }) || { _id: "DEP-BA" };
  const subtotal = items.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0);
  const promo = await evaluarCupon(cupon, items, "web");
  const esRetiro = envioPedido.tipo === "retiro";
  const envio = esRetiro
    ? { tipo: "retiro", puntoRetiro: envioPedido.puntoRetiro, costo: 0 }
    : { tipo: "domicilio", costo: subtotal - promo.descuento >= ENVIO_GRATIS_DESDE ? 0 : COSTO_ENVIO, empresa: "Andreani",
        direccion: { calle: dir.calle, ciudad: dir.ciudad, provincia: dir.provincia, cp: dir.cp } };
  if (esRetiro && !envio.puntoRetiro) throw error(400, "Elegí un punto de retiro");
  const medio = ["credito", "debito", "mercadopago", "transferencia"].includes(pago.medio) ? pago.medio : "mercadopago";
  const ahora = new Date();

  const reservar = async (session) => {
    const hechos = [];
    for (const it of items) {
      const r = await db.collection("productos").updateOne(
        { "variantes": { $elemMatch: { sku: it.sku, stock: { $elemMatch: { deposito: depo._id, cantidad: { $gte: it.cantidad } } } } } },
        { $inc: { "variantes.$[v].stock.$[s].cantidad": -it.cantidad } },
        { arrayFilters: [{ "v.sku": it.sku }, { "s.deposito": depo._id }], session }
      );
      if (r.modifiedCount !== 1) {
        if (!session) await devolver(hechos);
        throw error(409, `No hay stock suficiente de "${it.nombre}" en el depósito que abastece ${dir.provincia}`);
      }
      hechos.push(it);
    }
    const ultimo = await db.collection("pedidos").find({}, { projection: { numero: 1 }, session }).sort({ numero: -1 }).limit(1).next();
    const pedido = {
      numero: (ultimo?.numero || 100000) + 1,
      cliente: { _id: c._id, nombre: `${c.nombre} ${c.apellido}`, email: c.email, provincia: dir.provincia },
      fecha: ahora, canal: "web", deposito: depo._id,
      items: items.map(({ marcaId, ruta, ...it }) => it),
      subtotal, descuento: promo.descuento, total: subtotal - promo.descuento + envio.costo,
      pago: { medio, cuotas: medio === "credito" ? Math.max(1, Math.min(12, parseInt(pago.cuotas, 10) || 1)) : 1 },
      envio, estado: "pagado",
      historialEstados: [{ estado: "pendiente", fecha: ahora }, { estado: "pagado", fecha: ahora }]
    };
    if (promo.codigo) pedido.promocion = promo.codigo;
    await db.collection("pedidos").insertOne(pedido, { session });
    return pedido;
  };
  const devolver = (lista) => Promise.all(lista.map((it) => db.collection("productos").updateOne(
    { "variantes.sku": it.sku }, { $inc: { "variantes.$[v].stock.$[s].cantidad": it.cantidad } },
    { arrayFilters: [{ "v.sku": it.sku }, { "s.deposito": depo._id }] })));

  let pedido;
  if (esReplicaSet) {
    const session = cliente.startSession();
    try { await session.withTransaction(async () => { pedido = await reservar(session); }); }
    finally { await session.endSession(); }
  } else {
    pedido = await reservar(null);
  }
  // Puntos del club y vaciado del carrito guardado
  await db.collection("clientes").updateOne({ _id: c._id }, { $inc: { "club.puntos": Math.floor(pedido.total / 10000) } });
  await db.collection("carritos").deleteMany({ clienteId: c._id });
  res.status(201).json({ numero: pedido.numero, total: pedido.total, deposito: depo._id, transaccion: esReplicaSet });
}));

// Guarda el carrito del cliente (colección carritos con TTL de 30 días)
app.put("/api/carritos/:email", ruta(async (req, res) => {
  const c = await db.collection("clientes").findOne({ email: req.params.email }, { projection: { _id: 1 } });
  if (!c) throw error(404, "Cliente no encontrado");
  const items = (req.body.items || []).map((i) => ({ productoId: new ObjectId(i.productoId), sku: i.sku, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio }));
  if (!items.length) await db.collection("carritos").deleteMany({ clienteId: c._id });
  else await db.collection("carritos").updateOne({ clienteId: c._id }, { $set: { items, canal: "web", actualizado: new Date() } }, { upsert: true });
  res.json({ ok: true });
}));

// Seguimiento por número de pedido o por código de tracking
app.get("/api/seguimiento/:codigo", ruta(async (req, res) => {
  const cod = req.params.codigo.trim().toUpperCase();
  const filtro = /^\d+$/.test(cod) ? { numero: Number(cod) } : { "envio.tracking": cod };
  const p = await db.collection("pedidos").findOne(filtro, { projection: { numero: 1, fecha: 1, estado: 1, envio: 1, historialEstados: 1, items: { nombre: 1, cantidad: 1 }, total: 1 } });
  if (!p) throw error(404, "No encontramos un pedido con ese número o código de seguimiento");
  if (p.envio.puntoRetiro) p.envio.punto = await db.collection("depositos").findOne({ _id: p.envio.puntoRetiro }, { projection: { nombre: 1, direccion: 1, horario: 1 } });
  res.json(p);
}));

// ---------------------------------------------------------------------
// PANEL DE ADMINISTRACIÓN
// ---------------------------------------------------------------------
app.get("/api/admin/resumen", ruta(async (req, res) => {
  const anio = new Date(`${new Date().getFullYear()}-01-01T03:00:00Z`);
  const noCancelado = { estado: { $ne: "cancelado" } };
  const [kpis, porMes, porRubro, top, cola, stockBajo, carritos] = await Promise.all([
    db.collection("pedidos").aggregate([
      { $match: { fecha: { $gte: anio }, ...noCancelado } },
      { $group: { _id: null, facturacion: { $sum: "$total" }, pedidos: { $sum: 1 }, ticket: { $avg: "$total" }, clientes: { $addToSet: "$cliente._id" } } },
      { $project: { _id: 0, facturacion: 1, pedidos: 1, ticket: { $round: ["$ticket", 0] }, clientes: { $size: "$clientes" } } }
    ]).toArray(),
    db.collection("pedidos").aggregate([
      { $match: { fecha: { $gte: anio }, ...noCancelado } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$fecha", timezone: TZ } }, total: { $sum: "$total" }, pedidos: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray(),
    db.collection("pedidos").aggregate([
      { $match: { fecha: { $gte: anio }, ...noCancelado } }, { $unwind: "$items" },
      { $group: { _id: "$items.tipo", total: { $sum: { $multiply: ["$items.cantidad", "$items.precioUnitario"] } } } }, { $sort: { total: -1 } }
    ]).toArray(),
    db.collection("pedidos").aggregate([
      { $match: { fecha: { $gte: anio }, ...noCancelado } }, { $unwind: "$items" },
      { $group: { _id: "$items.productoId", unidades: { $sum: "$items.cantidad" }, total: { $sum: { $multiply: ["$items.cantidad", "$items.precioUnitario"] } } } },
      { $sort: { total: -1 } }, { $limit: 6 },
      { $lookup: { from: "productos", localField: "_id", foreignField: "_id", as: "p", pipeline: [{ $project: { nombre: 1, "marca.nombre": 1 } }] } },
      { $project: { nombre: { $first: "$p.nombre" }, marca: { $first: "$p.marca.nombre" }, unidades: 1, total: 1 } }
    ]).toArray(),
    db.collection("pedidos").find({ estado: { $in: ["pagado", "preparando"] } }, { projection: { numero: 1, fecha: 1, estado: 1, deposito: 1, "cliente.nombre": 1, "envio.tipo": 1, total: 1 } })
      .sort({ fecha: 1 }).limit(12).toArray(),
    db.collection("productos").aggregate([
      { $match: { activo: true } }, { $unwind: "$variantes" }, { $unwind: "$variantes.stock" },
      { $match: { "variantes.stock.cantidad": { $lte: 3 } } },
      { $project: { _id: 0, producto: "$nombre", presentacion: "$variantes.presentacion", deposito: "$variantes.stock.deposito", cantidad: "$variantes.stock.cantidad" } },
      { $sort: { cantidad: 1, producto: 1 } }, { $limit: 10 }
    ]).toArray(),
    db.collection("carritos").aggregate([
      { $match: { actualizado: { $lt: new Date(Date.now() - 3 * 86400000) } } },
      { $group: { _id: null, n: { $sum: 1 }, monto: { $sum: { $sum: { $map: { input: "$items", in: { $multiply: ["$$this.precio", "$$this.cantidad"] } } } } } } }
    ]).toArray()
  ]);
  res.json({ kpis: kpis[0] || {}, porMes, porRubro, top, cola, stockBajo, carritos: carritos[0] || { n: 0, monto: 0 } });
}));

// Avanza el estado de un pedido (pagado -> preparando -> enviado -> entregado)
app.post("/api/admin/pedidos/:numero/avanzar", ruta(async (req, res) => {
  const pasos = ["pagado", "preparando", "enviado", "entregado"];
  const numero = Number(req.params.numero);
  const p = await db.collection("pedidos").findOne({ numero }, { projection: { estado: 1, envio: 1 } });
  if (!p) throw error(404, "Pedido no encontrado");
  const i = pasos.indexOf(p.estado);
  if (i < 0 || i === pasos.length - 1) throw error(400, `El pedido está ${p.estado} y no se puede avanzar`);
  const nuevo = pasos[i + 1];
  const set = { estado: nuevo };
  if (nuevo === "enviado" && p.envio.tipo === "domicilio" && !p.envio.tracking) set["envio.tracking"] = `AND${String(numero).padStart(10, "0")}`;
  await db.collection("pedidos").updateOne({ numero, estado: p.estado }, { $set: set, $push: { historialEstados: { estado: nuevo, fecha: new Date() } } });
  res.json({ numero, estado: nuevo, tracking: set["envio.tracking"] });
}));

app.use("/api", (req, res) => res.status(404).json({ error: "Ruta inexistente" }));

// ---------------------------------------------------------------------
(async () => {
  try {
    await cliente.connect();
  } catch (e) {
    console.error(`\nNo se pudo conectar a MongoDB en ${URI}.\n¿Está encendido el servicio MongoDB?\n`);
    process.exit(1);
  }
  db = cliente.db("mparfum");
  const hello = await db.admin().command({ hello: 1 });
  esReplicaSet = Boolean(hello.setName);
  const n = await db.collection("productos").countDocuments();
  if (!n) console.warn("ATENCIÓN: la base mparfum está vacía. Ejecutá primero los scripts 00, 01 y 02.");
  app.listen(PUERTO, () => {
    console.log(`\nMparfum tienda online lista: http://localhost:${PUERTO}`);
    console.log(`Base: ${URI} / mparfum (${n} productos) - transacciones: ${esReplicaSet ? "sí (replica set)" : "no (servidor standalone)"}\n`);
  });
})();
