// =====================================================================
// MPARFUM - Verificación de un resguardo restaurado
// Compara colección por colección la base original con la restaurada:
// cantidad de documentos, índices y validadores.
// Uso: mongosh --eval "var DESTINO='mparfum_restore'" backup/verificar_restore.js
// =====================================================================

const origen = db.getSiblingDB("mparfum");
const copia = db.getSiblingDB(typeof DESTINO !== "undefined" ? DESTINO : "mparfum_restore");
let ok = true;

print(`Verificando ${copia.getName()} contra ${origen.getName()}`);
print("Colección     Docs origen  Docs copia  Índices  Validador");
// Sólo colecciones (las vistas no tienen índices ni datos propios)
for (const c of origen.getCollectionInfos({ type: "collection" }).map((i) => i.name).filter((n) => !n.startsWith("system.")).sort()) {
  const dOri = origen[c].countDocuments(), dCop = copia[c].countDocuments();
  const iOri = origen[c].getIndexes().length, iCop = copia[c].getIndexes().length;
  const vOri = JSON.stringify((origen.getCollectionInfos({ name: c })[0].options || {}).validator || {});
  const infoCop = copia.getCollectionInfos({ name: c })[0];
  const vCop = JSON.stringify(((infoCop && infoCop.options) || {}).validator || {});
  const fila = dOri === dCop && iOri === iCop && vOri === vCop;
  ok = ok && fila;
  print(`${c.padEnd(13)} ${String(dOri).padStart(11)} ${String(dCop).padStart(11)}  ${iOri}/${iCop}`.padEnd(50) + `${vOri === vCop ? "igual" : "DISTINTO"}  ${fila ? "OK" : "<-- REVISAR"}`);
}
print(ok ? "\nRESGUARDO VERIFICADO: la copia coincide con la base original." : "\nATENCIÓN: hay diferencias (puede ser normal si hubo escrituras después del resguardo).");
