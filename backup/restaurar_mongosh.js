// =====================================================================
// MPARFUM - Restauración hecha completamente desde mongosh
//
// Dentro de mongosh:
//   var CARPETA = "C:/resguardos/mparfum_2026-10-21_1530"   (carpeta del backup)
//   var DESTINO = "mparfum_restore"   (opcional; por defecto "mparfum")
//   load("C:/ruta/al/proyecto/backup/restaurar_mongosh.js")
//
// Si no se define CARPETA, usa el último backup hecho en esta sesión.
// Con DESTINO = "mparfum" REEMPLAZA la base: borra cada colección y la
// vuelve a crear con su validador, sus índices y sus documentos.
// =====================================================================
(() => {
  const fs = require("fs");
  const path = require("path");
  const zlib = require("zlib");
  const carpeta = typeof CARPETA !== "undefined" ? CARPETA : globalThis.ULTIMO_BACKUP;
  if (!carpeta || !fs.existsSync(path.join(carpeta, "manifiesto.ejson"))) {
    print("No encuentro el backup. Definí la carpeta con: var CARPETA = \"C:/resguardos/mparfum_...\"");
    return;
  }
  const destino = typeof DESTINO !== "undefined" ? DESTINO : "mparfum";
  const base = db.getSiblingDB(destino);
  const m = EJSON.parse(fs.readFileSync(path.join(carpeta, "manifiesto.ejson"), "utf8"));
  print(`Restaurando el backup del ${m.fecha.toISOString()} en la base "${destino}"\n`);

  // Primero se borran las vistas (dependen de las colecciones)
  for (const v of m.vistas) base.getCollection(v.nombre).drop();

  for (const c of m.colecciones) {
    base.getCollection(c.nombre).drop();
    base.createCollection(c.nombre, c.opciones);
    const col = base.getCollection(c.nombre);
    // Documentos en lotes de 5.000
    const texto = zlib.gunzipSync(fs.readFileSync(path.join(carpeta, `${c.nombre}.ejson.gz`))).toString("utf8");
    const lineas = texto ? texto.split("\n") : [];
    for (let i = 0; i < lineas.length; i += 5000) {
      const lote = lineas.slice(i, i + 5000).map((l) => EJSON.parse(l, { relaxed: false }));
      col.insertMany(lote, { ordered: false, bypassDocumentValidation: true });
    }
    // Índices: el de texto se reconstruye a partir de sus pesos
    let creados = 0;
    for (const ix of c.indices) {
      const { v, key, ns, ...opts } = ix;
      const clave = key._fts ? Object.fromEntries(Object.keys(ix.weights).map((k) => [k, "text"])) : key;
      try { col.createIndex(clave, opts); creados++; } catch (e) { if (!/already exists/i.test(e.message)) print(`   ! índice ${ix.name}: ${e.message}`); else creados++; }
    }
    print(`  ${c.nombre.padEnd(14)} ${String(col.countDocuments()).padStart(6)} docs  ${creados} índices`);
  }
  for (const v of m.vistas) {
    base.createView(v.nombre, v.viewOn, v.pipeline);
    print(`  vista ${v.nombre}`);
  }
  print(`\nRestauración terminada en "${destino}".`);
})();
