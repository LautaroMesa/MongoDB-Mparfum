# 1. Planteo del problema y requisitos

## Problemática

**Mparfum** es un **e-commerce de perfumería y cosmética**: vende por su sitio web y su app a todo el país. El catálogo tiene perfumes de mujer, hombre y unisex, y también cosmética: maquillaje (rostro, ojos, labios, uñas), tratamiento facial y dermocosmética, cuerpo y baño, cabello y sets de regalo. La estructura de categorías se armó tomando como guía la tienda online de Juleriaque.

Mparfum no tiene locales de venta. La operación logística se apoya en:

- **3 depósitos regionales** (Cuyo, Centro y AMBA), donde está el stock y desde donde se despachan los pedidos;
- **puntos de retiro**, donde el cliente pasa a buscar su compra sin pagar envío;
- **empresas de envío** (Andreani, OCA y Correo Argentino), que entregan a domicilio con un código de seguimiento.

La tienda necesita una base de datos que:

- guarde productos muy distintos entre sí. Un perfume tiene concentración, familia olfativa y notas de salida, corazón y fondo. Una base de maquillaje tiene tonos, acabado y cobertura. Un sérum tiene tipo de piel e ingredientes activos;
- maneje varias **presentaciones** por producto (30, 50 y 100 ml, o un tono distinto), con precio y stock propios en cada depósito;
- registre clientes, carritos, lista de deseos, pedidos, envíos, reseñas y cupones;
- dé respuestas rápidas al cliente (buscador, catálogo, "mis pedidos", seguimiento) y al negocio (ventas, stock, logística, carritos abandonados y promociones).

El esquema rígido de una base relacional obligaría a usar muchas tablas de atributos (EAV) o columnas nulas para soportar la variedad del catálogo. Por eso se eligió **MongoDB**, un motor documental con esquema flexible y validable.

## Requisitos funcionales

| # | Requisito | Dónde se resuelve |
|---|-----------|-------------------|
| RF1 | Publicar perfumes y cosméticos con atributos propios de cada tipo | `productos` (patrón polimórfico), validador `$jsonSchema` |
| RF2 | Manejar presentaciones y tonos con precio y stock por depósito | `productos.variantes[].stock[]` |
| RF3 | Navegar el catálogo por rubro, género, categoría, marca y precio, con filtros laterales | C1, C2, C3, C18 |
| RF4 | Buscador del sitio por texto libre (nombre, marca, notas olfativas) | C4, índice `tx_buscador` |
| RF5 | Registrar compras de la web y la app, con cupones, cuotas y medios de pago | `pedidos`, C29 (transacción) |
| RF6 | "Mis pedidos": historial de compras del cliente | C5 |
| RF7 | Seguimiento del envío por código de tracking | C24 |
| RF8 | Elegir en el checkout el punto de retiro más cercano | C13 (`$geoNear`) |
| RF9 | Gestionar la cola de despacho de cada depósito | C11 |
| RF10 | Medir los tiempos de entrega por depósito y empresa de envío | C23 |
| RF11 | Reportes de ventas por mes, canal (web o app), rubro, producto y provincia | C6, C7, C9, C20 |
| RF12 | Medir la efectividad de los cupones y promociones | C10, C19 |
| RF13 | Recomendar productos ("quienes compraron X también compraron") | C12 |
| RF14 | Lista de deseos (favoritos) | `clientes.favoritos`, C21 |
| RF15 | Detectar carritos abandonados para enviar recordatorios. Los carritos sin actividad se borran solos | C22, `carritos` + índice TTL |
| RF16 | Alertar sobre stock bajo en los depósitos | C14 |
| RF17 | Reseñas y rating de productos | `reseñas`, C8, C27 |
| RF18 | Segmentar clientes y programa de puntos (club) | C17, `clientes.club` |

## Requisitos no funcionales

| # | Requisito | Solución |
|---|-----------|----------|
| RNF1 | Integridad de los datos | Validadores `$jsonSchema` (validationLevel `strict`), índices únicos (email, DNI, SKU, número de pedido, tracking) |
| RNF2 | Desempeño en las consultas frecuentes del sitio | Índices compuestos (regla ESR), multikey, texto, geoespacial, parcial y TTL. Medición con `explain()` (script 04) |
| RNF3 | No vender sin stock (pedido + stock) | Actualización atómica con `arrayFilters` y transacciones multi-documento sobre replica set |
| RNF4 | Resguardo y recuperación | `mongodump`/`mongorestore` con rotación diaria, semanal y mensual, oplog y verificación automática (ver doc 03) |
| RNF5 | Seguridad | Autenticación, roles con mínimo privilegio (backend web, depósito, atención al cliente, analista) y vistas que ocultan datos personales (script 05) |
| RNF6 | Reproducibilidad | Datos generados con semilla fija y volumen configurable (`CANT_PEDIDOS`) |
