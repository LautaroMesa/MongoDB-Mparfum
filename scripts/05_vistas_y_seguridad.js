// =====================================================================
// MPARFUM - Script 05: vistas, roles y usuarios
// Uso: mongosh "mongodb://localhost:27017" scripts/05_vistas_y_seguridad.js
// Para que los permisos se apliquen, mongod debe iniciarse con --auth
// (o security.authorization: enabled en mongod.conf).
// Las contraseñas son de ejemplo: cambiarlas antes de usar en producción.
// =====================================================================

db = db.getSiblingDB("mparfum");

// ---------------------------------------------------------------------
// VISTAS
// ---------------------------------------------------------------------
for (const v of ["v_catalogo_publico", "v_ventas_diarias", "v_stock_por_deposito"]) db.getCollection(v).drop();

// Catálogo que consume el sitio web y la app: sin stock por depósito ni datos internos
db.createView("v_catalogo_publico", "productos", [
  { $match: { activo: true } },
  { $project: {
      nombre: 1, tipo: 1, genero: 1, marca: "$marca.nombre", categoria: "$categoria._id", descripcion: 1, atributos: 1, rating: 1,
      variantes: { $map: { input: "$variantes", in: {
        sku: "$$this.sku", presentacion: "$$this.presentacion", tono: "$$this.tono", precio: "$$this.precio",
        disponible: { $gt: [{ $sum: "$$this.stock.cantidad" }, 0] }
      } } }
  } }
]);

// Ventas por día, canal y depósito (para el analista; no expone datos personales)
db.createView("v_ventas_diarias", "pedidos", [
  { $match: { estado: { $ne: "cancelado" } } },
  { $group: {
      _id: { dia: { $dateToString: { format: "%Y-%m-%d", date: "$fecha", timezone: "America/Argentina/Mendoza" } }, canal: "$canal", deposito: "$deposito" },
      pedidos: { $sum: 1 }, facturacion: { $sum: "$total" }, descuentos: { $sum: "$descuento" }
  } },
  { $project: { _id: 0, dia: "$_id.dia", canal: "$_id.canal", deposito: "$_id.deposito", pedidos: 1, facturacion: 1, descuentos: 1 } }
]);

// Stock plano por depósito (para el personal de logística)
db.createView("v_stock_por_deposito", "productos", [
  { $match: { activo: true } },
  { $unwind: "$variantes" },
  { $unwind: "$variantes.stock" },
  { $project: { _id: 0, deposito: "$variantes.stock.deposito", sku: "$variantes.sku", producto: "$nombre", marca: "$marca.nombre", presentacion: "$variantes.presentacion", cantidad: "$variantes.stock.cantidad" } }
]);

print("Vistas creadas. Ejemplo de v_ventas_diarias:");
db.v_ventas_diarias.find().sort({ dia: -1, facturacion: -1 }).limit(3).forEach((d) => printjson(d));

// ---------------------------------------------------------------------
// ROLES PERSONALIZADOS (principio de mínimo privilegio)
// ---------------------------------------------------------------------
for (const r of ["operadorDeposito", "atencionCliente", "analistaComercial", "operadorTiendaOnline"]) {
  if (db.getRole(r)) db.dropRole(r);
}

// Operario de depósito: consulta stock y pedidos a despachar, actualiza el
// estado del pedido y el stock. No ve datos de pago ni puede borrar nada.
db.createRole({
  role: "operadorDeposito",
  privileges: [
    { resource: { db: "mparfum", collection: "v_stock_por_deposito" }, actions: ["find"] },
    { resource: { db: "mparfum", collection: "productos" }, actions: ["find", "update"] },
    { resource: { db: "mparfum", collection: "pedidos" }, actions: ["find", "update"] },
    { resource: { db: "mparfum", collection: "depositos" }, actions: ["find"] }
  ],
  roles: []
});

// Atención al cliente: consulta clientes y pedidos, actualiza datos del
// cliente (ej.: cambio de dirección) pero no modifica pedidos ni precios.
db.createRole({
  role: "atencionCliente",
  privileges: [
    { resource: { db: "mparfum", collection: "clientes" }, actions: ["find", "update"] },
    { resource: { db: "mparfum", collection: "pedidos" }, actions: ["find"] },
    { resource: { db: "mparfum", collection: "v_catalogo_publico" }, actions: ["find"] },
    { resource: { db: "mparfum", collection: "promociones" }, actions: ["find"] }
  ],
  roles: []
});

// Analista: sólo lectura de vistas agregadas y del catálogo (sin datos personales)
db.createRole({
  role: "analistaComercial",
  privileges: [
    { resource: { db: "mparfum", collection: "v_ventas_diarias" }, actions: ["find"] },
    { resource: { db: "mparfum", collection: "v_catalogo_publico" }, actions: ["find"] },
    { resource: { db: "mparfum", collection: "productos" }, actions: ["find"] },
    { resource: { db: "mparfum", collection: "reseñas" }, actions: ["find"] }
  ],
  roles: []
});

// Backend del sitio web y la app
db.createRole({
  role: "operadorTiendaOnline",
  privileges: [
    { resource: { db: "mparfum", collection: "v_catalogo_publico" }, actions: ["find"] },
    { resource: { db: "mparfum", collection: "productos" }, actions: ["find", "update"] },
    { resource: { db: "mparfum", collection: "carritos" }, actions: ["find", "insert", "update", "remove"] },
    { resource: { db: "mparfum", collection: "clientes" }, actions: ["find", "insert", "update"] },
    { resource: { db: "mparfum", collection: "pedidos" }, actions: ["find", "insert", "update"] },
    { resource: { db: "mparfum", collection: "reseñas" }, actions: ["find", "insert"] },
    { resource: { db: "mparfum", collection: "promociones" }, actions: ["find"] },
    { resource: { db: "mparfum", collection: "depositos" }, actions: ["find"] }
  ],
  roles: []
});

// ---------------------------------------------------------------------
// USUARIOS
// ---------------------------------------------------------------------
const usuarios = [
  { user: "admin_mparfum", pwd: "Cambiar.Admin2026", roles: [{ role: "dbOwner", db: "mparfum" }] },
  { user: "deposito_cuyo", pwd: "Cambiar.Depo2026", roles: [{ role: "operadorDeposito", db: "mparfum" }] },
  { user: "atencion_cliente", pwd: "Cambiar.Aten2026", roles: [{ role: "atencionCliente", db: "mparfum" }] },
  { user: "analista", pwd: "Cambiar.Anal2026", roles: [{ role: "analistaComercial", db: "mparfum" }] },
  { user: "tienda_web", pwd: "Cambiar.Web2026", roles: [{ role: "operadorTiendaOnline", db: "mparfum" }] }
];
for (const u of usuarios) {
  if (db.getUser(u.user)) db.dropUser(u.user);
  db.createUser(u);
}
// Usuario para los resguardos (roles predefinidos backup/restore en admin)
const admin = db.getSiblingDB("admin");
if (admin.getUser("backup")) admin.dropUser("backup");
admin.createUser({ user: "backup", pwd: "Cambiar.Backup2026", roles: ["backup", "restore", "clusterMonitor"] });

print("\nUsuarios de 'mparfum':");
db.getUsers().users.forEach((u) => print(`   ${u.user.padEnd(18)} -> ${u.roles.map((r) => r.role).join(", ")}`));
print("   backup (admin)     -> backup, restore, clusterMonitor");
