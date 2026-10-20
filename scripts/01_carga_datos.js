// =====================================================================
// MPARFUM - Script 01: carga de datos
// Uso: mongosh "mongodb://localhost:27017" scripts/01_carga_datos.js
//
// Catálogo armado tomando como guía la estructura de una perfumería
// argentina (Juleriaque): Fragancias, Maquillaje, Tratamiento, Cuerpo y
// baño, Cabello y Sets de regalo. Los precios son ilustrativos (ARS 2026).
//
// Mparfum es un e-commerce (sitio web + app) de perfumes y cosmética.
//
// Clientes, pedidos, reseñas y carritos se generan con un generador
// pseudoaleatorio con semilla fija: cada ejecución produce los mismos datos.
// La cantidad de pedidos se puede cambiar con la variable CANT_PEDIDOS:
//   mongosh --eval "var CANT_PEDIDOS=100000" scripts/01_carga_datos.js
// =====================================================================

db = db.getSiblingDB("mparfum");
const I = NumberInt;
const N_PEDIDOS = typeof CANT_PEDIDOS !== "undefined" ? CANT_PEDIDOS : 20000;
const N_CLIENTES = 2000;

// ---------------------------------------------------------------------
// Generador pseudoaleatorio reproducible (mulberry32)
// ---------------------------------------------------------------------
let semilla = 20261020;
function rnd() {
  semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];
function elegirPonderado(arr, pesos) {
  const total = pesos.reduce((s, p) => s + p, 0);
  let r = rnd() * total;
  for (let i = 0; i < arr.length; i++) { r -= pesos[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}
const redondear = (n) => Math.round(n / 100) * 100;

// ---------------------------------------------------------------------
// MARCAS
// ---------------------------------------------------------------------
const marcas = [
  ["chanel", "Chanel", "Francia", ["fragancias", "maquillaje", "tratamiento", "cuerpo"], "Chanel"],
  ["dior", "Dior", "Francia", ["fragancias", "maquillaje", "tratamiento"], "LVMH"],
  ["lancome", "Lancôme", "Francia", ["fragancias", "maquillaje", "tratamiento"], "L'Oréal"],
  ["ysl", "Yves Saint Laurent", "Francia", ["fragancias", "maquillaje"], "L'Oréal"],
  ["carolina-herrera", "Carolina Herrera", "Estados Unidos", ["fragancias"], "Puig"],
  ["rabanne", "Rabanne", "Francia", ["fragancias"], "Puig"],
  ["givenchy", "Givenchy", "Francia", ["fragancias", "maquillaje"], "LVMH"],
  ["gucci", "Gucci", "Italia", ["fragancias"], "Coty"],
  ["armani", "Giorgio Armani", "Italia", ["fragancias", "maquillaje"], "L'Oréal"],
  ["versace", "Versace", "Italia", ["fragancias"], "EuroItalia"],
  ["azzaro", "Azzaro", "Francia", ["fragancias"], "L'Oréal"],
  ["jpg", "Jean Paul Gaultier", "Francia", ["fragancias"], "Puig"],
  ["tom-ford", "Tom Ford", "Estados Unidos", ["fragancias", "maquillaje"], "Estée Lauder"],
  ["calvin-klein", "Calvin Klein", "Estados Unidos", ["fragancias"], "Coty"],
  ["jo-malone", "Jo Malone London", "Reino Unido", ["fragancias", "cuerpo"], "Estée Lauder"],
  ["estee-lauder", "Estée Lauder", "Estados Unidos", ["maquillaje", "tratamiento"], "Estée Lauder"],
  ["mac", "M·A·C", "Canadá", ["maquillaje"], "Estée Lauder"],
  ["nars", "NARS", "Estados Unidos", ["maquillaje"], "Shiseido"],
  ["urban-decay", "Urban Decay", "Estados Unidos", ["maquillaje"], "L'Oréal"],
  ["clinique", "Clinique", "Estados Unidos", ["tratamiento", "maquillaje"], "Estée Lauder"],
  ["la-roche-posay", "La Roche-Posay", "Francia", ["tratamiento"], "L'Oréal"],
  ["vichy", "Vichy", "Francia", ["tratamiento"], "L'Oréal"],
  ["kiehls", "Kiehl's", "Estados Unidos", ["tratamiento", "cuerpo"], "L'Oréal"],
  ["loccitane", "L'Occitane en Provence", "Francia", ["cuerpo", "tratamiento"], "L'Occitane"],
  ["victorias-secret", "Victoria's Secret", "Estados Unidos", ["cuerpo", "fragancias"], "Victoria's Secret"],
  ["kerastase", "Kérastase", "Francia", ["cabello"], "L'Oréal"],
  ["moroccanoil", "Moroccanoil", "Israel", ["cabello"], "Moroccanoil"]
].map(([_id, nombre, paisOrigen, rubros, grupo]) => ({ _id, nombre, paisOrigen, rubros, grupo, activa: true }));
db.marcas.insertMany(marcas);
const marcaPorId = Object.fromEntries(marcas.map((m) => [m._id, m]));

// ---------------------------------------------------------------------
// CATEGORÍAS (árbol de 2-3 niveles)
// ---------------------------------------------------------------------
const arbol = [
  ["fragancias", "Fragancias", null],
  ["fragancias-mujer", "Fragancias Mujer", "fragancias"],
  ["fragancias-hombre", "Fragancias Hombre", "fragancias"],
  ["fragancias-unisex", "Fragancias Unisex", "fragancias"],
  ["maquillaje", "Maquillaje", null],
  ["maquillaje-rostro", "Rostro", "maquillaje"],
  ["bases", "Bases", "maquillaje-rostro"],
  ["correctores", "Correctores", "maquillaje-rostro"],
  ["rubores", "Rubores", "maquillaje-rostro"],
  ["maquillaje-ojos", "Ojos", "maquillaje"],
  ["mascaras", "Máscaras de pestañas", "maquillaje-ojos"],
  ["sombras", "Sombras y paletas", "maquillaje-ojos"],
  ["maquillaje-labios", "Labios", "maquillaje"],
  ["labiales", "Labiales", "maquillaje-labios"],
  ["maquillaje-unas", "Uñas", "maquillaje"],
  ["tratamiento", "Tratamiento", null],
  ["hidratantes", "Hidratantes", "tratamiento"],
  ["serums", "Sérums", "tratamiento"],
  ["proteccion-solar", "Protección solar", "tratamiento"],
  ["limpieza", "Limpieza facial", "tratamiento"],
  ["cuerpo", "Cuerpo y baño", null],
  ["cremas-corporales", "Cremas corporales", "cuerpo"],
  ["body-mist", "Body mist", "cuerpo"],
  ["cabello", "Cabello", null],
  ["aceites-capilares", "Aceites y tratamientos", "cabello"],
  ["sets", "Sets de regalo", null]
];
const catPorId = {};
let orden = 0;
for (const [_id, nombre, padre] of arbol) {
  const ruta = padre ? [...catPorId[padre].ruta, padre] : [];
  catPorId[_id] = { _id, nombre, padre, ruta, nivel: I(ruta.length + 1), orden: I(++orden) };
}
db.categorias.insertMany(Object.values(catPorId));

// ---------------------------------------------------------------------
// DEPÓSITOS Y PUNTOS DE RETIRO (coordenadas GeoJSON: [longitud, latitud])
// Mparfum es una tienda 100% online: el stock está en 3 depósitos
// regionales y el cliente puede pedir envío a domicilio o retirar gratis
// en un punto de retiro.
// ---------------------------------------------------------------------
const depositos = [
  { _id: "DEP-MZA", nombre: "Depósito Cuyo", tipo: "deposito", direccion: { calle: "Carril Rodríguez Peña 2500", ciudad: "Maipú", provincia: "Mendoza" }, ubicacion: { type: "Point", coordinates: [-68.7925, -32.9420] }, provinciasQueAbastece: ["Mendoza", "San Juan", "San Luis", "Neuquén"], horario: "Lun a Sáb 7 a 22 h" },
  { _id: "DEP-CBA", nombre: "Depósito Centro", tipo: "deposito", direccion: { calle: "Av. Circunvalación Sur 6200", ciudad: "Córdoba", provincia: "Córdoba" }, ubicacion: { type: "Point", coordinates: [-64.1650, -31.4700] }, provinciasQueAbastece: ["Córdoba", "Santa Fe"], horario: "Lun a Sáb 7 a 22 h" },
  { _id: "DEP-BA", nombre: "Depósito AMBA", tipo: "deposito", direccion: { calle: "Ruta Panamericana km 36,5", ciudad: "Tortuguitas", provincia: "Buenos Aires" }, ubicacion: { type: "Point", coordinates: [-58.7560, -34.4700] }, provinciasQueAbastece: ["Buenos Aires"], horario: "Lun a Sáb 7 a 22 h" },
  { _id: "PR-MZA-CENTRO", nombre: "Punto de retiro Mendoza Centro", tipo: "punto_retiro", direccion: { calle: "Peatonal Sarmiento 150", ciudad: "Mendoza", provincia: "Mendoza" }, ubicacion: { type: "Point", coordinates: [-68.8405, -32.8895] }, horario: "Lun a Sáb 9 a 20 h" },
  { _id: "PR-GODOY-CRUZ", nombre: "Punto de retiro Palmares", tipo: "punto_retiro", direccion: { calle: "Panamericana 2650", ciudad: "Godoy Cruz", provincia: "Mendoza" }, ubicacion: { type: "Point", coordinates: [-68.8558, -32.9655] }, horario: "Todos los días 10 a 22 h" },
  { _id: "PR-GUAYMALLEN", nombre: "Punto de retiro Guaymallén", tipo: "punto_retiro", direccion: { calle: "Av. Acceso Este 3280", ciudad: "Guaymallén", provincia: "Mendoza" }, ubicacion: { type: "Point", coordinates: [-68.8156, -32.8908] }, horario: "Todos los días 10 a 22 h" },
  { _id: "PR-SAN-JUAN", nombre: "Punto de retiro San Juan", tipo: "punto_retiro", direccion: { calle: "Av. José I. de la Roza 806", ciudad: "San Juan", provincia: "San Juan" }, ubicacion: { type: "Point", coordinates: [-68.5364, -31.5375] }, horario: "Lun a Sáb 9 a 20 h" },
  { _id: "PR-CORDOBA", nombre: "Punto de retiro Nueva Córdoba", tipo: "punto_retiro", direccion: { calle: "Duarte Quirós 1400", ciudad: "Córdoba", provincia: "Córdoba" }, ubicacion: { type: "Point", coordinates: [-64.2037, -31.4103] }, horario: "Lun a Sáb 9 a 20 h" },
  { _id: "PR-PALERMO", nombre: "Punto de retiro Palermo", tipo: "punto_retiro", direccion: { calle: "Av. Santa Fe 3253", ciudad: "CABA", provincia: "Buenos Aires" }, ubicacion: { type: "Point", coordinates: [-58.4103, -34.5884] }, horario: "Lun a Sáb 9 a 20 h" }
];
db.depositos.insertMany(depositos);
const idsDepositos = depositos.filter((d) => d.tipo === "deposito").map((d) => d._id);
const depositoDeProvincia = {};
for (const d of depositos) for (const p of d.provinciasQueAbastece || []) depositoDeProvincia[p] = d._id;
const puntosRetiroDeProvincia = {};
for (const d of depositos.filter((x) => x.tipo === "punto_retiro")) (puntosRetiroDeProvincia[d.direccion.provincia] ||= []).push(d._id);

// ---------------------------------------------------------------------
// PRODUCTOS
// ---------------------------------------------------------------------
function stockInicial() {
  return idsDepositos.map((d) => ({ deposito: d, cantidad: I(d === "DEP-MZA" ? entre(0, 120) : entre(0, 60)) }));
}
let nroSku = 1000;
const nuevoSku = (prefijo) => `${prefijo}-${++nroSku}`;

// Fragancia: precio corresponde al tamaño más grande; los demás se escalan
function fragancia(nombre, marca, genero, concentracion, familia, notas, tamaños, precioMax, extra = {}) {
  const max = Math.max(...tamaños);
  return {
    nombre, tipo: "fragancia", genero,
    marca: { _id: marca, nombre: marcaPorId[marca].nombre },
    categoria: { _id: `fragancias-${genero}`, ruta: ["fragancias", `fragancias-${genero}`] },
    descripcion: `${concentracion} de ${marcaPorId[marca].nombre}, familia ${familia}. Notas de ${notas.salida.join(", ")} con fondo de ${notas.fondo.join(", ")}.`,
    etiquetas: [familia, concentracion.toLowerCase(), genero, ...(extra.etiquetas || [])],
    atributos: { concentracion, familiaOlfativa: familia, notas, perfumista: extra.perfumista, lanzamiento: extra.lanzamiento ? I(extra.lanzamiento) : undefined },
    variantes: tamaños.map((ml) => {
      const precio = redondear(precioMax * Math.pow(ml / max, 0.75));
      return { sku: nuevoSku("FR"), presentacion: `${concentracion} ${ml} ml`, contenido: { valor: I(ml), unidad: "ml" }, precio, precioLista: precio, stock: stockInicial() };
    })
  };
}

// Cosmético (maquillaje, tratamiento, cuerpo, cabello): una variante por tono/tamaño
function cosmetico(nombre, marca, tipo, categoria, atributos, variantes, extra = {}) {
  const cat = catPorId[categoria];
  return {
    nombre, tipo, genero: extra.genero || "unisex",
    marca: { _id: marca, nombre: marcaPorId[marca].nombre },
    categoria: { _id: categoria, ruta: [...cat.ruta, categoria] },
    descripcion: extra.descripcion || `${nombre} de ${marcaPorId[marca].nombre}.`,
    etiquetas: extra.etiquetas || [],
    atributos,
    variantes: variantes.map(([presentacion, valor, unidad, precio, tono]) => {
      const v = { sku: nuevoSku(tipo.substring(0, 2).toUpperCase()), presentacion, contenido: { valor, unidad }, precio, precioLista: precio, stock: stockInicial() };
      if (tono) v.tono = tono;
      return v;
    })
  };
}

const n = (salida, corazon, fondo) => ({ salida, corazon, fondo });
const productos = [
  // --- Fragancias mujer ---
  fragancia("N°5", "chanel", "mujer", "Eau de Parfum", "floral aldehídica", n(["aldehídos", "neroli", "bergamota"], ["rosa de mayo", "jazmín", "iris"], ["sándalo", "vainilla", "vetiver"]), [35, 50, 100], 420000, { perfumista: "Ernest Beaux", lanzamiento: 1921, etiquetas: ["clásico"] }),
  fragancia("Coco Mademoiselle", "chanel", "mujer", "Eau de Parfum", "chipre floral", n(["naranja", "bergamota"], ["rosa", "jazmín"], ["pachulí", "vetiver", "vainilla"]), [35, 50, 100], 410000, { perfumista: "Jacques Polge", lanzamiento: 2001 }),
  fragancia("J'adore", "dior", "mujer", "Eau de Parfum", "floral", n(["pera", "melón", "bergamota"], ["jazmín", "rosa", "ylang-ylang"], ["almizcle", "vainilla", "cedro"]), [30, 50, 100], 365000, { perfumista: "Calice Becker", lanzamiento: 1999 }),
  fragancia("Miss Dior", "dior", "mujer", "Eau de Parfum", "floral", n(["mandarina", "rosa"], ["peonía", "lirio del valle"], ["almizcle", "vainilla"]), [30, 50, 100], 355000, { lanzamiento: 2021 }),
  fragancia("La Vie Est Belle", "lancome", "mujer", "Eau de Parfum", "oriental gourmand", n(["pera", "grosella negra"], ["iris", "jazmín", "azahar"], ["praliné", "vainilla", "pachulí"]), [30, 50, 100], 298000, { lanzamiento: 2012, etiquetas: ["dulce"] }),
  fragancia("Libre", "ysl", "mujer", "Eau de Parfum", "floral lavanda", n(["lavanda", "mandarina", "grosella negra"], ["lavanda", "azahar", "jazmín"], ["vainilla de Madagascar", "almizcle", "cedro"]), [30, 50, 90], 305000, { lanzamiento: 2019 }),
  fragancia("Black Opium", "ysl", "mujer", "Eau de Parfum", "oriental vainilla", n(["pera", "pimienta rosa", "azahar"], ["café", "jazmín"], ["vainilla", "pachulí", "cedro"]), [30, 50, 90], 295000, { lanzamiento: 2014, etiquetas: ["dulce", "noche"] }),
  fragancia("Good Girl", "carolina-herrera", "mujer", "Eau de Parfum", "oriental floral", n(["almendra", "café"], ["tuberosa", "jazmín sambac"], ["haba tonka", "cacao", "vainilla"]), [30, 50, 80], 265000, { lanzamiento: 2016, etiquetas: ["noche"] }),
  fragancia("L'Interdit", "givenchy", "mujer", "Eau de Parfum", "floral amaderada", n(["pera", "bergamota"], ["tuberosa", "azahar", "jazmín"], ["pachulí", "vetiver", "ambroxan"]), [35, 50, 80], 270000, { lanzamiento: 2018 }),
  fragancia("Bloom", "gucci", "mujer", "Eau de Parfum", "floral", n(["jazmín"], ["tuberosa", "rangoon creeper"], ["almizcle"]), [30, 50, 100], 255000, { lanzamiento: 2017 }),
  fragancia("Sì", "armani", "mujer", "Eau de Parfum", "chipre frutal", n(["cassis"], ["rosa de mayo", "fresia"], ["vainilla", "pachulí", "ambroxan"]), [30, 50, 100], 260000, { lanzamiento: 2013 }),
  fragancia("Fame", "rabanne", "mujer", "Eau de Parfum", "floral amaderada", n(["mango", "bergamota"], ["jazmín", "incienso"], ["sándalo", "vainilla"]), [30, 50, 80], 225000, { lanzamiento: 2022 }),
  // --- Fragancias hombre ---
  fragancia("Sauvage", "dior", "hombre", "Eau de Toilette", "aromática fougère", n(["bergamota de Calabria", "pimienta"], ["lavanda", "pimienta de Sichuan", "geranio"], ["ambroxan", "cedro", "ládano"]), [60, 100, 200], 345000, { perfumista: "François Demachy", lanzamiento: 2015, etiquetas: ["fresco"] }),
  fragancia("Bleu de Chanel", "chanel", "hombre", "Eau de Parfum", "amaderada aromática", n(["pomelo", "limón", "menta"], ["jengibre", "nuez moscada", "jazmín"], ["incienso", "sándalo", "cedro"]), [50, 100, 150], 430000, { lanzamiento: 2010 }),
  fragancia("1 Million", "rabanne", "hombre", "Eau de Toilette", "oriental especiada", n(["mandarina", "menta"], ["rosa", "canela"], ["cuero", "ámbar", "pachulí"]), [50, 100, 200], 235000, { lanzamiento: 2008, etiquetas: ["noche", "dulce"] }),
  fragancia("Acqua di Giò", "armani", "hombre", "Eau de Toilette", "acuática", n(["notas marinas", "bergamota", "limón"], ["jazmín", "romero"], ["cedro", "pachulí", "almizcle"]), [50, 100, 200], 230000, { lanzamiento: 1996, etiquetas: ["fresco", "verano"] }),
  fragancia("Bad Boy", "carolina-herrera", "hombre", "Eau de Toilette", "oriental especiada", n(["pimienta blanca", "pimienta negra", "bergamota"], ["salvia", "cedro"], ["haba tonka", "cacao", "ámbar"]), [50, 100, 150], 215000, { lanzamiento: 2019 }),
  fragancia("Eros", "versace", "hombre", "Eau de Toilette", "aromática fougère", n(["menta", "manzana verde", "limón"], ["haba tonka", "geranio"], ["vainilla", "vetiver", "cedro"]), [50, 100, 200], 175000, { lanzamiento: 2012, etiquetas: ["noche"] }),
  fragancia("The Most Wanted", "azzaro", "hombre", "Eau de Parfum", "oriental amaderada", n(["cardamomo"], ["toffee"], ["ámbar", "madera"]), [50, 100], 185000, { lanzamiento: 2021 }),
  fragancia("Le Male", "jpg", "hombre", "Eau de Toilette", "oriental fougère", n(["lavanda", "menta", "cardamomo"], ["canela", "azahar"], ["vainilla", "haba tonka", "sándalo"]), [75, 125, 200], 205000, { perfumista: "Francis Kurkdjian", lanzamiento: 1995 }),
  fragancia("Y", "ysl", "hombre", "Eau de Parfum", "aromática fougère", n(["manzana", "jengibre", "bergamota"], ["salvia", "geranio", "enebro"], ["ámbar", "cedro", "haba tonka"]), [60, 100], 260000, { lanzamiento: 2018 }),
  // --- Fragancias unisex ---
  fragancia("Oud Wood", "tom-ford", "unisex", "Eau de Parfum", "amaderada oriental", n(["palo de rosa", "cardamomo"], ["oud", "sándalo", "vetiver"], ["haba tonka", "vainilla", "ámbar"]), [30, 50, 100], 690000, { lanzamiento: 2007, etiquetas: ["nicho", "lujo"] }),
  fragancia("CK One", "calvin-klein", "unisex", "Eau de Toilette", "cítrica aromática", n(["limón", "bergamota", "piña"], ["jazmín", "violeta", "rosa"], ["almizcle", "ámbar", "cedro"]), [50, 100, 200], 95000, { lanzamiento: 1994, etiquetas: ["fresco", "verano"] }),
  fragancia("Wood Sage & Sea Salt", "jo-malone", "unisex", "Cologne", "amaderada aromática", n(["ambreta"], ["sal marina"], ["salvia", "pomelo"]), [30, 100], 280000, { lanzamiento: 2014, etiquetas: ["fresco"] }),

  // --- Maquillaje ---
  cosmetico("Forever Skin Glow Base", "dior", "maquillaje", "bases", { zona: "rostro", acabado: "luminoso", cobertura: "media", duracionHoras: I(24), fps: I(20), tipoPiel: ["normal", "seca"] },
    [["30 ml · 1N", 30, "ml", 115000, "1N Neutral"], ["30 ml · 2N", 30, "ml", 115000, "2N Neutral"], ["30 ml · 3W", 30, "ml", 115000, "3W Warm"], ["30 ml · 4N", 30, "ml", 115000, "4N Neutral"]], { genero: "mujer", etiquetas: ["glow"] }),
  cosmetico("Double Wear Stay-in-Place Base", "estee-lauder", "maquillaje", "bases", { zona: "rostro", acabado: "mate", cobertura: "alta", duracionHoras: I(24), fps: I(10), tipoPiel: ["mixta", "grasa"] },
    [["30 ml · 1W2 Sand", 30, "ml", 98000, "1W2 Sand"], ["30 ml · 2C0 Cool Vanilla", 30, "ml", 98000, "2C0 Cool Vanilla"], ["30 ml · 3W1 Tawny", 30, "ml", 98000, "3W1 Tawny"]], { genero: "mujer", etiquetas: ["larga duración", "mate"] }),
  cosmetico("Touche Éclat Corrector", "ysl", "maquillaje", "correctores", { zona: "rostro", acabado: "luminoso", cobertura: "ligera" },
    [["2,5 ml · N°1", 2.5, "ml", 72000, "N°1 Luminous Radiance"], ["2,5 ml · N°2", 2.5, "ml", 72000, "N°2 Luminous Ivory"]], { genero: "mujer" }),
  cosmetico("Blush Rubor", "nars", "maquillaje", "rubores", { zona: "rostro", acabado: "satinado" },
    [["4,8 g · Orgasm", 4.8, "g", 62000, "Orgasm"], ["4,8 g · Deep Throat", 4.8, "g", 62000, "Deep Throat"]], { genero: "mujer", etiquetas: ["best seller"] }),
  cosmetico("Lash Idôle Máscara", "lancome", "maquillaje", "mascaras", { zona: "ojos", efecto: "volumen y curvatura", aPruebaDeAgua: false },
    [["8 ml · Negro", 8, "ml", 54000, "01 Glossy Black"]], { genero: "mujer" }),
  cosmetico("Naked3 Paleta de Sombras", "urban-decay", "maquillaje", "sombras", { zona: "ojos", cantidadTonos: I(12), acabado: "mixto" },
    [["12 x 1,3 g", 15.6, "g", 89000, "Rose Neutrals"]], { genero: "mujer" }),
  cosmetico("Rouge Coco Labial", "chanel", "maquillaje", "labiales", { zona: "labios", acabado: "satinado", hidratante: true },
    [["3,5 g · 432 Cécile", 3.5, "g", 68000, "432 Cécile"], ["3,5 g · 444 Gabrielle", 3.5, "g", 68000, "444 Gabrielle"], ["3,5 g · 470 Marthe", 3.5, "g", 68000, "470 Marthe"]], { genero: "mujer" }),
  cosmetico("Matte Lipstick", "mac", "maquillaje", "labiales", { zona: "labios", acabado: "mate" },
    [["3 g · Ruby Woo", 3, "g", 45000, "Ruby Woo"], ["3 g · Velvet Teddy", 3, "g", 45000, "Velvet Teddy"], ["3 g · Chili", 3, "g", 45000, "Chili"]], { genero: "mujer", etiquetas: ["best seller", "mate"] }),
  cosmetico("Le Vernis Esmalte", "chanel", "maquillaje", "maquillaje-unas", { zona: "uñas", acabado: "brillante" },
    [["13 ml · 500 Rouge Essentiel", 13, "ml", 52000, "500 Rouge Essentiel"], ["13 ml · 167 Ballerina", 13, "ml", 52000, "167 Ballerina"]], { genero: "mujer" }),

  // --- Tratamiento ---
  cosmetico("Advanced Night Repair Sérum", "estee-lauder", "tratamiento", "serums", { tipoPiel: ["todo tipo"], beneficios: ["reparación nocturna", "antiedad"], ingredientesClave: ["ácido hialurónico", "péptidos"] },
    [["30 ml", 30, "ml", 135000], ["50 ml", 50, "ml", 189000]], { etiquetas: ["antiedad", "best seller"] }),
  cosmetico("Advanced Génifique Sérum", "lancome", "tratamiento", "serums", { tipoPiel: ["todo tipo"], beneficios: ["luminosidad", "barrera cutánea"], ingredientesClave: ["probióticos", "ácido hialurónico"] },
    [["30 ml", 30, "ml", 128000], ["50 ml", 50, "ml", 175000]], { etiquetas: ["antiedad"] }),
  cosmetico("Moisture Surge 100H Crema", "clinique", "tratamiento", "hidratantes", { tipoPiel: ["seca", "mixta", "normal"], beneficios: ["hidratación 100 horas"], ingredientesClave: ["aloe vera", "ácido hialurónico"] },
    [["50 ml", 50, "ml", 76000]], { etiquetas: ["hidratación"] }),
  cosmetico("Ultra Facial Cream", "kiehls", "tratamiento", "hidratantes", { tipoPiel: ["todo tipo"], beneficios: ["hidratación 24 h"], ingredientesClave: ["escualano", "glaciar glicoproteína"] },
    [["50 ml", 50, "ml", 69000], ["125 ml", 125, "ml", 128000]], { etiquetas: ["hidratación"] }),
  cosmetico("Mineral 89 Booster", "vichy", "tratamiento", "hidratantes", { tipoPiel: ["sensible", "todo tipo"], beneficios: ["fortalece", "hidrata"], ingredientesClave: ["agua volcánica", "ácido hialurónico"] },
    [["50 ml", 50, "ml", 42000]], { etiquetas: ["dermocosmética"] }),
  cosmetico("Anthelios UVMune 400 Fluido FPS 50+", "la-roche-posay", "tratamiento", "proteccion-solar", { tipoPiel: ["sensible", "grasa"], fps: I(50), beneficios: ["protección UVA ultra larga"], ingredientesClave: ["Mexoryl 400"] },
    [["50 ml", 50, "ml", 38000]], { etiquetas: ["dermocosmética", "verano"] }),
  cosmetico("Effaclar Gel Limpiador", "la-roche-posay", "tratamiento", "limpieza", { tipoPiel: ["grasa", "acneica"], beneficios: ["limpieza profunda"], ingredientesClave: ["zinc"] },
    [["200 ml", 200, "ml", 29000], ["400 ml", 400, "ml", 46000]], { etiquetas: ["dermocosmética"] }),

  // --- Cuerpo y baño ---
  cosmetico("Coco Mademoiselle Emulsión Corporal", "chanel", "cuerpo", "cremas-corporales", { aroma: "Coco Mademoiselle", textura: "emulsión" },
    [["200 ml", 200, "ml", 125000]], { genero: "mujer" }),
  cosmetico("Crema de Manos Karité", "loccitane", "cuerpo", "cremas-corporales", { aroma: "karité", textura: "crema", ingredientesClave: ["manteca de karité 20%"] },
    [["30 ml", 30, "ml", 21000], ["150 ml", 150, "ml", 52000]], { etiquetas: ["regalo"] }),
  cosmetico("Bare Vanilla Body Mist", "victorias-secret", "cuerpo", "body-mist", { aroma: "vainilla", textura: "bruma" },
    [["250 ml", 250, "ml", 39000]], { genero: "mujer", etiquetas: ["dulce"] }),
  cosmetico("English Pear & Freesia Body Crème", "jo-malone", "cuerpo", "cremas-corporales", { aroma: "pera y fresia", textura: "crema" },
    [["175 ml", 175, "ml", 118000]]),

  // --- Cabello ---
  cosmetico("Elixir Ultime Aceite Capilar", "kerastase", "cabello", "aceites-capilares", { tipoCabello: ["todo tipo"], beneficios: ["brillo", "nutrición"] },
    [["100 ml", 100, "ml", 78000]]),
  cosmetico("Moroccanoil Treatment Original", "moroccanoil", "cabello", "aceites-capilares", { tipoCabello: ["todo tipo"], beneficios: ["brillo", "anti-frizz"], ingredientesClave: ["aceite de argán"] },
    [["25 ml", 25, "ml", 32000], ["100 ml", 100, "ml", 85000]])
];

// --- Sets de regalo (referencian a los productos que contienen) ---
const sets = [
  { nombre: "Set Sauvage EDT 100 ml + Gel de Ducha", marca: "dior", genero: "hombre", precio: 352000, incluye: ["Sauvage EDT 100 ml", "Gel de ducha 50 ml"] },
  { nombre: "Set Good Girl EDP 80 ml + Body Lotion", marca: "carolina-herrera", genero: "mujer", precio: 275000, incluye: ["Good Girl EDP 80 ml", "Body lotion 100 ml"] },
  { nombre: "Set La Vie Est Belle EDP 50 ml + Máscara", marca: "lancome", genero: "mujer", precio: 249000, incluye: ["La Vie Est Belle EDP 50 ml", "Lash Idôle 2,5 ml"] }
];
for (const s of sets) {
  productos.push({
    nombre: s.nombre, tipo: "set", genero: s.genero,
    marca: { _id: s.marca, nombre: marcaPorId[s.marca].nombre },
    categoria: { _id: "sets", ruta: ["sets"] },
    descripcion: `Set de regalo: ${s.incluye.join(" + ")}.`,
    etiquetas: ["regalo", "edición limitada"],
    atributos: { incluye: s.incluye, edicionLimitada: true, temporada: "Día de la Madre / Navidad 2026" },
    variantes: [{ sku: nuevoSku("SE"), presentacion: "Set", contenido: { valor: I(1), unidad: "u" }, precio: s.precio, precioLista: s.precio, stock: stockInicial() }]
  });
}

// Limpieza de atributos vacíos y datos comunes
for (const p of productos) {
  for (const k of Object.keys(p.atributos)) if (p.atributos[k] === undefined) delete p.atributos[k];
  p.rating = { promedio: 0, cantidad: I(0) };
  p.activo = true;
  p.fechaAlta = new Date(2024, entre(0, 11), entre(1, 28));
}
// Un producto discontinuado para mostrar el índice parcial de activos
productos.push({
  nombre: "Fantasy Body Spray (discontinuado)", tipo: "cuerpo", genero: "mujer",
  marca: { _id: "victorias-secret", nombre: "Victoria's Secret" },
  categoria: { _id: "body-mist", ruta: ["cuerpo", "body-mist"] },
  descripcion: "Producto fuera de catálogo.", etiquetas: [], atributos: {},
  variantes: [{ sku: nuevoSku("CU"), presentacion: "250 ml", contenido: { valor: I(250), unidad: "ml" }, precio: 30000, stock: [] }],
  rating: { promedio: 0, cantidad: I(0) }, activo: false, fechaAlta: new Date(2020, 1, 1)
});

const resProd = db.productos.insertMany(productos);
const productosDB = db.productos.find({ activo: true }).toArray();
// Popularidad relativa para que las ventas no sean uniformes
const popularidad = productosDB.map((p) =>
  ({ "Sauvage": 10, "N°5": 6, "La Vie Est Belle": 8, "Good Girl": 8, "1 Million": 7, "Black Opium": 6, "Matte Lipstick": 7, "Anthelios UVMune 400 Fluido FPS 50+": 6, "Acqua di Giò": 5 })[p.nombre] || (p.tipo === "set" ? 2 : 3));

// ---------------------------------------------------------------------
// PROMOCIONES
// ---------------------------------------------------------------------
db.promociones.insertMany([
  { codigo: "BIENVENIDA10", descripcion: "10% off en compras por la web o la app", tipo: "porcentaje", valor: 10, vigencia: { desde: ISODate("2025-01-01"), hasta: ISODate("2026-12-31") }, aplicaA: { canales: ["web", "app"] } },
  { codigo: "MADRE2026", descripcion: "Día de la Madre: 15% off en fragancias mujer y sets", tipo: "porcentaje", valor: 15, vigencia: { desde: ISODate("2026-10-01"), hasta: ISODate("2026-10-19T23:59:59Z") }, aplicaA: { categorias: ["fragancias-mujer", "sets"] } },
  { codigo: "PADRE2026", descripcion: "Día del Padre: 15% off en fragancias hombre", tipo: "porcentaje", valor: 15, vigencia: { desde: ISODate("2026-06-01"), hasta: ISODate("2026-06-21T23:59:59Z") }, aplicaA: { categorias: ["fragancias-hombre"] } },
  { codigo: "CYBER2025", descripcion: "CyberMonday: 20% off en todo el sitio", tipo: "porcentaje", valor: 20, vigencia: { desde: ISODate("2025-11-03"), hasta: ISODate("2025-11-05T23:59:59Z") }, aplicaA: { canales: ["web", "app"] } },
  { codigo: "DERMO5000", descripcion: "$5.000 off en dermocosmética", tipo: "monto_fijo", valor: 5000, vigencia: { desde: ISODate("2026-01-01"), hasta: ISODate("2026-12-31") }, aplicaA: { marcas: ["la-roche-posay", "vichy"] } },
  { codigo: "6CUOTAS", descripcion: "6 cuotas sin interés con tarjetas bancarias", tipo: "cuotas_sin_interes", valor: 6, vigencia: { desde: ISODate("2025-01-01"), hasta: ISODate("2026-12-31") }, medioPago: "credito" }
]);

// ---------------------------------------------------------------------
// CLIENTES
// ---------------------------------------------------------------------
const nombresF = ["Sofía", "Martina", "Valentina", "Camila", "Lucía", "Julieta", "Florencia", "Agustina", "Micaela", "Carolina", "Paula", "Rocío", "Milagros", "Antonella", "Victoria", "Belén"];
const nombresM = ["Juan", "Mateo", "Santiago", "Tomás", "Facundo", "Nicolás", "Lautaro", "Joaquín", "Franco", "Agustín", "Matías", "Ignacio", "Bruno", "Federico"];
const apellidos = ["González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "García", "Sánchez", "Romero", "Sosa", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Acosta", "Benítez", "Medina", "Herrera", "Suárez", "Aguirre", "Giménez", "Molina", "Castro", "Ortiz", "Morales"];
const ciudades = [
  ["Mendoza", "Mendoza", "5500", 18], ["Godoy Cruz", "Mendoza", "5501", 14], ["Guaymallén", "Mendoza", "5519", 12], ["Luján de Cuyo", "Mendoza", "5507", 8],
  ["Maipú", "Mendoza", "5515", 7], ["San Rafael", "Mendoza", "5600", 6], ["San Juan", "San Juan", "5400", 8], ["San Luis", "San Luis", "5700", 4],
  ["Córdoba", "Córdoba", "5000", 9], ["CABA", "Buenos Aires", "1425", 10], ["La Plata", "Buenos Aires", "1900", 3], ["Rosario", "Santa Fe", "2000", 4], ["Neuquén", "Neuquén", "8300", 3]
];
const calles = ["San Martín", "Belgrano", "Las Heras", "Colón", "Arístides Villanueva", "Emilio Civit", "Perú", "Godoy Cruz", "Rivadavia", "Mitre", "Sarmiento", "Boulogne Sur Mer"];
const familias = ["floral", "oriental", "amaderada", "cítrica", "aromática fougère", "gourmand", "acuática"];
const tiposPiel = ["seca", "grasa", "mixta", "normal", "sensible"];
const quitarTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const clientes = [];
const emails = new Set(), dnis = new Set();
for (let i = 0; i < N_CLIENTES; i++) {
  const esMujer = rnd() < 0.68;
  const nombre = elegir(esMujer ? nombresF : nombresM);
  const apellido = elegir(apellidos);
  let email = `${quitarTildes(nombre)}.${quitarTildes(apellido)}${entre(1, 999)}@${elegir(["gmail.com", "hotmail.com", "yahoo.com.ar", "outlook.com"])}`;
  while (emails.has(email)) email = email.replace("@", `${entre(0, 9)}@`);
  emails.add(email);
  const [ciudad, provincia, cp] = elegirPonderado(ciudades, ciudades.map((c) => c[3]));
  const direcciones = [{ alias: "Casa", calle: `${elegir(calles)} ${entre(10, 3500)}`, ciudad, provincia, cp, principal: true }];
  if (rnd() < 0.25) direcciones.push({ alias: "Trabajo", calle: `${elegir(calles)} ${entre(10, 3500)}`, ciudad, provincia, cp, principal: false });
  clientes.push({
    _id: new ObjectId(),
    nombre, apellido, email,
    dni: (() => { let d; do d = String(entre(20000000, 45999999)); while (dnis.has(d)); dnis.add(d); return d; })(),
    telefono: `+54 9 ${provincia === "Mendoza" ? "261" : provincia === "Buenos Aires" ? "11" : "351"} ${entre(4000000, 6999999)}`,
    fechaNacimiento: new Date(entre(1960, 2006), entre(0, 11), entre(1, 28)),
    genero: esMujer ? "F" : "M",
    direcciones,
    preferencias: {
      familiasOlfativas: [elegir(familias), elegir(familias)].filter((v, idx, a) => a.indexOf(v) === idx),
      tipoPiel: elegir(tiposPiel),
      aceptaNewsletter: rnd() < 0.6
    },
    favoritos: [],
    club: { nivel: "classic", puntos: I(0) },
    fechaRegistro: new Date(2024, entre(0, 23), entre(1, 28))
  });
}
db.clientes.insertMany(clientes);

// ---------------------------------------------------------------------
// PEDIDOS (con estacionalidad: picos en Día del Padre, Día de la Madre,
// CyberMonday y Navidad)
// ---------------------------------------------------------------------
const pesoMes = [6, 5, 5, 5, 6, 9, 7, 6, 6, 12, 9, 14]; // ene..dic
const inicio = new Date("2025-01-01T00:00:00Z").getTime();
const fin = new Date("2026-10-18T23:59:59Z").getTime();
function fechaPedido() {
  while (true) {
    const f = new Date(inicio + rnd() * (fin - inicio));
    if (rnd() * 14 < pesoMes[f.getUTCMonth()]) {
      f.setUTCHours(entre(12, 23), entre(0, 59), entre(0, 59)); // horario comercial (UTC-3)
      return f;
    }
  }
}
const promosPorCodigo = {
  BIENVENIDA10: { valor: 10, desde: new Date("2025-01-01"), hasta: new Date("2026-12-31") },
  CYBER2025: { valor: 20, desde: new Date("2025-11-03"), hasta: new Date("2025-11-06") },
  MADRE2026: { valor: 15, desde: new Date("2026-10-01"), hasta: new Date("2026-10-20"), cats: ["fragancias-mujer", "sets"] },
  PADRE2026: { valor: 15, desde: new Date("2026-06-01"), hasta: new Date("2026-06-22"), cats: ["fragancias-hombre"] }
};
const gastoCliente = {};
const compras = []; // [clienteId, productoId, fecha] para generar reseñas verificadas

let lote = [];
for (let i = 0; i < N_PEDIDOS; i++) {
  const cliente = clientes[Math.floor(Math.pow(rnd(), 1.6) * clientes.length)]; // algunos clientes compran mucho más
  const fecha = fechaPedido();
  const canal = elegirPonderado(["web", "app"], [72, 28]);
  const items = [];
  const cantItems = elegirPonderado([1, 2, 3, 4], [55, 28, 12, 5]);
  const usados = new Set();
  for (let k = 0; k < cantItems; k++) {
    const p = elegirPonderado(productosDB, popularidad);
    const v = elegir(p.variantes);
    if (usados.has(v.sku)) continue;
    usados.add(v.sku);
    items.push({ productoId: p._id, sku: v.sku, nombre: `${p.nombre} - ${v.presentacion}`, marca: p.marca.nombre, tipo: p.tipo, categoria: p.categoria._id, cantidad: I(rnd() < 0.9 ? 1 : 2), precioUnitario: v.precio });
    compras.push([cliente._id, p._id, fecha]);
  }
  const subtotal = items.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0);
  // Promoción vigente aplicable
  let promocion, descuento = 0;
  const candidatas = Object.entries(promosPorCodigo).filter(([c, pr]) => fecha >= pr.desde && fecha < pr.hasta);
  if (candidatas.length && rnd() < 0.45) {
    const [codigo, pr] = elegir(candidatas);
    const base = pr.cats ? items.filter((it) => pr.cats.includes(it.categoria)).reduce((s, it) => s + it.precioUnitario * it.cantidad, 0) : subtotal;
    if (base > 0) { promocion = codigo; descuento = redondear(base * pr.valor / 100); }
  }
  const dir = cliente.direcciones[0];
  // Envío: retiro gratis en un punto de la provincia o envío a domicilio
  // (gratis desde $150.000). Despacha el depósito regional del cliente.
  const deposito = depositoDeProvincia[dir.provincia] || "DEP-BA";
  const puntos = puntosRetiroDeProvincia[dir.provincia];
  const envio = puntos && rnd() < 0.3
    ? { tipo: "retiro", puntoRetiro: elegir(puntos), costo: 0 }
    : { tipo: "domicilio", costo: subtotal - descuento >= 150000 ? 0 : 6500, empresa: elegir(["Andreani", "OCA", "Correo Argentino"]), direccion: { calle: dir.calle, ciudad: dir.ciudad, provincia: dir.provincia, cp: dir.cp } };
  const medio = elegirPonderado(["credito", "debito", "mercadopago", "transferencia"], [50, 18, 26, 6]);
  const diasDesdeCompra = (fin - fecha.getTime()) / 86400000;
  let estado = diasDesdeCompra > 10 ? "entregado" : elegir(["pagado", "preparando", "enviado", "entregado"]);
  if (rnd() < 0.04) estado = "cancelado";
  const historial = [{ estado: "pendiente", fecha }];
  const pasos = ["pagado", "preparando", "enviado", "entregado"];
  if (estado === "cancelado") historial.push({ estado: "cancelado", fecha: new Date(fecha.getTime() + 3600000 * entre(1, 48)) });
  else for (let s = 0, t = fecha.getTime(); s <= pasos.indexOf(estado); s++) { t += 3600000 * entre(1, 30); historial.push({ estado: pasos[s], fecha: new Date(t) }); }
  const total = subtotal - descuento + (envio.costo || 0);
  const pedido = {
    numero: I(100001 + i),
    cliente: { _id: cliente._id, nombre: `${cliente.nombre} ${cliente.apellido}`, email: cliente.email, provincia: dir.provincia },
    fecha, canal, deposito,
    items, subtotal, descuento, total,
    pago: { medio, cuotas: I(medio === "credito" ? elegir([1, 3, 6, 6, 12]) : 1) },
    envio, estado, historialEstados: historial
  };
  if (envio.tipo === "domicilio" && ["enviado", "entregado"].includes(estado)) envio.tracking = `${envio.empresa.substring(0, 3).toUpperCase()}${String(100001 + i).padStart(10, "0")}`;
  if (promocion) pedido.promocion = promocion;
  if (estado !== "cancelado") gastoCliente[cliente._id] = (gastoCliente[cliente._id] || 0) + total;
  lote.push(pedido);
  if (lote.length === 5000) { db.pedidos.insertMany(lote, { ordered: false }); lote = []; }
}
if (lote.length) db.pedidos.insertMany(lote, { ordered: false });

// Puntos del club: 1 punto cada $10.000 gastados; nivel según puntos
const bulkClientes = Object.entries(gastoCliente).map(([id, gasto]) => {
  const puntos = Math.floor(gasto / 10000);
  const nivel = puntos >= 1000 ? "black" : puntos >= 300 ? "gold" : "classic";
  return { updateOne: { filter: { _id: ObjectId(id) }, update: { $set: { "club.puntos": I(puntos), "club.nivel": nivel } } } };
});
if (bulkClientes.length) db.clientes.bulkWrite(bulkClientes);

// Lista de deseos (favoritos) de la tienda: 60% de los clientes guarda de 1 a 6 productos
const bulkFavoritos = [];
for (const c of clientes) {
  if (rnd() > 0.6) continue;
  const favs = new Set();
  for (let k = entre(1, 6); k > 0; k--) favs.add(elegirPonderado(productosDB, popularidad)._id.toString());
  bulkFavoritos.push({ updateOne: { filter: { _id: c._id }, update: { $set: { favoritos: [...favs].map((id) => ObjectId(id)) } } } });
}
db.clientes.bulkWrite(bulkFavoritos);

// ---------------------------------------------------------------------
// RESEÑAS (de compras reales => compra verificada)
// ---------------------------------------------------------------------
const titulos = {
  5: ["Excelente", "Mi favorito", "Lo vuelvo a comprar", "Increíble duración"],
  4: ["Muy bueno", "Me gustó mucho", "Buena fijación"],
  3: ["Correcto", "Esperaba más", "Está bien"],
  2: ["No me convenció", "Poca duración"],
  1: ["No lo recomiendo", "Malo"]
};
const comentarios = {
  5: ["Dura todo el día y recibo muchos cumplidos.", "Llegó rápido y bien embalado.", "La mejor compra que hice este año."],
  4: ["Muy lindo, aunque el precio es alto.", "Buen producto, la entrega demoró un poco.", "Rinde muchísimo."],
  3: ["Cumple, pero nada especial.", "En mi piel no dura tanto como esperaba."],
  2: ["El aroma cambia mucho después de una hora.", "No me resultó para mi tipo de piel."],
  1: ["Me generó irritación.", "No era lo que esperaba."]
};
const reseñas = [];
const vistos = new Set();
for (const [clienteId, productoId, fecha] of compras) {
  const clave = `${clienteId}-${productoId}`;
  if (vistos.has(clave) || rnd() > 0.12) continue;
  vistos.add(clave);
  const puntaje = elegirPonderado([5, 4, 3, 2, 1], [48, 30, 12, 6, 4]);
  reseñas.push({
    productoId, clienteId, puntaje: I(puntaje),
    titulo: elegir(titulos[puntaje]), comentario: elegir(comentarios[puntaje]),
    compraVerificada: true,
    fecha: new Date(Math.min(fecha.getTime() + 86400000 * entre(3, 40), fin))
  });
}
db.reseñas.insertMany(reseñas);

// Patrón "computed": se guarda el rating resumido dentro del producto
db.reseñas.aggregate([
  { $group: { _id: "$productoId", promedio: { $avg: "$puntaje" }, cantidad: { $sum: 1 } } },
  { $project: { rating: { promedio: { $round: ["$promedio", 2] }, cantidad: { $toInt: "$cantidad" } } } },
  { $merge: { into: "productos", on: "_id", whenMatched: "merge", whenNotMatched: "discard" } }
]);

// ---------------------------------------------------------------------
// CARRITOS abiertos de la tienda (se borran solos a los 30 días por índice TTL)
// ---------------------------------------------------------------------
const carritos = [];
for (let i = 0; i < 300; i++) {
  const items = [];
  for (let k = entre(1, 3); k > 0; k--) {
    const p = elegirPonderado(productosDB, popularidad), v = elegir(p.variantes);
    if (!items.some((it) => it.sku === v.sku)) items.push({ productoId: p._id, sku: v.sku, nombre: `${p.nombre} - ${v.presentacion}`, cantidad: I(1), precio: v.precio });
  }
  carritos.push({
    clienteId: elegir(clientes)._id,
    canal: elegirPonderado(["web", "app"], [72, 28]),
    items,
    actualizado: new Date(Date.now() - 3600000 * entre(1, 24 * 25))
  });
}
db.carritos.insertMany(carritos);

// ---------------------------------------------------------------------
print("\nCarga finalizada. Documentos por colección:");
for (const c of db.getCollectionNames().sort()) print(`  ${c.padEnd(12)} ${db[c].countDocuments()}`);
