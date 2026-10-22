// =====================================================================
// MPARFUM - Backup y restauración para la consola mongosh de Compass
// (esa consola no permite load() ni escribir archivos).
//
// 1) Pegar esta función completa en la consola de Compass y Enter.
// 2) Backup:      copiarBase("mparfum", "mparfum_backup")
// 3) Restaurar:   copiarBase("mparfum_backup", "mparfum")
//
// Copia datos, índices, validadores, la serie temporal y las vistas.
// La copia queda en el mismo servidor: protege ante errores (un
// deleteMany equivocado), no ante la rotura del disco; para eso está
// backup_mongosh.js o mongodump, que generan archivos.
// =====================================================================
function copiarBase(origen, destino) {
  const o = db.getSiblingDB(origen), d = db.getSiblingDB(destino);
  d.dropDatabase();
  const infos = o.getCollectionInfos().filter(c => !c.name.startsWith("system."));
  for (const c of infos.filter(c => c.type !== "view")) {
    const { uuid, ...opciones } = c.options || {};
    d.createCollection(c.name, opciones);
    const docs = o.getCollection(c.name).find().toArray();
    if (docs.length) d.getCollection(c.name).insertMany(docs, { ordered: false, bypassDocumentValidation: true });
    for (const ix of o.getCollection(c.name).getIndexes()) {
      if (ix.name === "_id_") continue;
      const { v, key, ns, ...op } = ix;
      const clave = key._fts ? Object.fromEntries(Object.keys(ix.weights).map(k => [k, "text"])) : key;
      try { d.getCollection(c.name).createIndex(clave, op); } catch (e) {}
    }
    print(c.name + ": " + docs.length + " documentos");
  }
  for (const v of infos.filter(c => c.type === "view")) { d.createView(v.name, v.options.viewOn, v.options.pipeline); print("vista " + v.name); }
  return "Listo: " + origen + " copiada en " + destino;
}
