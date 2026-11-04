/* =========================================================
   Efeitos visuais e sonoros da ficha (v3.8)
   - cores e símbolos dos elementos
   - rolagem dramática (crítico / 1 natural)
   - animação de conjurar ritual
   Usado pela ficha (app.js), pela tela de efeito dos outros
   jogadores (efeito.html) e pelo fundo (selo no token).
   ========================================================= */

export const EL_COR = { Sangue: "#e0142f", Morte: "#b4b4c2", Conhecimento: "#e8b520", Energia: "#a65cff", Medo: "#f4f4ff" };
export const EL_COR2 = { Sangue: "#5a0010", Morte: "#26262e", Conhecimento: "#4a3500", Energia: "#1a5e7a", Medo: "#3c3c4c" };
export const ELEMENTOS = Object.keys(EL_COR);
export const corDe = (el) => EL_COR[el] || "#d0122f";

/* Símbolos próprios (desenhados para a extensão), em 24×24 */
const GLIFO = {
  Sangue: `<path d="M12 2.5C12 2.5 5.2 10.4 5.2 15.1a6.8 6.8 0 0 0 13.6 0C18.8 10.4 12 2.5 12 2.5Z" fill="currentColor"/><path d="M9 15.5a3 3 0 0 0 2.6 3" stroke="#000" stroke-opacity=".45" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  Morte: `<g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 3h12M6 21h12"/><path d="M7.5 3c0 5 9 6 9 9s-9 4-9 9M16.5 3c0 5-9 6-9 9s9 4 9 9"/></g><path d="M9.6 19.4h4.8L12 16.6z" fill="currentColor"/>`,
  Conhecimento: `<path d="M2 12s3.8-6.6 10-6.6S22 12 22 12s-3.8 6.6-10 6.6S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.3" fill="currentColor"/><path d="M12 2v2.2M12 19.8V22M4.5 4.5l1.5 1.5M19.5 4.5 18 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  Energia: `<path d="M13.4 2 4.6 13.6h6.6L10.4 22l9-11.8h-6.7Z" fill="currentColor"/>`,
  Medo: `<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.2 2"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/>`,
};
export function glifo(el, tam = 16, extra = "") {
  const g = GLIFO[el]; if (!g) return "";
  return `<svg class="glifo ${extra}" viewBox="0 0 24 24" width="${tam}" height="${tam}" style="color:${corDe(el)}" aria-hidden="true">${g}</svg>`;
}

/* Selo do ritual (círculo, runas e o símbolo no centro), em 200×200 */
const FORMA = {
  Sangue: `<path d="M100 172 35 58h130Z"/><path d="M100 28 165 142H35Z" opacity=".5"/>`,
  Morte: `<path d="M100 22a78 78 0 1 1-55 23" /><path d="M100 46a54 54 0 1 1-38 16" /><path d="M100 70a30 30 0 1 1-21 9" />`,
  Conhecimento: `<rect x="45" y="45" width="110" height="110" transform="rotate(45 100 100)"/><rect x="58" y="58" width="84" height="84"/>`,
  Energia: `<path d="M100 18 116 70 172 52 132 96 178 132 120 128 112 182 92 132 34 150 70 104 26 64 84 72Z"/>`,
  Medo: `<circle cx="100" cy="100" r="64"/><circle cx="100" cy="100" r="44" stroke-dasharray="6 9"/><circle cx="100" cy="36" r="6"/><circle cx="100" cy="164" r="6"/><circle cx="36" cy="100" r="6"/><circle cx="164" cy="100" r="6"/>`,
};
export function seloSVG(el, { brilho = true, id = "s" } = {}) {
  const c = corDe(el);
  const runas = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2; const x = 100 + Math.cos(a) * 79, y = 100 + Math.sin(a) * 79; const r = (a * 180) / Math.PI + 90;
    const tipo = i % 3;
    const d = tipo === 0 ? "M-3 -4 3 -4 0 4Z" : tipo === 1 ? "M-3 -4V4M3 -4V4M-3 0H3" : "M-4 -2 0 -5 4 -2 0 5Z";
    return `<path d="${d}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${r.toFixed(0)})"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  ${brilho ? `<defs><filter id="${id}g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` : ""}
  <g fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round" ${brilho ? `filter="url(#${id}g)"` : ""}>
    <g class="anel"><circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="86" stroke-width="1.2"/><g fill="${c}" stroke="none">${runas}</g><circle cx="100" cy="100" r="71" stroke-width="1.2"/></g>
    <g class="forma">${FORMA[el] || FORMA.Conhecimento}</g>
  </g>
  <g transform="translate(76 76) scale(2)" style="color:${c}" ${brilho ? `filter="url(#${id}g)"` : ""}>${GLIFO[el] || GLIFO.Conhecimento}</g>
</svg>`;
}

/* ---------- Estilos das camadas de efeito (injetados uma vez) ---------- */
const CSS = `
.fxcam { position: fixed; inset: 0; z-index: 90; pointer-events: none; display: grid; place-items: center; overflow: hidden; font-family: Oswald, "Arial Narrow", sans-serif; }
.fxcam.clicavel { pointer-events: auto; cursor: pointer; }
.fxcam .veu { position: absolute; inset: 0; opacity: 0; animation: fxveu var(--dur) ease forwards; }
@keyframes fxveu { 0% { opacity: 0; } 15% { opacity: 1; } 75% { opacity: 1; } 100% { opacity: 0; } }
.fxcam .bloco { position: relative; display: grid; justify-items: center; gap: 4px; text-align: center; padding: 0 12px; animation: fxbloco var(--dur) cubic-bezier(.2,.9,.3,1.2) forwards; }
@keyframes fxbloco { 0% { transform: scale(.4); opacity: 0; } 12% { transform: scale(1.12); opacity: 1; } 22% { transform: scale(1); } 80% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.04); } }
.fxcam .titulo { font-weight: 700; font-size: clamp(34px, 11vw, 96px); line-height: .95; letter-spacing: .02em; text-transform: uppercase; }
.fxcam .sub { font-family: "Crimson Pro", Georgia, serif; font-size: clamp(14px, 3.6vw, 22px); color: #fff; text-shadow: 0 2px 6px #000, 0 0 2px #000; max-width: 90vw; }
.fxcam .nome { font-size: clamp(13px, 3vw, 18px); letter-spacing: .25em; text-transform: uppercase; color: #fff; text-shadow: 0 2px 6px #000; }
/* crítico */
.fx-crit .veu { background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--c) 40%, transparent), rgba(0,0,0,.55) 70%); }
.fx-crit .raios { position: absolute; width: 160vmax; height: 160vmax; left: 50%; top: 50%; margin: -80vmax 0 0 -80vmax; opacity: 0;
  background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--c) 45%, transparent) 0 5deg, transparent 5deg 15deg);
  -webkit-mask: radial-gradient(circle, #000 0 8%, transparent 45%); mask: radial-gradient(circle, #000 0 8%, transparent 45%);
  animation: fxraios var(--dur) ease-out forwards; }
@keyframes fxraios { 0% { opacity: 0; transform: rotate(0) scale(.6); } 15% { opacity: 1; } 75% { opacity: .8; } 100% { opacity: 0; transform: rotate(40deg) scale(1.1); } }
.fx-crit .titulo { color: #fff; text-shadow: 0 0 18px var(--c), 0 0 42px var(--c), 4px 4px 0 #000; -webkit-text-stroke: 1.5px var(--c); }
.fx-crit .faisca { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px var(--c); left: 50%; top: 50%; opacity: 0; animation: fxfaisca 1.3s ease-out forwards; }
@keyframes fxfaisca { 0% { opacity: 1; transform: translate(0,0) scale(1); } 100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(.3); } }
/* 1 natural */
.fx-nat1 .veu { background: rgba(0,0,0,.7); backdrop-filter: grayscale(1); -webkit-backdrop-filter: grayscale(1); }
.fx-nat1 .titulo { color: #bdbdc4; text-shadow: 3px 3px 0 #000; animation: fxcai var(--dur) ease-in forwards; }
@keyframes fxcai { 0%, 55% { transform: none; } 62% { transform: rotate(-3deg) translateY(4px); } 100% { transform: rotate(-9deg) translateY(60px); opacity: .2; } }
.fx-nat1 .rachas { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; animation: fxracha var(--dur) steps(1, end) forwards; }
@keyframes fxracha { 0% { opacity: 0; } 8% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; } }
.fx-nat1 .rachas path { fill: none; stroke: rgba(255,255,255,.75); stroke-width: 1.3; stroke-dasharray: 800; stroke-dashoffset: 800; animation: fxtraco .35s .1s ease-out forwards; }
@keyframes fxtraco { to { stroke-dashoffset: 0; } }
/* ritual */
.fx-ritual .veu { background: radial-gradient(circle at 50% 46%, color-mix(in srgb, var(--c) 28%, transparent), rgba(0,0,0,.72) 62%); }
.fx-ritual .selo { width: min(62vw, 62vh, 340px); height: auto; animation: fxselo var(--dur) ease forwards; filter: drop-shadow(0 0 12px var(--c)); }
@keyframes fxselo { 0% { transform: scale(.55) rotate(-30deg); opacity: 0; } 20% { opacity: 1; } 70% { transform: scale(1) rotate(25deg); opacity: 1; } 100% { transform: scale(1.25) rotate(40deg); opacity: 0; } }
.fx-ritual .selo .anel, .fx-ritual .selo .forma { stroke-dasharray: 1400; stroke-dashoffset: 1400; animation: fxtraco 1.1s ease-out forwards; }
.fx-ritual .selo .forma { animation-delay: .35s; }
.fx-ritual .bloco { position: absolute; bottom: 12%; animation: fxbloco var(--dur) ease forwards; }
.fx-ritual .titulo { font-size: clamp(22px, 7vw, 48px); color: #fff; text-shadow: 0 0 14px var(--c), 3px 3px 0 #000; }
.fx-ritual .brasa { position: absolute; bottom: -10px; width: 5px; height: 5px; border-radius: 50%; background: var(--c); box-shadow: 0 0 8px var(--c); opacity: 0; animation: fxsobe var(--t) ease-out var(--d) forwards; }
@keyframes fxsobe { 0% { opacity: 0; transform: translateY(0); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--x), -70vh); } }
.fx-tremer { animation: fxtreme .45s ease; }
@keyframes fxtreme { 10%, 50%, 90% { transform: translate(-5px, 2px); } 30%, 70% { transform: translate(5px, -2px); } }
@media (prefers-reduced-motion: reduce) {
  .fxcam *, .fx-tremer { animation-duration: .01ms !important; animation-delay: 0s !important; }
  .fxcam .bloco, .fxcam .veu, .fx-ritual .selo { animation: fxparado var(--dur) linear forwards !important; }
  @keyframes fxparado { 0%, 90% { opacity: 1; } 100% { opacity: 0; } }
}`;
function garantirCSS(doc = document) {
  if (doc.getElementById("fx-css")) return;
  const st = doc.createElement("style"); st.id = "fx-css"; st.textContent = CSS; doc.head.appendChild(st);
}
const escH = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* d = { tipo: "crit" | "nat1" | "ritual", nome, sub, el, cor }
   Mostra o efeito por cima de tudo; devolve uma promessa que termina quando acaba. */
export function mostrar(d, { alvo = document.body, clicavel = true, tremer = null } = {}) {
  garantirCSS(alvo.ownerDocument || document);
  const dur = d.tipo === "ritual" ? 2600 : 2400;
  const cor = d.cor || corDe(d.el) || "#ffd36b";
  const cam = document.createElement("div");
  cam.className = `fxcam fx-${d.tipo}${clicavel ? " clicavel" : ""}`;
  cam.style.setProperty("--dur", dur + "ms"); cam.style.setProperty("--c", cor);
  let miolo = "";
  if (d.tipo === "crit") {
    const faiscas = Array.from({ length: 22 }, () => { const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 260; return `<i class="faisca" style="--x:${(Math.cos(a) * r).toFixed(0)}px;--y:${(Math.sin(a) * r).toFixed(0)}px;animation-delay:${(Math.random() * 0.25).toFixed(2)}s"></i>`; }).join("");
    miolo = `<div class="veu"></div><div class="raios"></div>${faiscas}<div class="bloco">${d.nome ? `<div class="nome">${escH(d.nome)}</div>` : ""}<div class="titulo">${escH(d.titulo || "Crítico!")}</div>${d.sub ? `<div class="sub">${escH(d.sub)}</div>` : ""}</div>`;
  } else if (d.tipo === "nat1") {
    const W = 400, H = 400; const cx = 200, cy = 200;
    const rachas = Array.from({ length: 9 }, (_, i) => { let x = cx, y = cy; const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4; let p = `M${cx} ${cy}`; for (let k = 0; k < 5; k++) { x += Math.cos(a + (Math.random() - 0.5) * 0.9) * (30 + Math.random() * 30); y += Math.sin(a + (Math.random() - 0.5) * 0.9) * (30 + Math.random() * 30); p += ` L${x.toFixed(0)} ${y.toFixed(0)}`; } return `<path d="${p}"/>`; }).join("");
    miolo = `<div class="veu"></div><svg class="rachas" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${rachas}</svg><div class="bloco">${d.nome ? `<div class="nome">${escH(d.nome)}</div>` : ""}<div class="titulo">${escH(d.titulo || "1 natural")}</div>${d.sub ? `<div class="sub">${escH(d.sub)}</div>` : ""}</div>`;
  } else {
    const brasas = Array.from({ length: 18 }, () => `<i class="brasa" style="left:${(Math.random() * 100).toFixed(0)}%;--x:${((Math.random() - 0.5) * 80).toFixed(0)}px;--t:${(1.4 + Math.random() * 1.2).toFixed(2)}s;--d:${(Math.random() * 0.9).toFixed(2)}s"></i>`).join("");
    miolo = `<div class="veu"></div>${brasas}<div class="selo">${seloSVG(d.el, { id: "fx" + Math.random().toString(36).slice(2, 6) })}</div><div class="bloco">${d.nome ? `<div class="nome">${escH(d.nome)}</div>` : ""}<div class="titulo">${escH(d.titulo || "Ritual")}</div>${d.sub ? `<div class="sub">${escH(d.sub)}</div>` : ""}</div>`;
  }
  cam.innerHTML = miolo;
  alvo.appendChild(cam);
  if (tremer && d.tipo !== "ritual") { tremer.classList.remove("fx-tremer"); void tremer.offsetWidth; tremer.classList.add("fx-tremer"); setTimeout(() => tremer.classList.remove("fx-tremer"), 600); }
  return new Promise((ok) => {
    const fim = () => { cam.remove(); ok(); };
    const t = setTimeout(fim, dur + 50);
    if (clicavel) cam.addEventListener("click", () => { clearTimeout(t); fim(); }, { once: true });
  });
}

/* ---------- Sons (só para quem rolou; os outros ouvem pela caixa de som do Escudo) ---------- */
let ctx = null;
function ac() { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume().catch(() => {}); return ctx; }
function tom(f, t, amp, dec, tipo = "sine", dest) { const c = ac(); const o = c.createOscillator(); const g = c.createGain(); o.type = tipo; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); o.connect(g).connect(dest || c.destination); o.start(t); o.stop(t + dec + 0.05); return o; }
function baque(t, f = 50, amp = 0.8, dec = 0.6) { const c = ac(); const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + dec); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); o.connect(g).connect(c.destination); o.start(t); o.stop(t + dec + 0.05); }
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
export function som(tipo, el) {
  try {
    const t = ac().currentTime + 0.03;
    if (tipo === "crit") { baque(t, 45, 0.9, 0.9); [60, 64, 67, 72, 76].forEach((m, i) => { tom(midi(m), t + 0.08 + i * 0.07, 0.12, 1.7); tom(midi(m) * 2, t + 0.08 + i * 0.07, 0.04, 1.1); }); }
    else if (tipo === "nat1") { const c = ac(); const o = c.createOscillator(); const g = c.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(70, t + 1.2); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 1.35); baque(t + 1.2, 55, 0.7, 0.3); }
    else if (tipo === "ritual") {
      if (el === "Sangue") { for (let k = 0; k < 3; k++) baque(t + k * 0.42, 50, 0.7 - k * 0.15, 0.3); tom(55, t, 0.12, 2.2, "sawtooth"); }
      else if (el === "Morte") { let tt = t; for (let k = 0; k < 6; k++) { tom(1900, tt, 0.12, 0.04, "square"); tt += 0.22 + k * 0.07; } tom(60, t + 0.4, 0.1, 2.2, "triangle"); }
      else if (el === "Energia") { for (let k = 0; k < 10; k++) tom(2500 + Math.random() * 3000, t + Math.random() * 1.4, 0.05, 0.03, "square"); const c = ac(); const o = c.createOscillator(); const g = c.createGain(); o.type = "sawtooth"; o.frequency.setValueAtTime(90, t + 0.3); o.frequency.exponentialRampToValueAtTime(1600, t + 1.6); g.gain.setValueAtTime(0.0001, t + 0.3); g.gain.linearRampToValueAtTime(0.06, t + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8); o.connect(g).connect(c.destination); o.start(t + 0.3); o.stop(t + 1.9); }
      else if (el === "Medo") { for (const f of [220, 233.1, 246.9, 311.1]) tom(f, t + 0.2, 0.05, 2.6); }
      else { [84, 88, 91, 96, 91, 95].forEach((m, i) => tom(midi(m), t + i * 0.16, 0.06, 1.1)); tom(110, t, 0.05, 2.4, "triangle"); }
    }
  } catch { /* sem áudio */ }
}
