# Mparfum: tienda online

Sitio web de la tienda conectado a la base MongoDB `mparfum`. Todo lo que se ve sale de la base en tiempo real, y lo que se hace en la página (comprar, guardar favoritos, avanzar un pedido) se escribe en ella.

## Requisitos
- La base `mparfum` creada con los scripts 00, 01 y 02.
- **Node.js** 18 o superior (https://nodejs.org, versión LTS).

## Cómo abrirla (Windows)
1. Abrí el CMD dentro de la carpeta `frontend`.
2. La primera vez, instalá las dependencias:
   ```
   npm install
   ```
3. Arrancá el servidor:
   ```
   npm start
   ```
4. Abrí **http://localhost:3000** en el navegador.

Para apagarlo, apretá `Ctrl + C` en el CMD.

## Páginas
| Página | Qué hace | Qué usa de MongoDB |
|--------|----------|--------------------|
| Inicio | Más vendidos de los últimos 90 días | `$unwind` + `$group` + `$lookup` sobre `pedidos` |
| Catálogo | Filtros por rubro, género, marca y precio, y orden | `$facet` (productos y filtros en una sola consulta), índice `ix_categoria_ruta` |
| Buscador | Busca por nombre, marca o nota olfativa | índice de texto `tx_buscador` (`$text` + `textScore`) |
| Ficha de producto | Variantes, stock, pirámide olfativa, reseñas, "también compraron" | `reseñas` + `$lookup`, recomendación sobre `items.productoId` |
| Carrito | Cupones, envío o retiro, cuotas | `promociones`, `$geoNear` sobre `depositos` (2dsphere), `carritos` (TTL) |
| Confirmar compra | Reserva stock y crea el pedido | Transacción (si hay replica set) + `arrayFilters` |
| Mi cuenta | Datos, club, mis pedidos, favoritos | índice `ix_cliente_fecha`, `$addToSet` / `$pull` en `favoritos` |
| Seguimiento | Línea de tiempo del pedido | índices `ux_numero` y `ux_tracking` |
| Panel de administración | KPIs, ventas por mes, rubros, top, stock bajo, cola de despacho | agregaciones sobre `pedidos` y `productos` |

## Ingresar
Es una demostración, así que no hay contraseña: en "Ingresar" elegís una de las cuentas de la colección `clientes` o escribís el email de cualquier cliente.

## Problemas frecuentes
- **"No se pudo conectar a MongoDB"**: el servicio de MongoDB está apagado. Encendelo con `net start MongoDB` desde un CMD abierto como administrador.
- **"npm no se reconoce"**: falta instalar Node.js. Después de instalarlo, cerrá y volvé a abrir el CMD.
- **El puerto 3000 está ocupado**: usá otro puerto con `set PORT=3001` y después `npm start`.
