# 3. Política de resguardo (backup) y recuperación

## Objetivos

| Indicador | Valor | Significado |
|-----------|-------|-------------|
| **RPO** (pérdida máxima aceptable) | 24 h con el dump diario. Con oplog y replica set, el instante exacto del fin del dump | Pedidos online que se podrían perder ante una falla total |
| **RTO** (tiempo máximo de recuperación) | < 30 minutos | Tiempo que la tienda puede estar sin vender. Con 20.000 pedidos el archivo pesa ~3 MB y se restaura en segundos |

## Estrategia

1. **Resguardo lógico completo diario** con `mongodump --gzip --archive` a las 03:15, la hora de menor tráfico en el sitio (`backup/backup.sh` + `backup/crontab.txt`).
2. **Consistencia**: si el servidor es un replica set, el dump se hace con `--oplog`. Así el resguardo corresponde a un único instante aunque entren compras online mientras se ejecuta (la tienda no cierra). Para restaurar se usa `--oplogReplay`.
3. **Retención escalonada (abuelo-padre-hijo)**:
   - diarios: se conservan **7**;
   - semanales (domingos): se conservan **4**;
   - mensuales (día 1): se conservan **12**.
4. **Integridad**: junto a cada archivo se guarda un `sha256`, que se controla antes de restaurar.
5. **Regla 3-2-1**: 3 copias, en 2 medios distintos y 1 fuera del servidor (`rclone` a Google Drive o S3; está la línea preparada en `backup.sh`).
6. **Prueba de restauración semanal** (lunes 05:00): el último resguardo se restaura en la base `mparfum_restore` sin tocar producción. Después `verificar_restore.js` compara, colección por colección, la cantidad de documentos, los índices y los validadores.
7. **Exportación legible del catálogo** (`mongoexport` a JSON) todos los domingos, para intercambio y auditoría.
8. **Usuario dedicado** `backup` con los roles predefinidos `backup`, `restore` y `clusterMonitor` (script 05). Los scripts no usan el usuario administrador.

## Archivos

| Archivo | Uso |
|---------|-----|
| `backup/backup.sh` | Resguardo, rotación y checksum (Linux/macOS) |
| `backup/backup_windows.bat` | Resguardo con retención de 7 días (Windows, Programador de tareas) |
| `backup/restore.sh` | Restauración en una base de prueba o en producción, con verificación |
| `backup/verificar_restore.js` | Compara la base restaurada con la original |
| `backup/crontab.txt` | Programación de resguardo, prueba de restauración y exportación |
| `backup/backup_mongosh.js` / `backup/restaurar_mongosh.js` | Backup y restauración hechos desde mongosh |
| `backup/backup_powershell.ps1` | Backup y restauración de prueba en Windows, midiendo tiempos y tamaño |
| `backup/verificar_compass.js` | Verificación de la copia, para pegar en la consola de Compass |
| `backup/copia_compass.js` | Copia de la base dentro del servidor, desde la consola de Compass |

## Procedimientos

```bash
# Resguardo manual
./backup/backup.sh "mongodb://localhost:27017" ./backup/resguardos

# Verificar un resguardo sin tocar producción
./backup/restore.sh ./backup/resguardos/diario/mparfum_2026-10-20_0315_oplog.archive.gz \
                    "mongodb://localhost:27017" mparfum_restore

# Recuperación ante desastre (reemplaza la base productiva)
./backup/restore.sh ./backup/resguardos/diario/mparfum_2026-10-20_0315_oplog.archive.gz \
                    "mongodb://localhost:27017" mparfum
```

## Prueba realizada

1. Se resguardó la base (replica set `rs0`, archivo de 3,1 MB con oplog).
2. Se restauró en `mparfum_restore`. La verificación dio **OK** en las 9 colecciones y en las vistas (documentos, índices y validadores iguales).
3. Se simuló una pérdida de datos borrando los 5.490 pedidos hechos desde la app: quedaron 14.510 de 20.000.
4. Se restauró sobre `mparfum` con `--oplogReplay`: se recuperaron los **20.000** pedidos.

## Backup y restauración desde mongosh

Además de `mongodump`, el proyecto incluye un backup hecho **enteramente desde mongosh** con los módulos `fs` y `zlib` de Node.js:

| Archivo | Uso |
|---------|-----|
| `backup/backup_mongosh.js` | Guarda cada colección en EJSON canónico comprimido (conserva int, double, Date y ObjectId), con su validador, sus índices y la definición de las vistas y de la serie temporal |
| `backup/restaurar_mongosh.js` | Recrea las colecciones con sus opciones e índices y carga los documentos, en `mparfum` o en otra base |

```
load("backup/backup_mongosh.js")
var DESTINO = "mparfum_restore"; load("backup/restaurar_mongosh.js")
load("backup/verificar_restore.js")
```
Prueba realizada: el backup ocupó 3,4 MB. La verificación dio OK en las 10 colecciones (incluida la serie temporal) y, tras borrar los pedidos de la app, la restauración recuperó todos.

**Copia rápida a otra base con `$out`**: duplica los datos en `mparfum_copia`, pero no copia índices ni validadores. Sirve para un resguardo puntual antes de una operación riesgosa, no como política de backup.

## Mediciones en Windows (completar con los valores obtenidos)

Con `backup/backup_powershell.ps1`:

| Medición | Valor |
|----------|-------|
| Tiempo de backup (`mongodump`) | ____ s |
| Tamaño del archivo | ____ MB |
| Tiempo de restauración (`mongorestore`) = **RTO** medido | ____ s |
| Verificación (`verificar_compass.js`) | RESTAURACION OK / con diferencias |

Con un backup diario, el **RPO** es de hasta 24 horas: es lo máximo que se puede perder si la falla ocurre justo antes del próximo backup.

## Por qué mongodump y no "Exportar" de Compass

`mongodump` guarda los datos en **BSON**, con sus tipos exactos (Date, ObjectId, int y double), además de los índices, los validadores, las vistas y la definición de la serie temporal. El "Export Collection" de Compass genera JSON o CSV sólo con los datos: en CSV se pierden los tipos, y en ningún caso se guardan índices ni validadores. Sirve para compartir datos, no para recuperar la base.

## Protección de datos personales (Ley 25.326)

La base guarda datos personales de los clientes: nombre, DNI, email, teléfono, fecha de nacimiento y direcciones. Por la **Ley 25.326 de Protección de Datos Personales**, los resguardos también tienen que protegerse:

- **Acceso restringido**: la carpeta de backups sólo la puede leer el usuario `backup` y el administrador. El usuario `backup` de MongoDB tiene sólo los roles `backup` y `restore` (script 05).
- **Cifrado**: la copia que sale del servidor (regla 3-2-1) se cifra antes de enviarse, por ejemplo con `rclone crypt` o con un ZIP con AES-256.
- **Fuera de la misma máquina**: un backup en el mismo disco no protege ante la rotura del disco.
- **Retención limitada**: los backups viejos se borran según la política (7 / 4 / 12), para no guardar datos personales más tiempo del necesario.
- **Minimización en las vistas**: el analista trabaja con `v_ventas_diarias`, que no expone datos personales.

## Alternativas a futuro

- **Snapshots del sistema de archivos** (LVM o snapshots del disco en la nube) para bases grandes, donde `mongodump` resulta lento.
- **Miembro *delayed*** del replica set (por ejemplo, con 1 hora de atraso) para recuperarse de errores humanos como un `deleteMany` sin filtro.
- **MongoDB Atlas**: backups continuos con restauración a un punto en el tiempo.
