// =====================================================================
// MPARFUM - Script 02: índices
// Uso: mongosh "mongodb://localhost:27017" scripts/02_indices.js
// Cada índice está pensado para una consulta concreta de 03_consultas.js
// (ver el número de consulta en el comentario).
// =====================================================================

db = db.getSiblingDB("mparfum");

// ---------------- productos ----------------
// SKU único dentro de todo el catálogo (índice multikey sobre el array de variantes)
db.productos.createIndex({ "variantes.sku": 1 }, { unique: true, name: "ux_sku" });
// Navegación del catálogo: tipo + género + precio (C1, C2). Índice compuesto
// siguiendo la regla ESR (Equality, Sort, Range).
db.productos.createIndex({ tipo: 1, genero: 1, "variantes.precio": 1 }, { name: "ix_tipo_genero_precio" });
// Productos de una categoría o cualquier subcategoría (ruta materializada) (C3)
db.productos.createIndex({ "categoria.ruta": 1 }, { name: "ix_categoria_ruta" });
// Filtro por marca (C1)
db.productos.createIndex({ "marca._id": 1 }, { name: "ix_marca" });
// Búsqueda por texto del buscador de la tienda (C4), con pesos
db.productos.createIndex(
  { nombre: "text", "marca.nombre": "text", etiquetas: "text", descripcion: "text", "atributos.notas.salida": "text", "atributos.notas.corazon": "text", "atributos.notas.fondo": "text" },
  { name: "tx_buscador", default_language: "spanish", weights: { nombre: 10, "marca.nombre": 8, etiquetas: 5, descripcion: 1 } }
);
// Índice parcial: sólo productos activos ordenados por rating (C8)
db.productos.createIndex({ "rating.promedio": -1 }, { name: "ix_rating_activos", partialFilterExpression: { activo: true } });

// ---------------- clientes ----------------
db.clientes.createIndex({ email: 1 }, { unique: true, name: "ux_email" });
db.clientes.createIndex({ dni: 1 }, { unique: true, sparse: true, name: "ux_dni" });
db.clientes.createIndex({ "direcciones.provincia": 1, "club.nivel": 1 }, { name: "ix_provincia_nivel" });
// Lista de deseos: ¿cuántos clientes tienen este producto en favoritos? (C21)
db.clientes.createIndex({ favoritos: 1 }, { name: "ix_favoritos" });

// ---------------- pedidos ----------------
db.pedidos.createIndex({ numero: 1 }, { unique: true, name: "ux_numero" });
// "Mis pedidos": pedidos de un cliente ordenados por fecha (C5)
db.pedidos.createIndex({ "cliente._id": 1, fecha: -1 }, { name: "ix_cliente_fecha" });
// Reportes por período y estado (C6, C7, C9, C10)
db.pedidos.createIndex({ fecha: 1, estado: 1 }, { name: "ix_fecha_estado" });
// Cola de despacho de cada depósito: (estado, deposito) igualdad + fecha orden (C11)
db.pedidos.createIndex({ estado: 1, deposito: 1, fecha: 1 }, { name: "ix_estado_deposito_fecha" });
// Seguimiento del envío por código de tracking (sólo pedidos que lo tienen)
db.pedidos.createIndex({ "envio.tracking": 1 }, { unique: true, partialFilterExpression: { "envio.tracking": { $exists: true } }, name: "ux_tracking" });
// ¿Quién compró este producto? (C12 - recomendaciones)
db.pedidos.createIndex({ "items.productoId": 1 }, { name: "ix_items_producto" });

// ---------------- reseñas ----------------
db.reseñas.createIndex({ productoId: 1, fecha: -1 }, { name: "ix_producto_fecha" });
// Un cliente opina una sola vez por producto
db.reseñas.createIndex({ clienteId: 1, productoId: 1 }, { unique: true, name: "ux_cliente_producto" });

// ---------------- depositos ----------------
db.depositos.createIndex({ ubicacion: "2dsphere" }, { name: "geo_ubicacion" }); // (C13)

// ---------------- promociones ----------------
db.promociones.createIndex({ codigo: 1 }, { unique: true, name: "ux_codigo" });
db.promociones.createIndex({ "vigencia.desde": 1, "vigencia.hasta": 1 }, { name: "ix_vigencia" });

// ---------------- carritos ----------------
// TTL: un carrito sin actividad por 30 días se elimina automáticamente
db.carritos.createIndex({ actualizado: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30, name: "ttl_carritos_30d" });
db.carritos.createIndex({ clienteId: 1 }, { name: "ix_cliente" });

// ---------------- categorias ----------------
db.categorias.createIndex({ padre: 1, orden: 1 }, { name: "ix_padre_orden" });

print("Índices creados:");
for (const c of db.getCollectionNames().sort()) {
  print(`\n${c}`);
  db[c].getIndexes().forEach((ix) => print(`   - ${ix.name.padEnd(26)} ${JSON.stringify(ix.key)}`));
}
