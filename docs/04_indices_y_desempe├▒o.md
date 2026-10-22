# 4. Índices y medición de desempeño

## Índices definidos (script 02)

| Colección | Índice | Tipo | Consulta que lo usa |
|-----------|--------|------|---------------------|
| productos | `ux_sku` `{variantes.sku}` | único, multikey | agregar al carrito o comprar por SKU (C25, C29) |
| productos | `ix_tipo_genero_precio` | compuesto | C1, C2 |
| productos | `ix_categoria_ruta` | multikey | C3 (menú del sitio) |
| productos | `ix_marca` | simple | filtro por marca, C26 |
| productos | `tx_buscador` | texto (español, con pesos) | C4 (buscador del sitio) |
| productos | `ix_rating_activos` | **parcial** (`activo: true`) | C8 |
| clientes | `ux_email`, `ux_dni` | únicos | login y registro, P6 |
| clientes | `ix_provincia_nivel` | compuesto, multikey | segmentación |
| clientes | `ix_favoritos` | multikey | C21 (lista de deseos) |
| pedidos | `ux_numero` | único | P2 |
| pedidos | `ix_cliente_fecha` | compuesto (resuelve el sort) | C5 "Mis pedidos", P1 |
| pedidos | `ix_fecha_estado` | compuesto | C6, C7, C9, C23, P7 |
| pedidos | `ix_estado_deposito_fecha` | compuesto **ESR** | C11 cola de despacho, P3, P4 |
| pedidos | `ix_items_producto` | multikey | C12 recomendaciones, C21, P5 |
| pedidos | `ux_tracking` | único **parcial** (sólo pedidos con tracking) | C24 seguimiento del envío |
| reseñas | `ix_producto_fecha`, `ux_cliente_producto` | compuesto / único | reseñas de un producto, una reseña por cliente |
| depositos | `geo_ubicacion` | **2dsphere** | C13 punto de retiro más cercano |
| promociones | `ux_codigo`, `ix_vigencia` | único / compuesto | validar el cupón, C19 |
| carritos | `ttl_carritos_30d` | **TTL** (30 días) | borrado automático de carritos abandonados |

## Metodología

El script `04_desempeño_indices.js` ejecuta cada consulta con `explain("executionStats")` en dos casos:

- **Sin índice**: se fuerza un recorrido completo con `hint({ $natural: 1 })`.
- **Con índice**: el optimizador elige el plan.

Cada medición se repite 5 veces y se toma el menor tiempo. Se informan el plan ganador, los documentos y claves examinados, los documentos devueltos y los milisegundos.

## Resultados (MongoDB 8.0, 200.000 pedidos)

| Consulta | Plan con índice | Docs examinados sin → con | Tiempo sin → con |
|----------|-----------------|---------------------------|------------------|
| P1 "Mis pedidos": últimos 10 de un cliente | `LIMIT ← FETCH ← IXSCAN(ix_cliente_fecha)` | 200.000 → 10 | 121 ms → 0 ms |
| P2 Pedido por número | `EXPRESS_IXSCAN(ux_numero)` | 200.000 → 1 | 113 ms → 0 ms |
| P3 Entregados en septiembre | `FETCH ← IXSCAN` | 200.000 → 7.627 | 154 ms → 23 ms |
| P4 Cola de despacho del Depósito Cuyo | `FETCH ← SORT_MERGE ← IXSCAN(ix_estado_deposito_fecha)` | 200.000 → 1.853 | 151 ms → 6 ms |
| P5 Pedidos que incluyen un producto | `FETCH ← IXSCAN(ix_items_producto)` | 200.000 → 5.527 | 178 ms → 11 ms |
| P6 Login por email (**consulta cubierta**) | `PROJECTION_COVERED ← IXSCAN(ux_email)` | 2.000 → **0** | 1 ms → 0 ms |
| P7 Agregación: facturación por canal | `GROUP ← FETCH ← IXSCAN(ix_fecha_estado)` | 200.000 → 7.627 | 168 ms → 62 ms |

### Experimento ESR (Equality, Sort, Range)

Se usó la misma consulta P4 (`estado ∈ {pagado, preparando}`, `deposito = DEP-MZA`, orden por `fecha`) con dos índices:

| Índice | Claves examinadas | Docs examinados | Tiempo |
|--------|------------------:|----------------:|-------:|
| `{fecha, estado}` (mal ordenado) | 200.000 | 200.000 | 724 ms |
| `{estado, deposito, fecha}` (ESR) | 1.853 | 1.853 | 6 ms |

Con los campos de igualdad primero y el de orden después, MongoDB recorre únicamente las entradas que cumplen el filtro y las devuelve ya ordenadas. El índice mal ordenado obliga a recorrerlo entero y resulta incluso más lento que no tener índice.

### `$text` contra `$regex` (buscador del sitio)

El índice de texto examina sólo los 13 documentos que coinciden con "vainilla". Un `$regex` sin anclar no puede usar un índice B-tree y recorre toda la colección. Además, `$text` ordena los resultados por relevancia (`textScore`) y aplica *stemming* en español.

## Portada: ¿14 documentos o uno solo? (`pagina_inicio`)

Se evaluó si convenía guardar la portada en **14 documentos** (uno por bloque) o en **un solo documento** con los 14 bloques adentro. En los dos casos, para mostrar la página también hay que buscar los productos con su precio y stock al día.

**Prueba de carga** (`frontend/prueba_carga.js`): 3.000 visitas a la portada con 1, 10, 50 y 100 clientes simultáneos. "Espera p95" es lo máximo que espera el 95 % de los clientes.

| Simultáneos | A) 14 documentos | B) 1 documento |
|---:|---|---|
| 1 | 408 portadas/s · p95 3,2 ms | 474 portadas/s · p95 2,7 ms |
| 10 | 1.076 portadas/s · p95 16,5 ms | 1.270 portadas/s · p95 13,3 ms |
| 50 | 1.043 portadas/s · p95 67,7 ms | 1.049 portadas/s · p95 75,6 ms |
| 100 | 886 portadas/s · p95 148,8 ms | 924 portadas/s · p95 137,7 ms |

**Carga masiva (escritura) de la portada completa**, promedio de 300 cargas: `insertMany` de 14 documentos 2,3 ms; `insertOne` de 1 documento 1,7 ms.

**100 clientes entrando mientras se actualiza un bloque cada 20 ms**: A 831 portadas/s (p95 149 ms); B 925 portadas/s (p95 141 ms). Las actualizaciones no frenan a los clientes en ninguno de los dos diseños.

**Decisión: se mantienen los 14 documentos.**

- La diferencia de velocidad es chica: con 100 clientes a la vez, el documento único atiende apenas un 4 % más de portadas por segundo, y la espera del 95 % de los clientes baja de 149 a 138 ms. Lo que más tarda en los dos casos es buscar los productos, no leer los bloques.
- Los 14 documentos permiten activar, ocultar, reordenar o programar por fechas **un bloque sin tocar los demás**.
- Con un solo documento, si dos personas editan la portada al mismo tiempo se pueden pisar los cambios, y cada modificación reescribe la portada entera.
- La portada se arma en una agregación (bloques vigentes + `$lookup` a productos) en unos 3,8 ms, muy por debajo de lo que un cliente puede percibir.

Las pruebas se hicieron con el cliente y el servidor en la misma máquina (4 núcleos). En otra computadora los números absolutos cambian, pero la relación entre los diseños se mantiene.

## Conclusiones

- Las consultas sobre `pedidos`, la colección que más crece en un e-commerce, pasan de examinar el 100% de los documentos a examinar sólo los que devuelven.
- Con un orden de campos correcto, el índice compuesto evita además la etapa `SORT` en memoria.
- La consulta cubierta del login (P6) responde sin leer ningún documento.
- Los índices tienen un costo de escritura y de espacio. Por eso sólo se crearon los que usa alguna consulta concreta. `$indexStats` permite detectar índices que no se usan.
