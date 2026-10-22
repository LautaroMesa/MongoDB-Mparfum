// =====================================================================
// MPARFUM - Script 07: cada tema de la clase "MongoDB - Gestión de Datos"
// (Ing. F. Zapata) aplicado a la base mparfum.
// Uso: mongosh "mongodb://localhost:27017" scripts/07_consultas_clase.js
//
// Las operaciones que modifican datos trabajan sobre un producto de
// prueba y sobre la colección "prueba_clase", que se borran al final:
// la base queda igual que antes de ejecutar el script.
// =====================================================================

db = db.getSiblingDB("mparfum");
function tema(t) { print(`\n${"#".repeat(70)}\n# ${t}\n${"#".repeat(70)}`); }
function paso(t) { print(`\n--- ${t}`); }

// =====================================================================
tema("1. OPERACIONES BÁSICAS");
// =====================================================================
paso("show databases  (en un script: db.getMongo().getDBNames())");
printjson(db.getMongo().getDBNames());

paso("use mparfum / db  -> base activa");
print(db.getName());

paso("db.createCollection(\"prueba_clase\")");
db.prueba_clase.drop();
db.createCollection("prueba_clase");

paso("show collections");
printjson(db.getCollectionNames().sort());

paso("db.dropDatabase()  (sobre una base de prueba, nunca sobre mparfum)");
const prueba = db.getSiblingDB("mparfum_prueba");
prueba.temporal.insertOne({ x: 1 });
printjson(prueba.dropDatabase());

// =====================================================================
tema("2. CREAR, CONSULTAR, MODIFICAR Y ELIMINAR DOCUMENTOS (CRUD)");
// =====================================================================
paso("insertOne: alta de un perfume nuevo (pasa por el validador $jsonSchema)");
const nuevo = db.productos.insertOne({
  nombre: "Idôle (producto de prueba)", tipo: "fragancia", genero: "mujer",
  marca: { _id: "lancome", nombre: "Lancôme" },
  categoria: { _id: "fragancias-mujer", ruta: ["fragancias", "fragancias-mujer"] },
  descripcion: "Eau de Parfum floral chipre.", etiquetas: ["floral", "nuevo"],
  atributos: { concentracion: "Eau de Parfum", familiaOlfativa: "floral chipre", notas: { salida: ["pera", "bergamota"], corazon: ["rosa", "jazmín"], fondo: ["almizcle", "vainilla"] } },
  variantes: [{ sku: "FR-PRUEBA-1", presentacion: "Eau de Parfum 50 ml", contenido: { valor: NumberInt(50), unidad: "ml" }, precio: 189000, stock: [{ deposito: "DEP-MZA", cantidad: NumberInt(10) }] }],
  rating: { promedio: 0, cantidad: NumberInt(0) }, activo: true, fechaAlta: new Date()
});
const idNuevo = nuevo.insertedId;
print(`Insertado con _id ${idNuevo}`);

paso("find() con condición simple: perfumes de hombre (sólo nombre y marca)");
db.productos.find({ tipo: "fragancia", genero: "hombre" }, { _id: 0, nombre: 1, "marca.nombre": 1 }).limit(5).forEach((d) => printjson(d));

paso("findOne(): un cliente cualquiera");
printjson(db.clientes.findOne({}, { nombre: 1, apellido: 1, email: 1, "club.nivel": 1 }));

paso("find() con varias condiciones (AND implícito): pedidos web, con crédito, en 12 cuotas");
print(db.pedidos.countDocuments({ canal: "web", "pago.medio": "credito", "pago.cuotas": 12 }) + " pedidos");

paso("updateOne + $set: cambiar la descripción del producto de prueba");
printjson(db.productos.updateOne({ _id: idNuevo }, { $set: { descripcion: "Eau de Parfum floral chipre, lanzamiento 2026." } }));

paso("updateOne + $inc: subir $5.000 el precio de la primera variante");
db.productos.updateOne({ _id: idNuevo }, { $inc: { "variantes.0.precio": 5000 } });
print(db.productos.findOne({ _id: idNuevo }).variantes[0].precio);

paso("updateOne + $unset: quitar un campo");
db.productos.updateOne({ _id: idNuevo }, { $unset: { fechaAlta: "" } });
print("¿Tiene fechaAlta? " + ("fechaAlta" in db.productos.findOne({ _id: idNuevo })));

paso("updateMany: marcar como destacados todos los sets de regalo");
printjson(db.productos.updateMany({ tipo: "set" }, { $set: { destacado: true } }));

// =====================================================================
tema("3. GESTIÓN DE ARRAYS ($push, $each, $pop, $pull, $addToSet)");
// =====================================================================
const etiquetas = () => print(JSON.stringify(db.productos.findOne({ _id: idNuevo }).etiquetas));
paso("Etiquetas iniciales"); etiquetas();
paso("$push: agrega 'día de la madre' al final"); db.productos.updateOne({ _id: idNuevo }, { $push: { etiquetas: "día de la madre" } }); etiquetas();
paso("$push + $each: agrega varias de una vez"); db.productos.updateOne({ _id: idNuevo }, { $push: { etiquetas: { $each: ["noche", "elegante", "best seller"] } } }); etiquetas();
paso("$pop 1: elimina el último elemento (pila)"); db.productos.updateOne({ _id: idNuevo }, { $pop: { etiquetas: 1 } }); etiquetas();
paso("$pop -1: elimina el primer elemento (cola)"); db.productos.updateOne({ _id: idNuevo }, { $pop: { etiquetas: -1 } }); etiquetas();
paso("$pull: elimina los elementos que cumplen la condición"); db.productos.updateOne({ _id: idNuevo }, { $pull: { etiquetas: "noche" } }); etiquetas();
paso("$addToSet: agrega sólo si no existe (no duplica)"); db.productos.updateOne({ _id: idNuevo }, { $addToSet: { etiquetas: "elegante" } }); etiquetas();
paso("$push en un array de subdocumentos: nueva presentación de 100 ml");
db.productos.updateOne({ _id: idNuevo }, { $push: { variantes: { sku: "FR-PRUEBA-2", presentacion: "Eau de Parfum 100 ml", contenido: { valor: NumberInt(100), unidad: "ml" }, precio: 265000, stock: [{ deposito: "DEP-MZA", cantidad: NumberInt(4) }] } } });
print(db.productos.findOne({ _id: idNuevo }).variantes.map((v) => v.presentacion).join(" | "));

// =====================================================================
tema("4. CARGA MASIVA (insertMany y bucles)");
// =====================================================================
paso("insertMany con _id únicos");
printjson(db.prueba_clase.insertMany([{ _id: 0 }, { _id: 1 }, { _id: 2 }, { _id: 3 }]));

paso("insertMany con un _id repetido: se interrumpe el proceso (ordered: true)");
try { db.prueba_clase.insertMany([{ _id: 10 }, { _id: 11 }, { _id: 11 }, { _id: 12 }]); }
catch (e) { print(`Error ${e.code} (clave duplicada). Se insertaron ${e.result.insertedCount} y el _id 12 NO se insertó.`); }

paso("insertMany con ordered: false: salta el repetido y sigue");
try { db.prueba_clase.insertMany([{ _id: 20 }, { _id: 21 }, { _id: 21 }, { _id: 22 }], { ordered: false }); }
catch (e) { print(`Error en 1 documento, pero se insertaron ${e.result.insertedCount} (incluido el _id 22).`); }

paso("Bucle for: 1000 documentos (como en la clase, pero en un solo insertMany)");
const lote = [];
for (let i = 0; i < 1000; i++) lote.push({ clave: "dato" + i, num: i, otro: i * 2 });
db.prueba_clase.insertMany(lote);
print(`prueba_clase tiene ${db.prueba_clase.countDocuments()} documentos`);

// =====================================================================
tema("5. OPERADORES DE CONSULTA");
// =====================================================================
paso("$gte / $lte: rango de precios (variantes entre $100.000 y $150.000)");
db.productos.find({ "variantes.precio": { $gte: 100000, $lte: 150000 } }, { _id: 0, nombre: 1 }).limit(5).forEach((d) => printjson(d));

paso("$elemMatch: la MISMA variante cumple las dos condiciones");
print(db.productos.countDocuments({ variantes: { $elemMatch: { precio: { $lt: 60000 }, "contenido.unidad": "ml" } } }) + " productos con una presentación en ml de menos de $60.000");

paso("$in: productos de Chanel, Dior o Lancôme");
print(db.productos.countDocuments({ "marca._id": { $in: ["chanel", "dior", "lancome"] } }) + " productos");

paso("$nin / $ne: productos que no son fragancias ni sets, y no son unisex");
print(db.productos.countDocuments({ tipo: { $nin: ["fragancia", "set"] }, genero: { $ne: "unisex" } }) + " productos");

paso("$or: perfumes de hombre O productos de cabello");
db.productos.find({ $or: [{ tipo: "fragancia", genero: "hombre" }, { tipo: "cabello" }] }, { _id: 0, nombre: 1, tipo: 1 }).limit(6).forEach((d) => printjson(d));

paso("$exists: pedidos que usaron un cupón");
print(db.pedidos.countDocuments({ promocion: { $exists: true } }) + " pedidos con cupón");

paso("Expresión regular: productos cuyo nombre empieza con 'S' (sin importar mayúsculas)");
db.productos.find({ nombre: /^s/i }, { _id: 0, nombre: 1 }).forEach((d) => printjson(d));

paso("$all y $size: fragancias que tienen vainilla Y pachulí, y las que tienen exactamente 3 presentaciones");
print(db.productos.countDocuments({ "atributos.notas.fondo": { $all: ["vainilla", "pachulí"] } }) + " con vainilla y pachulí de fondo");
print(db.productos.countDocuments({ variantes: { $size: 3 } }) + " con exactamente 3 presentaciones");

paso("Documento embebido (notación de punto): pedidos enviados a Godoy Cruz");
print(db.pedidos.countDocuments({ "envio.direccion.ciudad": "Godoy Cruz" }) + " pedidos");

paso("sort + skip + limit: segunda página (5 por página) de las fragancias más caras");
db.productos.find({ tipo: "fragancia" }, { _id: 0, nombre: 1, "variantes.precio": 1 }).sort({ "variantes.precio": -1 }).skip(5).limit(5).forEach((d) => print(`${d.nombre}: ${Math.max(...d.variantes.map((v) => v.precio))}`));

paso("distinct: familias olfativas distintas del catálogo");
printjson(db.productos.distinct("atributos.familiaOlfativa"));

// =====================================================================
tema("6. TIPOS DE DATOS");
// =====================================================================
const ped = db.pedidos.findOne({}, { fecha: 1, numero: 1, total: 1, items: 1 });
paso("ObjectId: 12 bytes, incluye la fecha de creación");
print(`_id ${ped._id} -> creado el ${ped._id.getTimestamp().toISOString()}`);
paso("Date: pedidos de los últimos 7 días (comparación de fechas)");
print(db.pedidos.countDocuments({ fecha: { $gte: new Date(Date.now() - 7 * 86400000) } }) + " pedidos");
paso("$type: comprobar el tipo BSON guardado");
print("fecha es date: " + db.pedidos.countDocuments({ _id: ped._id, fecha: { $type: "date" } }));
print("numero es int: " + db.pedidos.countDocuments({ _id: ped._id, numero: { $type: "int" } }));
print("items es array: " + db.pedidos.countDocuments({ _id: ped._id, items: { $type: "array" } }));
paso("Array con distintos tipos (permitido en MongoDB)");
db.prueba_clase.insertOne({ _id: "mixto", tags: ["UM", "amigos", 3.14, true, new Date(), { anidado: 1 }] });
printjson(db.prueba_clase.findOne({ _id: "mixto" }));

// =====================================================================
tema("7. RELACIONES");
// =====================================================================
paso("Uno a uno (embebido): cada pedido tiene UN envío dentro del documento");
printjson(db.pedidos.findOne({ "envio.tipo": "domicilio" }, { _id: 0, numero: 1, envio: 1 }));

paso("Uno a muchos (embebido): un producto tiene muchas variantes");
printjson(db.productos.findOne({ nombre: "Sauvage" }, { _id: 0, nombre: 1, "variantes.presentacion": 1, "variantes.precio": 1 }));

paso("Uno a muchos (referenciado): un cliente tiene muchos pedidos -> $lookup (como en la clase)");
const cli = db.pedidos.aggregate([{ $group: { _id: "$cliente._id", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 }]).next()._id;
db.clientes.aggregate([
  { $match: { _id: cli } },
  { $lookup: { from: "pedidos", localField: "_id", foreignField: "cliente._id", as: "pedidosDelCliente" } },
  { $project: { _id: 0, nombre: 1, apellido: 1, cantidadPedidos: { $size: "$pedidosDelCliente" }, ultimos: { $slice: [{ $sortArray: { input: "$pedidosDelCliente.numero", sortBy: -1 } }, 3] } } }
]).forEach((d) => printjson(d));

paso("Muchos a muchos: clientes <-> productos a través de la lista de favoritos (array de ObjectId)");
db.clientes.aggregate([
  { $match: { "favoritos.2": { $exists: true } } }, { $limit: 1 },
  { $lookup: { from: "productos", localField: "favoritos", foreignField: "_id", as: "productosFavoritos" } },
  { $project: { _id: 0, nombre: 1, favoritos: "$productosFavoritos.nombre" } }
]).forEach((d) => printjson(d));
paso("...y en sentido inverso: cuántos clientes tienen a Sauvage en favoritos");
const sauvage = db.productos.findOne({ nombre: "Sauvage" })._id;
print(db.clientes.countDocuments({ favoritos: sauvage }) + " clientes");

// =====================================================================
tema("8. CONSULTAS AVANZADAS CON aggregate()");
// =====================================================================
paso("$match + $group + $sum: facturación por canal (sin cancelados)");
db.pedidos.aggregate([
  { $match: { estado: { $ne: "cancelado" } } },
  { $group: { _id: "$canal", facturacion: { $sum: "$total" }, pedidos: { $sum: 1 } } }
]).forEach((d) => printjson(d));

paso("$group con _id: null -> un único total general");
db.pedidos.aggregate([{ $match: { estado: "entregado" } }, { $group: { _id: null, suma: { $sum: "$total" }, promedio: { $avg: "$total" }, maximo: { $max: "$total" } } }]).forEach((d) => printjson(d));

paso("$project: incluir / excluir campos");
db.clientes.aggregate([{ $project: { _id: 0, apellido: 1, nombre: 1, email: 1 } }, { $limit: 3 }]).forEach((d) => printjson(d));
print("(Nota: no se pueden mezclar 1 y 0 en el mismo $project; la única excepción es _id: 0.)");
paso("$project excluyendo: todo el cliente menos datos sensibles");
printjson(db.clientes.aggregate([{ $project: { dni: 0, telefono: 0, direcciones: 0, favoritos: 0, preferencias: 0 } }, { $limit: 1 }]).next());

paso("$project: renombrar claves y valores calculados ($add, $subtract, $multiply)");
db.pedidos.aggregate([
  { $match: { descuento: { $gt: 0 } } }, { $limit: 3 },
  { $project: { _id: 0, nroPedido: "$numero", cliente: "$cliente.nombre",
      sinDescuento: { $add: ["$subtotal", "$envio.costo"] },
      pagado: { $subtract: [{ $add: ["$subtotal", "$envio.costo"] }, "$descuento"] },
      ahorroPorcentaje: { $round: [{ $multiply: [{ $divide: ["$descuento", "$subtotal"] }, 100] }, 1] } } }
]).forEach((d) => printjson(d));

paso("$project + $cond: clasificar clientes por edad (como el Adulto / Menor de la clase; todos los clientes son mayores, así que se corta en 30 años)");
db.clientes.aggregate([
  { $project: { _id: 0, nombre: 1, edad: { $dateDiff: { startDate: "$fechaNacimiento", endDate: "$$NOW", unit: "year" } } } },
  { $project: { nombre: 1, edad: 1, categoria: { $cond: { if: { $gte: ["$edad", 30] }, then: "30 años o más", else: "Menos de 30 años" } } } },
  { $group: { _id: "$categoria", clientes: { $sum: 1 }, edadPromedio: { $avg: "$edad" } } }
]).forEach((d) => printjson(d));

paso("$cond aplicado al catálogo: gama Premium / Media / Accesible según el precio");
db.productos.aggregate([
  { $match: { activo: true } },
  { $project: { nombre: 1, precioDesde: { $min: "$variantes.precio" } } },
  { $project: { nombre: 1, precioDesde: 1, gama: { $cond: { if: { $gte: ["$precioDesde", 150000] }, then: "Premium", else: { $cond: [{ $gte: ["$precioDesde", 60000] }, "Media", "Accesible"] } } } } },
  { $group: { _id: "$gama", productos: { $sum: 1 }, ejemplos: { $push: "$nombre" } } },
  { $project: { productos: 1, ejemplos: { $slice: ["$ejemplos", 3] } } }
]).forEach((d) => printjson(d));

paso("$lookup + $unwind + $group: las 5 marcas que más facturan");
db.pedidos.aggregate([
  { $match: { estado: { $ne: "cancelado" } } },
  { $unwind: "$items" },
  { $lookup: { from: "productos", localField: "items.productoId", foreignField: "_id", as: "prod" } },
  { $group: { _id: { $first: "$prod.marca.nombre" }, facturacion: { $sum: { $multiply: ["$items.cantidad", "$items.precioUnitario"] } } } },
  { $sort: { facturacion: -1 } }, { $limit: 5 }
]).forEach((d) => printjson(d));

// =====================================================================
tema("9. SERIES TEMPORALES");
// =====================================================================
const info = db.getCollectionInfos({ name: "eventos_web" })[0];
if (info) {
  paso("Configuración de la colección eventos_web");
  printjson(info.options.timeseries);
  paso("Eventos por tipo en las últimas 24 horas");
  db.eventos_web.aggregate([{ $match: { fecha: { $gte: new Date(Date.now() - 86400000) } } }, { $group: { _id: "$meta.tipo", n: { $sum: 1 } } }]).forEach((d) => printjson(d));
  print("(Las demás consultas de series temporales están en el script 06.)");
} else {
  print("Ejecutá primero scripts/06_series_temporales.js para crear la colección eventos_web.");
}

// =====================================================================
tema("10. ELIMINAR (y dejar la base como estaba)");
// =====================================================================
paso("deleteOne: borrar el producto de prueba  (equivale a remove de la clase)");
printjson(db.productos.deleteOne({ _id: idNuevo }));
paso("deleteMany: borrar los documentos con num >= 500 de prueba_clase");
printjson(db.prueba_clase.deleteMany({ num: { $gte: 500 } }));
paso("drop(): eliminar la colección completa");
print(db.prueba_clase.drop());
paso("$unset con updateMany: quitar la marca de destacado de los sets");
printjson(db.productos.updateMany({ tipo: "set" }, { $unset: { destacado: "" } }));
print("\nListo: la base mparfum quedó igual que antes.");
