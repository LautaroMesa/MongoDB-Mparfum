// =====================================================================
// MPARFUM - Backup hecho completamente desde mongosh (sin mongodump)
//
// Dentro de mongosh:
//   load("C:/ruta/al/proyecto/backup/backup_mongosh.js")
// Opcional, antes del load:
//   var CARPETA_BACKUPS = "C:/resguardos"   (por defecto: ./resguardos)
//
// Por cada colección guarda, en una carpeta con la fecha:
//   - los documentos en EJSON canónico comprimido con gzip
//     (conserva los tipos: int, double, Date, ObjectId)
//   - las opciones de la colección (validador $jsonSchema, serie temporal)
//   - los índices (únicos, parciales, TTL, texto, 2dsphere)
// También guarda la definición de las vistas.
// =====================================================================
(() => {
  const fs = require("fs");
  const path = require("path");
  const zlib = require("zlib");
  const base = db.getSiblingDB("mparfum");
  const raiz = typeof CARPETA_BACKUPS !== "undefined" ? CARPETA_BACKUPS : path.join(process.cwd(), "resguardos");
  const ahora = new Date();
  const sello = ahora.toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  const carpeta = path.join(raiz, `mparfum_${sello}`);
  fs.mkdirSync(carpeta, { recursive: true });

  const manifiesto = { base: "mparfum", fecha: ahora, servidor: db.version(), colecciones: [], vistas: [] };
  const infos = base.getCollectionInfos().filter((c) => !c.name.startsWith("system."));
  print(`Backup de mparfum en ${carpeta}\n`);

  for (const info of infos) {
    if (info.type === "view") {
      manifiesto.vistas.push({ nombre: info.name, viewOn: info.options.viewOn, pipeline: info.options.pipeline });
      print(`  vista      ${info.name}`);
      continue;
    }
    const col = base.getCollection(info.name);
    // Documentos: una línea EJSON por documento
    const lineas = [];
    col.find().forEach((d) => lineas.push(EJSON.stringify(d, { relaxed: false })));
    fs.writeFileSync(path.join(carpeta, `${info.name}.ejson.gz`), zlib.gzipSync(lineas.join("\n")));
    // Índices (el _id_ se crea solo)
    const indices = col.getIndexes().filter((i) => i.name !== "_id_");
    // Opciones de la colección (validador, timeseries, expireAfterSeconds)
    const { uuid, ...opciones } = info.options || {};
    manifiesto.colecciones.push({ nombre: info.name, tipo: info.type, documentos: lineas.length, opciones, indices });
    print(`  ${info.type.padEnd(10)} ${info.name.padEnd(14)} ${String(lineas.length).padStart(6)} docs  ${indices.length} índices`);
  }

  fs.writeFileSync(path.join(carpeta, "manifiesto.ejson"), EJSON.stringify(manifiesto, { relaxed: false }, 2), "utf8");
  const total = manifiesto.colecciones.reduce((s, c) => s + c.documentos, 0);
  print(`\nBackup terminado: ${manifiesto.colecciones.length} colecciones, ${manifiesto.vistas.length} vistas, ${total} documentos.`);
  const bytes = fs.readdirSync(carpeta).reduce((s, f) => s + fs.statSync(path.join(carpeta, f)).size, 0);
  print(`Carpeta: ${carpeta} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  globalThis.ULTIMO_BACKUP = carpeta;
})();
