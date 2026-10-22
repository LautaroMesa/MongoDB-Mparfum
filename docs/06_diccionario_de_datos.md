# 6. Diccionario de datos

Todos los campos de cada colección de la base `mparfum`, con su tipo BSON real (comprobado con `$type` sobre los datos cargados).

**Convenciones**
- **Obl.** = obligatorio según el validador `$jsonSchema`: ✔ obligatorio, — opcional.
- `campo.sub` = campo dentro de un documento embebido.
- `campo[]` = cada elemento de un array.
- Números: en mongosh 2.x un entero (`5`) se guarda como **int** (Int32) y un número con decimales (`5.5`) como **double**.

---

## marcas
Catálogo de marcas de fragancias y cosmética. **27 documentos.**

| Campo | Tipo | Obl. | Descripción | Ejemplo |
|---|---|---|---|---|
| `_id` | string | ✔ | Identificador legible (slug) | `"dior"` |
| `nombre` | string | ✔ | Nombre comercial | `"Dior"` |
| `paisOrigen` | string | ✔ | País de la marca | `"Francia"` |
| `rubros` | array de string | ✔ | Rubros que vende: fragancias, maquillaje, tratamiento, cuerpo, cabello | `["fragancias", "maquillaje"]` |
| `grupo` | string | — | Grupo empresario | `"LVMH"` |
| `activa` | bool | ✔ | Si se vende actualmente | `true` |

## categorias
Árbol del menú de la tienda (3 niveles). **26 documentos.**

| Campo | Tipo | Obl. | Descripción | Ejemplo |
|---|---|---|---|---|
| `_id` | string | ✔ | Identificador legible | `"labiales"` |
| `nombre` | string | ✔ | Nombre que se muestra | `"Labiales"` |
| `padre` | string / null | — | Categoría padre (`null` en las de primer nivel) | `"maquillaje-labios"` |
| `ruta` | array de string | ✔ | Ruta materializada: todos los ancestros | `["maquillaje", "maquillaje-labios"]` |
| `nivel` | int | ✔ | Profundidad en el árbol (1 a 3) | `3` |
| `orden` | int | — | Orden en el menú | `14` |

## depositos
Depósitos con stock y puntos de retiro. **9 documentos** (3 depósitos y 6 puntos de retiro).

| Campo | Tipo | Obl. | Descripción | Ejemplo |
|---|---|---|---|---|
| `_id` | string | ✔ | Código | `"DEP-MZA"`, `"PR-MZA-CENTRO"` |
| `nombre` | string | ✔ | Nombre | `"Depósito Cuyo"` |
| `tipo` | string (enum) | ✔ | `deposito` o `punto_retiro` | `"deposito"` |
| `direccion` | objeto | ✔ | Dirección | |
| `direccion.calle` | string | ✔ | Calle y número | `"Carril Rodríguez Peña 2500"` |
| `direccion.ciudad` | string | ✔ | Ciudad | `"Maipú"` |
| `direccion.provincia` | string | ✔ | Provincia | `"Mendoza"` |
| `ubicacion` | objeto GeoJSON | ✔ | Punto geográfico (índice 2dsphere) | |
| `ubicacion.type` | string | ✔ | Siempre `"Point"` | `"Point"` |
| `ubicacion.coordinates` | array de double | ✔ | [longitud, latitud] | `[-68.7925, -32.942]` |
| `provinciasQueAbastece` | array de string | — | Sólo depósitos: provincias que despacha | `["Mendoza", "San Juan"]` |
| `horario` | string | — | Horario de atención | `"Lun a Sáb 9 a 20 h"` |

## productos
Perfumes y cosméticos en una sola colección (patrón polimórfico). **50 documentos.**

| Campo | Tipo | Obl. | Descripción | Ejemplo |
|---|---|---|---|---|
| `_id` | objectId | ✔ | Identificador | `ObjectId("...")` |
| `nombre` | string | ✔ | Nombre del producto | `"Sauvage"` |
| `tipo` | string (enum) | ✔ | `fragancia`, `maquillaje`, `tratamiento`, `cuerpo`, `cabello`, `set` | `"fragancia"` |
| `genero` | string (enum) | — | `mujer`, `hombre`, `unisex` | `"hombre"` |
| `marca` | objeto | ✔ | Referencia extendida a `marcas` | |
| `marca._id` | string | ✔ | → `marcas._id` | `"dior"` |
| `marca.nombre` | string | ✔ | Copia del nombre (evita `$lookup`) | `"Dior"` |
| `categoria` | objeto | ✔ | Referencia a `categorias` | |
| `categoria._id` | string | ✔ | → `categorias._id` | `"fragancias-hombre"` |
| `categoria.ruta` | array de string | ✔ | Ruta completa (para filtrar por cualquier nivel) | `["fragancias", "fragancias-hombre"]` |
| `descripcion` | string | — | Texto de la ficha | |
| `etiquetas` | array de string | — | Palabras clave del buscador | `["fresco", "best seller"]` |
| `atributos` | objeto | — | **Distinto según el tipo** (ver tabla siguiente) | |
| `variantes` | array de objetos | ✔ | Presentaciones o tonos (mínimo 1) | |
| `variantes[].sku` | string | ✔ | Código único (índice único) | `"FR-1037"` |
| `variantes[].presentacion` | string | ✔ | Texto de la presentación | `"Eau de Toilette 100 ml"` |
| `variantes[].tono` | string | — | Sólo maquillaje | `"Ruby Woo"` |
| `variantes[].contenido.valor` | int / double | — | Cantidad | `100`, `2.5` |
| `variantes[].contenido.unidad` | string (enum) | — | `ml`, `g`, `u` | `"ml"` |
| `variantes[].precio` | int / double | ✔ | Precio de venta en ARS (≥ 0) | `205100` |
| `variantes[].precioLista` | int / double | — | Precio de lista | `205100` |
| `variantes[].stock` | array de objetos | ✔ | Stock por depósito | |
| `variantes[].stock[].deposito` | string | ✔ | → `depositos._id` | `"DEP-MZA"` |
| `variantes[].stock[].cantidad` | int | ✔ | Unidades disponibles (≥ 0) | `84` |
| `rating` | objeto | — | Resumen de reseñas (patrón computed) | |
| `rating.promedio` | double | — | Promedio de 0 a 5 | `4.07` |
| `rating.cantidad` | int | — | Cantidad de reseñas | `198` |
| `activo` | bool | ✔ | Si está a la venta | `true` |
| `fechaAlta` | date | — | Fecha de alta en el catálogo | `ISODate("2024-01-12")` |

**Campos de `atributos` según el tipo de producto**

| Tipo | Campo | Tipo | Ejemplo |
|---|---|---|---|
| fragancia | `atributos.concentracion` | string | `"Eau de Parfum"` |
| fragancia | `atributos.familiaOlfativa` | string | `"oriental vainilla"` |
| fragancia | `atributos.notas.salida` / `corazon` / `fondo` | array de string | `["vainilla", "pachulí"]` |
| fragancia | `atributos.perfumista` | string | `"Francis Kurkdjian"` |
| fragancia | `atributos.lanzamiento` | int | `2015` |
| maquillaje | `atributos.zona` | string | `"labios"` |
| maquillaje | `atributos.acabado` | string | `"mate"` |
| maquillaje | `atributos.cobertura` | string | `"alta"` |
| maquillaje | `atributos.duracionHoras` | int | `24` |
| maquillaje | `atributos.efecto` / `cantidadTonos` / `hidratante` / `aPruebaDeAgua` | string / int / bool / bool | |
| tratamiento | `atributos.tipoPiel` | array de string | `["grasa", "sensible"]` |
| tratamiento | `atributos.fps` | int | `50` |
| tratamiento, cabello | `atributos.beneficios` / `ingredientesClave` | array de string | `["ácido hialurónico"]` |
| cuerpo | `atributos.aroma` / `textura` | string | `"vainilla"` |
| cabello | `atributos.tipoCabello` | array de string | `["todo tipo"]` |
| set | `atributos.incluye` | array de string | `["Sauvage EDT 100 ml", "Gel de ducha 50 ml"]` |
| set | `atributos.edicionLimitada` / `temporada` | bool / string | `true` |

## clientes
Cuentas de la tienda. **2.000 documentos.**

| Campo | Tipo | Obl. | Descripción | Ejemplo |
|---|---|---|---|---|
| `_id` | objectId | ✔ | Identificador | |
| `nombre` | string | ✔ | Nombre | `"Camila"` |
| `apellido` | string | ✔ | Apellido | `"Rodríguez"` |
| `email` | string | ✔ | Email, con formato validado (índice único) | `"camila.rodriguez49@yahoo.com.ar"` |
| `dni` | string | — | 7 u 8 dígitos (índice único) | `"38123456"` |
| `telefono` | string | — | Teléfono | `"+54 9 261 5123456"` |
| `fechaNacimiento` | date | — | Fecha de nacimiento | `ISODate("1990-08-20")` |
| `genero` | string | — | `F` / `M` | `"F"` |
| `direcciones` | array de objetos | — | Hasta 5 direcciones de envío | |
| `direcciones[].alias` | string | — | `Casa`, `Trabajo` | `"Casa"` |
| `direcciones[].calle` | string | ✔ | Calle y número | `"San Martín 1450"` |
| `direcciones[].ciudad` | string | ✔ | Ciudad | `"Mendoza"` |
| `direcciones[].provincia` | string | ✔ | Provincia | `"Mendoza"` |
| `direcciones[].cp` | string | — | Código postal | `"5500"` |
| `direcciones[].principal` | bool | — | Dirección por defecto | `true` |
| `preferencias.familiasOlfativas` | array de string | — | Gustos del cliente | `["floral", "gourmand"]` |
| `preferencias.tipoPiel` | string | — | Tipo de piel | `"mixta"` |
| `preferencias.aceptaNewsletter` | bool | — | Acepta recibir mails | `true` |
| `favoritos` | array de objectId | — | Lista de deseos → `productos._id` (relación N a N) | `[ObjectId("..."), ...]` |
| `club.nivel` | string (enum) | — | `classic`, `gold`, `black` | `"gold"` |
| `club.puntos` | int | — | Puntos acumulados (1 cada $10.000) | `412` |
| `fechaRegistro` | date | ✔ | Alta de la cuenta | |

## pedidos
Compras de la web y la app. **20.000 documentos.**

| Campo | Tipo | Obl. | Descripción | Ejemplo |
|---|---|---|---|---|
| `_id` | objectId | ✔ | Identificador | |
| `numero` | int | ✔ | Número de pedido (índice único) | `100001` |
| `cliente` | objeto | ✔ | Referencia extendida a `clientes` | |
| `cliente._id` | objectId | ✔ | → `clientes._id` | |
| `cliente.nombre` | string | — | Copia del nombre | `"Lautaro Martínez"` |
| `cliente.email` | string | ✔ | Copia del email | |
| `cliente.provincia` | string | — | Provincia de entrega (para reportes) | `"Mendoza"` |
| `fecha` | date | ✔ | Fecha y hora de la compra | |
| `canal` | string (enum) | ✔ | `web` o `app` | `"web"` |
| `deposito` | string | — | Depósito que despacha → `depositos._id` | `"DEP-MZA"` |
| `items` | array de objetos | ✔ | Productos comprados (snapshot del momento) | |
| `items[].productoId` | objectId | ✔ | → `productos._id` | |
| `items[].sku` | string | ✔ | SKU de la variante | `"FR-1046"` |
| `items[].nombre` | string | ✔ | Nombre y presentación al momento de la compra | `"Acqua di Giò - Eau de Toilette 50 ml"` |
| `items[].marca` | string | — | Marca | `"Giorgio Armani"` |
| `items[].tipo` | string | — | Rubro | `"fragancia"` |
| `items[].categoria` | string | — | Categoría | `"fragancias-hombre"` |
| `items[].cantidad` | int | ✔ | Unidades (≥ 1) | `1` |
| `items[].precioUnitario` | int / double | ✔ | Precio pagado por unidad | `81300` |
| `subtotal` | int / double | — | Suma de los ítems | `81300` |
| `descuento` | int / double | — | Descuento por cupón | `8100` |
| `total` | int / double | ✔ | Subtotal − descuento + envío | `73200` |
| `promocion` | string | — | Cupón usado → `promociones.codigo` | `"BIENVENIDA10"` |
| `pago.medio` | string (enum) | — | `credito`, `debito`, `mercadopago`, `transferencia` | `"credito"` |
| `pago.cuotas` | int | — | De 1 a 12 | `6` |
| `envio.tipo` | string (enum) | ✔ | `domicilio` o `retiro` | `"domicilio"` |
| `envio.costo` | int / double | ✔ | Costo del envío (0 si es gratis) | `6500` |
| `envio.empresa` | string | — | Sólo domicilio | `"Andreani"` |
| `envio.tracking` | string | — | Código de seguimiento (índice único parcial) | `"AND0000100003"` |
| `envio.direccion` | objeto | — | Copia de la dirección (calle, ciudad, provincia, cp) | |
| `envio.puntoRetiro` | string | — | Sólo retiro → `depositos._id` | `"PR-MZA-CENTRO"` |
| `estado` | string (enum) | ✔ | `pendiente`, `pagado`, `preparando`, `enviado`, `entregado`, `cancelado` | `"entregado"` |
| `historialEstados` | array de objetos | — | Cada cambio de estado | |
| `historialEstados[].estado` | string | — | Estado | `"pagado"` |
| `historialEstados[].fecha` | date | — | Cuándo cambió | |

## reseñas
Opiniones de los clientes. **≈3.800 documentos.**

| Campo | Tipo | Obl. | Descripción | Ejemplo |
|---|---|---|---|---|
| `_id` | objectId | ✔ | Identificador | |
| `productoId` | objectId | ✔ | → `productos._id` | |
| `clienteId` | objectId | ✔ | → `clientes._id` (único por producto) | |
| `puntaje` | int | ✔ | De 1 a 5 | `5` |
| `titulo` | string | — | Máximo 100 caracteres | `"Excelente"` |
| `comentario` | string | — | Máximo 2.000 caracteres | `"Dura todo el día..."` |
| `compraVerificada` | bool | — | El cliente compró el producto | `true` |
| `fecha` | date | ✔ | Fecha de la reseña | |

## promociones
Cupones y promociones. **6 documentos.**

| Campo | Tipo | Obl. | Descripción | Ejemplo |
|---|---|---|---|---|
| `_id` | objectId | ✔ | Identificador | |
| `codigo` | string | ✔ | Código del cupón (índice único) | `"MADRE2026"` |
| `descripcion` | string | — | Texto | `"15% off en fragancias mujer y sets"` |
| `tipo` | string (enum) | ✔ | `porcentaje`, `monto_fijo`, `2x1`, `cuotas_sin_interes` | `"porcentaje"` |
| `valor` | int / double | ✔ | Porcentaje, monto o cantidad de cuotas | `15` |
| `vigencia.desde` | date | ✔ | Inicio | `ISODate("2026-10-01")` |
| `vigencia.hasta` | date | ✔ | Fin | `ISODate("2026-10-19")` |
| `aplicaA.categorias` | array de string | — | Categorías que participan | `["fragancias-mujer", "sets"]` |
| `aplicaA.marcas` | array de string | — | Marcas que participan | `["la-roche-posay"]` |
| `aplicaA.canales` | array de string | — | Canales donde vale | `["web", "app"]` |
| `medioPago` | string | — | Medio de pago requerido | `"credito"` |

## carritos
Carritos abiertos de la tienda. **300 documentos.** No tiene validador; los carritos se borran solos a los 30 días sin actividad (índice TTL).

| Campo | Tipo | Obl. | Descripción | Ejemplo |
|---|---|---|---|---|
| `_id` | objectId | — | Identificador | |
| `clienteId` | objectId | — | → `clientes._id` | |
| `canal` | string | — | `web` o `app` | `"app"` |
| `items[].productoId` | objectId | — | → `productos._id` | |
| `items[].sku` | string | — | SKU | `"FR-1038"` |
| `items[].nombre` | string | — | Nombre y presentación | `"Sauvage - Eau de Toilette 100 ml"` |
| `items[].cantidad` | int | — | Unidades | `1` |
| `items[].precio` | int / double | — | Precio al agregarlo | `205100` |
| `actualizado` | date | — | Última actividad (lo usa el TTL) | |

## eventos_web (serie temporal)
Vistas, carritos y búsquedas del sitio. **≈29.000 documentos** (se crea con el script 06). Configuración: `timeField: "fecha"`, `metaField: "meta"`, `granularity: "minutes"`, expira a los 180 días.

| Campo | Tipo | Obl. | Descripción | Ejemplo |
|---|---|---|---|---|
| `fecha` | date | ✔ | **timeField**: cuándo ocurrió | |
| `meta` | objeto | — | **metaField**: identifica la serie (agrupa los buckets) | |
| `meta.tipo` | string | — | `vista_producto`, `agregar_carrito`, `busqueda` | `"vista_producto"` |
| `meta.canal` | string | — | `web` o `app` | `"web"` |
| `meta.productoId` | objectId | — | → `productos._id` (no está en las búsquedas) | |
| `segundos` | int | — | Tiempo en la página | `42` |
| `termino` | string | — | Sólo búsquedas: lo que se buscó | `"vainilla"` |
| `provincia` | string | — | Desde dónde | `"Mendoza"` |

## pagina_inicio
Portada de la tienda: todo lo que ve el cliente apenas entra al sitio (se crea con el script 08). **14 documentos, uno por bloque.** Patrón polimórfico: todos los bloques comparten los primeros campos y el resto depende del `tipo`.

**Campos comunes a todos los bloques**

| Campo | Tipo | Obl. | Descripción | Ejemplo |
|---|---|---|---|---|
| `_id` | objectId | ✔ | Identificador | |
| `clave` | string | ✔ | Nombre único del bloque (índice único) | `"banner-principal"` |
| `tipo` | string (enum) | ✔ | `encabezado`, `banner_principal`, `campanas`, `promociones`, `productos_destacados`, `tendencias`, `marcas`, `seccion_categoria`, `info_envios`, `medios_pago`, `accesos` | `"tendencias"` |
| `titulo` | string | ✔ | Título que se muestra | `"Productos destacados"` |
| `orden` | int | ✔ | Posición en la página, de arriba hacia abajo | `4` |
| `activo` | bool | ✔ | Se muestra o se oculta sin borrarlo | `true` |
| `vigencia.desde` / `vigencia.hasta` | date | — | Período en que se muestra el bloque | |
| `canales` | array de string | — | `web`, `app` | `["web", "app"]` |
| `actualizado` | date | — | Última actualización | |

**Campos según el tipo de bloque**

| Tipo | Campos | Qué muestra |
|---|---|---|
| `encabezado` | `logo` {texto, imagen, alt, enlace}, `barraAnuncios[]`, `buscador` {placeholder, sugerencias[]}, `menu[]` {texto, categoria, resaltado}, `iconos[]` {tipo: cuenta / favoritos / carrito, texto, enlace} | Logo, barra superior, buscador, menú de navegación, cuenta, favoritos y carrito |
| `banner_principal` | `rotacionSegundos` (int), `slides[]` {titulo, subtitulo, textoBoton, enlace, imagen, colores[], promocion, vigencia} | Carrusel de imágenes grandes. Cada imagen tiene su propia vigencia |
| `campanas` | `items[]` {marca, titulo, imagen, enlace} | Campañas de marcas y lanzamientos |
| `promociones` | `items[]` {codigo → `promociones.codigo`, destacado, texto} | Promociones y descuentos, con la vigencia tomada de `promociones` |
| `productos_destacados` | `criterio`, `productos[]` {productoId → `productos._id`, nombre, marca, precioDesde, etiqueta} | Selección manual del equipo comercial |
| `tendencias` | `criterio`, `periodoDias` (int), `productos[]` {productoId, nombre, marca, precioDesde, ventas, vistas, puntaje} | **Calculado**: ventas × 3 + vistas de los últimos 30 días |
| `marcas` | `marcas[]` {marcaId → `marcas._id`, nombre, logo} | Marcas que vende la tienda |
| `seccion_categoria` | `categoria` → `categorias._id`, `bajada`, `subcategorias[]` {categoria, nombre}, `cantidad` (int), `productos[]` | Secciones de fragancias, maquillaje, cuidado de la piel y cabello. **Productos calculados**: los mejor puntuados |
| `info_envios` | `items[]` {icono, titulo, texto}, `envioGratisDesde` (int), `costoEnvio` (int) | Condiciones de envío y retiro |
| `medios_pago` | `medios[]` {medio, nombre, detalle, cuotasSinInteres}, `beneficios[]` | Formas de pago y cuotas |
| `accesos` | `grupos[]` {titulo, enlaces[] {texto, enlace}} | Enlaces del pie de página |

---

## Vistas (no guardan datos)

| Vista | Sobre | Campos que devuelve |
|---|---|---|
| `v_catalogo_publico` | productos | `nombre`, `tipo`, `genero`, `marca`, `categoria`, `descripcion`, `atributos`, `rating`, `variantes[]` (`sku`, `presentacion`, `tono`, `precio`, `disponible`) |
| `v_ventas_diarias` | pedidos | `dia`, `canal`, `deposito`, `pedidos`, `facturacion`, `descuentos` |
| `v_stock_por_deposito` | productos | `deposito`, `sku`, `producto`, `marca`, `presentacion`, `cantidad` |

## Relaciones entre colecciones

| Campo | Apunta a | Cardinalidad |
|---|---|---|
| `productos.marca._id` | `marcas._id` | N a 1 |
| `productos.categoria._id` | `categorias._id` | N a 1 |
| `categorias.padre` | `categorias._id` | árbol (N a 1) |
| `productos.variantes[].stock[].deposito` | `depositos._id` | N a 1 |
| `pedidos.cliente._id` | `clientes._id` | N a 1 (un cliente, muchos pedidos) |
| `pedidos.items[].productoId` | `productos._id` | N a N (a través de los ítems) |
| `pedidos.deposito` / `envio.puntoRetiro` | `depositos._id` | N a 1 |
| `pedidos.promocion` | `promociones.codigo` | N a 1 |
| `clientes.favoritos[]` | `productos._id` | N a N |
| `reseñas.productoId` / `reseñas.clienteId` | `productos._id` / `clientes._id` | N a 1 |
| `carritos.clienteId` | `clientes._id` | N a 1 |
| `eventos_web.meta.productoId` | `productos._id` | N a 1 |
| `pagina_inicio.productos[].productoId` | `productos._id` | N a N |
| `pagina_inicio.items[].codigo` (promociones) | `promociones.codigo` | N a N |
| `pagina_inicio.categoria` | `categorias._id` | N a 1 |
