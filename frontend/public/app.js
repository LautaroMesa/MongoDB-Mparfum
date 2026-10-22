// =====================================================================
// MPARFUM - lógica del sitio (navegación por hash, sin frameworks)
// =====================================================================
const $app = document.getElementById("app");
const fmt = (n) => "$" + Math.round(n).toLocaleString("es-AR");
const fecha = (d) => new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
const fechaHora = (d) => new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const RUBROS = { fragancia: "Fragancias", maquillaje: "Maquillaje", tratamiento: "Tratamiento", cuerpo: "Cuerpo y baño", cabello: "Cabello", set: "Sets de regalo" };
const GENEROS = { mujer: "Mujer", hombre: "Hombre", unisex: "Unisex" };
const COORDS = { Mendoza: [-68.8458, -32.8895], "San Juan": [-68.5364, -31.5375], "San Luis": [-66.3356, -33.295], Córdoba: [-64.1888, -31.4201], "Buenos Aires": [-58.3816, -34.6037], "Santa Fe": [-60.6393, -32.9468], Neuquén: [-68.0591, -38.9516] };

async function api(url, opciones = {}) {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opciones, body: opciones.body ? JSON.stringify(opciones.body) : undefined });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || "Error de conexión con el servidor");
  return datos;
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2400);
}
const guardado = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ---------- estado: cliente y carrito ----------
let usuario = guardado("mparfum-usuario", null);
let carrito = guardado("mparfum-carrito", []);
function actualizarCabecera() {
  const n = carrito.reduce((s, i) => s + i.cantidad, 0);
  const b = document.getElementById("badge-carrito");
  b.textContent = n; b.hidden = !n;
  document.getElementById("link-cuenta").textContent = usuario ? `Hola, ${usuario.nombre}` : "Ingresar";
}
function guardarCarrito() {
  guardar("mparfum-carrito", carrito);
  actualizarCabecera();
  // El carrito también se guarda en MongoDB (colección carritos, con TTL)
  if (usuario) api(`/api/carritos/${encodeURIComponent(usuario.email)}`, { method: "PUT", body: { items: carrito } }).catch(() => {});
}

// ---------- ilustraciones de producto (SVG generado) ----------
const PALETAS = [["#d9a35b", "#8a5a22"], ["#e7b7c4", "#9c4a64"], ["#b9a3d6", "#5c3f86"], ["#9cc2b4", "#3f6f5f"], ["#e9dccb", "#9a7f5c"], ["#a8b4c8", "#3d4a63"], ["#f0c9a6", "#b0623a"], ["#d0d6a3", "#6b7330"]];
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function ilustracion(p, alto = 160) {
  const [claro, oscuro] = PALETAS[hash(p.nombre + p.marca.nombre) % PALETAS.length];
  const id = "g" + hash(p.nombre).toString(36);
  const grad = `<defs><linearGradient id="${id}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${claro}"/><stop offset="1" stop-color="${oscuro}"/></linearGradient></defs>`;
  const formas = {
    fragancia: `<rect x="44" y="8" width="32" height="26" rx="4" fill="#2b2230"/><rect x="52" y="32" width="16" height="12" fill="#c9b07a"/><rect x="18" y="44" width="84" height="104" rx="16" fill="url(#${id})"/><rect x="30" y="86" width="60" height="26" rx="3" fill="#fff" opacity=".85"/><rect x="26" y="52" width="10" height="84" rx="5" fill="#fff" opacity=".25"/>`,
    maquillaje: `<rect x="42" y="8" width="36" height="40" rx="6" fill="url(#${id})"/><path d="M42 48h36v8H42z" fill="#2b2230" opacity=".4"/><rect x="34" y="56" width="52" height="92" rx="8" fill="#2b2230"/><rect x="40" y="62" width="40" height="5" rx="2" fill="#c9b07a"/>`,
    tratamiento: `<rect x="20" y="56" width="80" height="22" rx="8" fill="#2b2230"/><rect x="16" y="76" width="88" height="72" rx="14" fill="url(#${id})"/><rect x="30" y="100" width="60" height="22" rx="3" fill="#fff" opacity=".85"/>`,
    cuerpo: `<rect x="54" y="6" width="12" height="24" fill="#2b2230"/><path d="M40 14h26v8H40z" fill="#2b2230"/><rect x="44" y="28" width="32" height="14" rx="3" fill="#2b2230"/><rect x="26" y="40" width="68" height="108" rx="18" fill="url(#${id})"/><rect x="36" y="80" width="48" height="30" rx="3" fill="#fff" opacity=".85"/>`,
    cabello: `<circle cx="60" cy="20" r="12" fill="#2b2230"/><rect x="52" y="28" width="16" height="22" fill="#2b2230"/><rect x="28" y="48" width="64" height="100" rx="12" fill="url(#${id})" opacity=".92"/><rect x="38" y="84" width="44" height="28" rx="3" fill="#fff" opacity=".85"/>`,
    set: `<rect x="14" y="58" width="92" height="90" rx="6" fill="url(#${id})"/><rect x="8" y="42" width="104" height="24" rx="5" fill="${oscuro}"/><rect x="54" y="42" width="12" height="106" fill="#c9b07a"/><path d="M60 42c-12-22-34-18-26-4 6 8 26 4 26 4zm0 0c12-22 34-18 26-4-6 8-26 4-26 4z" fill="#c9b07a"/>`
  };
  return `<svg viewBox="0 0 120 156" height="${alto}" role="img" aria-label="${esc(p.nombre)}">${grad}${formas[p.tipo] || formas.tratamiento}</svg>`;
}
const estrellas = (r) => r && r.cantidad ? `<span class="estrellas">${"★".repeat(Math.round(r.promedio))}${"☆".repeat(5 - Math.round(r.promedio))}<span>${r.promedio.toFixed(1)} (${r.cantidad})</span></span>` : `<span class="muted" style="font-size:12px">Sin reseñas</span>`;
function detalleCorto(p) {
  if (p.tipo === "fragancia") return `${p.atributos?.concentracion || ""} · ${p.atributos?.familiaOlfativa || ""}`;
  return `${RUBROS[p.tipo]}${p.presentaciones > 1 ? ` · ${p.presentaciones} opciones` : ""}`;
}
function tarjeta(p) {
  return `<a class="tarjeta" href="#/p/${p._id}">
    <div class="vis">${ilustracion(p)}${!p.disponible ? '<span class="cinta agotado">Sin stock</span>' : p.etiqueta ? `<span class="cinta">${esc(p.etiqueta)}</span>` : p.etiquetas?.includes("best seller") ? '<span class="cinta">Best seller</span>' : p.tipo === "set" ? '<span class="cinta">Edición limitada</span>' : ""}</div>
    <div class="info"><span class="marca">${esc(p.marca.nombre)}</span><span class="nombre">${esc(p.nombre)}</span><span class="detalle">${esc(detalleCorto(p))}</span>${estrellas(p.rating)}
    <span class="precio">${p.presentaciones > 1 ? "<small>desde </small>" : ""}${fmt(p.precioDesde)}</span></div></a>`;
}

// ---------- menú de categorías ----------
async function armarMenu() {
  const cats = await api("/api/categorias");
  document.getElementById("menu").innerHTML = cats.map((c) => `<div><a href="#/catalogo?categoria=${c._id}" data-cat="${c._id}">${esc(c.nombre)}</a>${c.hijos.length ? `<div class="sub">${c.hijos.map((h) => `<a href="#/catalogo?categoria=${h._id}">${esc(h.nombre)}</a>${h.hijos.map((n) => `<a class="nivel3" href="#/catalogo?categoria=${n._id}">${esc(n.nombre)}</a>`).join("")}`).join("")}</div>` : ""}</div>`).join("");
  armarMenu.cats = cats;
}
function nombreCategoria(id) {
  const buscar = (lista) => { for (const c of lista) { if (c._id === id) return c.nombre; const r = buscar(c.hijos); if (r) return r; } };
  return buscar(armarMenu.cats || []) || id;
}

// =====================================================================
// PÁGINAS
// =====================================================================
async function paginaInicioBasica() {
  const destacados = await api("/api/destacados");
  const vis = destacados.slice(0, 3).map((p, i) => ilustracion(p, [190, 240, 170][i])).join("");
  $app.innerHTML = `
    <section class="hero">
      <div class="hero-txt"><span class="eyebrow">Perfumería y cosmética online</span>
        <h1>Tu fragancia, tu piel, tu ritual.</h1>
        <p>Más de 25 marcas: Chanel, Dior, Lancôme, Carolina Herrera, M·A·C, La Roche-Posay y muchas más. Envío a todo el país o retiro gratis en el punto más cercano.</p>
        <a class="btn claro" href="#/catalogo?tipo=fragancia">Ver fragancias</a></div>
      <div class="hero-vis">${vis}</div>
    </section>
    <section class="bloque"><div class="titulo-seccion"><h2>Comprá por categoría</h2></div>
      <div class="rubros">${Object.entries(RUBROS).map(([k, v]) => `<a class="rubro" href="#/catalogo?tipo=${k}">${ilustracion({ tipo: k, nombre: v, marca: { nombre: "" } }, 70)}<b>${v}</b></a>`).join("")}</div></section>
    <section class="bloque"><div class="titulo-seccion"><h2>Los más vendidos</h2><a href="#/catalogo">Ver todo el catálogo →</a></div>
      <div class="grilla">${destacados.map(tarjeta).join("")}</div></section>
    <section class="bloque"><div class="beneficios">
      <div class="beneficio"><b>Envío gratis</b><span class="muted">En compras desde ${fmt(150000)} a todo el país.</span></div>
      <div class="beneficio"><b>Retiro sin cargo</b><span class="muted">En 6 puntos de retiro de Mendoza, San Juan, Córdoba y CABA.</span></div>
      <div class="beneficio"><b>Cuotas sin interés</b><span class="muted">Hasta 6 cuotas con tarjeta de crédito.</span></div></div></section>
    <section class="bloque"><div class="titulo-seccion"><h2>Nuestras marcas</h2></div>
      <div class="marcas-tira">${["chanel:Chanel", "dior:Dior", "lancome:Lancôme", "ysl:Yves Saint Laurent", "carolina-herrera:Carolina Herrera", "tom-ford:Tom Ford", "mac:M·A·C", "estee-lauder:Estée Lauder", "la-roche-posay:La Roche-Posay", "kerastase:Kérastase"].map((m) => { const [id, n] = m.split(":"); return `<a href="#/catalogo?marca=${id}">${n}</a>`; }).join("")}</div></section>`;
}

// ---------- portada armada desde la colección pagina_inicio ----------
let rotacionBanner;
async function paginaInicio() {
  const bloques = await api("/api/inicio").catch(() => []);
  if (!bloques.length) return paginaInicioBasica(); // si no se corrió el script 08
  clearInterval(rotacionBanner);
  const html = [];
  for (const b of bloques) {
    if (b.tipo === "encabezado") {
      document.querySelector(".topbar").textContent = b.barraAnuncios.join(" · ");
      document.getElementById("input-buscar").placeholder = b.buscador.placeholder;
    } else if (b.tipo === "banner_principal" && b.slides.length) {
      html.push(`<section class="carrusel" data-rot="${b.rotacionSegundos || 6}">${b.slides.map((s, i) => `
        <a class="slide ${i ? "" : "activo"}" href="${esc(s.enlace)}" style="background:linear-gradient(120deg, ${s.colores[0]} 0%, ${s.colores[1]} 75%)">
          <div class="slide-txt"><span class="eyebrow">${s.promocion ? "Promoción " + esc(s.promocion) : "Mparfum"}</span><h1>${esc(s.titulo)}</h1><p>${esc(s.subtitulo)}</p><span class="btn claro">${esc(s.textoBoton)}</span></div>
          <div class="slide-vis">${[0, 1, 2].map((k) => ilustracion({ tipo: ["fragancia", "set", "fragancia"][k], nombre: s.titulo + k, marca: { nombre: "" } }, [170, 230, 150][k])).join("")}</div>
        </a>`).join("")}
        ${b.slides.length > 1 ? `<div class="puntos">${b.slides.map((_, i) => `<button aria-label="Banner ${i + 1}" data-i="${i}" class="${i ? "" : "activo"}"></button>`).join("")}</div>` : ""}</section>`);
    } else if (b.tipo === "campanas") {
      html.push(`<section class="bloque"><div class="titulo-seccion"><h2>${esc(b.titulo)}</h2></div><div class="campanas">${b.items.map((c, i) => `
        <a class="campana" href="${esc(c.enlace)}" style="background:linear-gradient(150deg, ${PALETAS[i * 3 % PALETAS.length][1]}, #1f1823)"><span class="eyebrow">${esc(c.marca)}</span><b>${esc(c.titulo)}</b><span>Ver más →</span></a>`).join("")}</div></section>`);
    } else if (b.tipo === "promociones" && b.items.length) {
      html.push(`<section class="bloque"><div class="titulo-seccion"><h2>${esc(b.titulo)}</h2></div><div class="promos">${b.items.map((p) => `
        <div class="promo ${p.estado}"><b>${esc(p.destacado)}</b><span>${esc(p.texto)}</span>${p.estado === "proximamente" ? `<em>Desde el ${fecha(p.desde)}</em>` : `<code>${esc(p.codigo)}</code>`}</div>`).join("")}</div></section>`);
    } else if ((b.tipo === "productos_destacados" || b.tipo === "tendencias") && b.productos.length) {
      html.push(`<section class="bloque"><div class="titulo-seccion"><h2>${esc(b.titulo)}</h2><a href="#/catalogo">Ver todo el catálogo →</a></div><div class="grilla ${b.productos.length % 6 === 0 ? "seis" : "cuatro"}">${b.productos.map(tarjeta).join("")}</div></section>`);
    } else if (b.tipo === "marcas") {
      html.push(`<section class="bloque"><div class="titulo-seccion"><h2>${esc(b.titulo)}</h2></div><div class="marcas-tira">${b.marcas.map((m) => `<a href="#/catalogo?marca=${esc(m.marcaId)}">${esc(m.nombre)}</a>`).join("")}</div></section>`);
    } else if (b.tipo === "seccion_categoria" && b.productos.length) {
      html.push(`<section class="bloque"><div class="titulo-seccion"><div><h2>${esc(b.titulo)}</h2><p class="muted">${esc(b.bajada || "")}</p></div><a href="#/catalogo?categoria=${esc(b.categoria)}">Ver todo →</a></div>
        ${b.subcategorias?.length ? `<div class="chips">${b.subcategorias.map((c) => `<a class="chip" href="#/catalogo?categoria=${esc(c.categoria)}">${esc(c.nombre)}</a>`).join("")}</div>` : ""}
        <div class="grilla cuatro">${b.productos.map(tarjeta).join("")}</div></section>`);
    } else if (b.tipo === "info_envios") {
      html.push(`<section class="bloque"><div class="titulo-seccion"><h2>${esc(b.titulo)}</h2></div><div class="beneficios cuatro">${b.items.map((i) => `<div class="beneficio"><b>${esc(i.titulo)}</b><span class="muted">${esc(i.texto)}</span></div>`).join("")}</div></section>`);
    } else if (b.tipo === "medios_pago") {
      html.push(`<section class="bloque"><div class="titulo-seccion"><h2>${esc(b.titulo)}</h2></div><div class="beneficios cuatro">${b.medios.map((m) => `<div class="beneficio"><b>${esc(m.nombre)}</b><span class="muted">${esc(m.detalle)}${m.cuotasSinInteres ? ` · hasta ${m.cuotasSinInteres} cuotas sin interés` : ""}</span></div>`).join("")}</div>
        ${b.beneficios?.length ? `<div class="chips">${b.beneficios.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>` : ""}</section>`);
    } else if (b.tipo === "accesos") {
      const pie = document.querySelector(".footer-in");
      pie.querySelectorAll(".grupo-accesos").forEach((g) => g.remove());
      pie.querySelectorAll(":scope > div:not(:first-child)").forEach((g) => g.remove());
      pie.insertAdjacentHTML("beforeend", b.grupos.map((g) => `<div class="grupo-accesos"><b>${esc(g.titulo)}</b>${g.enlaces.map((e) => `<a href="${esc(e.enlace)}">${esc(e.texto)}</a>`).join("")}</div>`).join(""));
    }
  }
  $app.innerHTML = html.join("");
  // Rotación automática del banner principal
  const car = $app.querySelector(".carrusel");
  if (car) {
    const slides = car.querySelectorAll(".slide"), puntos = car.querySelectorAll(".puntos button");
    let i = 0;
    const ir = (n) => { slides[i].classList.remove("activo"); puntos[i]?.classList.remove("activo"); i = (n + slides.length) % slides.length; slides[i].classList.add("activo"); puntos[i]?.classList.add("activo"); };
    puntos.forEach((p) => (p.onclick = (e) => { e.preventDefault(); ir(+p.dataset.i); }));
    if (slides.length > 1) rotacionBanner = setInterval(() => ir(i + 1), car.dataset.rot * 1000);
  }
}

async function paginaCatalogo(params) {
  const q = new URLSearchParams(params);
  const datos = await api("/api/productos?" + q);
  const link = (cambios) => { const n = new URLSearchParams(params); for (const [k, v] of Object.entries(cambios)) v == null ? n.delete(k) : n.set(k, v); return "#/catalogo?" + n; };
  const titulo = params.get("q") ? `Resultados para “${esc(params.get("q"))}”` : params.get("categoria") ? esc(nombreCategoria(params.get("categoria"))) : params.get("tipo") ? RUBROS[params.get("tipo")] : "Todo el catálogo";
  const activos = [["tipo", (v) => RUBROS[v]], ["genero", (v) => GENEROS[v]], ["marca", (v) => datos.marcas.find((m) => m._id === v)?.nombre || v], ["categoria", nombreCategoria], ["precioMax", (v) => `Hasta ${fmt(v)}`]]
    .filter(([k]) => params.get(k)).map(([k, f]) => `<a class="chip" href="${link({ [k]: null })}">${esc(f(params.get(k)))} ✕</a>`).join("");
  const maxPrecio = Number(params.get("precioMax") || 700000);
  $app.innerHTML = `
    <div class="migas"><a href="#/">Inicio</a> / ${titulo}</div>
    <div class="catalogo">
      <aside class="filtros">
        <div><h3>Rubro</h3><div class="opciones">${datos.rubros.map((r) => `<a class="${params.get("tipo") === r._id ? "sel" : ""}" href="${link({ tipo: params.get("tipo") === r._id ? null : r._id, categoria: null })}">${RUBROS[r._id]}<span>${r.count}</span></a>`).join("")}</div></div>
        <div><h3>Para</h3><div class="opciones">${datos.generos.map((g) => `<a class="${params.get("genero") === g._id ? "sel" : ""}" href="${link({ genero: params.get("genero") === g._id ? null : g._id })}">${GENEROS[g._id]}<span>${g.count}</span></a>`).join("")}</div></div>
        <div><h3>Marca</h3><div class="opciones">${datos.marcas.map((m) => `<a class="${params.get("marca") === m._id ? "sel" : ""}" href="${link({ marca: params.get("marca") === m._id ? null : m._id })}">${esc(m.nombre)}<span>${m.n}</span></a>`).join("")}</div></div>
        <div><h3>Precio máximo</h3><input id="rango-precio" type="range" min="20000" max="700000" step="10000" value="${maxPrecio}"><div class="fila"><span class="muted">Hasta</span><b id="rango-txt">${fmt(maxPrecio)}</b></div></div>
      </aside>
      <section>
        <div class="barra-cat"><div><h1>${titulo}</h1><p class="muted">${datos.productos.length} productos</p></div>
          <select id="orden" aria-label="Ordenar">${[["relevancia", "Más relevantes"], ["precio-asc", "Menor precio"], ["precio-desc", "Mayor precio"], ["rating", "Mejor puntuados"], ["nombre", "Nombre A-Z"]].map(([v, t]) => `<option value="${v}" ${params.get("orden") === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        ${activos ? `<div class="chips" style="margin-bottom:16px">${activos}</div>` : ""}
        ${datos.productos.length ? `<div class="grilla">${datos.productos.map(tarjeta).join("")}</div>` : `<div class="vacio">No encontramos productos con esos filtros. <a class="btn sec chico" href="#/catalogo">Ver todo</a></div>`}
      </section>
    </div>`;
  document.getElementById("orden").onchange = (e) => (location.hash = link({ orden: e.target.value }));
  const rango = document.getElementById("rango-precio");
  rango.oninput = () => (document.getElementById("rango-txt").textContent = fmt(rango.value));
  rango.onchange = () => (location.hash = link({ precioMax: rango.value >= 700000 ? null : rango.value }));
}

async function paginaProducto(id) {
  const { producto: p, reseñas, tambien } = await api("/api/productos/" + id);
  let sel = p.variantes.find((v) => v.stock > 0) || p.variantes[0];
  let cant = 1;
  const esFav = () => usuario?.favoritos?.includes(p._id);
  const total = p.rating?.cantidad || 0;
  const a = p.atributos || {};
  const nombresAtr = { zona: "Zona", acabado: "Acabado", cobertura: "Cobertura", duracionHoras: "Duración (horas)", fps: "Protección FPS", tipoPiel: "Tipo de piel", beneficios: "Beneficios", ingredientesClave: "Ingredientes clave", efecto: "Efecto", cantidadTonos: "Cantidad de tonos", aroma: "Aroma", textura: "Textura", tipoCabello: "Tipo de cabello", incluye: "Incluye", temporada: "Temporada", perfumista: "Perfumista", lanzamiento: "Lanzamiento", concentracion: "Concentración", familiaOlfativa: "Familia olfativa", hidratante: "Hidratante", aPruebaDeAgua: "A prueba de agua", edicionLimitada: "Edición limitada" };
  const valor = (v) => Array.isArray(v) ? v.join(", ") : v === true ? "Sí" : v === false ? "No" : v;
  const atributos = Object.entries(a).filter(([k]) => k !== "notas").map(([k, v]) => `<div><dt>${nombresAtr[k] || k}</dt><dd>${esc(valor(v))}</dd></div>`).join("");

  $app.innerHTML = `
    <div class="migas"><a href="#/">Inicio</a> / <a href="#/catalogo?tipo=${p.tipo}">${RUBROS[p.tipo]}</a> / <a href="#/catalogo?categoria=${p.categoria._id}">${esc(nombreCategoria(p.categoria._id))}</a> / ${esc(p.nombre)}</div>
    <div class="ficha">
      <div class="ficha-vis">${ilustracion(p, 340)}</div>
      <div class="ficha-info">
        <a class="marca" href="#/catalogo?marca=${p.marca._id}">${esc(p.marca.nombre)}</a>
        <h1>${esc(p.nombre)}</h1>
        ${estrellas(p.rating)}
        <p class="muted">${esc(p.descripcion)}</p>
        <div class="ficha-precio" id="precio"></div>
        <div><b style="font-size:13px">${p.variantes.some((v) => v.tono) ? "Tono" : "Presentación"}</b>
          <div class="variantes" id="variantes" style="margin-top:8px">${p.variantes.map((v) => `<button class="variante" data-sku="${v.sku}" ${v.stock ? "" : "disabled"}>${esc(v.tono || v.presentacion)}<small>${fmt(v.precio)}</small></button>`).join("")}</div></div>
        <span class="stock" id="stock"></span>
        <div class="comprar">
          <div class="cantidad"><button id="menos" aria-label="Menos">−</button><span id="cant">1</span><button id="mas" aria-label="Más">+</button></div>
          <button class="btn" id="agregar">Agregar al carrito</button>
          <button class="btn sec" id="fav">${esFav() ? "♥ En favoritos" : "♡ Favorito"}</button>
        </div>
        ${a.notas ? `<div class="caja"><h3>Pirámide olfativa</h3><div class="piramide">${[["Salida", a.notas.salida], ["Corazón", a.notas.corazon], ["Fondo", a.notas.fondo]].filter(([, n]) => n).map(([t, n]) => `<div><b>${t}</b><span>${esc(n.join(" · "))}</span></div>`).join("")}</div></div>` : ""}
        ${atributos ? `<div class="caja"><h3>Características</h3><dl class="atributos">${atributos}</dl></div>` : ""}
      </div>
    </div>
    <section class="bloque"><h2>Opiniones</h2>
      ${total ? `<div class="resenas">
        <div class="caja"><b style="font-size:40px;line-height:1">${p.rating.promedio.toFixed(1)}</b>${estrellas(p.rating)}
          <div class="dist">${[5, 4, 3, 2, 1].map((n) => { const c = p.distribucion[n] || 0; return `<div><span>${n}★</span><i><em style="width:${(c / total) * 100}%"></em></i><span class="muted num">${c}</span></div>`; }).join("")}</div></div>
        <div>${reseñas.map((r) => `<div class="resena"><span class="estrellas">${"★".repeat(r.puntaje)}${"☆".repeat(5 - r.puntaje)}</span><b>${esc(r.titulo)}</b><p>${esc(r.comentario)}</p><span class="muted" style="font-size:12.5px">${esc(r.autor)} · ${esc(r.ciudad || "")} · ${fecha(r.fecha)} ${r.compraVerificada ? '· <span class="verificada">✓ Compra verificada</span>' : ""}</span></div>`).join("")}</div>
      </div>` : `<p class="muted">Todavía no hay opiniones de este producto.</p>`}
    </section>
    ${tambien.length ? `<section class="bloque"><h2>Quienes compraron este producto también compraron</h2><div class="grilla">${tambien.map(tarjeta).join("")}</div></section>` : ""}`;

  function pintar() {
    document.querySelectorAll(".variante").forEach((b) => b.setAttribute("aria-pressed", b.dataset.sku === sel.sku));
    const cuota = sel.precio / 6;
    document.getElementById("precio").innerHTML = `${fmt(sel.precio)}<small>6 cuotas sin interés de ${fmt(cuota)}</small>`;
    const st = document.getElementById("stock");
    st.className = "stock " + (!sel.stock ? "sin" : sel.stock <= 5 ? "poco" : "ok");
    st.textContent = !sel.stock ? "Sin stock" : sel.stock <= 5 ? `¡Últimas ${sel.stock} unidades!` : "En stock · despacho en 24 h";
    document.getElementById("cant").textContent = cant;
    document.getElementById("agregar").disabled = !sel.stock;
  }
  document.getElementById("variantes").onclick = (e) => { const b = e.target.closest(".variante"); if (b && !b.disabled) { sel = p.variantes.find((v) => v.sku === b.dataset.sku); cant = 1; pintar(); } };
  document.getElementById("menos").onclick = () => { cant = Math.max(1, cant - 1); pintar(); };
  document.getElementById("mas").onclick = () => { cant = Math.min(5, sel.stock, cant + 1); pintar(); };
  document.getElementById("agregar").onclick = () => {
    const ex = carrito.find((i) => i.sku === sel.sku);
    if (ex) ex.cantidad = Math.min(5, ex.cantidad + cant);
    else carrito.push({ productoId: p._id, sku: sel.sku, nombre: `${p.nombre} - ${sel.tono || sel.presentacion}`, marca: p.marca.nombre, tipo: p.tipo, precio: sel.precio, cantidad: cant });
    guardarCarrito(); toast("Agregado al carrito");
  };
  document.getElementById("fav").onclick = async () => {
    if (!usuario) { toast("Ingresá con una cuenta para guardar favoritos"); location.hash = "#/cuenta"; return; }
    usuario.favoritos = await api(`/api/clientes/${encodeURIComponent(usuario.email)}/favoritos`, { method: "POST", body: { productoId: p._id, quitar: esFav() } });
    guardar("mparfum-usuario", usuario);
    document.getElementById("fav").textContent = esFav() ? "♥ En favoritos" : "♡ Favorito";
    toast(esFav() ? "Guardado en favoritos" : "Quitado de favoritos");
  };
  pintar();
}

async function paginaCarrito() {
  if (!carrito.length) {
    $app.innerHTML = `<h1>Tu carrito</h1><div class="vacio" style="margin-top:20px">Tu carrito está vacío.<br><br><a class="btn" href="#/catalogo">Ir al catálogo</a></div>`;
    return;
  }
  const estado = { cupon: "", envio: "domicilio", punto: null, medio: "credito", cuotas: 6 };
  const provincia = usuario?.direcciones?.[0]?.provincia || "Mendoza";
  const [lng, lat] = COORDS[provincia] || COORDS.Mendoza;
  const puntos = await api(`/api/puntos-retiro?lng=${lng}&lat=${lat}`);
  estado.punto = puntos[0]?._id;

  $app.innerHTML = `<h1>Tu carrito</h1>
    <div class="carrito" style="margin-top:20px">
      <section>
        <div id="items"></div>
        <div class="caja" style="margin-top:20px"><h3>Entrega</h3>
          <label class="opcion-envio"><input type="radio" name="envio" value="domicilio" checked><span><b>Envío a domicilio</b><br><span class="muted">${usuario ? esc(`${usuario.direcciones[0].calle}, ${usuario.direcciones[0].ciudad}`) : "A la dirección de tu cuenta"} · Andreani · 24 a 72 h</span></span></label>
          <label class="opcion-envio"><input type="radio" name="envio" value="retiro"><span><b>Retiro gratis en punto de retiro</b><br><span class="muted">Los más cercanos a ${esc(provincia)} (búsqueda geoespacial)</span></span></label>
          <div id="puntos" hidden class="campo"><select id="punto">${puntos.map((x) => `<option value="${x._id}">${esc(x.nombre)} · ${esc(x.direccion.calle)} · ${x.km} km</option>`).join("")}</select></div>
        </div>
        <div class="caja" style="margin-top:14px"><h3>Pago</h3>
          <div class="en-linea"><label class="campo" style="flex:1">Medio de pago<select id="medio"><option value="credito">Tarjeta de crédito</option><option value="debito">Tarjeta de débito</option><option value="mercadopago">Mercado Pago</option><option value="transferencia">Transferencia</option></select></label>
          <label class="campo" id="campo-cuotas" style="flex:1">Cuotas<select id="cuotas"><option value="1">1 pago</option><option value="3">3 cuotas sin interés</option><option value="6" selected>6 cuotas sin interés</option></select></label></div>
        </div>
      </section>
      <aside class="caja resumen">
        <h3>Resumen</h3>
        <label class="campo">Cupón de descuento<div class="en-linea"><input id="cupon" placeholder="Ej.: BIENVENIDA10"><button class="btn sec chico" id="aplicar">Aplicar</button></div></label>
        <span id="msg-cupon"></span>
        <div id="totales"></div>
        ${usuario ? `<button class="btn" id="confirmar">Confirmar compra</button><p class="muted" style="font-size:12.5px">Comprás como ${esc(usuario.email)}</p>` : `<a class="btn" href="#/cuenta">Ingresá para comprar</a>`}
        <span id="msg-compra"></span>
      </aside>
    </div>`;

  function pintarItems() {
    document.getElementById("items").innerHTML = carrito.map((i, k) => `<div class="item-carrito">
      <div class="mini">${ilustracion({ tipo: i.tipo, nombre: i.nombre.split(" - ")[0], marca: { nombre: i.marca } }, 60)}</div>
      <div><span class="muted" style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${esc(i.marca)}</span><br><b>${esc(i.nombre)}</b><br>
        <div class="en-linea" style="margin-top:6px;align-items:center"><div class="cantidad"><button data-k="${k}" data-d="-1">−</button><span>${i.cantidad}</span><button data-k="${k}" data-d="1">+</button></div><button class="quitar" data-quitar="${k}">Quitar</button></div></div>
      <b class="num">${fmt(i.precio * i.cantidad)}</b></div>`).join("");
  }
  async function cotizar() {
    try {
      const r = await api("/api/carrito/cotizar", { method: "POST", body: { items: carrito, cupon: estado.cupon, envio: estado.envio } });
      const msg = document.getElementById("msg-cupon");
      msg.className = r.errorCupon ? "error-txt" : "ok-txt";
      msg.textContent = r.errorCupon || (r.cupon.codigo ? `✓ ${r.cupon.descripcion}` : "");
      const falta = r.envioGratisDesde - (r.subtotal - r.cupon.descuento);
      document.getElementById("totales").innerHTML = `
        <div class="fila"><span>Subtotal</span><span class="num">${fmt(r.subtotal)}</span></div>
        ${r.cupon.descuento ? `<div class="fila desc"><span>Descuento ${esc(r.cupon.codigo)}</span><span class="num">−${fmt(r.cupon.descuento)}</span></div>` : ""}
        <div class="fila"><span>Envío</span><span class="num">${r.envio ? fmt(r.envio) : "Gratis"}</span></div>
        ${estado.envio === "domicilio" && falta > 0 ? `<p class="muted" style="font-size:12.5px">Te faltan ${fmt(falta)} para el envío gratis.</p>` : ""}
        <div class="fila total"><span>Total</span><span class="num">${fmt(r.total)}</span></div>
        ${estado.medio === "credito" && estado.cuotas > 1 ? `<p class="ok-txt">${estado.cuotas} cuotas sin interés de ${fmt(r.total / estado.cuotas)}</p>` : ""}`;
    } catch (e) { document.getElementById("totales").innerHTML = `<p class="error-txt">${esc(e.message)}</p>`; }
  }
  document.getElementById("items").onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.quitar != null) carrito.splice(+b.dataset.quitar, 1);
    else { const it = carrito[+b.dataset.k]; it.cantidad = Math.max(1, Math.min(5, it.cantidad + +b.dataset.d)); }
    guardarCarrito();
    if (!carrito.length) return paginaCarrito();
    pintarItems(); cotizar();
  };
  document.querySelectorAll("input[name=envio]").forEach((r) => (r.onchange = () => { estado.envio = r.value; document.getElementById("puntos").hidden = r.value !== "retiro"; cotizar(); }));
  document.getElementById("punto").onchange = (e) => (estado.punto = e.target.value);
  document.getElementById("medio").onchange = (e) => { estado.medio = e.target.value; document.getElementById("campo-cuotas").hidden = estado.medio !== "credito"; cotizar(); };
  document.getElementById("cuotas").onchange = (e) => { estado.cuotas = +e.target.value; cotizar(); };
  document.getElementById("aplicar").onclick = () => { estado.cupon = document.getElementById("cupon").value; cotizar(); };
  const conf = document.getElementById("confirmar");
  if (conf) conf.onclick = async () => {
    conf.disabled = true; conf.textContent = "Procesando…";
    try {
      const r = await api("/api/pedidos", { method: "POST", body: { email: usuario.email, items: carrito, cupon: estado.cupon || undefined, envio: { tipo: estado.envio, puntoRetiro: estado.punto }, pago: { medio: estado.medio, cuotas: estado.cuotas } } });
      carrito = []; guardarCarrito();
      $app.innerHTML = `<div class="caja" style="max-width:620px;margin:20px auto;text-align:center;align-items:center;padding:36px">
        <span class="eyebrow">¡Gracias por tu compra!</span><h1>Pedido N° ${r.numero}</h1>
        <p class="muted">Total ${fmt(r.total)}. Lo despacha el depósito ${esc(r.deposito)}. ${r.transaccion ? "El stock se reservó y el pedido se registró en una única transacción de MongoDB." : "El stock ya quedó reservado en la base."}</p>
        <div class="en-linea"><a class="btn" href="#/seguimiento?codigo=${r.numero}">Seguir mi pedido</a><a class="btn sec" href="#/cuenta">Mis pedidos</a></div></div>`;
    } catch (e) {
      conf.disabled = false; conf.textContent = "Confirmar compra";
      const m = document.getElementById("msg-compra"); m.className = "error-txt"; m.textContent = e.message;
    }
  };
  pintarItems(); cotizar();
}

async function paginaCuenta() {
  if (!usuario) {
    const demo = await api("/api/clientes/demo");
    $app.innerHTML = `<h1>Ingresar</h1><p class="muted" style="margin:8px 0 20px">Para la demostración elegí una de las cuentas cargadas en la base, o escribí el email de cualquier cliente de la colección <b>clientes</b>.</p>
      <div class="cuentas-demo">${demo.map((c) => `<button class="cuenta-demo" data-email="${esc(c.email)}"><span class="nivel ${c.club.nivel}">${c.club.nivel}</span><b>${esc(c.nombre)} ${esc(c.apellido)}</b><span class="muted" style="font-size:13px">${esc(c.email)}</span><span class="muted" style="font-size:12.5px">${esc(c.provincia)} · ${c.club.puntos} puntos</span></button>`).join("")}</div>
      <form class="caja" id="form-email" style="margin-top:20px;max-width:480px"><label class="campo">Email<div class="en-linea"><input id="email" type="email" required placeholder="nombre.apellido123@gmail.com"><button class="btn chico">Ingresar</button></div></label><span id="msg-login" class="error-txt"></span></form>`;
    const entrar = async (email) => {
      try { usuario = await api("/api/clientes/" + encodeURIComponent(email)); guardar("mparfum-usuario", usuario); actualizarCabecera(); paginaCuenta(); }
      catch (e) { document.getElementById("msg-login").textContent = e.message; }
    };
    document.querySelectorAll(".cuenta-demo").forEach((b) => (b.onclick = () => entrar(b.dataset.email)));
    document.getElementById("form-email").onsubmit = (e) => { e.preventDefault(); entrar(document.getElementById("email").value); };
    return;
  }
  usuario = await api("/api/clientes/" + encodeURIComponent(usuario.email));
  guardar("mparfum-usuario", usuario);
  const [pedidos, favoritos] = await Promise.all([api(`/api/clientes/${encodeURIComponent(usuario.email)}/pedidos`), api(`/api/clientes/${encodeURIComponent(usuario.email)}/favoritos`)]);
  const d = usuario.direcciones[0];
  $app.innerHTML = `
    <div class="titulo-seccion"><div><span class="eyebrow">Mi cuenta</span><h1>${esc(usuario.nombre)} ${esc(usuario.apellido)}</h1></div><button class="btn sec chico" id="salir">Cerrar sesión</button></div>
    <div class="kpis" style="margin-top:20px">
      <div class="kpi"><span>Club Mparfum</span><b><span class="nivel ${usuario.club.nivel}">${usuario.club.nivel}</span></b></div>
      <div class="kpi"><span>Puntos acumulados</span><b>${usuario.club.puntos}</b></div>
      <div class="kpi"><span>Pedidos</span><b>${pedidos.length}${pedidos.length === 20 ? "+" : ""}</b></div>
      <div class="kpi"><span>Envío a</span><b style="font-size:15px">${esc(d.calle)}, ${esc(d.ciudad)}</b></div>
    </div>
    <section class="bloque"><h2>Mis pedidos</h2><div class="caja">${pedidos.length ? pedidos.map((p) => `<a class="pedido-fila" href="#/seguimiento?codigo=${p.numero}">
      <b>N° ${p.numero}</b><span><span class="muted">${fecha(p.fecha)} · </span>${esc(p.items.map((i) => i.nombre.split(" - ")[0]).join(", "))}</span><span class="estado ${p.estado}">${p.estado}</span><b class="num">${fmt(p.total)}</b></a>`).join("") : '<p class="muted">Todavía no hiciste compras.</p>'}</div></section>
    <section class="bloque"><h2>Mis favoritos</h2>${favoritos.length ? `<div class="grilla">${favoritos.map(tarjeta).join("")}</div>` : '<p class="muted">Guardá productos tocando “♡ Favorito” en su ficha.</p>'}</section>`;
  document.getElementById("salir").onclick = () => { usuario = null; guardar("mparfum-usuario", null); actualizarCabecera(); paginaCuenta(); };
}

async function paginaSeguimiento(params) {
  const codigo = params.get("codigo") || "";
  $app.innerHTML = `<div style="max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:20px">
    <div><span class="eyebrow">Seguimiento</span><h1>¿Dónde está mi pedido?</h1></div>
    <form class="caja" id="form-seg"><label class="campo">Número de pedido o código de seguimiento<div class="en-linea"><input id="codigo" value="${esc(codigo)}" placeholder="Ej.: 105000 o AND0000100003"><button class="btn chico">Buscar</button></div></label></form>
    <div id="resultado"></div></div>`;
  document.getElementById("form-seg").onsubmit = (e) => { e.preventDefault(); location.hash = "#/seguimiento?codigo=" + encodeURIComponent(document.getElementById("codigo").value.trim()); };
  if (!codigo) return;
  const res = document.getElementById("resultado");
  try {
    const p = await api("/api/seguimiento/" + encodeURIComponent(codigo));
    const pasos = p.estado === "cancelado" ? ["pendiente", "cancelado"] : ["pendiente", "pagado", "preparando", "enviado", "entregado"];
    const nombres = { pendiente: "Pedido recibido", pagado: "Pago aprobado", preparando: "Preparando tu pedido", enviado: p.envio.tipo === "retiro" ? "En camino al punto de retiro" : "En camino", entregado: p.envio.tipo === "retiro" ? "Listo / retirado" : "Entregado", cancelado: "Cancelado" };
    const cuando = Object.fromEntries(p.historialEstados.map((h) => [h.estado, h.fecha]));
    res.innerHTML = `<div class="caja">
      <div class="titulo-seccion"><h2>Pedido N° ${p.numero}</h2><span class="estado ${p.estado}">${p.estado}</span></div>
      <p class="muted">${fecha(p.fecha)} · ${esc(p.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(", "))} · Total ${fmt(p.total)}</p>
      <p>${p.envio.tipo === "retiro" ? `Retiro en <b>${esc(p.envio.punto?.nombre || p.envio.puntoRetiro)}</b> · ${esc(p.envio.punto?.direccion.calle || "")} · ${esc(p.envio.punto?.horario || "")}` : `Envío a domicilio por <b>${esc(p.envio.empresa)}</b>${p.envio.tracking ? ` · Código <b>${esc(p.envio.tracking)}</b>` : ""} · ${esc(p.envio.direccion?.ciudad || "")}`}</p>
      <div class="linea-tiempo" style="margin-top:8px">${pasos.map((s) => `<div class="hito ${cuando[s] ? "hecho" : ""}"><div class="punto"><i></i><em></em></div><div><b>${nombres[s]}</b><br><span class="muted" style="font-size:13px">${cuando[s] ? fechaHora(cuando[s]) : "Pendiente"}</span></div></div>`).join("")}</div></div>`;
  } catch (e) { res.innerHTML = `<div class="vacio">${esc(e.message)}</div>`; }
}

async function paginaAdmin() {
  const r = await api("/api/admin/resumen");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const max = Math.max(...r.porMes.map((m) => m.total), 1);
  const W = 640, H = 220, pad = 30, ancho = (W - pad * 2) / Math.max(r.porMes.length, 1);
  const barras = r.porMes.map((m, i) => {
    const h = (m.total / max) * (H - 60), x = pad + i * ancho + ancho * 0.18, y = H - 26 - h;
    return `<rect x="${x}" y="${y}" width="${ancho * 0.64}" height="${h}" rx="3" fill="var(--berry)"/><text x="${x + ancho * 0.32}" y="${H - 8}" text-anchor="middle">${meses[+m._id.slice(5) - 1]}</text><text class="valor" x="${x + ancho * 0.32}" y="${y - 6}" text-anchor="middle">${(m.total / 1e6).toFixed(0)}M</text>`;
  }).join("");
  const totalRubros = r.porRubro.reduce((s, x) => s + x.total, 0);
  $app.innerHTML = `
    <div><span class="eyebrow">Panel de administración</span><h1>Resumen ${new Date().getFullYear()}</h1><p class="muted">Calculado en vivo con agregaciones sobre la colección pedidos.</p></div>
    <div class="kpis" style="margin-top:20px">
      <div class="kpi"><span>Facturación del año</span><b>${fmt(r.kpis.facturacion || 0)}</b></div>
      <div class="kpi"><span>Pedidos</span><b>${(r.kpis.pedidos || 0).toLocaleString("es-AR")}</b></div>
      <div class="kpi"><span>Ticket promedio</span><b>${fmt(r.kpis.ticket || 0)}</b></div>
      <div class="kpi"><span>Clientes que compraron</span><b>${(r.kpis.clientes || 0).toLocaleString("es-AR")}</b></div>
    </div>
    <div class="admin-grid" style="margin-top:16px">
      <div class="caja"><h3>Facturación por mes (millones de $)</h3><div class="scroll-x"><svg class="grafico" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Facturación mensual">${barras}</svg></div></div>
      <div class="caja"><h3>Participación por rubro</h3><div class="barras-h">${r.porRubro.map((x) => { const pc = (x.total / totalRubros) * 100; return `<div><span>${RUBROS[x._id]}</span><i style="width:${Math.max(pc, 1)}%"></i><b class="num">${pc.toFixed(0)}%</b></div>`; }).join("")}</div>
        <p class="muted" style="font-size:12.5px">Carritos abandonados (más de 3 días): <b>${r.carritos.n}</b> por ${fmt(r.carritos.monto)}</p></div>
      <div class="caja"><h3>Productos más vendidos</h3><div class="scroll-x"><table class="tabla"><thead><tr><th>Producto</th><th class="der">Unid.</th><th class="der">Facturación</th></tr></thead><tbody>${r.top.map((t) => `<tr><td><b>${esc(t.nombre)}</b><br><span class="muted">${esc(t.marca)}</span></td><td class="der num">${t.unidades}</td><td class="der num">${fmt(t.total)}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="caja"><h3>Stock bajo en depósitos</h3><div class="scroll-x"><table class="tabla"><thead><tr><th>Producto</th><th>Depósito</th><th class="der">Stock</th></tr></thead><tbody>${r.stockBajo.map((s) => `<tr><td><b>${esc(s.producto)}</b><br><span class="muted">${esc(s.presentacion)}</span></td><td>${esc(s.deposito)}</td><td class="der num" style="color:${s.cantidad ? "var(--warn)" : "var(--bad)"};font-weight:700">${s.cantidad}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">Sin alertas</td></tr>'}</tbody></table></div></div>
    </div>
    <section class="bloque"><div class="caja"><h3>Cola de despacho (pedidos pagados o en preparación)</h3><div class="scroll-x"><table class="tabla"><thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Depósito</th><th>Entrega</th><th>Estado</th><th></th></tr></thead>
      <tbody>${r.cola.map((p) => `<tr><td><a href="#/seguimiento?codigo=${p.numero}"><b>${p.numero}</b></a></td><td>${fecha(p.fecha)}</td><td>${esc(p.cliente.nombre)}</td><td>${esc(p.deposito)}</td><td>${p.envio.tipo === "retiro" ? "Retiro" : "Domicilio"}</td><td><span class="estado ${p.estado}">${p.estado}</span></td><td><button class="btn sec chico" data-avanzar="${p.numero}">Avanzar estado</button></td></tr>`).join("") || '<tr><td colspan="7" class="muted">No hay pedidos pendientes</td></tr>'}</tbody></table></div></div></section>`;
  $app.querySelectorAll("[data-avanzar]").forEach((b) => (b.onclick = async () => {
    try { const x = await api(`/api/admin/pedidos/${b.dataset.avanzar}/avanzar`, { method: "POST" }); toast(`Pedido ${x.numero}: ${x.estado}${x.tracking ? ` · tracking ${x.tracking}` : ""}`); paginaAdmin(); }
    catch (e) { toast(e.message); }
  }));
}

// =====================================================================
// NAVEGACIÓN
// =====================================================================
async function navegar() {
  const [ruta, qs] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(qs || "");
  const partes = ruta.split("/").filter(Boolean);
  document.querySelectorAll(".menu a[data-cat]").forEach((a) => a.classList.toggle("activo", params.get("categoria") === a.dataset.cat));
  document.getElementById("input-buscar").value = params.get("q") || "";
  window.scrollTo({ top: 0 });
  clearInterval(rotacionBanner);
  try {
    if (!partes.length) await paginaInicio();
    else if (partes[0] === "catalogo") await paginaCatalogo(params);
    else if (partes[0] === "p") await paginaProducto(partes[1]);
    else if (partes[0] === "carrito") await paginaCarrito();
    else if (partes[0] === "cuenta") await paginaCuenta();
    else if (partes[0] === "seguimiento") await paginaSeguimiento(params);
    else if (partes[0] === "admin") await paginaAdmin();
    else $app.innerHTML = `<div class="vacio">Página no encontrada. <a class="btn sec chico" href="#/">Volver al inicio</a></div>`;
  } catch (e) {
    $app.innerHTML = `<div class="vacio"><b>No se pudo cargar la página.</b><br>${esc(e.message)}<br><br>Revisá que el servidor (npm start) y MongoDB estén encendidos.</div>`;
  }
}
document.getElementById("form-buscar").onsubmit = (e) => {
  e.preventDefault();
  const q = document.getElementById("input-buscar").value.trim();
  location.hash = q ? "#/catalogo?q=" + encodeURIComponent(q) : "#/catalogo";
};
window.addEventListener("hashchange", navegar);
actualizarCabecera();
armarMenu().catch(() => {}).finally(navegar);
