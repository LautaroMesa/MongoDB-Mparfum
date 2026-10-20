// =====================================================================
// MPARFUM - Proyecto MongoDB - Diseño de Bases de Datos II (UM 2026)
// Script 00: creación de la base y de las colecciones con validación
// Uso: mongosh "mongodb://localhost:27017" scripts/00_crear_colecciones.js
// =====================================================================

db = db.getSiblingDB("mparfum");

// Se borra la base para poder re-ejecutar el proyecto desde cero
db.dropDatabase();

// ---------------------------------------------------------------------
// marcas: catálogo de marcas (fragancias y cosmética)
// ---------------------------------------------------------------------
db.createCollection("marcas", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "nombre", "paisOrigen", "rubros", "activa"],
      properties: {
        _id: { bsonType: "string", description: "slug de la marca, ej: 'chanel'" },
        nombre: { bsonType: "string" },
        paisOrigen: { bsonType: "string" },
        rubros: {
          bsonType: "array",
          minItems: 1,
          items: { enum: ["fragancias", "maquillaje", "tratamiento", "cuerpo", "cabello"] }
        },
        grupo: { bsonType: "string", description: "grupo empresario (LVMH, L'Oréal, ...)" },
        activa: { bsonType: "bool" }
      }
    }
  }
});

// ---------------------------------------------------------------------
// categorias: árbol de categorías (referencia al padre + ruta materializada)
// ---------------------------------------------------------------------
db.createCollection("categorias", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "nombre", "nivel", "ruta"],
      properties: {
        _id: { bsonType: "string" },
        nombre: { bsonType: "string" },
        padre: { bsonType: ["string", "null"] },
        ruta: { bsonType: "array", items: { bsonType: "string" } },
        nivel: { bsonType: "int", minimum: 1, maximum: 3 },
        orden: { bsonType: "int" }
      }
    }
  }
});

// ---------------------------------------------------------------------
// depositos: centros de distribución del e-commerce (tienen stock) y
// puntos de retiro donde el cliente pasa a buscar su compra online.
// Ubicación GeoJSON para buscar el punto de retiro más cercano.
// ---------------------------------------------------------------------
db.createCollection("depositos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "nombre", "tipo", "direccion", "ubicacion"],
      properties: {
        _id: { bsonType: "string" },
        nombre: { bsonType: "string" },
        tipo: { enum: ["deposito", "punto_retiro"] },
        direccion: {
          bsonType: "object",
          required: ["calle", "ciudad", "provincia"],
          properties: {
            calle: { bsonType: "string" },
            ciudad: { bsonType: "string" },
            provincia: { bsonType: "string" }
          }
        },
        ubicacion: {
          bsonType: "object",
          required: ["type", "coordinates"],
          properties: {
            type: { enum: ["Point"] },
            coordinates: { bsonType: "array", minItems: 2, maxItems: 2, items: { bsonType: "double" } }
          }
        },
        provinciasQueAbastece: { bsonType: "array", items: { bsonType: "string" } },
        horario: { bsonType: "string" }
      }
    }
  }
});

// ---------------------------------------------------------------------
// productos: perfumes y cosméticos en una única colección (patrón
// polimórfico). Las variantes (presentación / tono) van embebidas.
// ---------------------------------------------------------------------
db.createCollection("productos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre", "tipo", "marca", "categoria", "variantes", "activo"],
      properties: {
        nombre: { bsonType: "string", minLength: 1 },
        tipo: { enum: ["fragancia", "maquillaje", "tratamiento", "cuerpo", "cabello", "set"] },
        genero: { enum: ["mujer", "hombre", "unisex"] },
        marca: {
          bsonType: "object",
          required: ["_id", "nombre"],
          properties: { _id: { bsonType: "string" }, nombre: { bsonType: "string" } }
        },
        categoria: {
          bsonType: "object",
          required: ["_id", "ruta"],
          properties: { _id: { bsonType: "string" }, ruta: { bsonType: "array" } }
        },
        descripcion: { bsonType: "string" },
        etiquetas: { bsonType: "array", items: { bsonType: "string" } },
        atributos: { bsonType: "object" },
        variantes: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["sku", "presentacion", "precio", "stock"],
            properties: {
              sku: { bsonType: "string" },
              presentacion: { bsonType: "string" },
              contenido: {
                bsonType: "object",
                properties: {
                  valor: { bsonType: ["int", "double"] },
                  unidad: { enum: ["ml", "g", "u"] }
                }
              },
              tono: { bsonType: "string" },
              precio: { bsonType: ["int", "double", "decimal"], minimum: 0 },
              precioLista: { bsonType: ["int", "double", "decimal"], minimum: 0 },
              stock: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["deposito", "cantidad"],
                  properties: {
                    deposito: { bsonType: "string" },
                    cantidad: { bsonType: "int", minimum: 0 }
                  }
                }
              }
            }
          }
        },
        rating: {
          bsonType: "object",
          properties: {
            promedio: { bsonType: ["double", "int"], minimum: 0, maximum: 5 },
            cantidad: { bsonType: "int", minimum: 0 }
          }
        },
        activo: { bsonType: "bool" },
        fechaAlta: { bsonType: "date" }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

// ---------------------------------------------------------------------
// clientes
// ---------------------------------------------------------------------
db.createCollection("clientes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre", "apellido", "email", "fechaRegistro"],
      properties: {
        nombre: { bsonType: "string" },
        apellido: { bsonType: "string" },
        email: { bsonType: "string", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
        dni: { bsonType: "string", pattern: "^[0-9]{7,8}$" },
        telefono: { bsonType: "string" },
        fechaNacimiento: { bsonType: "date" },
        direcciones: {
          bsonType: "array",
          maxItems: 5,
          items: {
            bsonType: "object",
            required: ["calle", "ciudad", "provincia"],
            properties: {
              alias: { bsonType: "string" },
              calle: { bsonType: "string" },
              ciudad: { bsonType: "string" },
              provincia: { bsonType: "string" },
              cp: { bsonType: "string" },
              principal: { bsonType: "bool" }
            }
          }
        },
        preferencias: { bsonType: "object" },
        favoritos: { bsonType: "array", items: { bsonType: "objectId" }, description: "lista de deseos" },
        club: {
          bsonType: "object",
          properties: {
            nivel: { enum: ["classic", "gold", "black"] },
            puntos: { bsonType: "int", minimum: 0 }
          }
        },
        fechaRegistro: { bsonType: "date" }
      }
    }
  }
});

// ---------------------------------------------------------------------
// pedidos: compras de la tienda online (web o app). Cabecera + ítems
// embebidos (snapshot de precio y nombre) + envío y seguimiento
// ---------------------------------------------------------------------
db.createCollection("pedidos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["numero", "cliente", "fecha", "canal", "items", "total", "estado"],
      properties: {
        numero: { bsonType: "int" },
        cliente: {
          bsonType: "object",
          required: ["_id", "email"],
          properties: { _id: { bsonType: "objectId" }, email: { bsonType: "string" } }
        },
        fecha: { bsonType: "date" },
        canal: { enum: ["web", "app"] },
        deposito: { bsonType: "string", description: "depósito que despacha el pedido" },
        items: {
          bsonType: "array",
          minItems: 1,
          items: {
            bsonType: "object",
            required: ["productoId", "sku", "nombre", "cantidad", "precioUnitario"],
            properties: {
              productoId: { bsonType: "objectId" },
              sku: { bsonType: "string" },
              nombre: { bsonType: "string" },
              marca: { bsonType: "string" },
              tipo: { bsonType: "string" },
              cantidad: { bsonType: "int", minimum: 1 },
              precioUnitario: { bsonType: ["int", "double", "decimal"], minimum: 0 }
            }
          }
        },
        subtotal: { bsonType: ["int", "double", "decimal"] },
        descuento: { bsonType: ["int", "double", "decimal"] },
        total: { bsonType: ["int", "double", "decimal"], minimum: 0 },
        pago: {
          bsonType: "object",
          properties: {
            medio: { enum: ["credito", "debito", "mercadopago", "transferencia"] },
            cuotas: { bsonType: "int", minimum: 1, maximum: 12 }
          }
        },
        envio: {
          bsonType: "object",
          required: ["tipo", "costo"],
          properties: {
            tipo: { enum: ["domicilio", "retiro"] },
            costo: { bsonType: ["int", "double"], minimum: 0 },
            puntoRetiro: { bsonType: "string" },
            empresa: { bsonType: "string" },
            tracking: { bsonType: "string" },
            direccion: { bsonType: "object" }
          }
        },
        estado: { enum: ["pendiente", "pagado", "preparando", "enviado", "entregado", "cancelado"] },
        historialEstados: { bsonType: "array" },
        promocion: { bsonType: "string" }
      }
    }
  }
});

// ---------------------------------------------------------------------
// reseñas: opiniones de clientes (referencian producto y cliente)
// ---------------------------------------------------------------------
db.createCollection("reseñas", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["productoId", "clienteId", "puntaje", "fecha"],
      properties: {
        productoId: { bsonType: "objectId" },
        clienteId: { bsonType: "objectId" },
        puntaje: { bsonType: "int", minimum: 1, maximum: 5 },
        titulo: { bsonType: "string", maxLength: 100 },
        comentario: { bsonType: "string", maxLength: 2000 },
        compraVerificada: { bsonType: "bool" },
        fecha: { bsonType: "date" }
      }
    }
  }
});

// ---------------------------------------------------------------------
// promociones / cupones
// ---------------------------------------------------------------------
db.createCollection("promociones", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["codigo", "tipo", "valor", "vigencia"],
      properties: {
        codigo: { bsonType: "string" },
        descripcion: { bsonType: "string" },
        tipo: { enum: ["porcentaje", "monto_fijo", "2x1", "cuotas_sin_interes"] },
        valor: { bsonType: ["int", "double"] },
        vigencia: {
          bsonType: "object",
          required: ["desde", "hasta"],
          properties: { desde: { bsonType: "date" }, hasta: { bsonType: "date" } }
        },
        aplicaA: { bsonType: "object" },
        medioPago: { bsonType: "string" }
      }
    }
  }
});

// ---------------------------------------------------------------------
// carritos: carritos abiertos de la tienda online (expiran por TTL)
// ---------------------------------------------------------------------
db.createCollection("carritos");

print("Colecciones creadas en 'mparfum':");
printjson(db.getCollectionNames().sort());
