# Mparfum: e-commerce de perfumería y cosmética en MongoDB

Proyecto de **Diseño de Bases de Datos II**, Universidad de Mendoza, 2026 (Ing. F. Zapata / Ing. C. Cozzolino).

Mparfum es una tienda online (sitio web y app) que vende **perfumes y cosmética**: maquillaje, tratamiento facial y dermocosmética, cuerpo y baño, cabello y sets de regalo. El catálogo se estructuró tomando como guía la tienda de Juleriaque. Los precios son ilustrativos (ARS 2026).

## Cómo cubre las consignas del proyecto

| Consigna del enunciado | Dónde está |
|------------------------|------------|
| Planteo de necesidades (requisitos) y solución propuesta | `docs/01_requisitos.md` |
| Modelado de la estructura de datos | `docs/02_modelo_de_datos.md`, `docs/06_diccionario_de_datos.md` |
| Implementación del modelo en MongoDB | `scripts/00_crear_colecciones.js` (colecciones y validadores `$jsonSchema`) |
| Carga de datos | `scripts/01_carga_datos.js` |
| Consultas avanzadas | `scripts/03_consultas.js` (29 consultas: agregaciones, `$lookup`, `$facet`, `$bucket`, `$graphLookup`, `$geoNear`, `$text`, `$setWindowFields`, `$merge`, `arrayFilters` y transacciones) |
| Medición del desempeño (indexación) | `scripts/02_indices.js`, `scripts/04_desempeño_indices.js`, `docs/04_indices_y_desempeño.md` |
| Políticas de resguardo | `backup/`, `docs/03_politica_resguardo.md` |
| Extra: vistas, roles y usuarios | `scripts/05_vistas_y_seguridad.js` |
| Series temporales (clase) | `scripts/06_series_temporales.js` (colección `eventos_web`) |
| Cada tema de la clase aplicado a Mparfum | `scripts/07_consultas_clase.js`, `docs/05_guia_presentacion.md` |
| Portada de la tienda (colección principal que ve el cliente) | `scripts/08_pagina_inicio.js` (colección `pagina_inicio`) |
| Extra: tienda web conectada a la base | `frontend/` (ver `frontend/README.md`) |

## Estructura

```
BD 2 PROYECTO/
├── README.md
├── docs/
│   ├── 01_requisitos.md
│   ├── 02_modelo_de_datos.md
│   ├── 03_politica_resguardo.md
│   ├── 04_indices_y_desempeño.md
│   ├── 05_guia_presentacion.md   (consultas para la exposición)
│   └── 06_diccionario_de_datos.md (todos los campos de cada colección)
├── scripts/
│   ├── 00_crear_colecciones.js
│   ├── 01_carga_datos.js
│   ├── 02_indices.js
│   ├── 03_consultas.js
│   ├── 04_desempeño_indices.js
│   ├── 05_vistas_y_seguridad.js
│   ├── 06_series_temporales.js
│   ├── 07_consultas_clase.js
│   └── 08_pagina_inicio.js
├── frontend/          (tienda web: npm install y npm start)
│   ├── server.js
│   └── public/        (index.html, app.js, styles.css)
└── backup/
    ├── backup.sh / backup_windows.bat
    ├── restore.sh
    ├── verificar_restore.js
    └── crontab.txt
```

## Base `mparfum`

| Colección | Qué guarda |
|-----------|-----------|
| `productos` | Perfumes y cosméticos (patrón polimórfico), con variantes (ml o tono), precio y stock por depósito |
| `marcas` | 27 marcas de fragancias y cosmética |
| `categorias` | Árbol del menú de la tienda (Fragancias, Maquillaje, Tratamiento, Cuerpo, Cabello, Sets) |
| `clientes` | Cuenta del cliente: direcciones, preferencias, favoritos y club de puntos |
| `pedidos` | Compras web y app con ítems, cupón, pago en cuotas, envío con tracking y estados |
| `carritos` | Carritos abiertos (se borran solos a los 30 días, índice TTL) |
| `eventos_web` | **Serie temporal**: vistas de producto, carritos y búsquedas del sitio |
| `pagina_inicio` | **Portada** (14 documentos, uno por bloque): banner, campañas, promociones, destacados, tendencias, marcas, secciones, envíos, pagos |
| `reseñas` | Opiniones con compra verificada |
| `promociones` | Cupones (BIENVENIDA10, CYBER2025, MADRE2026...) |
| `depositos` | 3 depósitos regionales y 6 puntos de retiro (GeoJSON) |

## Requisitos

- MongoDB 7.0 u 8.0 (probado con 8.0.23)
- `mongosh`
- MongoDB Database Tools (`mongodump`, `mongorestore`, `mongoexport`) para los resguardos

## Ejecución

Desde la carpeta del proyecto y en este orden:

```bash
mongosh "mongodb://localhost:27017" scripts/00_crear_colecciones.js
mongosh "mongodb://localhost:27017" scripts/01_carga_datos.js
mongosh "mongodb://localhost:27017" scripts/02_indices.js
mongosh "mongodb://localhost:27017" scripts/03_consultas.js
mongosh "mongodb://localhost:27017" scripts/04_desempeño_indices.js
mongosh "mongodb://localhost:27017" scripts/05_vistas_y_seguridad.js
mongosh "mongodb://localhost:27017" scripts/06_series_temporales.js
mongosh "mongodb://localhost:27017" scripts/07_consultas_clase.js
mongosh "mongodb://localhost:27017" scripts/08_pagina_inicio.js
```

- **Más volumen para medir desempeño**: `mongosh --eval "var CANT_PEDIDOS=200000" scripts/01_carga_datos.js` y después volver a correr `02` y `04`.
- **Transacción (C29)**: necesita un replica set. Para tener uno de un solo nodo, iniciar `mongod --replSet rs0` y ejecutar `rs.initiate()` una vez. En un servidor standalone el script avisa y saltea ese paso. Todo lo demás funciona igual.
- **Seguridad**: los roles se aplican cuando `mongod` se inicia con `--auth`. Las contraseñas del script 05 son de ejemplo.
- **MongoDB Compass**: se puede abrir la base `mparfum` y pegar cualquier pipeline de `03_consultas.js` en la pestaña *Aggregations*.

## Verificación

Se probó todo sobre MongoDB 8.0.23 en un replica set de un nodo:

- los 6 scripts terminan sin errores;
- el validador rechaza documentos inválidos;
- la transacción confirma el pedido y descuenta el stock;
- los roles bloquean las operaciones no permitidas;
- el ciclo backup → restore → verificación da OK en todas las colecciones;
- tras borrar los pedidos de la app, una restauración completa los recupera todos.
