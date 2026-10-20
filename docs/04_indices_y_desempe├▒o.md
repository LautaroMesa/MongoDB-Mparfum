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

## Conclusiones

- Las consultas sobre `pedidos`, la colección que más crece en un e-commerce, pasan de examinar el 100% de los documentos a examinar sólo los que devuelven.
- Con un orden de campos correcto, el índice compuesto evita además la etapa `SORT` en memoria.
- La consulta cubierta del login (P6) responde sin leer ningún documento.
- Los índices tienen un costo de escritura y de espacio. Por eso sólo se crearon los que usa alguna consulta concreta. `$indexStats` permite detectar índices que no se usan.
