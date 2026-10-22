// =====================================================================
// MPARFUM - Prueba de carga de la página de inicio
// Uso (dentro de la carpeta frontend, después de npm install):
//   node prueba_carga.js
//   node prueba_carga.js 5000        (cantidad de visitas por escenario)
//
// Simula muchos clientes entrando a la portada AL MISMO TIEMPO y compara
// dos diseños de la colección de la portada:
//   A) 14 documentos, uno por bloque (pagina_inicio, el que usa el proyecto)
//   B) 1 documento con los 14 bloques adentro (copia temporal)
// En los dos casos se buscan los productos con su precio y stock al día.
// Mide cuánto espera cada visitante (mediana, p95, p99) y cuántas
// portadas por segundo puede servir la base.
// Requiere haber corrido scripts/08_pagina_inicio.js. No modifica datos:
// la colección temporal del diseño B se borra al terminar.
// =====================================================================
const { MongoClient } = require("mongodb");

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const VISITAS = Number(process.argv[2]) || 3000;
const SIMULTANEOS = [1, 10, 50, 100];

const TARJETA = {
  nombre: 1, tipo: 1, genero: 1, marca: 1, categoria: 1, rating: 1, etiquetas: 1,
  "atributos.familiaOlfativa": 1, "atributos.concentracion": 1,
  precioDesde: { $min: "$variantes.precio" }, presentaciones: { $size: "$variantes" },
  disponible: { $gt: [{ $sum: { $map: { input: "$variantes", in: { $sum: "$$this.stock.cantidad" } } } }, 0] }
};

(async () => {
  const cliente = new MongoClient(URI, { maxPoolSize: 120 });
  await cliente.connect();
  const db = cliente.db("mparfum");
  if (!(await db.collection("pagina_inicio").estimatedDocumentCount())) {
    console.log("Falta la portada: ejecutá primero  mongosh scripts/08_pagina_inicio.js");
    process.exit(1);
  }

  // Diseño B: copia temporal con los 14 bloques en un solo documento
  await db.collection("prueba_portada_unica").drop().catch(() => {});
  const bloques = await db.collection("pagina_inicio").find({}, { projection: { _id: 0 } }).sort({ orden: 1 }).toArray();
  await db.collection("prueba_portada_unica").insertOne({ _id: "portada", bloques });

  const vigente = () => {
    const ahora = new Date();
    return { activo: true, $and: [
      { $or: [{ "vigencia.desde": { $exists: false } }, { "vigencia.desde": { $lte: ahora } }] },
      { $or: [{ "vigencia.hasta": { $exists: false } }, { "vigencia.hasta": { $gte: ahora } }] }] };
  };
  const productosDe = (bls) => {
    const ids = bls.flatMap((b) => (b.productos || []).map((p) => p.productoId));
    return db.collection("productos").aggregate([{ $match: { _id: { $in: ids } } }, { $project: TARJETA }]).toArray();
  };

  // Lo que hace la página para cada visitante, según el diseño
  const disenos = {
    "A) 14 documentos + productos aparte": async () => {
      const bl = await db.collection("pagina_inicio").find(vigente()).sort({ orden: 1 }).toArray();
      return productosDe(bl);
    },
    "B) 1 documento + productos aparte": async () => {
      const d = await db.collection("prueba_portada_unica").findOne({ _id: "portada" });
      return productosDe(d.bloques.filter((b) => b.activo));
    }
  };

  // N visitantes simultáneos repartiéndose VISITAS pedidos de portada
  async function carga(fn, simultaneos) {
    const tiempos = [];
    let pendientes = VISITAS;
    const visitante = async () => {
      while (pendientes-- > 0) {
        const t = process.hrtime.bigint();
        await fn();
        tiempos.push(Number(process.hrtime.bigint() - t) / 1e6);
      }
    };
    const inicio = process.hrtime.bigint();
    await Promise.all(Array.from({ length: simultaneos }, visitante));
    const totalMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    tiempos.sort((a, b) => a - b);
    const p = (q) => tiempos[Math.min(tiempos.length - 1, Math.floor(tiempos.length * q))];
    return { porSeg: Math.round(VISITAS / (totalMs / 1000)), p50: p(0.5), p95: p(0.95), p99: p(0.99), max: tiempos[tiempos.length - 1] };
  }

  console.log(`\nPrueba de carga de la portada: ${VISITAS} visitas por escenario\n`);
  const resultados = {};
  for (const [nombre, fn] of Object.entries(disenos)) {
    for (let i = 0; i < 300; i++) await fn(); // calentamiento
    resultados[nombre] = {};
    console.log(nombre);
    console.log("  Simultáneos | Portadas/seg | Espera mediana | p95       | p99       | peor caso");
    for (const n of SIMULTANEOS) {
      const r = await carga(fn, n);
      resultados[nombre][n] = r;
      console.log(`  ${String(n).padStart(11)} | ${String(r.porSeg).padStart(12)} | ${r.p50.toFixed(2).padStart(11)} ms | ${r.p95.toFixed(2).padStart(6)} ms | ${r.p99.toFixed(2).padStart(6)} ms | ${r.max.toFixed(1).padStart(6)} ms`);
    }
    console.log("");
  }

  const [A, B] = Object.values(resultados).map((r) => r[100]);
  console.log("Con 100 clientes entrando a la vez:");
  console.log(`  B atiende ${(B.porSeg / A.porSeg).toFixed(2)} veces las portadas por segundo de A.`);
  console.log(`  El 95 % de los clientes espera como máximo: A ${A.p95.toFixed(1)} ms | B ${B.p95.toFixed(1)} ms`);

  // -------------------------------------------------------------------
  // 2) CARGA MASIVA (escritura): cargar la portada completa
  //    A) insertMany de 14 documentos   B y C) insertOne de 1 documento
  // -------------------------------------------------------------------
  const tmp = db.collection("prueba_carga_escritura");
  async function medirEscritura(fn, n = 300) {
    await tmp.drop().catch(() => {});
    const t = process.hrtime.bigint();
    for (let i = 0; i < n; i++) await fn(i);
    return Number(process.hrtime.bigint() - t) / 1e6 / n;
  }
  const escA = await medirEscritura((i) => tmp.insertMany(bloques.map((b) => ({ ...b, version: i }))));
  const escB = await medirEscritura((i) => tmp.insertOne({ _id: i, bloques }));
  await tmp.drop().catch(() => {});
  console.log("\nCarga masiva de la portada completa (promedio de 300 cargas):");
  console.log(`  A) insertMany de 14 documentos: ${escA.toFixed(2)} ms`);
  console.log(`  B) insertOne de 1 documento:    ${escB.toFixed(2)} ms`);

  // -------------------------------------------------------------------
  // 3) 100 clientes entrando MIENTRAS se actualiza la portada
  //    (el equipo comercial cambia un bloque cada 20 ms)
  // -------------------------------------------------------------------
  const actualizaciones = {
    "A) 14 documentos": () => db.collection("pagina_inicio").updateOne({ clave: "tendencias" }, { $set: { actualizado: new Date() } }),
    "B) 1 documento": () => db.collection("prueba_portada_unica").updateOne({ _id: "portada", "bloques.clave": "tendencias" }, { $set: { "bloques.$.actualizado": new Date() } })
  };
  console.log("\n100 clientes entrando mientras se actualiza la portada cada 20 ms:");
  console.log("  Diseño            | Portadas/seg | Espera mediana | p95");
  const nombres = Object.keys(disenos);
  let k = 0;
  for (const [nombre, upd] of Object.entries(actualizaciones)) {
    let activo = true, cambios = 0;
    const escritor = (async () => { while (activo) { await upd(); cambios++; await new Promise((r) => setTimeout(r, 20)); } })();
    const r = await carga(disenos[nombres[k++]], 100);
    activo = false; await escritor;
    console.log(`  ${nombre.padEnd(17)} | ${String(r.porSeg).padStart(12)} | ${r.p50.toFixed(2).padStart(11)} ms | ${r.p95.toFixed(2).padStart(6)} ms   (${cambios} actualizaciones)`);
  }

  await db.collection("prueba_portada_unica").drop();
  await cliente.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
