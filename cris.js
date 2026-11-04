/* =========================================================
   Importação de fichas da plataforma C.R.I.S.
   (crisordemparanormal.com)

   A CRIS guarda cada ficha num banco Firestore público
   (projeto "cris-ordem-paranormal"). Uma ficha aberta por
   link pode ser lida pela API REST do Firestore, só leitura.
   Nada é alterado na CRIS.
   ========================================================= */

const BASE = "https://firestore.googleapis.com/v1/projects/cris-ordem-paranormal/databases/(default)/documents/characters/";
// Chave pública do site da CRIS (vai embutida no próprio site); só usada se a leitura sem chave falhar
const CHAVE_PUBLICA = "AIzaSyADXkE6U5j_hlSRxK3nfqyylmPXgUeGWsQ";

/* ---------- Link → id ---------- */
export function crisId(texto) {
  const t = String(texto || "").trim();
  if (!t) return null;
  const m = /\/agente\/(?:stream\/|portrait\/|overlay\/)?([A-Za-z0-9_-]{10,})/.exec(t);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{10,}$/.test(t)) return t;
  return null;
}

/* ---------- Busca ---------- */
export async function buscarCris(texto) {
  const id = crisId(texto);
  if (!id) throw new Error("Link da CRIS inválido. Use o link da ficha, como crisordemparanormal.com/agente/…");
  let r;
  for (const url of [BASE + id, BASE + id + "?key=" + CHAVE_PUBLICA]) {
    try { r = await fetch(url); } catch { r = null; continue; }
    if (r.ok) return { id, doc: await r.json() };
    if (r.status !== 403 && r.status !== 401) break;
  }
  if (!r) throw new Error("Não consegui falar com a CRIS. Confira sua internet e tente de novo.");
  if (r.status === 404) throw new Error("Ficha não encontrada na CRIS. Confira o link.");
  if (r.status === 403 || r.status === 401) throw new Error("A CRIS não deixou ler essa ficha (ela pode estar privada).");
  throw new Error(`A CRIS respondeu com erro ${r.status}. Tente de novo mais tarde.`);
}

/* ---------- Firestore → objeto simples ---------- */
function valor(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return !!v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return campos(v.mapValue?.fields || {});
  if ("arrayValue" in v) return (v.arrayValue?.values || []).map(valor);
  return null;
}
function campos(f) { const o = {}; for (const [k, v] of Object.entries(f || {})) o[k] = valor(v); return o; }
export function docParaObjeto(doc) { return campos(doc?.fields || {}); }

/* ---------- Ajudas de conversão ---------- */
const n = (v, d = 0) => { const x = Number(String(v ?? "").replace(",", ".").replace(/[^\d.-]/g, "")); return Number.isFinite(x) && String(v ?? "").trim() !== "" ? x : d; };
const txt = (v) => (v == null ? "" : String(v).trim());
const semAcento = (s) => txt(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const lista = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
function escolher(valorCris, opcoes, padrao) {
  const a = semAcento(valorCris); if (!a) return padrao;
  return opcoes.find((o) => semAcento(o) === a) || opcoes.find((o) => a.includes(semAcento(o)) || semAcento(o).includes(a)) || padrao;
}

const ATTR_CRIS = { str: "FOR", dex: "AGI", agi: "AGI", int: "INT", pre: "PRE", con: "VIG", vig: "VIG" };
const ATTR_TXT = { for: "FOR", forca: "FOR", agi: "AGI", agilidade: "AGI", int: "INT", intelecto: "INT", pre: "PRE", presenca: "PRE", vig: "VIG", vigor: "VIG", str: "FOR", dex: "AGI", con: "VIG" };
function attrDeTexto(v) { return ATTR_TXT[semAcento(v)] || null; }

function treinoDe(v) {
  const s = semAcento(v);
  if (/expert/.test(s)) return 15;
  if (/veterano/.test(s)) return 10;
  if (/treinad/.test(s)) return 5;
  const x = n(v, 0);
  if (x >= 15) return 15; if (x >= 10) return 10; if (x >= 5) return 5;
  return 0;
}
function categoriaDe(v) {
  const s = txt(v).toUpperCase().replace(/^CAT(EGORIA)?\.?\s*/, "");
  const romano = { "0": 0, I: 1, II: 2, III: 3, IV: 4 };
  if (s in romano) return romano[s];
  const x = n(v, 0); return Math.max(0, Math.min(4, x));
}
function separarDano(d) {
  // "1d8+3" → ["1d8", 3]
  const s = txt(d).replace(/\s+/g, "");
  const m = /^(.*?d\d+(?:[+-]\d+d\d+)*)([+-]\d+)?$/i.exec(s);
  return m ? [m[1], n(m[2], 0)] : [s, 0];
}
function primeiraImagem(c) {
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === "string" && /^https?:\/\//.test(v) && /(pic|img|image|portrait|avatar|foto|token)/i.test(k)) return v;
  }
  return "";
}

/* ---------- Ficha da CRIS → ficha da extensão ----------
   ctx: { newSheet, newItem, SCHEMAS, PERICIAS, CLASSES, TIPOS_DANO, ALCANCES, ELEMENTOS, EXECUCOES, ALC_RITUAL } */
export function crisParaFicha(doc, ctx, origem = "") {
  const c = docParaObjeto(doc);
  const s = ctx.newSheet();
  const avisos = [];
  const item = (k, campos) => ({ ...ctx.newItem(ctx.SCHEMAS[k]), ...campos });

  /* Cabeçalho */
  s.header.personagem = txt(c.name) || "Agente da CRIS";
  s.header.jogador = txt(c.player) || s.header.jogador;
  s.header.origem = txt(c.backgroundName || c.background);
  const classe = txt(c.className || c.class);
  s.header.classe = escolher(classe, ctx.CLASSES, "Combatente");
  if (classe && semAcento(classe) !== semAcento(s.header.classe)) avisos.push(`A classe "${classe}" não existe nesta ficha; ficou como ${s.header.classe}.`);
  const trilha = txt(c.trail || c.trailName || c.path);
  if (trilha) s.header.trilha = trilha;
  const afin = txt(c.affinity);
  if (afin) s.header.afinidade = afin;
  const img = primeiraImagem(c); if (img) s.header.img = img;
  if (txt(c.patent)) s.equip.patente = txt(c.patent);
  if (c.prestigePoints != null) s.equip.prestigio = n(c.prestigePoints, 0);

  /* NEX e deslocamento */
  const nex = n(c.nex, 5); s.nex = nex >= 99 ? 99 : Math.max(5, Math.min(95, Math.round(nex / 5) * 5));
  if (c.movement != null) s.desloc = n(c.movement, 9);

  /* Atributos */
  const at = c.attributes || {};
  for (const [k, a] of Object.entries(ATTR_CRIS)) if (at[k] != null) s.attrs[a] = Math.max(0, Math.min(5, n(at[k], 1)));

  /* PV, PE/SAN ou Determinação */
  s.pv = { atual: n(c.currentPv, n(c.maxPv, 1)), max: n(c.maxPv, 1) };
  const temPd = n(c.maxPd, 0) > 0;
  const temSan = n(c.maxSan, 0) > 0 || n(c.maxPe, 0) > 0;
  if (c.useDeterminationPoints === true || (temPd && !temSan)) {
    s.regra = "determinacao";
    s.pd = { atual: n(c.currentPd, n(c.maxPd, 0)), max: n(c.maxPd, 0) };
  } else {
    s.regra = "padrao";
    s.pd = { atual: n(c.currentPe, n(c.maxPe, 0)), max: n(c.maxPe, 0) };
    s.san = { atual: n(c.currentSan, n(c.maxSan, 0)), max: n(c.maxSan, 0) };
  }

  /* Defesa */
  s.defesa.outros = n(c.bonusDefense, 0);

  /* Perícias */
  const nomes = ctx.PERICIAS.map((p) => p[0]);
  let achou = 0;
  for (const sk of lista(c.skills)) {
    const nome = escolher(sk.name, nomes, null);
    if (!nome) continue;
    achou++;
    const p = s.pericias[nome];
    p.treino = treinoDe(sk.trainingDegree ?? sk.training);
    p.outros = n(sk.otherBonus ?? sk.bonus, 0);
    const a = attrDeTexto(sk.attribute); if (a) p.attr = a;
  }
  if (lista(c.skills).length && !achou) avisos.push("Não reconheci as perícias da CRIS; confira a aba Perícias.");

  /* Inventário */
  let protEncontrada = false;
  for (const it of lista(c.inventory)) {
    const tipo = semAcento(it.itemType || it.type);
    const base = { nome: txt(it.name) || "Item", espacos: n(it.slots ?? it.spaces, 1), categoria: categoriaDe(it.category), desc: txt(it.description) };
    if (/protec|armor|armadura/.test(tipo) || n(it.defense, 0) > 0) {
      protEncontrada = true;
      s.protecoes.push(item("protecoes", { ...base, defesa: n(it.defense, 0) }));
    } else if (/weapon|arma/.test(tipo)) {
      const [d, fixo] = separarDano(it.damage);
      s.armas.push(item("armas", { ...base, dano: d, danoFixo: fixo, critico: n(it.criticalRange, 20) || 20, mult: n(it.criticalMult, 2) || 2, tipoDano: escolher(it.damageType, ctx.TIPOS_DANO, ctx.TIPOS_DANO[0]) }));
    } else if (/cursed|amaldi/.test(tipo)) {
      s.amaldicoados.push(item("amaldicoados", { ...base, elemento: escolher(it.element, ["Sangue", "Morte", "Energia", "Conhecimento", "Medo"], "Varia") }));
    } else if (/ammo|munic/.test(tipo)) {
      s.municoes.push(item("municoes", { ...base, atual: n(it.quantity, 0), max: n(it.quantity, 0) }));
    } else {
      s.gerais.push(item("gerais", { ...base, tipo: escolher(it.tag || it.category, ["Acessórios", "Explosivos", "Itens Operacionais", "Itens Paranormais"], "Itens Operacionais") }));
    }
  }
  if (!protEncontrada && n(c.protectionDefense, 0)) s.defesa.equip = n(c.protectionDefense, 0);

  /* Ataques: os que já viraram arma do inventário não repetem */
  const armasNomes = new Set(s.armas.map((a) => semAcento(a.nome)));
  for (const a of lista(c.attacks)) {
    const nm = semAcento(a.name);
    const arma = s.armas.find((w) => semAcento(w.nome) === nm);
    const [d, fixo] = separarDano(a.damage);
    const pericia = escolher(a.skillUsed || a.skill, ["Luta", "Pontaria", ...nomes], "Luta");
    if (arma) {
      if (!arma.dano) { arma.dano = d; arma.danoFixo = fixo; }
      arma.bonus = n(a.attackBonus, 0); arma.critico = n(a.criticalRange, arma.critico) || 20; arma.mult = n(a.criticalMult, arma.mult) || 2;
      arma.alcance = escolher(a.range, ctx.ALCANCES, arma.alcance);
      if (pericia === "Pontaria") arma.tipo = "Arma de Fogo";
      continue;
    }
    if (armasNomes.has(nm)) continue;
    s.ataques.push(item("ataques", {
      nome: txt(a.name) || "Ataque", dano: txt(a.damage).replace(/\s+/g, ""), tipo: escolher(a.damageType, ctx.TIPOS_DANO, ctx.TIPOS_DANO[0]),
      critico: n(a.criticalRange, 20) || 20, mult: n(a.criticalMult, 2) || 2, bonus: n(a.attackBonus, 0),
      alcance: escolher(a.range, ctx.ALCANCES, "Corpo a Corpo"), pericia, desc: txt(a.description || a.special),
    }));
  }

  /* Rituais */
  for (const r of lista(c.rituals)) {
    s.rituais.lista.push(item("rituais", {
      nome: txt(r.name) || "Ritual", elemento: escolher(r.element, ctx.ELEMENTOS, ctx.ELEMENTOS[0]),
      circulo: Math.max(1, Math.min(4, n(r.circle, 1))), execucao: escolher(r.execution, ctx.EXECUCOES, "Padrão"),
      alcance: escolher(r.range, ctx.ALC_RITUAL, "Pessoal"), area: txt(r.target || r.area), duracao: txt(r.duration),
      dados: txt(r.normalCastDamage || r.damage), dadosDiscente: txt(r.discentCastDamage), dadosVerdadeiro: txt(r.trueCastDamage),
      desc: txt(r.description || r.normalCastDescription), descDiscente: txt(r.discentCastDescription), descVerdadeiro: txt(r.trueCastDescription),
    }));
  }
  if (c.ritualsDc != null || c.ritualDc != null) s.rituais.dt = n(c.ritualsDc ?? c.ritualDc, s.rituais.dt);

  /* Poderes e habilidades */
  for (const p of [...lista(c.powers), ...lista(c.abilities)]) {
    s.habilidades.push(item("habilidades", { nome: txt(p.name) || "Poder", desc: txt(p.description), custo: 0 }));
  }

  /* Textos */
  const d = c.description || {};
  s.notas.historico = txt(d.history);
  s.notas.aparencia = txt(d.physical || d.appearance);
  s.notas.personalidade = txt(d.personal || d.personality);
  s.notas.objetivo = txt(d.goal || d.objective);
  s.notas.anotacoes = [txt(d.anotation || d.notes), origem ? `Importada da CRIS: ${origem}` : "", ...avisos].filter(Boolean).join("\n\n");

  return { sheet: s, avisos, resumo: { pericias: achou, itens: lista(c.inventory).length, ataques: lista(c.attacks).length, rituais: lista(c.rituals).length, poderes: lista(c.powers).length + lista(c.abilities).length } };
}
