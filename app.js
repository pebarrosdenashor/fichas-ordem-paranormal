import OBR, { buildShape, buildText } from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";
import { buscarCris, crisParaFicha, crisId } from "./cris.js?v=3.10.0";
import * as FX from "./efeitos.js?v=3.10.0";

/* =========================================================
   Ficha de Ordem Paranormal — extensão para Owlbear Rodeo
   v2.0
   ========================================================= */

const NS = "io.github.pebarrosdenashor.ficha-op";
const CHANNEL = NS + "/sync";
const MODAL_ID = NS + "/modal";
const LINK_KEY = NS + "/link";       // metadado gravado no token
const OPEN_KEY = NS + ":open";       // pedido de "abrir ficha" vindo do menu do token
const IS_MODAL = new URLSearchParams(location.search).has("modal");
const QUICK_ID = new URLSearchParams(location.search).get("quick"); // janelinha de acesso rápido aberta pelo token
const FX_CH = NS + "/fx";            // v3.8: efeitos para a mesa (crítico, 1 natural, selo do ritual)
const CFG_KEY = NS + "/cfg";         // v3.8: na sala, o mestre liga/desliga os efeitos para todos
const MESTRE_CH = "io.github.pebarrosdenashor.mestre-hx/msg"; // caixa de som do Escudo do Mestre

/* ---------- Dados fixos do sistema ---------- */
const ATTRS = [["FOR", "Força"], ["AGI", "Agilidade"], ["INT", "Intelecto"], ["VIG", "Vigor"], ["PRE", "Presença"]];
const ATTR_BY_NAME = Object.fromEntries(ATTRS.map(([a, n]) => [n, a]));
// [nome, atributo, marcas]  + penalidade de carga, * somente treinada
const PERICIAS = [
  ["Acrobacia", "AGI", "+"], ["Adestramento", "PRE", "*"], ["Artes", "PRE", "*"], ["Atletismo", "FOR", ""],
  ["Atualidades", "INT", ""], ["Ciências", "INT", "*"], ["Crime", "AGI", "*+"], ["Diplomacia", "PRE", ""],
  ["Enganação", "PRE", ""], ["Fortitude", "VIG", ""], ["Furtividade", "AGI", "+"], ["Iniciativa", "AGI", ""],
  ["Intimidação", "PRE", ""], ["Intuição", "PRE", ""], ["Investigação", "INT", ""], ["Luta", "FOR", ""],
  ["Medicina", "INT", ""], ["Ocultismo", "INT", "*"], ["Percepção", "PRE", ""], ["Pilotagem", "AGI", "*"],
  ["Pontaria", "AGI", ""], ["Profissão", "INT", "*"], ["Reflexos", "AGI", ""], ["Religião", "PRE", "*"],
  ["Sobrevivência", "INT", ""], ["Tática", "INT", "*"], ["Tecnologia", "INT", "*"], ["Vontade", "PRE", ""],
];
const PER_MARK = Object.fromEntries(PERICIAS.map(([n, , m]) => [n, m]));
const TREINO = [[0, "—"], [5, "Treinado"], [10, "Veterano"], [15, "Expert"]];
const CLASSES = ["Combatente", "Especialista", "Ocultista"];
// PV e Determinação por classe: [inicial, por NEX] — somam VIG (PV) ou PRE (PD)
// pd = Determinação (SaH, p. 104); pe e san = regra do livro básico (PE + Sanidade)
const CLASSE_STATS = {
  Combatente: { pv: [20, 4], pd: [6, 3], pe: [2, 2], san: [12, 3] },
  Especialista: { pv: [16, 3], pd: [8, 4], pe: [3, 3], san: [16, 4] },
  Ocultista: { pv: [12, 2], pd: [10, 5], pe: [4, 4], san: [20, 5] },
};
const REGRAS = [["determinacao", "Determinação (Sobrevivendo ao Horror)"], ["padrao", "PE + Sanidade (livro básico)"]];
const isDet = (s) => s?.regra !== "padrao";
const resSig = (s) => (isDet(s) ? "PD" : "PE");
const resNome = (s) => (isDet(s) ? "Determinação" : "Pontos de Esforço");
// Em fichas com a regra padrão, os textos de PD passam a dizer PE
function trPE(txt) { return String(txt).replace(/\bPD\b/g, "PE").replace(/Determinação/g, "Pontos de Esforço"); }
function translateDom(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) if (/\bPD\b|Determinação/.test(n.nodeValue) && !n.parentElement?.closest("[data-keep]")) n.nodeValue = trPE(n.nodeValue);
  root.querySelectorAll("[title]").forEach((el) => { if (/\bPD\b|Determinação/.test(el.title)) el.title = trPE(el.title); });
}
const NEX_OPTS = [...Array.from({ length: 19 }, (_, i) => (i + 1) * 5), 99];
const TIPOS_DANO = ["Balístico", "Cortante", "Impacto", "Perfurante", "Sangue", "Morte", "Conhecimento", "Energia", "Medo", "Mental", "Frio", "Fogo", "Químico", "Eletricidade"];
const ALCANCES = ["Corpo a Corpo", "Curto", "Médio", "Longo", "Extremo", "Ilimitado"];
const ELEMENTOS = ["Conhecimento", "Energia", "Medo", "Morte", "Sangue"];
const EXECUCOES = ["Padrão", "Movimento", "Completa", "Reação", "Livre"];
const ALC_RITUAL = ["Pessoal", "Toque", "Curto", "Médio", "Longo", "Extremo", "Ilimitado"];
const RES_PERICIA = ["—", "Fortitude", "Vontade", "Reflexos"];
const RES_EFEITO = ["—", "Anula", "Desacredita", "Parcial", "Reduz à Metade"];
const PATENTES = ["Mundano", "Recruta", "Operador", "Agente Especial", "Oficial de Operações", "Agente de Elite"];
const CREDITO = ["Baixo", "Médio", "Alto", "Ilimitado"];
// Tabela 3.1 (livro básico): PP mínimos, crédito e limite de itens por categoria [0, I, II, III, IV]
const PATENTE_TAB = {
  "Recruta": { pp: 0, credito: "Baixo", lim: [0, 2, 0, 0, 0] },
  "Operador": { pp: 20, credito: "Médio", lim: [0, 3, 1, 0, 0] },
  "Agente Especial": { pp: 50, credito: "Médio", lim: [0, 3, 2, 1, 0] },
  "Oficial de Operações": { pp: 100, credito: "Alto", lim: [0, 3, 3, 2, 1] },
  "Agente de Elite": { pp: 200, credito: "Ilimitado", lim: [0, 3, 3, 3, 2] },
};
function patentePorPP(pp) { let r = "Recruta"; for (const [n, t] of Object.entries(PATENTE_TAB)) if (num(pp) >= t.pp) r = n; return r; }
const CATS = [[0, "0"], [1, "I"], [2, "II"], [3, "III"], [4, "IV"]];
const ITEM_LISTS = ["armas", "municoes", "protecoes", "gerais", "amaldicoados"];
const CUSTO_CIRCULO = { 1: 1, 2: 3, 3: 6, 4: 10 };
const TEMAS = [["Padrão", "Padrão"], ["Afinidade", "Pela afinidade (muda sozinho)"], ["Sangue", "Sangue"], ["Morte", "Morte"], ["Conhecimento", "Conhecimento"], ["Energia", "Energia"], ["Medo", "Medo"]];
// v3.8: "Afinidade" usa o elemento da afinidade; sem afinidade, o padrão
function temaEf(s) { const t = s?.header?.tema || "Padrão"; return t === "Afinidade" ? (ELEMENTOS.includes(s.header.afinidade) ? s.header.afinidade : "Padrão") : t; }
const TRILHA_NEX = [10, 40, 65, 99];

/* Condições: d = dados perdidos (todos / físicos FOR-AGI-VIG / mentais INT-PRE / ataques / perícia específica),
   def = penalidade de Defesa (fontes iguais não acumulam), mov = efeito no deslocamento, custo = PD extra */
const CONDICOES = [
  ["Abalado", "−1d em testes. Se ficar abalado de novo, fica apavorado.", { dAll: 1 }],
  ["Apavorado", "−2d em testes de perícia e precisa fugir da fonte do medo.", { dAll: 2 }],
  ["Agarrado", "Desprevenido, imóvel, −1d em ataques e só pode usar armas leves.", { def: "desprevenido", dAtk: 1, mov: "imovel" }],
  ["Alquebrado", "O custo em PD de habilidades e rituais aumenta em +1.", { custo: 1 }],
  ["Atordoado", "Desprevenido e não pode fazer ações.", { def: "desprevenido" }],
  ["Caído", "−2d em ataques corpo a corpo e deslocamento de 1,5m; −5 na Defesa contra corpo a corpo e +5 contra ataques à distância.", { mov: "caido", dMelee: 2 }],
  ["Cego", "Desprevenido e lento, não faz testes de Percepção para observar e sofre −2d em perícias de Agilidade ou Força.", { def: "desprevenido", mov: "lento", dAttr: { AGI: 2, FOR: 2 } }],
  ["Confuso", "Age de forma aleatória (role para saber o que faz).", {}],
  ["Debilitado", "−2d em Agilidade, Força e Vigor.", { dFis: 2 }],
  ["Desprevenido", "−5 na Defesa e −1d em Reflexos.", { def: "desprevenido", dPer: { Reflexos: 1 } }],
  ["Enredado", "Lento, desprevenido e −1d em ataques.", { def: "desprevenido", dAtk: 1, mov: "lento" }],
  ["Em chamas", "Sofre dano de fogo a cada rodada até apagar as chamas.", {}],
  ["Enjoado", "Só pode fazer uma ação padrão ou de movimento por rodada.", {}],
  ["Envenenado", "Sofre o efeito do veneno descrito.", {}],
  ["Esmorecido", "−2d em Intelecto e Presença.", { dMen: 2 }],
  ["Fascinado", "−2d em Percepção e não pode fazer ações, exceto observar o que o fascinou.", { dPer: { "Percepção": 2 } }],
  ["Exausto", "Debilitado, lento e vulnerável.", { dFis: 2, def: "vulneravel", mov: "lento" }],
  ["Fatigado", "Fraco e vulnerável.", { dFis: 1, def: "vulneravel" }],
  ["Fraco", "−1d em Agilidade, Força e Vigor.", { dFis: 1 }],
  ["Frustrado", "−1d em Intelecto e Presença.", { dMen: 1 }],
  ["Imóvel", "Deslocamento reduzido a 0.", { mov: "imovel" }],
  ["Inconsciente", "Indefeso; não pode fazer ações.", { def: "indefeso" }],
  ["Indefeso", "Desprevenido, mas −10 na Defesa; falha automaticamente em Reflexos e pode sofrer golpe de misericórdia.", { def: "indefeso" }],
  ["Lento", "Deslocamento reduzido à metade.", { mov: "lento" }],
  ["Ofuscado", "−1d em ataques e em Percepção.", { dAtk: 1, dPer: { "Percepção": 1 } }],
  ["Paralisado", "Imóvel e indefeso; só pode fazer ações puramente mentais.", { def: "indefeso", mov: "imovel" }],
  ["Pasmo", "Não pode fazer ações.", {}],
  ["Sangrando", "Perde PV no início de cada turno até estancar o sangramento.", {}],
  ["Surdo", "Não faz testes de Percepção para ouvir e sofre −2d em Iniciativa.", { dPer: { "Iniciativa": 2 } }],
  ["Surpreendido", "Desprevenido e não pode fazer ações.", { def: "desprevenido" }],
  ["Vulnerável", "−2 na Defesa.", { def: "vulneravel" }],
];
const COND_MAP = Object.fromEntries(CONDICOES.map(([n, d, e]) => [n, { d, e }]));

/* ---------- Esquemas das listas ---------- */
const F = (k, label, type = "text", extra = {}) => ({ k, label, type, ...extra });
const nomeCat = (v) => (CATS.find((c) => String(c[0]) === String(v)) || CATS[0])[1];
const SCHEMAS = {
  ataques: {
    title: "ataque",
    fields: [
      F("nome", "Nome", "text", { wide: true }), F("dano", "Dano (dados)", "text", { ph: "1d8+2" }),
      F("tipo", "Tipo de dano", "select", { opts: TIPOS_DANO }),
      F("critico", "Crítico (1–20)", "num", { min: 1, max: 20, def: 20 }), F("mult", "Multiplicador", "num", { min: 1, max: 9, def: 2 }),
      F("bonus", "Bônus de ataque", "num", { def: 0 }), F("alcance", "Alcance", "select", { opts: ALCANCES }),
      F("pericia", "Perícia base", "select", { opts: ["Luta", "Pontaria", ...PERICIAS.map((p) => p[0]).filter((p) => p !== "Luta" && p !== "Pontaria")] }),
      F("attrDano", "Atributo de dano", "select", { opts: ["Nenhum", ...ATTRS.map((a) => a[1])] }),
      F("adicionais", "Danos adicionais", "dmglist"), F("img", "Imagem", "img"), F("desc", "Descrição", "textarea"),
    ],
    info: (it) => [it.dano, it.tipo].filter(Boolean).join(" · "),
    quick: (p) => `<button class="icon roll-q" data-atk="${p}" title="Atacar">🎲</button>`,
    actions: (p) => `<button class="primary" data-atk="${p}">🎲 Atacar</button>`,
    hay: (it) => [it.nome, it.desc, it.tipo].join(" "),
  },
  habilidades: {
    title: "habilidade",
    fields: [F("nome", "Nome", "text", { wide: true }), F("custo", "Custo em PD (0 = sem custo)", "num", { def: 0, min: 0 }), F("img", "Imagem", "img"), F("desc", "Descrição", "textarea")],
    info: (it) => (num(it.custo) ? `${num(it.custo)} PD` : ""),
    actions: (p, it) => (num(it.custo) ? `<button class="primary" data-usehab="${p}">Usar (−${num(it.custo)} PD)</button>` : ""),
    hay: (it) => [it.nome, it.desc].join(" "),
  },
  rituais: {
    title: "ritual",
    fields: [
      F("nome", "Nome", "text", { wide: true }), F("elemento", "Elemento", "select", { opts: ELEMENTOS }),
      F("circulo", "Círculo", "select", { opts: [1, 2, 3, 4].map((n) => [n, n + "º"]) }),
      F("execucao", "Execução", "select", { opts: EXECUCOES }), F("alcance", "Alcance", "select", { opts: ALC_RITUAL }),
      F("area", "Área / Alvo", "text"), F("duracao", "Duração", "text"),
      F("resPericia", "Resistência (perícia)", "select", { opts: RES_PERICIA }),
      F("resEfeito", "Resistência (efeito)", "select", { opts: RES_EFEITO }),
      F("dados", "Dados", "text"), F("dadosDiscente", "Dados — Discente", "text"), F("dadosVerdadeiro", "Dados — Verdadeiro", "text"),
      F("custoDiscente", "PD extra — Discente", "num", { def: 0, min: 0 }), F("custoVerdadeiro", "PD extra — Verdadeiro", "num", { def: 0, min: 0 }),
      F("img", "Imagem", "img"), F("desc", "Descrição", "textarea"),
      F("descDiscente", "Descrição — Discente", "textarea"), F("descVerdadeiro", "Descrição — Verdadeiro", "textarea"),
    ],
    info: (it) => `${it.elemento || ""} ${it.circulo ? it.circulo + "º" : ""}`,
    actions: (p) => `<button class="primary" data-cast="${p}|normal">✦ Conjurar</button><button data-cast="${p}|discente">Discente</button><button data-cast="${p}|verdadeiro">Verdadeiro</button>`,
    hay: (it) => [it.nome, it.desc, it.elemento].join(" "),
    attrs: (it) => `data-el="${esc(it.elemento)}" data-circ="${esc(it.circulo)}"`,
  },
  armas: {
    title: "arma",
    fields: [
      F("nome", "Nome", "text", { wide: true }),
      F("prof", "Proficiência", "select", { opts: ["Arma Simples", "Arma Tática", "Arma Pesada"] }),
      F("tipo", "Tipo", "select", { opts: ["Corpo a Corpo", "Arma de Arremesso", "Arma de Disparo", "Arma de Fogo"] }),
      F("empunhadura", "Empunhadura", "select", { opts: ["Leve", "Uma Mão", "Duas Mãos"] }),
      F("tipoDano", "Tipo de dano", "select", { opts: TIPOS_DANO }),
      F("dano", "Dano (dados)", "text", { ph: "1d6" }), F("danoFixo", "Dano fixo (+)", "num", { def: 0 }),
      F("dano2", "Dano secundário (dados)", "text"), F("dano2Fixo", "Dano secundário fixo (+)", "num", { def: 0 }),
      F("critico", "Crítico (1–20)", "num", { min: 1, max: 20, def: 20 }), F("mult", "Multiplicador", "num", { min: 1, max: 9, def: 2 }),
      F("bonus", "Bônus de ataque", "num", { def: 0 }),
      F("alcance", "Alcance", "select", { opts: ALCANCES }), F("categoria", "Categoria", "select", { opts: CATS }),
      F("espacos", "Espaços", "num", { def: 1, min: 0 }),
      F("melhorias", "Melhorias", "strlist"), F("img", "Imagem", "img"), F("desc", "Descrição", "textarea"),
    ],
    info: (it) => [dmgTxt(it.dano, it.danoFixo), it.tipoDano, "Cat. " + nomeCat(it.categoria)].filter(Boolean).join(" · "),
    quick: (p) => `<button class="icon roll-q" data-arma="${p}|1" title="Atacar">🎲</button>`,
    actions: (p, it) => `<button class="primary" data-arma="${p}|1">🎲 Atacar</button>${it.dano2 || num(it.dano2Fixo) ? `<button data-arma="${p}|2">🎲 Dano secundário</button>` : ""}`,
    hay: (it) => [it.nome, it.desc, it.tipo, it.prof].join(" "),
    attrs: (it) => `data-cat="${num(it.categoria)}"`,
  },
  municoes: {
    title: "munição",
    fields: [
      F("nome", "Nome", "text", { wide: true }), F("categoria", "Categoria", "select", { opts: CATS }),
      F("espacos", "Espaços", "num", { def: 1, min: 0 }),
      F("atual", "Quantidade atual", "num", { def: 0, min: 0 }), F("max", "Quantidade máxima", "num", { def: 0, min: 0 }),
      F("img", "Imagem", "img"), F("desc", "Descrição", "textarea"),
    ],
    info: (it) => `${num(it.atual)}/${num(it.max)} · Cat. ${nomeCat(it.categoria)}`,
    quick: (p) => `<button class="icon" data-ammo="${p}|-1" title="Gastar 1">−1</button><button class="icon" data-ammo="${p}|max" title="Recarregar">↻</button>`,
    hay: (it) => [it.nome, it.desc].join(" "),
    attrs: (it) => `data-cat="${num(it.categoria)}"`,
  },
  protecoes: {
    title: "proteção",
    fields: [
      F("nome", "Nome", "text", { wide: true }), F("defesa", "Defesa", "num", { def: 0 }),
      F("categoria", "Categoria", "select", { opts: CATS }), F("espacos", "Espaços", "num", { def: 1, min: 0 }),
      F("melhorias", "Melhorias", "strlist"), F("img", "Imagem", "img"), F("desc", "Descrição", "textarea"),
    ],
    info: (it) => `+${num(it.defesa)} Def · Cat. ${nomeCat(it.categoria)}`,
    hay: (it) => [it.nome, it.desc].join(" "),
    attrs: (it) => `data-cat="${num(it.categoria)}"`,
  },
  gerais: {
    title: "item geral",
    fields: [
      F("nome", "Nome", "text", { wide: true }),
      F("tipo", "Tipo", "select", { opts: ["Acessórios", "Explosivos", "Itens Operacionais", "Itens Paranormais"] }),
      F("categoria", "Categoria", "select", { opts: CATS }), F("espacos", "Espaços", "num", { def: 1, min: 0 }),
      F("melhorias", "Melhorias", "strlist"), F("img", "Imagem", "img"), F("desc", "Descrição", "textarea"),
    ],
    info: (it) => `${it.tipo || ""} · Cat. ${nomeCat(it.categoria)}`,
    hay: (it) => [it.nome, it.desc, it.tipo].join(" "),
    attrs: (it) => `data-cat="${num(it.categoria)}"`,
  },
  amaldicoados: {
    title: "item amaldiçoado",
    fields: [
      F("nome", "Nome", "text", { wide: true }),
      F("elemento", "Elemento", "select", { opts: ["Sangue", "Morte", "Energia", "Conhecimento", "Medo", "Varia"] }),
      F("categoria", "Categoria", "select", { opts: CATS }), F("espacos", "Espaços", "num", { def: 1, min: 0 }),
      F("img", "Imagem", "img"), F("desc", "Descrição", "textarea"),
    ],
    info: (it) => `${it.elemento || ""} · Cat. ${nomeCat(it.categoria)}`,
    hay: (it) => [it.nome, it.desc, it.elemento].join(" "),
    attrs: (it) => `data-cat="${num(it.categoria)}"`,
  },
};
// v3.10: habilidades que só existem na forma suprema (ult)
SCHEMAS.ultHabs = {
  title: "habilidade da forma suprema",
  fields: [F("nome", "Nome", "text", { wide: true }), F("alvo", "Aprimora a habilidade (vazio = habilidade nova)", "text", { ph: "Ex.: Golpe Pesado" }), F("custo", "Custo em PD (0 = sem custo)", "num", { def: 0, min: 0 }), F("img", "Imagem", "img"), F("desc", "Descrição", "textarea")],
  info: (it) => [it.alvo ? `aprimora ${it.alvo}` : "nova", num(it.custo) ? `${num(it.custo)} PD` : ""].filter(Boolean).join(" · "),
  actions: (p, it) => num(it.custo) ? `<button class="primary" data-usehab="${p}">Usar (−${num(it.custo)} PD)</button>` : `<button class="primary" data-hablog="${p}">Usar</button>`,
  hay: (it) => [it.nome, it.alvo, it.desc].join(" "),
};
const LIST_PATHS = { ultHabs: "ult.habilidades", ataques: "ataques", habilidades: "habilidades", rituais: "rituais.lista", armas: "armas", municoes: "municoes", protecoes: "protecoes", gerais: "gerais", amaldicoados: "amaldicoados" };

/* ---------- Utilidades ---------- */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (n) => (n >= 0 ? "+" + n : String(n));
function dmgTxt(d, fixo) { const f = num(fixo); return d ? d + (f ? (f > 0 ? "+" : "") + f : "") : (f ? String(f) : ""); }
function getPath(o, p) { return p.split(".").reduce((a, k) => (a == null ? a : a[k]), o); }
function setPath(o, p, v) {
  const ks = p.split("."); const last = ks.pop();
  const t = ks.reduce((a, k) => (a[k] ??= {}), o); t[last] = v;
}
function delPath(o, p) {
  const ks = p.split("."); const idx = Number(ks.pop()); const arr = getPath(o, ks.join("."));
  if (Array.isArray(arr)) arr.splice(idx, 1);
}
function normOpts(opts) { return opts.map((o) => (Array.isArray(o) ? o : [o, o])); }
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

/* ---------- Ficha nova ---------- */
function newItem(schema) {
  const it = { id: uid() };
  for (const f of schema.fields) {
    if (f.type === "strlist" || f.type === "dmglist") it[f.k] = [];
    else if (f.type === "num") it[f.k] = f.def ?? 0;
    else if (f.type === "select") it[f.k] = normOpts(f.opts)[0][0];
    else it[f.k] = "";
  }
  return it;
}
function newSheet() {
  const per = {};
  for (const [n, a] of PERICIAS) per[n] = { attr: a, treino: 0, outros: 0 };
  return {
    id: uid(), owner: { id: me.id, name: me.name }, updatedAt: Date.now(), lastExport: 0,
    header: { img: "", personagem: "Novo agente", jogador: me.name || "", origem: "", classe: "Combatente", trilha: "", trilhaKey: "", afinidade: "", tema: "Padrão" },
    trilhaHab: { 10: "", 40: "", 65: "", 99: "" },
    attrs: { FOR: 1, AGI: 1, INT: 1, VIG: 1, PRE: 1 },
    nex: 5, pdBonus: 0, pdRodada: 0, desloc: 9,
    regra: lsGet(NS + ":regra") === "padrao" ? "padrao" : "determinacao",
    pv: { atual: 21, max: 21 }, pd: { atual: 7, max: 7 }, san: { atual: 12, max: 12 },
    morrendo: 0, enlouquecendo: 0, efeitos: [], rapido: [],
    condicoes: [],
    defesa: { equip: 0, outros: 0 },
    resistencias: "", proficiencias: "",
    pericias: per,
    ataques: [], habilidades: [], rituais: { dt: 10, lista: [] },
    equip: { prestigio: 0, patente: "Recruta", limites: [0, 2, 0, 0, 0], credito: "Baixo", cargaMod: 0 },
    armas: [], municoes: [], protecoes: [], gerais: [], amaldicoados: [],
    notas: { anotacoes: "", aparencia: "", personalidade: "", historico: "", objetivo: "" },
    token: { barrasTodos: true },
    pvTemp: 0, pdTemp: 0, rdGeral: 0, rdTipos: [], descanso: "Normal", buffs: [],
    ult: ultBase(),
  };
}
// Garante que fichas antigas ganhem os campos novos
function upgrade(s) {
  if (s.regra === undefined) s.regra = "determinacao"; // fichas antigas usavam Determinação
  const base = newSheet();
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  for (const [n, a] of PERICIAS) if (!s.pericias[n]) s.pericias[n] = { attr: a, treino: 0, outros: 0 };
  for (const k of ["header", "equip", "notas", "defesa", "rituais", "trilhaHab", "token", "ult"]) s[k] = { ...base[k], ...s[k] };
  if (!Array.isArray(s.ult.habilidades)) s.ult.habilidades = [];
  for (const [key, path] of Object.entries(LIST_PATHS)) {
    const arr = getPath(s, path); if (!Array.isArray(arr)) continue;
    const proto = newItem(SCHEMAS[key]);
    arr.forEach((it, i) => { arr[i] = { ...proto, ...it, id: it.id || uid() }; });
  }
  return s;
}

/* ---------- Estado ---------- */
let obrOk = false, sceneOk = false;
let role = "PLAYER";
let me = { id: "local", name: "" };
let storeKey = NS + ":local";
let store = { own: {}, others: {}, currentId: null };
let tab = "principal";
const openCards = new Set();
let pendingImgPath = null;
let renderPending = false;
let hiddenRolls = false;
let rollLog = [];
let ini = { list: [], turn: 0 };
const filters = {};

const isGM = () => role === "GM";
function allVisible() {
  const list = Object.values(store.own).map((s) => ({ s, own: true }));
  if (isGM()) for (const s of Object.values(store.others)) list.push({ s, own: false });
  return list;
}
function sheetById(id) { return store.own[id] || (isGM() ? store.others[id] : null) || null; }
function cur() { return sheetById(QUICK_ID || store.currentId); }
function isOwnCurrent() { return !!store.own[store.currentId]; }

function load() {
  try {
    const raw = JSON.parse(lsGet(storeKey) || "null");
    if (raw && raw.own) store = { own: raw.own, others: raw.others || {}, currentId: raw.currentId };
  } catch { /* armazenamento indisponível */ }
  for (const s of [...Object.values(store.own), ...Object.values(store.others)]) { upgrade(s); committed[s.id] = JSON.stringify(s); }
  try { rollLog = JSON.parse(lsGet(storeKey + ":log") || "[]"); } catch { rollLog = []; }
  try { ini = JSON.parse(lsGet(storeKey + ":ini") || "null") || { list: [], turn: 0 }; } catch { /* */ }
}
function persist() {
  if (!lsSet(storeKey, JSON.stringify(store))) toast("Não foi possível salvar: o armazenamento do navegador está cheio. Use imagens menores ou remova algumas.");
}

/* ---------- Sincronização (broadcast em partes de ≤16 KB) ---------- */
const CHUNK = 5000;
const partial = {};
const syncTimers = {};

async function send(msg) {
  if (!obrOk) return;
  const s = JSON.stringify(msg);
  const n = Math.max(1, Math.ceil(s.length / CHUNK));
  const m = uid();
  for (let i = 0; i < n; i++) {
    try { await OBR.broadcast.sendMessage(CHANNEL, { m, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) }); }
    catch (e) { console.warn("Falha ao enviar", e); return; }
    if (n > 1) await sleep(70);
  }
}
function scheduleSync(sheet) {
  clearTimeout(syncTimers[sheet.id]);
  syncTimers[sheet.id] = setTimeout(() => { send({ t: "sheet", sheet }); syncToken(sheet); }, 900);
}
function onChunk(data) {
  if (!data || !data.m) return;
  const p = (partial[data.m] ||= { n: data.n, parts: [], got: 0, at: Date.now() });
  if (p.parts[data.i] === undefined) { p.parts[data.i] = data.d; p.got++; }
  if (p.got === p.n) {
    delete partial[data.m];
    try { handle(JSON.parse(p.parts.join(""))); } catch (e) { console.warn("Mensagem inválida", e); }
  }
  for (const [k, v] of Object.entries(partial)) if (Date.now() - v.at > 60000) delete partial[k];
}
function handle(msg) {
  if (msg.t === "sheet") {
    const s = upgrade(msg.sheet);
    if (store.own[s.id]) { // mestre editou uma ficha minha
      if (num(s.updatedAt) <= num(store.own[s.id].updatedAt)) return;
      s.lastExport = store.own[s.id].lastExport;
      store.own[s.id] = s; committed[s.id] = JSON.stringify(s);
    } else if (isGM()) {
      const old = store.others[s.id];
      if (old && num(s.updatedAt) < num(old.updatedAt)) { send({ t: "sheet", sheet: old }); return; } // jogador estava com versão antiga
      if (old && num(s.updatedAt) === num(old.updatedAt)) return;
      store.others[s.id] = s; committed[s.id] = JSON.stringify(s);
    } else return;
    persist(); softRender();
  } else if (msg.t === "request") {
    pushAllOwn();
  } else if (msg.t === "delete") {
    if (store.own[msg.id] || store.others[msg.id]) {
      delete store.own[msg.id]; delete store.others[msg.id];
      if (store.currentId === msg.id) store.currentId = null;
      persist(); softRender();
    }
  } else if (msg.t === "newreq" && msg.req) {
    if (!isGM()) return;
    const rs = readLs(reqKey(), []); if (!rs.some((r) => r.id === msg.req.id)) { rs.push(msg.req); lsSet(reqKey(), JSON.stringify(rs)); }
    OBR.notification.show(`${msg.req.name} pediu para criar uma nova ficha.`); softRender();
  } else if (msg.t === "newok" && msg.pid === me.id) {
    addAllow(msg.reqId);
    if (consumeAllow()) escolherRegra((regra) => { const n = newSheet(); n.regra = regra; aplicarSugInicial(n); store.own[n.id] = n; store.currentId = n.id; tab = "principal"; persist(); scheduleSync(n); render(); });
    toast("O mestre aceitou: sua nova ficha foi criada.");
  } else if (msg.t === "newno" && msg.pid === me.id) {
    toast("O mestre recusou o pedido de nova ficha.");
  } else if (msg.t === "roll") {
    if (msg.secret && !isGM()) return; // rolagem secreta: só o mestre recebe
    if (obrOk) OBR.notification.show((msg.secret ? `🙈 ${msg.who} (secreta): ` : "") + msg.text.split("\n")[0]);
    addLog(msg.text, msg.who, !!msg.secret, msg.id);
  } else if (msg.t === "lib" && msg.lib?.itens && !isGM()) {
    if (libMerge(msg.lib)) toast(`O mestre enviou a biblioteca do livro (${msg.lib.itens.length} entradas).`);
  } else if (msg.t === "dice" && msg.pid && msg.pid !== me.id) {
    storeFeed(msg); if (tab === "pratos") softRender();
  }
}
async function pushAllOwn() {
  for (const s of Object.values(store.own)) await send({ t: "sheet", sheet: s });
}

function touchSheet(s) {
  s.updatedAt = Date.now();
  if (store.own[s.id] && me.name) s.owner = { id: me.id, name: me.name };
  persist(); scheduleSync(s); recordUndo(s);
}
function touch() { const s = cur(); if (s) touchSheet(s); }

/* ---------- Token (barras e vínculo) ---------- */
const tokenCache = {};
function tokenData(s) {
  return {
    sheetId: s.id, ownerId: s.owner?.id || me.id, nome: s.header.personagem,
    pv: [num(s.pv.atual), num(s.pv.max)], pd: isDet(s) ? [num(s.pd.atual), num(s.pd.max)] : [num(s.san?.atual), num(s.san?.max)], cor2: isDet(s) ? "#7b5cff" : "#2f9ed1", todos: !!s.token.barrasTodos,
  };
}
async function syncToken(s) {
  if (!sceneOk) return;
  const data = tokenData(s); const sig = JSON.stringify(data);
  if (tokenCache[s.id] === sig) return;
  try {
    const items = await OBR.scene.items.getItems((it) => it.metadata?.[LINK_KEY]?.sheetId === s.id);
    if (!items.length) { tokenCache[s.id] = sig; return; }
    await OBR.scene.items.updateItems(items.map((i) => i.id), (drafts) => { for (const d of drafts) d.metadata[LINK_KEY] = data; });
    tokenCache[s.id] = sig;
  } catch (e) { console.warn("Não foi possível atualizar o token", e); }
}
async function linkSelected(s) {
  if (!sceneOk) return toast("Abra uma cena no Owlbear primeiro.");
  const sel = await OBR.player.getSelection();
  if (!sel || !sel.length) return toast("Selecione um token no mapa e clique de novo.");
  try {
    await OBR.scene.items.updateItems(sel, (drafts) => { for (const d of drafts) d.metadata[LINK_KEY] = tokenData(s); });
    tokenCache[s.id] = JSON.stringify(tokenData(s));
    toast(`Ficha vinculada a ${sel.length} token(s).`); refreshLinkCount();
  } catch { toast("Sem permissão para alterar esse token. Peça ao mestre."); }
}
async function unlinkAll(s) {
  if (!sceneOk) return;
  try {
    const items = await OBR.scene.items.getItems((it) => it.metadata?.[LINK_KEY]?.sheetId === s.id);
    await OBR.scene.items.updateItems(items.map((i) => i.id), (drafts) => { for (const d of drafts) delete d.metadata[LINK_KEY]; });
    toast("Vínculo removido."); refreshLinkCount();
  } catch { toast("Não foi possível desvincular."); }
}
async function refreshLinkCount() {
  const el = document.getElementById("linkInfo"); const s = cur();
  if (!el || !s) return;
  if (!sceneOk) { el.textContent = "Abra uma cena para vincular a um token."; return; }
  try {
    const items = await OBR.scene.items.getItems((it) => it.metadata?.[LINK_KEY]?.sheetId === s.id);
    el.textContent = items.length ? `Vinculada a ${items.length} token(s) nesta cena.` : "Sem token vinculado nesta cena.";
    document.getElementById("btnUnlink")?.toggleAttribute("hidden", !items.length);
  } catch { /* */ }
}

/* ---------- Cálculos ---------- */
function attrVal(s, a) { return clamp(num(s.attrs[a]), 0, 5); }
function nivelNex(s) { return num(s.nex) >= 99 ? 20 : Math.max(1, Math.round(num(s.nex) / 5)); }
function pdLimiteBase(s) { return Math.round(num(s.nex) / 5); }
function pdLimite(s) { return pdLimiteBase(s) + num(s.pdBonus); }
function condFx(s) {
  const fx = { dAll: 0, dFis: 0, dMen: 0, dAtk: 0, dMelee: 0, dPer: {}, dAttr: {}, defs: new Set(), mov: new Set(), custo: 0 };
  for (const c of activeConds(s)) {
    const e = COND_MAP[c]?.e; if (!e) continue;
    for (const k of ["dAll", "dFis", "dMen", "dAtk", "dMelee"]) if (e[k]) fx[k] = Math.max(fx[k], e[k]);
    if (e.dAttr) for (const [a, v] of Object.entries(e.dAttr)) fx.dAttr[a] = Math.max(fx.dAttr[a] || 0, v);
    if (e.dPer) for (const [p, v] of Object.entries(e.dPer)) fx.dPer[p] = Math.max(fx.dPer[p] || 0, v);
    if (e.def) fx.defs.add(e.def);
    if (e.mov) fx.mov.add(e.mov);
    if (e.custo) fx.custo = Math.max(fx.custo, e.custo);
  }
  return fx;
}
function sobrecarregado(s) { return cargaAtual(s) > cargaMax(s); }
function cargaPen(s, pericia) { return sobrecarregado(s) && (PER_MARK[pericia] || "").includes("+") ? -5 : 0; }
function periciaBonus(s, n) { const p = s.pericias[n]; return p ? num(p.treino) + num(p.outros) : 0; }
function periciaTotal(s, n) { return periciaBonus(s, n) + cargaPen(s, n); }
function hexaPen(s) { return -clamp(num(s.hexa?.pen), 0, 6); } // Hexatombe: −1 em testes por sino (máx. −6)
function periciaTeste(s, n) { return periciaTotal(s, n) + hexaPen(s) + ultTeste(s); }
function dicePenalty(s, attr, pericia, isAttack) {
  const fx = condFx(s);
  let pen = fx.dAll;
  if (["FOR", "AGI", "VIG"].includes(attr)) pen += fx.dFis;
  if (["INT", "PRE"].includes(attr)) pen += fx.dMen;
  if (isAttack) pen += fx.dAtk + (pericia === "Luta" ? fx.dMelee : 0);
  if (pericia && fx.dAttr[attr]) pen += fx.dAttr[attr];
  if (pericia && fx.dPer[pericia]) pen += fx.dPer[pericia];
  if (s.hexa?.desertor) pen += 1; // Hexatombe: desertor sofre −1d em testes
  return pen;
}
function defProtecoes(s) { return s.protecoes.reduce((a, p) => a + num(p.defesa), 0); }
function defPenalty(s) {
  const d = condFx(s).defs; let p = 0;
  if (d.has("indefeso")) p -= 10; else if (d.has("desprevenido")) p -= 5;
  if (d.has("vulneravel")) p -= 2;
  return p + (sobrecarregado(s) ? -5 : 0);
}
function defesaTotal(s) { return 10 + attrVal(s, "AGI") + defProtecoes(s) + num(s.defesa.equip) + num(s.defesa.outros) + defPenalty(s) + ultDef(s); }
function deslocEfetivo(s) {
  const mov = condFx(s).mov; let d = num(s.desloc);
  if (sobrecarregado(s)) d -= 3;
  if (mov.has("lento")) d = d / 2;
  if (mov.has("caido")) d = Math.min(d, 1.5);
  if (mov.has("imovel")) d = 0;
  return Math.max(0, Math.floor(d / 1.5) * 1.5);
}
function allItems(s) { return ITEM_LISTS.flatMap((k) => s[k]); }
function cargaAtual(s) { return allItems(s).reduce((a, it) => a + num(it.espacos), 0); }
function cargaMax(s) { const f = attrVal(s, "FOR"); return (f > 0 ? 5 * f : 2) + num(s.equip.cargaMod); }
function catCount(s, c) { return allItems(s).filter((it) => num(it.categoria) === c).length; }
function sugerido(s) {
  const st = CLASSE_STATS[s.header.classe] || CLASSE_STATS.Combatente; const n = nivelNex(s);
  const vig = attrVal(s, "VIG"), pre = attrVal(s, "PRE");
  const r = isDet(s) ? st.pd : st.pe;
  return { pv: st.pv[0] + vig + (n - 1) * (st.pv[1] + vig), pd: r[0] + pre + (n - 1) * (r[1] + pre), san: st.san[0] + (n - 1) * st.san[1] };
}
function needsBackup(s) {
  if (!store.own[s.id]) return false;
  const changed = num(s.updatedAt) > num(s.lastExport) + 5000;
  return changed && (!s.lastExport || Date.now() - num(s.lastExport) > 24 * 3600e3);
}

const CALC = {
  pdBase: (s) => pdLimiteBase(s),
  pdTotal: (s) => pdLimite(s),
  pdRodada: (s) => `${num(s.pdRodada)} / ${pdLimite(s)}`,
  blocos: (s) => { const e = deslocEfetivo(s); return `${+(e / 1.5).toFixed(1)} blocos${e !== num(s.desloc) ? ` (efetivo ${e}m)` : ""}`; },
  agi: (s) => attrVal(s, "AGI"),
  defProt: (s) => defProtecoes(s),
  defPen: (s) => { const p = defPenalty(s); return [p ? `Condições/carga: ${p} na Defesa` : "", ultDef(s) ? `Forma suprema: +${ultDef(s)} na Defesa (já somado)` : ""].filter(Boolean).join(" · "); },
  defesa: (s) => defesaTotal(s),
  bloqueio: (s) => periciaTotal(s, "Fortitude"),
  esquiva: (s) => defesaTotal(s) + periciaTotal(s, "Reflexos"),
  carga: (s) => cargaAtual(s),
  cargaMax: (s) => cargaMax(s),
  cargaTotal: (s) => cargaMax(s),
  cargaAviso: (s) => (cargaAtual(s) > 2 * cargaMax(s) ? `Acima do dobro do limite (${2 * cargaMax(s)}): pelas regras, não dá para carregar tudo isso.` : sobrecarregado(s) ? `Sobrecarregado: −5 na Defesa e nas perícias com +, −3m de deslocamento (máximo absoluto: ${2 * cargaMax(s)} espaços).` : ""),
  patenteDica: (s) => { const sug = patentePorPP(s.equip.prestigio); return sug !== s.equip.patente && PATENTE_TAB[s.equip.patente] ? `Com ${num(s.equip.prestigio)} PP a patente seria ${sug}.` : ""; },
  cat: (s, c) => catCount(s, Number(c)),
  pbonus: (s, n) => fmt(periciaTeste(s, n)),
  pdice: (s, n) => { const v = attrVal(s, s.pericias[n].attr) - dicePenalty(s, s.pericias[n].attr, n, false); return v > 0 ? `${v}d20` : `${2 - v}d20↓`; },
  pvfill: (s) => pct(s.pv), pdfill: (s) => pct(s.pd),
  pvTempTxt: (s) => (num(s.pvTemp) ? `+${num(s.pvTemp)} temporários` : ""),
  pdTempTxt: (s) => (num(s.pdTemp) ? `+${num(s.pdTemp)} temporários` : ""),
  sumName: (s, p) => getPath(s, p + ".nome") || "(sem nome)",
  sumInfo: (s, p, key) => SCHEMAS[key].info(getPath(s, p) || {}),
  sugestao: (s) => { const g = sugerido(s); return `Sugerido para ${s.header.classe} com NEX ${s.nex}%: PV ${g.pv} · ${isDet(s) ? `Determinação ${g.pd}` : `PE ${g.pd} · SAN ${g.san}`}`; },
  sanfill: (s) => pct(s.san || { atual: 0, max: 0 }),
};
function pct(b) { const m = num(b.max); return m > 0 ? clamp((num(b.atual) / m) * 100, 0, 100) : 0; }

function refreshDerived() {
  const s = cur(); if (!s) return;
  document.querySelectorAll("[data-calc]").forEach((el) => {
    const [fn, ...args] = el.dataset.calc.split("|");
    const v = CALC[fn]?.(s, ...args);
    if (fn === "pvfill" || fn === "pdfill" || fn === "sanfill") el.style.width = v + "%";
    else el.textContent = isDet(s) ? v : trPE(v);
  });
  const over = sobrecarregado(s);
  document.querySelectorAll(".carga-num").forEach((el) => el.classList.toggle("over", over));
  document.querySelectorAll("[data-catcount]").forEach((el) => {
    const c = Number(el.dataset.catcount);
    el.classList.toggle("over", c > 0 && catCount(s, c) > num(s.equip.limites[c]));
  });
  document.querySelectorAll("[data-rollper]").forEach((b) => {
    const n = b.dataset.rollper; const blocked = (PER_MARK[n] || "").includes("*") && !num(s.pericias[n].treino);
    b.disabled = blocked; b.title = blocked ? `${n} só pode ser usada treinada` : `Rolar ${n}`;
  });
  const banners = document.getElementById("banners");
  if (banners) banners.innerHTML = bannersHTML(s);
}

/* ---------- Dados ---------- */
const die = (f) => 1 + Math.floor(Math.random() * f);
function rollTest(nDice) {
  const n = nDice > 0 ? nDice : 2 - nDice; const dice = Array.from({ length: n }, () => die(20));
  return { dice, pick: nDice > 0 ? Math.max(...dice) : Math.min(...dice), worst: nDice <= 0 };
}
// Rola expressões como "2d6+1d4+3"; mult multiplica só os dados (crítico)
function rollExpr(expr, mult = 1) {
  const str = String(expr || "").replace(/\s+/g, "").toLowerCase();
  if (!str) return { total: 0, txt: "", ok: false, groups: [] };
  const re = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g; let m, total = 0; const parts = []; const groups = [];
  while ((m = re.exec(str))) {
    if (m[3]) {
      const sign = m[1] === "-" ? -1 : 1; const qty = (Number(m[2]) || 1) * mult; const faces = Number(m[3]);
      const rs = Array.from({ length: Math.min(qty, 200) }, () => die(faces));
      const sum = rs.reduce((a, b) => a + b, 0); total += sign * sum;
      parts.push(`${sign < 0 ? "−" : ""}${qty}d${faces}[${rs.join(",")}]`); groups.push({ f: faces, vals: rs, keep: -1 });
    } else {
      const v = (m[4] === "-" ? -1 : 1) * Number(m[5]); total += v; parts.push(fmt(v));
    }
  }
  return { total, txt: parts.join(" "), ok: parts.length > 0, groups };
}
// v3.6: relê o histórico salvo antes de gravar, para a janelinha do acesso rápido e a ficha
// não apagarem as rolagens uma da outra; o id evita a mesma rolagem entrar duas vezes.
function addLog(text, who, hidden, id) {
  id ||= Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  try { rollLog = JSON.parse(lsGet(storeKey + ":log") || "[]"); } catch { /* mantém o que tem */ }
  if (rollLog.some((r) => r.id === id)) return id;
  rollLog.unshift({ id, at: Date.now(), text, who: who || "", hidden: !!hidden });
  rollLog = rollLog.slice(0, 150);
  lsSet(storeKey + ":log", JSON.stringify(rollLog));
  if (tab === "rolagens" || tab === "dados") softRender();
  return id;
}
function announce(text, forceHidden = false) {
  if (cur() && !isDet(cur())) text = trPE(text);
  if (QUICK_ID) setTimeout(() => { const el = document.getElementById("qkLast"); if (el) el.textContent = text; }, 60);
  const hidden = forceHidden || (isGM() && hiddenRolls);
  const secret = !isGM() && secretRoll && !forceHidden;
  trayText(text);
  soltarDrama(hidden || secret);
  const id = addLog(text, me.name, hidden || secret);
  if (obrOk) {
    OBR.notification.show((hidden || secret ? "🙈 " : "") + text.split("\n")[0] + (secret ? " (só o mestre vê)" : ""));
    if (secret) send({ t: "roll", text, who: me.name, secret: true, id });
    else if (!hidden) { send({ t: "roll", text, who: me.name, id }); shareDiceSoon(text); }
  } else toast(text);
}
function testLine(s, pericia, isAttack, extraBonus = 0, opts = {}) {
  const p = s.pericias[pericia]; const attr = p ? p.attr : "AGI";
  const nDice = attrVal(s, attr) - dicePenalty(s, attr, pericia, isAttack);
  const m = opts.noMod ? { dados: 0, bonus: 0 } : takeNextMod();
  const r = rollTest(nDice + num(m.dados) + num(opts.dados)); const b = (p ? periciaTeste(s, pericia) : hexaPen(s) + ultTeste(s)) + num(extraBonus) + num(m.bonus);
  if (!opts.noAnim) { diceAnim(r.dice, r.pick, r.worst); marcarDrama(r.pick, pericia); }
  return { ...r, bonus: b, total: r.pick + b, txt: `[${r.dice.join(", ")}]${r.worst ? " (pior)" : ""} → ${r.pick} ${fmt(b)} = ${r.pick + b}${modTxt(m)}${diceWhy(s, attr, pericia, isAttack, num(m.dados))}${ultTeste(s) ? ` (⚡ forma suprema ${fmt(ultTeste(s))})` : ""}${opts.nota || ""}` };
}
function rollPericia(s, n) {
  if ((PER_MARK[n] || "").includes("*") && !num(s.pericias[n].treino)) return toast(`${n} só pode ser usada se for treinada.`);
  const t = testLine(s, n, false);
  announce(`${s.header.personagem} — ${n}: ${t.txt}`);
}
function rollAttr(s, a) {
  const m = takeNextMod();
  const r = rollTest(attrVal(s, a) - dicePenalty(s, a, null, false) + num(m.dados)); const hp = hexaPen(s) + ultTeste(s) + num(m.bonus);
  diceAnim(r.dice, r.pick, r.worst); marcarDrama(r.pick, `Teste de ${a}`);
  announce(`${s.header.personagem} — teste de ${a}${diceWhy(s, a, null, false, num(m.dados))}: [${r.dice.join(", ")}]${r.worst ? " (pior)" : ""} → ${r.pick}${hp ? ` ${fmt(hp)} = ${r.pick + hp}` : ""}${modTxt(m)}${ultTeste(s) ? ` (⚡ forma suprema ${fmt(ultTeste(s))})` : ""}`);
}
function rollAttack(s, a) {
  // a = { nome, pericia, bonus, critico, mult, dano, tipo, attrDano (sigla ou ""), adicionais }
  const semProf = a.prof && !temProf(s, a.prof);
  const t = testLine(s, a.pericia, true, a.bonus, semProf ? { dados: -2, nota: ` (sem proficiência em ${a.prof}: −2d)` } : {});
  const crit = t.pick >= clamp(num(a.critico) || 20, 1, 20);
  const mult = crit ? Math.max(1, num(a.mult) || 2) : 1;
  if (crit) marcarDrama(20, `${a.nome || "Ataque"} · dano ×${mult}`, t.pick < 20 ? `margem ${t.pick}` : "");
  else if (drama) drama.sub = a.nome || drama.sub;
  const d = rollExpr(ultDanoExpr(s, a.dano), mult); const dmgGroups = [...d.groups];
  const attrB = a.attrDano ? attrVal(s, a.attrDano) : 0;
  let total = d.total + attrB;
  let dano = d.ok ? `${d.txt}${attrB ? ` ${fmt(attrB)} (${a.attrDano})` : ""}${ultDanoExpr(s, a.dano) !== a.dano ? ` (⚡ +${num(s.ult.danoN)}d forma suprema)` : ""}` : (attrB ? `${fmt(attrB)} (${a.attrDano})` : "");
  const extras = [];
  if ((s.hexa?.rewards || []).includes("Rancor")) { total += 5; dano += " +5 (Rancor)"; }
  if (s.hexa?.batalha) { const bt = rollExpr("1d10"); extras.push(`+ ${bt.total} se o alvo for ${s.hexa.batalha} (batalha de intenções)`); }
  for (const ad of a.adicionais || []) {
    const r = rollExpr(ad.dano); if (r.ok) { extras.push(`+ ${r.total} ${ad.tipo}`); dmgGroups.push(...r.groups); }
  }
  const lines = [
    `${s.header.personagem} — ${a.nome || "Ataque"} (${a.pericia}): ${t.txt}${crit ? ` CRÍTICO ×${mult}!` : ""}`,
    `Dano: ${total} ${a.tipo || ""}${extras.length ? " " + extras.join(" ") : ""}${dano ? `  —  ${dano}` : ""}`,
  ];
  if (dmgGroups.length) setTimeout(() => trayRoll(dmgGroups, true), 350);
  announce(lines.join("\n"));
}
function attackFromAtaque(at) {
  return {
    nome: at.nome, pericia: s_pericia(at.pericia), bonus: at.bonus, critico: at.critico, mult: at.mult, dano: at.dano,
    tipo: at.tipo, attrDano: ATTR_BY_NAME[at.attrDano] || "", adicionais: at.adicionais,
  };
}
function s_pericia(p) { return PER_MARK[p] !== undefined ? p : "Luta"; }
// Livro básico p. 54: todos usam armas simples; combatentes começam com táticas; sem proficiência = −2d no ataque
function temProf(s, prof) {
  const t = String(s.proficiencias || "").toLowerCase();
  if (!prof || prof === "Arma Simples") return true;
  if (prof === "Arma Tática") return s.header.classe === "Combatente" || /t[áa]tica/.test(t);
  if (prof === "Arma Pesada") return /pesada/.test(t);
  return true;
}
function attackFromArma(w, which) {
  const melee = w.tipo === "Corpo a Corpo"; const throwW = w.tipo === "Arma de Arremesso";
  const dano = which === 2 ? dmgTxt(w.dano2, w.dano2Fixo) : dmgTxt(w.dano, w.danoFixo);
  return {
    nome: w.nome + (which === 2 ? " (secundário)" : ""), pericia: melee ? "Luta" : "Pontaria", bonus: w.bonus,
    critico: w.critico, mult: w.mult, dano, tipo: w.tipoDano, attrDano: melee || throwW ? "FOR" : "", adicionais: [], prof: w.prof,
  };
}

/* ---------- Gasto de PD ---------- */
const forceSpend = {};
function spendPD(s, cost, label, btn) {
  const lim = pdLimite(s); const key = s.id + label;
  if (num(s.pd.atual) + num(s.pdTemp) < cost) { toast(`Determinação insuficiente: precisa de ${cost} PD e você tem ${num(s.pd.atual)}.`); return false; }
  if (num(s.pdRodada) + cost > lim && !forceSpend[key]) {
    forceSpend[key] = true; setTimeout(() => delete forceSpend[key], 4000);
    toast(`Passa do limite de PD por rodada (${num(s.pdRodada)} + ${cost} > ${lim}). Clique de novo para gastar mesmo assim.`);
    if (btn) btn.classList.add("confirm");
    return false;
  }
  delete forceSpend[key];
  const tmp = Math.min(num(s.pdTemp), cost); s.pdTemp = num(s.pdTemp) - tmp;
  s.pd.atual = num(s.pd.atual) - (cost - tmp); s.pdRodada = num(s.pdRodada) + cost;
  touchSheet(s); return true;
}
function castRitual(s, path, versao, btn) {
  const r = getPath(s, path); if (!r) return;
  let extra = versao === "discente" ? num(r.custoDiscente) : versao === "verdadeiro" ? num(r.custoVerdadeiro) : 0;
  const ultLivre = extra > 0 && ultOn(s) && s.ult.ritualGratis; if (ultLivre) extra = 0;
  const cost = CUSTO_CIRCULO[num(r.circulo)] + extra + condFx(s).custo;
  if (!spendPD(s, cost, path + versao, btn)) return;
  const expr = versao === "discente" ? r.dadosDiscente : versao === "verdadeiro" ? r.dadosVerdadeiro : r.dados;
  const baseExpr = expr || (versao !== "normal" ? r.dados : ""); const rExpr = ultOn(s) && s.ult.danoRitual ? ultDanoExpr(s, baseExpr) : baseExpr;
  const d = rollExpr(rExpr); if (d.groups.length) trayRoll(d.groups);
  const nome = versao === "normal" ? r.nome : `${r.nome} (${versao === "discente" ? "Discente" : "Verdadeiro"})`;
  efeitoRitual(s, r.elemento, nome || "Ritual", `−${cost} ${resSig(s)}${d.ok ? ` · efeito ${d.total}` : ""}`);
  const res = r.resPericia && r.resPericia !== "—" ? ` · ${r.resPericia} DT ${dtRitual(s)}${r.resEfeito && r.resEfeito !== "—" ? " " + r.resEfeito.toLowerCase() : ""}` : "";
  announce(`${s.header.personagem} conjurou ${nome || "ritual"} (−${cost} PD${ultLivre ? ", versão avançada sem custo extra pela forma suprema" : ""})${res}${d.ok ? `\nEfeito: ${d.total}  —  ${d.txt}${rExpr !== baseExpr ? ` (⚡ +${num(s.ult.danoN)}d)` : ""}` : ""}`);
  render();
}
function useHab(s, path, btn) {
  const h = getPath(s, path); if (!h) return;
  const cost = num(h.custo) + condFx(s).custo;
  if (!spendPD(s, cost, path, btn)) return;
  announce(`${s.header.personagem} usou ${h.nome || "habilidade"} (−${cost} PD)`);
  render();
}

/* ---------- Componentes HTML ---------- */
function inp(path, val, type = "text", extra = "") {
  return `<input data-path="${path}" data-type="${type}" type="${type === "num" ? "number" : "text"}" value="${esc(val)}" ${extra}>`;
}
function sel(path, val, opts, extra = "") {
  return `<select data-path="${path}" ${extra}>${normOpts(opts).map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
}
function ta(path, val, rows = 3) { return `<textarea data-path="${path}" rows="${rows}">${esc(val)}</textarea>`; }
function imgField(path, val) {
  const isUrl = /^https?:/i.test(val || "");
  return `<div class="imgbox">${val ? `<img src="${esc(val)}" alt="">` : `<span class="empty">Sem imagem</span>`}
    <div class="imgbtns"><button data-imgup="${path}">Enviar</button>${val ? `<button data-imgdel="${path}" class="danger">Remover</button>` : ""}</div></div>
    <input class="imgurl" data-path="${path}" data-rerender="1" placeholder="…ou cole o link de uma imagem" value="${isUrl ? esc(val) : ""}">`;
}
function delBtn(path, label = "✕") { return `<button class="icon danger" data-del="${path}" title="Remover">${label}</button>`; }

function fieldHTML(f, p, val) {
  const wide = f.wide || ["textarea", "img", "strlist", "dmglist"].includes(f.type) ? "wide" : "";
  let body = "";
  if (f.type === "text") body = inp(p, val, "text", f.ph ? `placeholder="${esc(f.ph)}"` : "");
  else if (f.type === "num") body = inp(p, val, "num", `${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""}`);
  else if (f.type === "select") body = sel(p, val, f.opts);
  else if (f.type === "textarea") body = ta(p, val, 4);
  else if (f.type === "img") body = imgField(p, val);
  else if (f.type === "strlist") {
    body = `<div class="sublist">${(val || []).map((m, j) => `<div class="row">${inp(`${p}.${j}`, m)}${delBtn(`${p}.${j}`)}</div>`).join("")}
      <button class="add" data-addstr="${p}">+ melhoria</button></div>`;
  } else if (f.type === "dmglist") {
    body = `<div class="sublist">${(val || []).map((d, j) => `<div class="row">${inp(`${p}.${j}.dano`, d.dano, "text", 'placeholder="1d6"')}${sel(`${p}.${j}.tipo`, d.tipo, TIPOS_DANO)}${delBtn(`${p}.${j}`)}</div>`).join("")}
      <button class="add" data-adddmg="${p}">+ dano adicional</button></div>`;
  }
  return `<label class="${wide}">${esc(f.label)}${body}</label>`;
}
function listHTML(key) {
  const s = cur(); const base = LIST_PATHS[key]; const sc = SCHEMAS[key]; const arr = getPath(s, base);
  const af = s.header.afinidade;
  return `<div class="list" data-list="${key}">${arr.map((it, i) => {
    const p = `${base}.${i}`;
    const star = key === "rituais" && af && it.elemento === af ? `<span class="afin" title="Elemento da sua afinidade">★</span>` : "";
    const elem = (key === "rituais" || key === "amaldicoados") && FX.EL_COR[it.elemento] ? it.elemento : "";
    const ultH = key === "habilidades" ? ultAprimora(s, it) : null;
    const acts = (ultH ? `<div class="ult-note">⚡ <b>${esc(s.ult.nome || "Forma suprema")}:</b> ${esc(ultH.desc || ultH.nome)}</div>` : "") + (sc.actions ? sc.actions(p, it) : "");
    return `<details class="item ${star ? "is-afin" : ""} ${ultH ? "is-ult" : ""}" data-id="${it.id}" data-idx="${i}" data-hay="${esc((sc.hay(it) || "").toLowerCase())}" ${sc.attrs ? sc.attrs(it) : ""} ${elem ? `data-elem="${elem}" style="--elc:${FX.corDe(elem)}"` : ""} ${openCards.has(it.id) ? "open" : ""}>
      <summary><span class="drag" draggable="true" data-drag="${key}|${i}" title="Arraste para reordenar">⋮⋮</span>${star}${ultH ? `<span class="ult-mk" title="Aprimorada na forma suprema">⚡</span>` : ""}${elem ? `<span class="el-glifo" title="${esc(elem)}">${FX.glifo(elem, 18)}</span>` : ""}<span class="sum-name" data-calc="sumName|${p}"></span><span class="sum-info" data-calc="sumInfo|${p}|${key}"></span>${sc.quick ? sc.quick(p) : ""}${RAPIDO_KEYS.includes(key) ? `<button class="icon qk-tog ${isRapido(s, key, it.id) ? "on" : ""}" data-rapido="${key}|${it.id}" title="${isRapido(s, key, it.id) ? "Tirar do acesso rápido" : "Pôr no acesso rápido (até 4)"}">⚡</button>` : ""}${delBtn(p)}</summary>
      ${acts ? `<div class="actions">${acts}</div>` : ""}
      <div class="fields">${sc.fields.map((f) => fieldHTML(f, `${p}.${f.k}`, it[f.k])).join("")}</div></details>`;
  }).join("") || `<p class="muted">Nada adicionado ainda.</p>`}</div>
  <button class="add" data-add="${key}">+ Adicionar ${sc.title}</button>`;
}
function filterBar(scope, opts = {}) {
  const f = (filters[scope] ||= { q: "", cat: "", el: "", circ: "" });
  return `<div class="filterbar" data-scope="${scope}">
    <input data-filter="${scope}|q" placeholder="🔍 Buscar…" value="${esc(f.q)}">
    ${opts.cat ? `<select data-filter="${scope}|cat"><option value="">Categoria</option>${CATS.map(([c, l]) => `<option value="${c}" ${String(f.cat) === String(c) ? "selected" : ""}>Cat. ${l}</option>`).join("")}</select>` : ""}
    ${opts.el ? `<select data-filter="${scope}|el"><option value="">Elemento</option>${ELEMENTOS.map((e) => `<option ${f.el === e ? "selected" : ""}>${e}</option>`).join("")}</select>` : ""}
    ${opts.circ ? `<select data-filter="${scope}|circ"><option value="">Círculo</option>${[1, 2, 3, 4].map((c) => `<option value="${c}" ${String(f.circ) === String(c) ? "selected" : ""}>${c}º</option>`).join("")}</select>` : ""}
  </div>`;
}
function applyFilters() {
  document.querySelectorAll(".filterbar").forEach((bar) => {
    const f = filters[bar.dataset.scope] || {};
    let el = bar.nextElementSibling; const lists = [];
    while (el && !el.classList.contains("filterbar")) { el.querySelectorAll?.("details.item").forEach((d) => lists.push(d)); if (el.matches?.("details.item")) lists.push(el); el = el.nextElementSibling; }
    for (const d of lists) {
      const ok = (!f.q || d.dataset.hay.includes(f.q.toLowerCase())) && (f.cat === "" || f.cat == null || d.dataset.cat === String(f.cat)) &&
        (!f.el || d.dataset.el === f.el) && (!f.circ || d.dataset.circ === String(f.circ));
      d.hidden = !ok;
    }
  });
}

/* ---------- Abas ---------- */
function tabsFor() {
  const t = [["principal", "Principal"], ["pericias", "Perícias"], ["combate", "Combate"], ["habilidades", "Habilidades"], ["rituais", "Rituais"], ["inventario", "Inventário"], ["notas", "Notas"], ["interludio", "Interlúdio"], ["dados", "Dados"], ["rolagens", "Rolagens"], ["pratos", "Pratos da mesa"]];
  if (isGM()) t.push(["mesa", "Mesa"]);
  if (cur()?.ult?.habilitada) t.splice(1, 0, ["ult", "⚡ Ult"]);
  return t;
}
const mentalBar = (s) => (isDet(s) ? s.pd : s.san);
function bannersHTML(s) {
  let h = "";
  if (num(s.pv.atual) <= 0) h += counterBanner(s, "morrendo");
  if (num(mentalBar(s)?.atual) <= 0) h += counterBanner(s, "enlouquecendo");
  return h;
}
function counterBanner(s, k) {
  const v = num(s[k]); const morr = k === "morrendo";
  const recurso = morr ? "PV" : isDet(s) ? "PD" : "SAN";
  const fim = v >= 3;
  const desc = fim ? (morr ? "O personagem começou o terceiro turno morrendo: está morto." : "O personagem começou o terceiro turno enlouquecendo: está insano e passa para o controle do mestre.")
    : morr ? "PV em 0: você está inconsciente e morrendo. No começo de cada turno seu, marque abaixo. Se começar 3 turnos assim na mesma cena, o personagem morre."
    : `${recurso} em 0: você está enlouquecendo. No começo de cada turno seu, marque abaixo. Se começar 3 turnos assim na mesma cena, o personagem fica insano.`;
  const ultAviso = !morr && ultOn(s) ? `<span class="ult-txt">⚡ Na forma suprema: se ficar insano, o personagem vira um NPC controlado pela intenção assassina (ou semelhante da sua mesa).</span>` : "";
  return `<div class="banner ${k} ${fim ? "fim" : ""}"><b>${fim ? (morr ? "☠ MORTO" : "✖ INSANO") : morr ? "MORRENDO" : "ENLOUQUECENDO"}</b><span>${desc}</span>${ultAviso}
    <div class="row wrap"><span class="pips">${[1, 2, 3].map((i) => `<span class="pip ${v >= i ? "on" : ""}">${i}</span>`).join("")}</span>
    ${fim ? "" : `<button class="primary" data-dying="${k}|turno">▶ Comecei meu turno ${morr ? "morrendo" : "enlouquecendo"} (${v + 1}/3)</button>`}
    ${v ? `<button class="ghost icon" data-dying="${k}|voltar" title="Desmarcar o último">↶</button>` : ""}
    <button data-dying="${k}|salvo">${morr ? "✚ Fui estabilizado (fico com 1 PV)" : `✚ Fui acalmado (fico com 1 ${recurso})`}</button></div></div>`;
}
function tabPrincipal(s) {
  const pos = { AGI: [50, 15], INT: [86, 41], VIG: [73, 84], PRE: [27, 84], FOR: [14, 41] };
  const pts = ["AGI", "INT", "VIG", "PRE", "FOR"].map((a) => `${pos[a][0] * 2.9},${pos[a][1] * 2.7}`).join(" ");
  const nex = num(s.nex);
  return `
  <div id="banners">${bannersHTML(s)}</div>
  ${(s.rapido || []).length ? `<section class="card"><h3>Acesso rápido <span class="muted">também no botão ≡ ao lado do token</span></h3>${quickHTML(s)}</section>` : ""}
  ${hexaCard(s)}
  ${ultCard(s)}
  <section class="card header">
    <div class="portrait">${imgField("header.img", s.header.img)}</div>
    <div class="hfields">
      <label class="wide">Personagem ${inp("header.personagem", s.header.personagem)}</label>
      <label>Jogador ${inp("header.jogador", s.header.jogador)}</label>
      <label>Origem ${inp("header.origem", s.header.origem)}</label>
      <label class="wide">Classe ${sel("header.classe", s.header.classe, CLASSES, 'data-rerender="1"')}</label>
      <label class="wide" data-keep>Regra ${sel("regra", s.regra, REGRAS, 'data-rerender="1"')}</label>
    </div>
  </section>

  ${obrOk ? `<section class="card tokencard">
    <div class="row wrap"><button id="btnLink">🔗 Vincular ao token selecionado</button><button id="btnUnlink" class="ghost danger" hidden>Desvincular</button></div>
    <div class="row wrap"><span class="muted" id="linkInfo">…</span>
    <label class="check"><input type="checkbox" data-path="token.barrasTodos" ${s.token.barrasTodos ? "checked" : ""}> Barras visíveis para todos</label></div>
  </section>` : ""}

  <section class="card">
    <h3>Atributos <span class="muted">clique na sigla para rolar</span></h3>
    <div class="penta">
      <svg viewBox="0 0 290 270"><polygon points="${pts}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/></svg>
      <div class="center">ATRIBUTOS</div>
      ${ATTRS.map(([a, n]) => `<div class="attr" style="left:${pos[a][0]}%;top:${pos[a][1]}%">
        <input data-path="attrs.${a}" data-type="num" data-min="0" data-max="5" type="number" min="0" max="5" value="${attrVal(s, a)}">
        <span class="nm">${n}</span><button class="ab" data-rollattr="${a}">${a}</button></div>`).join("")}
    </div>
  </section>

  <section class="card grid3">
    <label>NEX ${sel("nex", s.nex, NEX_OPTS.map((n) => [n, n + "%"]), 'data-rerender="1"')}</label>
    <label>Limite de PD por rodada
      <div class="row"><span class="calc small" data-calc="pdBase"></span><span class="muted">+</span>${inp("pdBonus", s.pdBonus, "num", 'title="Bônus"')}<span class="muted">=</span><span class="calc" data-calc="pdTotal"></span></div>
    </label>
    <label>Deslocamento
      <div class="row">${inp("desloc", s.desloc, "num", 'step="1.5" min="0"')}<span class="muted">m</span></div>
      <span class="muted" data-calc="blocos"></span>
    </label>
  </section>

  <section class="card">
    ${barHTML("pv", "Pontos de Vida", s.pv)}
    ${barHTML("pd", "Determinação", s.pd)}
    ${isDet(s) ? "" : barHTML("san", "Sanidade", s.san)}
    <div class="row wrap between">
      <span class="muted">PD gastos nesta rodada: <b data-calc="pdRodada"></b></span>
      <button id="btnRound">Nova rodada</button>
    </div>
    <div class="row wrap between sug">
      <span class="muted" data-calc="sugestao"></span>
      <button id="btnApplySug" class="ghost">Aplicar máximos</button>
    </div>
  </section>
  ${danoCard(s)}

  <section class="card">
    <h3>Condições <span class="muted">passe o mouse para ver o efeito</span></h3>
    <div class="chips">${CONDICOES.map(([n, d]) => { const ef = efeitoDaCond(s, n); return `<button class="chip ${s.condicoes.includes(n) || ef ? "on" : ""} ${ef ? "timed" : ""}" data-cond="${esc(n)}" title="${esc(d)}${ef ? ` — vem do efeito “${esc(ef.nome)}”` : ""}">${ef ? "⏱ " : ""}${esc(n)}</button>`; }).join("")}</div>
    ${activeConds(s).length ? `<ul class="condlist">${activeConds(s).map((c) => `<li><b>${esc(c)}:</b> ${esc(COND_MAP[c]?.d || "")}</li>`).join("")}</ul>` : ""}
  </section>
  ${efeitosCard(s)}

  <section class="card">
    <h3>Defesa</h3>
    <div class="defline">
      <label>Base<div class="calc small">10</div></label>
      <label>Agilidade<div class="calc small" data-calc="agi"></div></label>
      <label>Proteções<div class="calc small" data-calc="defProt"></div></label>
      <label>Equip. ${inp("defesa.equip", s.defesa.equip, "num")}</label>
      <label>Outros ${inp("defesa.outros", s.defesa.outros, "num")}</label>
    </div>
    <p class="muted warn" data-calc="defPen"></p>
    <div class="grid3" style="margin-top:6px">
      <label>Defesa<div class="calc" data-calc="defesa"></div></label>
      <label>Bloqueio <span class="muted" style="text-transform:none">(Fortitude)</span><div class="calc" data-calc="bloqueio"></div></label>
      <label>Esquiva <span class="muted" style="text-transform:none">(Def. + Reflexos)</span><div class="calc" data-calc="esquiva"></div></label>
    </div>
  </section>

  <section class="card">
    <h3>Trilha e afinidade</h3>
    <div class="grid2">
      <label>Trilha <span class="row">${inp("header.trilha", s.header.trilha, "text", 'placeholder="Ex.: Aniquilador" data-rerender="1"')}<button class="small" data-trilha="1" title="Escolher entre as trilhas dos livros carregados">📚 Escolher</button></span></label>
      <label>Afinidade ${nex >= 50 ? sel("header.afinidade", s.header.afinidade, [["", "—"], ...ELEMENTOS], 'data-rerender="1"') : `<span class="muted" style="text-transform:none">Liberada com NEX 50%</span>`}</label>
      ${trilhaAviso(s)}
      ${TRILHA_NEX.map((n) => { const prox = trilhaAtual(s)?.habs.find((it) => num(it.nex) === n); return `<label class="wide ${nex >= n ? "reached" : "locked"}">Habilidade de trilha — NEX ${n}% ${nex >= n ? "✓" : "🔒"} <textarea data-path="trilhaHab.${n}" rows="2" ${prox && !s.trilhaHab[n] ? `placeholder="${esc(`${nex >= n ? "" : "Próxima: "}${prox.nome}`)}"` : ""}>${esc(s.trilhaHab[n])}</textarea></label>`; }).join("")}
    </div>
  </section>

  <section class="card grid2">
    <label>Resistências ${ta("resistencias", s.resistencias)}</label>
    <label>Proficiências ${ta("proficiencias", s.proficiencias)}</label>
  </section>

  <section class="card">
    <label>Tema de cores da ficha ${sel("header.tema", s.header.tema, TEMAS, 'data-rerender="1"')}</label>
  </section>`;
}
const HEXA_REWARDS = {
  Desejo: "Após cair morrendo pela primeira vez no dia, recebe +15 PV temporários e levanta.",
  Rancor: "+5 de dano do mesmo tipo sempre que causa dano (já somado nas rolagens).",
  "Obsessão": "RD 5.",
  Culpa: "Recebe um poder de quem morreu.",
  Prazer: "+10 PV máximos (já aplicado).",
  Orgulho: "+10 PD máximos (já aplicado).",
};
function hexaCard(s) {
  const h = s.hexa; if (!h) return "";
  const surv = sobrevivenciaHTML(h);
  const lines = [];
  if (h.desertor) lines.push(`<li class="bad"><b>Desertor:</b> −1d em testes${num(h.pen) ? ` e ${hexaPen(s)} em testes (${num(h.pen)}/6 sinos)` : ""}; PV máximos pela metade.</li>`);
  if (h.batalha) lines.push(`<li><b>Batalha de intenções contra ${esc(h.batalha)}:</b> +1d10 de dano nele; dano de qualquer outra fonte cai pela metade.</li>`);
  for (const r of h.rewards || []) lines.push(`<li class="good"><b>Intenção (${esc(r)}):</b> ${esc(HEXA_REWARDS[r] || "")}</li>`);

  const desejo = (h.rewards || []).includes("Desejo") ? `<button id="btnDesejo" class="ghost">Usar Desejo: +15 PV temporários e levantar</button>` : "";
  return `<section class="card hexa"><h3>Hexatombe</h3>${surv}${lines.length ? `<ul>${lines.join("")}</ul>` : ""}${desejo}</section>`;
}

/* =========================================================
   v3.10 — Versão ultimate da ficha / forma suprema
   (Arquivos Secretos 2: Hexatombe, p. 96–97 — "As máscaras na sua mesa")
   ========================================================= */
function ultBase() {
  return {
    habilitada: false, ativo: false, rodada: 0, ganho: null,
    nome: "Forma suprema", item: "", img: "", desc: "",
    custoAtivar: 6, custoRodada: 2, // SAN (ou PD na regra de Determinação)
    pv: 20, pd: 10, def: 10,        // recebidos ao ativar (atuais e máximos)
    // Recomendações do livro: cada jogador escolhe quais a ficha recebe
    ritualGratis: false, danoDados: false, danoN: 2, danoRitual: false, testes: false, testesN: 5, dt: false, dtN: 5,
    habilidades: [],
  };
}
const ultOn = (s) => !!(s?.ult?.habilitada && s.ult.ativo);
const ultTeste = (s) => (ultOn(s) && s.ult.testes ? num(s.ult.testesN) : 0);
const ultDef = (s) => (ultOn(s) ? num(s.ult.def) : 0);
const ultDT = (s) => (ultOn(s) && s.ult.dt ? num(s.ult.dtN) : 0);
const dtRitual = (s) => num(s.rituais.dt) + ultDT(s);
// Recurso que paga a forma suprema: Sanidade (livro) ou Determinação (regra de Determinação, que não tem SAN)
const ultPagaSig = (s) => (isDet(s) ? "PD" : "SAN");
// "+2 dados do mesmo tipo": 6d6 vira 8d6 (só o primeiro grupo de dados da expressão)
function ultDanoExpr(s, expr) {
  if (!ultOn(s) || !s.ult.danoDados || !num(s.ult.danoN)) return expr;
  return String(expr || "").replace(/(\d*)d(\d+)/i, (m0, q, f) => `${(Number(q) || 1) + num(s.ult.danoN)}d${f}`);
}
function ultAprimora(s, hab) {
  if (!ultOn(s) || !hab?.nome) return null;
  return s.ult.habilidades.find((h) => h.alvo && normTxt(h.alvo) === normTxt(hab.nome)) || null;
}
function ultResumo(s) {
  const u = s.ult; const L = [`+${num(u.pv)} PV`, `+${num(u.pd)} PD`, `+${num(u.def)} Defesa`];
  if (u.testes) L.push(`${fmt(num(u.testesN))} em testes`);
  if (u.danoDados) L.push(`+${num(u.danoN)} dados de dano${u.danoRitual ? " (rituais também)" : ""}`);
  if (u.dt) L.push(`DT ${fmt(num(u.dtN))}`);
  if (u.ritualGratis) L.push("rituais avançados sem custo extra");
  const n = u.habilidades.length; if (n) L.push(`${n} habilidade${n > 1 ? "s" : ""} exclusiva${n > 1 ? "s" : ""}`);
  return L.join(" · ");
}
function ultBotao(s) {
  const u = s.ult;
  return u.ativo
    ? `<button class="ult-go off" id="btnUltOff" title="Ação livre">⏹ Desativar ${esc(u.nome || "forma suprema")} <span class="small">(ação livre)</span></button>`
    : `<button class="ult-go" id="btnUltOn" title="1 ação de movimento">⚡ Ativar ${esc(u.nome || "forma suprema")} <span class="small">(movimento · −${num(u.custoAtivar)} ${ultPagaSig(s)})</span></button>`;
}
function ultCard(s) {
  const u = s.ult; if (!u?.habilitada) return "";
  return `<section class="card ult-card ${u.ativo ? "ativo" : ""}">
    <h3>⚡ ${esc(u.nome || "Forma suprema")} <span class="muted">${u.ativo ? `ativa · rodada ${num(u.rodada)}` : "inativa"}</span></h3>
    ${u.ativo ? `<p class="small">Cada rodada além da primeira custa <b>${num(u.custoRodada)} ${ultPagaSig(s)}</b> (cobrado sozinho em “Nova rodada”). Ao desativar, perde ${num(u.ganho?.pv ?? u.pv)} PV atuais e máximos${num(s.pv.atual) <= num(u.ganho?.pv ?? u.pv) ? ` — <b class="over">com ${num(s.pv.atual)} PV, você fica com 0 e morrendo</b>` : ""}.</p>` : ""}
    <p class="muted small">${esc(ultResumo(s))}</p>
    <div class="row wrap">${ultBotao(s)}<button class="ghost" data-tab="ult">Configurar</button></div>
  </section>`;
}
function ck(path, val, label) { return `<label class="check"><input type="checkbox" data-path="${path}" data-rerender="1" ${val ? "checked" : ""}> ${label}</label>`; }
function tabUlt(s) {
  const u = s.ult; const pg = ultPagaSig(s);
  const intro = `<section class="card ult-card ${u.ativo ? "ativo" : ""}">
    <h3>⚡ Versão ultimate <span class="muted">Arquivos Secretos 2, p. 96–97</span></h3>
    <p class="small">Uma vestimenta, arma ou item (como a máscara do Mutilador Noturno) desumaniza o personagem e manifesta a intenção assassina dele numa forma poderosíssima. Monte aqui, com o consentimento do mestre, como fica a sua ficha na forma suprema.</p>
    ${ck("ult.habilitada", u.habilitada, "Habilitar a versão ultimate desta ficha")}
    ${u.habilitada ? `<div class="row wrap" style="margin-top:8px">${ultBotao(s)}</div>` : ""}
  </section>`;
  if (!u.habilitada) return intro;
  const ganhoAtivo = u.ativo && u.ganho && (num(u.ganho.pv) !== num(u.pv) || num(u.ganho.pd) !== num(u.pd))
    ? `<p class="muted small warn">A forma ativa agora deu +${num(u.ganho.pv)} PV e +${num(u.ganho.pd)} PD; os valores novos valem na próxima ativação.</p>` : "";
  return `${intro}
  <section class="card"><h3>Identidade da forma</h3>
    <div class="grid2">
      <label>Nome da forma ${inp("ult.nome", u.nome, "text", 'placeholder="Ex.: Mutilador Noturno" data-rerender="1"')}</label>
      <label>Objeto da desumanização ${inp("ult.item", u.item, "text", 'placeholder="Ex.: máscara, capuz, elmo…"')}</label>
      <label class="wide">Aparência e justificativa narrativa ${ta("ult.desc", u.desc, 3)}</label>
      <label class="wide">Imagem da forma suprema ${imgField("ult.img", u.img)}</label>
    </div>
  </section>

  <section class="card"><h3>Custo <span class="muted">regra do livro</span></h3>
    <div class="grid2">
      <label>Ativar (1 ação de movimento) <div class="row">${inp("ult.custoAtivar", u.custoAtivar, "num", 'min="0"')}<span class="muted" data-keep>${pg}</span></div></label>
      <label>Cada rodada além da primeira <div class="row">${inp("ult.custoRodada", u.custoRodada, "num", 'min="0"')}<span class="muted" data-keep>${pg}</span></div></label>
    </div>
    <p class="muted small" data-keep>${isDet(s) ? "Esta ficha usa a regra de Determinação (sem Sanidade), então o custo sai da Determinação." : "O custo sai da Sanidade."} Desativar é uma ação livre e tira todos os benefícios.</p>
  </section>

  <section class="card"><h3>Ao ativar, você recebe</h3>
    <div class="grid3">
      <label>PV atuais e máximos ${inp("ult.pv", u.pv, "num", 'min="0"')}</label>
      <label>PD atuais e máximos ${inp("ult.pd", u.pd, "num", 'min="0"')}</label>
      <label>Defesa ${inp("ult.def", u.def, "num")}</label>
    </div>
    ${ganhoAtivo}
    <p class="muted small">Ao desativar, os PV e PD recebidos saem dos atuais e dos máximos. Se tiver menos PV atuais do que os recebidos, fica com 0 PV e morrendo.</p>
  </section>

  <section class="card"><h3>Aprimoramentos <span class="muted">escolha os da sua ficha</span></h3>
    <div class="ult-opts">
      ${ck("ult.ritualGratis", u.ritualGratis, "Conjurar rituais nas formas avançadas (Discente e Verdadeiro) sem pagar o custo extra delas")}
      <div class="row wrap">${ck("ult.danoDados", u.danoDados, "Todos os danos aumentam em")}<span class="row mini">+${inp("ult.danoN", u.danoN, "num", 'min="0" style="width:56px"')} dados do mesmo tipo</span></div>
      ${u.danoDados ? `<div class="sub">${ck("ult.danoRitual", u.danoRitual, "Também nos dados dos rituais (deixe desligado se seus rituais rolam cura)")}</div>` : ""}
      <div class="row wrap">${ck("ult.testes", u.testes, "Bônus em testes de qualquer tipo:")}<span class="row mini">${inp("ult.testesN", u.testesN, "num", 'style="width:56px"')}</span></div>
      <div class="row wrap">${ck("ult.dt", u.dt, "A DT das suas habilidades (poderes, rituais etc.) aumenta em")}<span class="row mini">+${inp("ult.dtN", u.dtN, "num", 'style="width:56px"')}</span></div>
      ${u.dt ? `<p class="muted small sub">DT dos rituais: ${num(s.rituais.dt)} → ${num(s.rituais.dt) + num(u.dtN)} na forma suprema.</p>` : ""}
    </div>
    <p class="muted small">Os aprimoramentos marcados entram sozinhos nas rolagens enquanto a forma estiver ativa (aparecem com ⚡ no resultado).</p>
  </section>

  <section class="card"><h3>Habilidades da forma suprema <span class="muted">só aparecem com ela ativa</span></h3>
    <p class="muted small">Crie uma habilidade nova ou um efeito novo para uma habilidade que você já tem (escreva o nome dela em “Aprimora a habilidade”).</p>
    ${listHTML("ultHabs")}
  </section>`;
}
const ultConfirm = {};
function ultAtivar(s, btn) {
  const u = s.ult; if (!u.habilitada || u.ativo) return;
  const bar = mentalBar(s); const c = Math.max(0, num(u.custoAtivar)); const k = s.id + "on";
  if (num(bar.atual) <= c && !ultConfirm[k]) {
    ultConfirm[k] = true; setTimeout(() => delete ultConfirm[k], 4000); btn?.classList.add("confirm");
    return toast(`Ativar custa ${c} ${ultPagaSig(s)} e você tem ${num(bar.atual)}: vai ficar enlouquecendo. Clique de novo para ativar mesmo assim.`);
  }
  delete ultConfirm[k];
  bar.atual = Math.max(0, num(bar.atual) - c);
  const g = { pv: Math.max(0, num(u.pv)), pd: Math.max(0, num(u.pd)) };
  s.pv.max = num(s.pv.max) + g.pv; s.pv.atual = num(s.pv.atual) + g.pv;
  s.pd.max = num(s.pd.max) + g.pd; s.pd.atual = num(s.pd.atual) + g.pd;
  if (num(s.pv.atual) > 0) s.morrendo = 0;
  if (num(mentalBar(s).atual) > 0) s.enlouquecendo = 0;
  u.ganho = g; u.ativo = true; u.rodada = 1;
  touchSheet(s); render();
  efeitoRitual(s, ELEMENTOS.includes(s.header.afinidade) ? s.header.afinidade : "Sangue", u.nome || "Forma suprema", "ULTIMATE");
  announce(`⚡ ${s.header.personagem} assume ${u.nome || "a forma suprema"}${u.item ? ` (${u.item})` : ""}! Ação de movimento, −${c} ${ultPagaSig(s)}.\n${ultResumo(s)}`);
}
function ultDesativar(s, silencioso, btn) {
  const u = s.ult; if (!u.ativo) return;
  const g = u.ganho || { pv: num(u.pv), pd: num(u.pd) }; const k = s.id + "off";
  if (!silencioso && num(s.pv.atual) <= g.pv && !ultConfirm[k]) {
    ultConfirm[k] = true; setTimeout(() => delete ultConfirm[k], 4000); btn?.classList.add("confirm");
    return toast(`Você tem ${num(s.pv.atual)} PV: ao perder os ${g.pv} da forma suprema, fica com 0 PV e morrendo. Clique de novo para desativar mesmo assim.`);
  }
  delete ultConfirm[k];
  s.pv.max = Math.max(0, num(s.pv.max) - g.pv); s.pv.atual = clamp(num(s.pv.atual) - g.pv, 0, num(s.pv.max));
  s.pd.max = Math.max(0, num(s.pd.max) - g.pd); s.pd.atual = clamp(num(s.pd.atual) - g.pd, 0, num(s.pd.max));
  const rod = num(u.rodada); u.ativo = false; u.rodada = 0; u.ganho = null;
  touchSheet(s); render();
  announce(`${s.header.personagem} desfaz ${u.nome || "a forma suprema"} após ${rod} rodada${rod === 1 ? "" : "s"} (ação livre): −${g.pv} PV e −${g.pd} PD atuais e máximos, −${num(u.def)} Defesa.${num(s.pv.atual) <= 0 ? " Ficou com 0 PV e está morrendo!" : ""}`);
}
// Chamado a cada "Nova rodada": a forma mantida cobra o custo por rodada adicional
function ultRodada(s) {
  if (!ultOn(s)) return;
  const u = s.ult; u.rodada = num(u.rodada) + 1;
  const c = Math.max(0, num(u.custoRodada)); if (!c) return;
  const bar = mentalBar(s); bar.atual = Math.max(0, num(bar.atual) - c);
  setTimeout(() => announce(`⚡ ${s.header.personagem} mantém ${u.nome || "a forma suprema"} (rodada ${u.rodada}): −${c} ${ultPagaSig(s)} (${num(bar.atual)}/${num(bar.max)}).${num(bar.atual) <= 0 ? " Enlouquecendo! Se ficar insano nesta forma, vira um NPC da intenção assassina." : ""}`), 30);
}
function barHTML(k, title, b) {
  return `<div class="bar ${k}">
    <div class="head"><span>${title}${k === "pv" ? ' <b class="temp" data-calc="pvTempTxt"></b>' : k === "pd" ? ' <b class="temp" data-calc="pdTempTxt"></b>' : ""}</span><span class="row">
      <button class="icon" data-step="${k}.atual" data-delta="-5">−5</button><button class="icon" data-step="${k}.atual" data-delta="-1">−1</button>
      <button class="icon" data-step="${k}.atual" data-delta="1">+1</button><button class="icon" data-step="${k}.atual" data-delta="5">+5</button></span></div>
    <div class="track"><div class="fill" data-calc="${k}fill"></div>
      <div class="vals">${inp(`${k}.atual`, b.atual, "num")}<span>/</span>${inp(`${k}.max`, b.max, "num")}</div></div>
  </div>`;
}
function tabPericias(s) {
  const attrOpts = ATTRS.map(([a]) => [a, a]);
  return `${nextModBar()}<section class="card"><h3>Perícias</h3>
  <p class="muted warn" data-calc="cargaAviso"></p>
  <table class="pericias"><thead><tr><th></th><th>Perícia</th><th>Dados</th><th>Bônus</th><th>Treino</th><th>Outros</th></tr></thead><tbody>
  ${PERICIAS.map(([n, , m]) => { const p = s.pericias[n]; return `<tr>
    <td><button class="roll" data-rollper="${esc(n)}" title="Rolar ${esc(n)}">🎲</button></td>
    <td class="nome">${esc(n)}${m}</td>
    <td>${sel(`pericias.${n}.attr`, p.attr, attrOpts)}<div class="dice" data-calc="pdice|${n}"></div></td>
    <td class="bon" data-calc="pbonus|${n}"></td>
    <td>${sel(`pericias.${n}.treino`, p.treino, TREINO, 'data-type="num" data-rerender="1"')}</td>
    <td style="width:52px">${inp(`pericias.${n}.outros`, p.outros, "num")}</td></tr>`; }).join("")}
  </tbody></table>
  <p class="muted">+ Penalidade de carga. * Somente treinada (o dado fica bloqueado sem treino). Atributo 0 ou menos: rola 2d20 ou mais e fica com o pior. As condições ativas já tiram dados.</p></section>`;
}
function tabInventario(s) {
  return `<section class="card">
    <h3>Equipamento</h3>
    <div class="grid3">
      <label>Prestígio ${inp("equip.prestigio", s.equip.prestigio, "num")}</label>
      <label>Patente ${sel("equip.patente", s.equip.patente, PATENTES, 'data-rerender="1"')}</label>
      <label>Crédito ${sel("equip.credito", s.equip.credito, CREDITO)}</label>
    </div>
    <p class="muted small" data-calc="patenteDica"></p>
    <div class="section-title">Itens por categoria</div>
    <table class="cats"><thead><tr><th></th>${CATS.map(([, l]) => `<th>${l}</th>`).join("")}</tr></thead><tbody>
      <tr><th>Limite</th>${CATS.map(([c]) => `<td>${c === 0 ? `<span class="muted">sem limite</span>` : inp(`equip.limites.${c}`, s.equip.limites[c], "num", 'min="0"')}</td>`).join("")}</tr>
      <tr><th>No inventário</th>${CATS.map(([c]) => `<td class="calc small" data-catcount="${c}" data-calc="cat|${c}"></td>`).join("")}</tr>
    </tbody></table>
    <div class="section-title">Carga</div>
    <div class="defline" style="grid-template-columns:repeat(4,1fr)">
      <label>Carregada<div class="calc carga-num" data-calc="carga"></div></label>
      <label>Máxima<div class="calc small" data-calc="cargaMax"></div></label>
      <label>Modificador ${inp("equip.cargaMod", s.equip.cargaMod, "num")}</label>
      <label class="muted" style="text-transform:none;justify-content:center">Carga máx. = 5 × FOR (FOR 0: 2) + mod.</label>
    </div>
    <p class="muted warn" data-calc="cargaAviso"></p>
  </section>
  ${filterBar("inventario", { cat: true })}
  <div class="section-title row between"><span>Armas</span><button class="libbtn small" data-lib="item:armas">📚 Do livro</button></div>${listHTML("armas")}
  <div class="section-title row between"><span>Munições</span><button class="libbtn small" data-lib="item:municoes">📚 Do livro</button></div>${listHTML("municoes")}
  <div class="section-title row between"><span>Proteções</span><button class="libbtn small" data-lib="item:protecoes">📚 Do livro</button></div>${listHTML("protecoes")}
  <div class="section-title row between"><span>Itens gerais</span><button class="libbtn small" data-lib="item:gerais">📚 Do livro</button></div>${listHTML("gerais")}
  <div class="section-title row between"><span>Itens amaldiçoados</span><button class="libbtn small" data-lib="item:amaldicoados">📚 Do livro</button></div>${listHTML("amaldicoados")}`;
}
function tabNotas(s) {
  const N = [["anotacoes", "Anotações pessoais"], ["aparencia", "Aparência"], ["personalidade", "Personalidade"], ["historico", "Histórico"], ["objetivo", "Objetivo"]];
  return N.map(([k, l]) => `<section class="card"><h3>${l}</h3>${ta(`notas.${k}`, s.notas[k], 5)}</section>`).join("");
}
function tabRolagens() {
  const fmtT = (t) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `<section class="card"><h3>Histórico de rolagens <button class="ghost" id="btnClearLog">Limpar</button></h3>
    ${rollLog.length ? `<ul class="log">${rollLog.map((r) => `<li class="${r.hidden ? "hid" : ""}"><span class="t">${fmtT(r.at)}${r.hidden ? " 🙈" : ""}</span><pre>${esc(r.text)}</pre></li>`).join("")}</ul>` : `<p class="muted">Nenhuma rolagem ainda.</p>`}
  </section>`;
}
/* ---------- Aba Dados (v3.6): rolagem livre, sem depender da ficha ---------- */
const DP_FACES = [4, 6, 8, 10, 12, 20, 100];
let dp = { pool: {}, mod: 0, modo: "soma", expr: "", motivo: "" };
const dpFavKey = () => NS + ":dadosFav";
const dpFavs = () => readLs(dpFavKey(), []);
function dpPoolExpr() {
  const parts = DP_FACES.filter((f) => dp.pool[f] > 0).map((f) => `${dp.pool[f]}d${f}`);
  const m = num(dp.mod);
  return parts.join("+") + (m ? (m > 0 ? "+" : "") + m : "");
}
const DP_MODOS = [["soma", "Somar tudo"], ["maior", "Ficar com o maior dado"], ["menor", "Ficar com o menor dado"]];
function tabDados() {
  const fmtT = (t) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const pe = dpPoolExpr(); const favs = dpFavs();
  const chips = DP_FACES.filter((f) => dp.pool[f] > 0).map((f) => `<span class="dp-chip">${dp.pool[f]}d${f}<button class="icon ghost" data-dpsub="${f}" title="Tirar um d${f}">−</button></span>`).join("");
  return `<section class="card"><h3>Rolar dados</h3>
    <p class="muted small">Toque nos dados para montar a rolagem. Não usa nada da ficha.</p>
    <div class="dp-pick">${DP_FACES.map((f) => `<button class="dp-die" data-dpadd="${f}" title="Adicionar um d${f}"><svg viewBox="0 0 100 100"><polygon points="${SHAPES[f === 100 ? 10 : f]}"/><g>${INNER[f === 100 ? 10 : f] || ""}</g></svg><b>d${f}</b>${dp.pool[f] ? `<i>${dp.pool[f]}</i>` : ""}</button>`).join("")}</div>
    <div class="dp-pool">${chips || `<span class="muted small">Nenhum dado escolhido.</span>`}${chips ? `<button class="ghost small" id="btnDpClear">Limpar</button>` : ""}</div>
    <div class="grid2">
      <label>Modificador <input type="number" id="dpMod" value="${num(dp.mod)}"></label>
      <label>Resultado <select id="dpModo">${DP_MODOS.map(([v, l]) => `<option value="${v}" ${v === dp.modo ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="wide">Ou escreva a rolagem <input type="text" id="dpExpr" placeholder="ex.: 2d6+1d4+3" value="${esc(dp.expr)}"></label>
      <label class="wide">Motivo (opcional) <input type="text" id="dpMotivo" placeholder="ex.: Dano extra, Sorte…" value="${esc(dp.motivo)}"></label>
    </div>
    <div class="row dp-go"><button class="primary" id="btnDpRoll">🎲 Rolar ${esc(dp.expr.trim() || pe || "")}</button><button id="btnDpFav" title="Guardar esta rolagem para usar de novo">☆ Guardar</button></div>
  </section>
  ${favs.length ? `<section class="card"><h3>Rolagens guardadas</h3><div class="dp-favs">${favs.map((f, i) => `<span class="dp-fav"><button data-dpfav="${i}" title="Rolar">🎲 ${esc(f.nome || f.expr)}${f.nome ? ` <span class="muted small">${esc(f.expr)}${f.modo !== "soma" ? " · " + (f.modo === "maior" ? "maior" : "menor") : ""}</span>` : ""}</button><button class="icon ghost" data-dpfavdel="${i}" title="Apagar">✕</button></span>`).join("")}</div></section>` : ""}
  <section class="card"><h3>Prato de dados</h3>
    <label class="check"><input type="checkbox" id="dpFixo" ${diceCfg.fixo ? "checked" : ""}> Deixar o prato na tela até eu fechar no ✕ ou rolar de novo</label>
    ${diceCfg.fixo ? "" : `<p class="muted small">Agora ele some sozinho depois de ${num(diceCfg.tempo)} s.</p>`}
    <div class="row"><button id="btnDpLook">🎨 Aparência dos dados e do prato</button></div>
  </section>
  ${rollLog.length ? `<section class="card"><h3>Últimas rolagens <button class="ghost" data-tab="rolagens">Ver todas</button></h3><ul class="log">${rollLog.slice(0, 5).map((r) => `<li class="${r.hidden ? "hid" : ""}"><span class="t">${fmtT(r.at)}${r.hidden ? " 🙈" : ""}</span><pre>${esc(r.text)}</pre></li>`).join("")}</ul></section>` : ""}`;
}
function updDpBtn() { const b = document.getElementById("btnDpRoll"); if (b) b.textContent = "🎲 Rolar " + (dp.expr.trim() || dpPoolExpr()); }
function rollDados(expr, modo, motivo) {
  expr = String(expr || "").replace(/\s+/g, "");
  if (!/\d*d\d+/i.test(expr)) { toast("Escolha pelo menos um dado (ou escreva algo como 2d6+3)."); return; }
  const r = rollExpr(expr);
  if (!r.ok) { toast("Não entendi essa rolagem. Use algo como 2d6+1d4+3."); return; }
  const who = cur()?.header.personagem || me.name || "Jogador";
  const titulo = `${who} rolou ${expr}${motivo ? ` (${motivo})` : ""}`;
  let linha;
  if (modo === "maior" || modo === "menor") {
    const todos = r.groups.flatMap((g) => g.vals);
    const somaDados = todos.reduce((a, b) => a + b, 0);
    const mod = r.total - somaDados; // parte fixa (+3, −1…)
    const pick = modo === "maior" ? Math.max(...todos) : Math.min(...todos);
    let marcado = false;
    for (const g of r.groups) { const i = marcado ? -1 : g.vals.indexOf(pick); if (i >= 0) { g.keep = i; g.worst = modo === "menor"; marcado = true; } }
    r.groups.forEach((g) => { if (g.keep < 0) g.keep = -2; }); // os outros aparecem apagados
    linha = `[${todos.join(", ")}] → ${modo === "maior" ? "maior" : "menor"} ${pick}${mod ? " " + fmt(mod) : ""} = ${pick + mod}`;
  } else linha = `${r.txt} = ${r.total}`;
  trayRoll(r.groups.map((g) => ({ ...g, keep: g.keep === -2 ? 99 : g.keep })));
  announce(`${titulo}: ${linha}`);
}
function rodadaTodos() {
  const out = [];
  for (const { s: x } of allVisible()) { const fim = novaRodada(x); touchSheet(x); if (fim.length) out.push(`${x.header.personagem}: ${fim.join(", ")}`); }
  render(); toast(`Nova rodada.${out.length ? " Terminou — " + out.join("; ") : ""}`);
}
function tabMesa() {
  const all = allVisible().map((v) => v.s);
  const opts = PERICIAS.map(([n]) => `<option>${esc(n)}</option>`).join("");
  return `<section class="card"><h3>Personagens</h3>
    ${all.length ? `<table class="mesa"><thead><tr><th>Personagem</th><th>PV</th><th>PD/PE</th><th>Def</th><th>Esq</th></tr></thead><tbody>
    ${all.map((x) => `<tr><td><button class="link" data-open="${x.id}">${esc(x.header.personagem)}</button>${ultOn(x) ? ` <span class="ult-mk" title="Na forma suprema (rodada ${num(x.ult.rodada)})">⚡</span>` : ""}<div class="muted">${esc(x.owner?.name || "")}${x.condicoes.length ? " · " + esc(x.condicoes.join(", ")) : ""}</div></td>
      <td class="${num(x.pv.atual) <= 0 ? "over" : ""}">${num(x.pv.atual)}/${num(x.pv.max)}</td><td class="${num(mentalBar(x).atual) <= 0 ? "over" : ""}">${num(x.pd.atual)}/${num(x.pd.max)} ${resSig(x)}${isDet(x) ? "" : `<div class="muted small">SAN ${num(x.san.atual)}/${num(x.san.max)}</div>`}</td>
      <td>${defesaTotal(x)}</td><td>${defesaTotal(x) + periciaTotal(x, "Reflexos")}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Nenhuma ficha ainda.</p>`}
    <div class="row wrap" style="margin-top:8px"><button id="btnAskSheets">Pedir fichas aos jogadores</button><button id="btnRoundAll">⏭ Nova rodada para todos</button><button id="btnCenaAll">🎬 Fim de cena para todos</button></div>
    <p class="muted small">Nova rodada tira 1 dos efeitos de rodadas em todas as fichas (também acontece sozinho quando a iniciativa volta ao primeiro). Fim de cena encerra os efeitos da cena e os pontos temporários.</p>
  </section>

  <section class="card"><h3>Iniciativa</h3>
    <div class="row wrap"><button class="primary" id="btnIni">🎲 Rolar iniciativa de todos</button><button id="btnIniNext" ${ini.list.length ? "" : "disabled"}>Próximo turno ▸</button><button class="ghost" id="btnIniClear">Limpar</button></div>
    ${obrOk ? `<div class="row" style="margin-top:6px"><button class="ghost" id="btnIniTokens">Mostrar ordem nos tokens</button><span class="muted small">Números nos tokens vinculados; quem está na vez ganha um contorno vermelho.</span></div>` : ""}
    <div class="row" style="margin-top:6px"><input id="npcName" placeholder="NPC / ameaça"><input id="npcVal" type="number" placeholder="Valor" style="width:80px"><button id="btnNpc">+</button></div>
    ${ini.list.length ? `<ol class="ini">${ini.list.map((e, i) => `<li class="${i === ini.turn ? "turn" : ""}"><span>${esc(e.nome)}</span><b>${e.total}</b><button class="icon danger" data-inidel="${i}">✕</button></li>`).join("")}</ol>` : ""}
  </section>

  <section class="card"><h3>Teste em grupo</h3>
    <div class="row"><select id="grpPer">${opts}</select><button id="btnGrp">🎲 Rolar para todos</button></div>
    <label class="check" style="margin-top:6px"><input type="checkbox" id="grpHidden" checked> Resultado só para mim (oculto)</label>
  </section>
  ${isGM() && obrOk ? cfgMesaHTML() : ""}`;
}
function tabContent(s) {
  switch (tab) {
    case "principal": return tabPrincipal(s);
    case "pericias": return tabPericias(s);
    case "combate": return `${nextModBar()}${filterBar("ataques")}<div class="section-title">Ataques</div>${listHTML("ataques")}`;
    case "ult": return tabUlt(s);
    case "habilidades": return `${ultOn(s) && s.ult.habilidades.length ? `<section class="card ult-card"><h3>⚡ Só na ${esc(s.ult.nome || "forma suprema")}</h3>${s.ult.habilidades.map((h, i) => `<div class="ult-hab"><div><b>${esc(h.nome || "(sem nome)")}</b>${h.alvo ? ` <span class="tag">aprimora ${esc(h.alvo)}</span>` : ""}<div class="muted small">${esc(resumo(h.desc, 200))}</div></div>${SCHEMAS.ultHabs.actions(`ult.habilidades.${i}`, h)}</div>`).join("")}</section>` : ""}<button class="libbtn" data-lib="habilidades">📚 Adicionar do livro</button>${filterBar("habilidades")}<div class="section-title">Habilidades</div>${listHTML("habilidades")}`;
    case "rituais": return `<section class="card grid2"><label>DT dos rituais ${inp("rituais.dt", s.rituais.dt, "num")}${dtRitual(s) !== num(s.rituais.dt) ? `<span class="ult-txt">⚡ Na forma suprema: DT ${dtRitual(s)}</span>` : ""}</label>
        <label>PD nesta rodada<div class="calc small" data-calc="pdRodada"></div></label>
        <p class="muted wide">Custo: 1º círculo 1 PD · 2º 3 PD · 3º 6 PD · 4º 10 PD (+ extra da versão). ${s.header.afinidade ? `★ = afinidade com ${esc(s.header.afinidade)}.` : ""}</p></section>
      <button class="libbtn" data-lib="rituais">📚 Adicionar ritual do livro</button>
      ${filterBar("rituais", { el: true, circ: true })}<div class="section-title">Rituais</div>${listHTML("rituais")}`;
    case "inventario": return tabInventario(s);
    case "notas": return tabNotas(s);
    case "rolagens": return tabRolagens();
    case "dados": return tabDados();
    case "interludio": return tabInterludio(s);
    case "pratos": return tabPratos();
    case "mesa": return isGM() ? tabMesa() : "";
  }
  return "";
}

/* =========================================================
   v2.2 — desfazer, dano/RD/PV temporários, interlúdio, ajuda,
   impressão, backup na cena, animação e som
   ========================================================= */

/* ---------- Desfazer ---------- */
const undoStack = {}; const committed = {}; const committedAt = {};
function commitBase(s) { if (s && committed[s.id] === undefined) committed[s.id] = JSON.stringify(s); }
function recordUndo(s) {
  const id = s.id; const now = Date.now();
  if (committed[id] !== undefined && now - (committedAt[id] || 0) > 1500) {
    const st = (undoStack[id] ||= []);
    if (st[st.length - 1] !== committed[id]) st.push(committed[id]);
    if (st.length > 40) st.shift();
  }
  committed[id] = JSON.stringify(s); committedAt[id] = now;
  const btn = document.getElementById("btnUndo"); if (btn) btn.disabled = !(undoStack[id] || []).length;
}
function undo() {
  const s = cur(); if (!s) return;
  const st = undoStack[s.id] || []; if (!st.length) return toast("Nada para desfazer.");
  const r = upgrade(JSON.parse(st.pop()));
  r.updatedAt = Date.now(); r.lastExport = s.lastExport;
  if (store.own[s.id]) store.own[s.id] = r; else store.others[s.id] = r;
  committed[s.id] = JSON.stringify(r); committedAt[s.id] = 0;
  persist(); scheduleSync(r); render(); toast("Última alteração desfeita.");
}

/* ---------- Acesso rápido (v3.5) ---------- */
const RAPIDO_KEYS = ["ataques", "armas", "habilidades", "rituais"];
const RAPIDO_MAX = 4;
function isRapido(s, k, id) { return (s.rapido || []).some((r) => r.k === k && r.id === id); }
function rapidoItens(s) {
  const out = [];
  for (const r of s.rapido || []) {
    const arr = getPath(s, LIST_PATHS[r.k]) || []; const i = arr.findIndex((x) => x.id === r.id);
    if (i >= 0) out.push({ ...r, it: arr[i], path: `${LIST_PATHS[r.k]}.${i}` });
  }
  return out;
}
function resumo(txt, n = 110) { const t = String(txt || "").replace(/\s+/g, " ").trim(); if (!t) return ""; const f = t.split(/(?<=[.!?])\s/)[0]; return (f.length > n ? f.slice(0, n - 1) + "…" : f); }
function quickHTML(s) {
  const L = rapidoItens(s);
  if (!L.length) return `<p class="muted">Nada no acesso rápido ainda. Na ficha, toque no ⚡ de até ${RAPIDO_MAX} ataques, armas, habilidades ou rituais.</p>`;
  return `<div class="qk-list">${L.map(({ k, it, path }) => {
    let act = "", custo = "", sub = "", extra = "";
    if (k === "ataques") { act = `data-atk="${path}"`; sub = [it.dano && `${it.dano} ${String(it.tipo || "").toLowerCase()}`, `crítico ${it.critico}/×${it.mult}`].filter(Boolean).join(" · "); }
    if (k === "armas") { act = `data-arma="${path}|1"`; sub = [dmgTxt(it.dano, it.danoFixo) && `${dmgTxt(it.dano, it.danoFixo)} ${String(it.tipoDano || "").toLowerCase()}`, `crítico ${it.critico}/×${it.mult}`, it.alcance].filter(Boolean).join(" · "); }
    if (k === "habilidades") { act = `data-usehab="${path}"`; custo = num(it.custo) ? `${num(it.custo)} ${resSig(s)}` : ""; if (!num(it.custo)) act = `data-hablog="${path}"`; }
    if (k === "rituais") {
      act = `data-cast="${path}|normal"`; custo = `${CUSTO_CIRCULO[num(it.circulo)] || 0} ${resSig(s)}`;
      sub = `${it.elemento || ""} ${it.circulo || ""}º${it.dados ? ` · ${it.dados}` : ""}`;
      extra = `<span class="qk-vers">${num(it.custoDiscente) || it.descDiscente ? `<button data-cast="${path}|discente">Discente +${num(it.custoDiscente)}</button>` : ""}${num(it.custoVerdadeiro) || it.descVerdadeiro ? `<button data-cast="${path}|verdadeiro">Verdadeiro +${num(it.custoVerdadeiro)}</button>` : ""}</span>`;
    }
    const desc = resumo(it.desc) || sub;
    const elq = k === "rituais" && FX.EL_COR[it.elemento] ? it.elemento : "";
    return `<div class="qk-item qk-${k}" ${elq ? `data-elem="${elq}" style="--elc:${FX.corDe(elq)}"` : ""}>
      <button class="qk-main" ${act}><span class="qk-title">${elq ? FX.glifo(elq, 16) : ""}<span class="qk-name">${esc(it.nome || "(sem nome)")}</span>${custo ? `<span class="qk-cost">${esc(custo)}</span>` : ""}</span>
      <span class="qk-desc">${esc(desc)}${desc !== sub && sub ? `<br><span class="qk-sub">${esc(sub)}</span>` : ""}</span></button>${extra}</div>`;
  }).join("")}</div>`;
}
function renderQuick() {
  const s = cur();
  document.body.classList.add("quick-mode"); document.body.dataset.tema = temaEf(s); document.body.classList.toggle("ult-on", !!(s && ultOn(s)));
  if (!s) { app.innerHTML = `<div class="qk-wrap"><p class="muted">Ficha não encontrada neste navegador.</p></div>`; return; }
  app.innerHTML = `<div class="qk-wrap"><div class="qk-head"><b>${esc(s.header.personagem)}</b><span>PV ${num(s.pv.atual)}/${num(s.pv.max)} · ${resSig(s)} ${num(s.pd.atual)}/${num(s.pd.max)}${isDet(s) ? "" : ` · SAN ${num(s.san.atual)}/${num(s.san.max)}`} · ${resSig(s)} na rodada ${num(s.pdRodada)}/${pdLimite(s)}</span></div>${s.ult?.habilitada ? `<div class="qk-ult">${ultBotao(s)}</div>` : ""}${quickHTML(s)}<p class="qk-last" id="qkLast"></p></div>`;
  commitBase(s);
  if (!isDet(s)) translateDom(app);
}

/* ---------- Efeitos com duração (v3.4) ---------- */
const DURACOES = [["rodadas", "Rodadas"], ["cena", "Até o fim da cena"], ["interludio", "Até o próximo interlúdio"], ["livre", "Sem prazo (tiro à mão)"]];
function activeConds(s) {
  const set = new Set(s.condicoes || []);
  for (const e of s.efeitos || []) if (e.cond) set.add(e.cond);
  return [...set];
}
function efeitoDaCond(s, c) { return (s.efeitos || []).find((e) => e.cond === c) || null; }
function durTxt(e) {
  if (e.dur === "rodadas") return `${num(e.rest)} rodada${num(e.rest) === 1 ? "" : "s"}`;
  return { cena: "até o fim da cena", interludio: "até o próximo interlúdio", livre: "sem prazo" }[e.dur] || "";
}
// tipo: "rodada" (−1 nas rodadas), "cena" (acaba rodadas e cena), "interludio" (acaba tudo menos "livre")
function tickEfeitos(s, tipo) {
  const fim = []; const ficam = [];
  for (const e of s.efeitos || []) {
    let acaba = false;
    if (tipo === "rodada" && e.dur === "rodadas") { e.rest = num(e.rest) - 1; acaba = e.rest <= 0; }
    if (tipo === "cena" && (e.dur === "rodadas" || e.dur === "cena")) acaba = true;
    if (tipo === "interludio" && e.dur !== "livre") acaba = true;
    (acaba ? fim : ficam).push(e);
  }
  s.efeitos = ficam;
  if (tipo === "cena" || tipo === "interludio") {
    // Pontos temporários somem no fim da cena (OPRPG, p. 36)
    if (num(s.pvTemp) || num(s.pdTemp)) fim.push("pontos temporários");
    s.pvTemp = 0; s.pdTemp = 0; s.morrendo = num(s.pv.atual) > 0 ? 0 : s.morrendo;
  }
  return fim.map((e) => (typeof e === "string" ? e : e.nome));
}
function efeitosCard(s) {
  const ef = s.efeitos || [];
  return `<section class="card efeitos"><h3>Efeitos com duração <span class="muted">somem sozinhos quando o prazo acaba</span></h3>
    ${ef.length ? `<ul class="eflist">${ef.map((e, i) => `<li><div><b>${esc(e.nome)}</b> <span class="tag">${esc(durTxt(e))}</span>${e.cond ? ` <span class="tag cond">${esc(e.cond)}</span>` : ""}${e.desc ? `<div class="muted small">${esc(e.desc)}</div>` : ""}</div>
      <span class="row">${e.dur === "rodadas" ? `<button class="icon" data-efstep="${i}|-1" title="Uma rodada a menos">−1</button><button class="icon" data-efstep="${i}|1" title="Uma rodada a mais">+1</button>` : ""}<button class="icon danger" data-efdel="${i}" title="Encerrar agora">✕</button></span></li>`).join("")}</ul>` : `<p class="muted small">Nenhum efeito ativo. Use para buffs, penalidades e condições com prazo (por exemplo, "Abalado por 2 rodadas").</p>`}
    <div class="efadd">
      <input id="efNome" placeholder="Efeito (ex.: Amaldiçoar Arma)">
      <select id="efDur">${DURACOES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
      <input id="efRod" type="number" min="1" value="3" title="Rodadas" style="width:60px">
      <select id="efCond"><option value="">Sem condição</option>${CONDICOES.map(([n]) => `<option>${esc(n)}</option>`).join("")}</select>
      <input id="efDesc" placeholder="Anotação (opcional)">
      <button class="primary" id="efAdd">+ Adicionar efeito</button>
    </div>
    <div class="row wrap" style="margin-top:6px"><button id="btnRound2">⏭ Nova rodada</button><button id="btnCena">🎬 Fim de cena</button>
      <span class="muted small">Nova rodada tira 1 das rodadas e zera o contador de PD gastos. Fim de cena encerra os efeitos da cena e os pontos temporários.</span></div>
  </section>`;
}
function novaRodada(s) {
  s.pdRodada = 0; const fim = tickEfeitos(s, "rodada");
  ultRodada(s);
  return fim;
}
function fimDeCena(s) { const fim = tickEfeitos(s, "cena"); s.pdRodada = 0; return fim; }

/* ---------- Regra da ficha ---------- */
function escolherRegra(fn) {
  const atual = lsGet(NS + ":regra") === "padrao" ? "padrao" : "determinacao";
  const w = dialog(`<h3>Nova ficha: qual regra?</h3>
    <p class="muted">Dá para trocar depois, no topo da aba Principal.</p>
    <button class="${atual === "determinacao" ? "primary" : ""}" data-regra="determinacao"><b>Determinação</b><br><span class="small">Sobrevivendo ao Horror, p. 104: um só recurso (PD) para habilidades e dano mental.</span></button>
    <button class="${atual === "padrao" ? "primary" : ""}" data-regra="padrao"><b>PE + Sanidade</b><br><span class="small">Livro básico: Pontos de Esforço para habilidades e Sanidade para dano mental.</span></button>
    <button data-close>Cancelar</button>`);
  w.querySelectorAll("[data-regra]").forEach((b) => b.addEventListener("click", () => { const r = b.dataset.regra; lsSet(NS + ":regra", r); w.remove(); fn(r); }));
}
function aplicarSugInicial(n) {
  const g = sugerido(n);
  n.pv = { atual: g.pv, max: g.pv }; n.pd = { atual: g.pd, max: g.pd }; n.san = { atual: g.san, max: g.san };
}
function dyingAction(s, k, op) {
  const morr = k === "morrendo"; const nome = s.header.personagem;
  if (op === "turno") {
    s[k] = Math.min(3, num(s[k]) + 1);
    if (s[k] >= 3) announce(morr ? `☠ ${nome} começou o terceiro turno morrendo e morreu.` : `✖ ${nome} começou o terceiro turno enlouquecendo e ficou insano.${ultOn(s) ? ` Na ${s.ult.nome || "forma suprema"}, agora é um NPC controlado pela intenção assassina.` : ""}`);
    else announce(`${nome} começou o turno ${morr ? "morrendo" : "enlouquecendo"} (${s[k]}/3).`);
  } else if (op === "voltar") s[k] = Math.max(0, num(s[k]) - 1);
  else if (op === "salvo") {
    if (morr) { s.pv.atual = Math.max(1, num(s.pv.atual)); s.morrendo = 0; announce(`✚ ${nome} foi estabilizado e fica com ${s.pv.atual} PV.`); }
    else { const b = mentalBar(s); b.atual = Math.max(1, num(b.atual)); s.enlouquecendo = 0; announce(`✚ ${nome} foi acalmado e fica com ${b.atual} ${isDet(s) ? "PD" : "SAN"}.`); }
  }
  touchSheet(s); render();
}

/* ---------- Dano, cura, RD e PV temporários ---------- */
function rdTotal(s, tipo) {
  let rd = num(s.rdGeral) + ((s.hexa?.rewards || []).includes("Obsessão") ? 5 : 0);
  for (const r of s.rdTipos || []) if (r.tipo === tipo) rd += num(r.valor);
  return rd;
}
function sofrerDano(s, valor, tipo, doRival) {
  let v = Math.max(0, Math.floor(num(valor))); if (!v) return toast("Digite o valor do dano.");
  const passos = [`${v}`];
  if (s.hexa?.batalha && !doRival) { v = Math.floor(v / 2); passos.push(`metade pela batalha de intenções = ${v}`); }
  const rd = rdTotal(s, tipo); if (rd && v) { v = Math.max(0, v - rd); passos.push(`RD ${rd} = ${v}`); }
  let res;
  if (tipo === "Mental" && !isDet(s)) {
    s.san.atual = num(s.san.atual) - v; res = `Sanidade ${s.san.atual}/${s.san.max}`;
  } else if (tipo === "Mental") {
    const t = Math.min(num(s.pdTemp), v); if (t) { s.pdTemp = num(s.pdTemp) - t; passos.push(`${t} absorvidos pelos PD temporários`); }
    s.pd.atual = num(s.pd.atual) - (v - t); res = `Determinação ${s.pd.atual}/${s.pd.max}`;
  }
  else {
    const t = Math.min(num(s.pvTemp), v);
    if (t) { s.pvTemp = num(s.pvTemp) - t; passos.push(`${t} absorvidos pelos PV temporários`); }
    s.pv.atual = num(s.pv.atual) - (v - t);
    res = `PV ${s.pv.atual}/${s.pv.max}${num(s.pvTemp) ? ` (+${s.pvTemp} temp.)` : ""}`;
  }
  touchSheet(s); render();
  announce(`${s.header.personagem} sofreu ${v} de dano${tipo ? " " + tipo.toLowerCase() : ""} (${passos.join(" → ")}). ${res}`);
}
function curar(s, valor, alvo) {
  const v = Math.max(0, Math.floor(num(valor))); if (!v) return toast("Digite o valor.");
  const b = alvo === "pd" ? s.pd : alvo === "san" ? s.san : s.pv; const antes = num(b.atual);
  b.atual = Math.min(num(b.max), antes + v);
  if (alvo === "pv" && b.atual > 0) s.morrendo = 0;
  if (b === mentalBar(s) && b.atual > 0) s.enlouquecendo = 0;
  touchSheet(s); render();
  announce(`${s.header.personagem} recuperou ${b.atual - antes} ${alvo === "pd" ? resSig(s) : alvo === "san" ? "SAN" : "PV"} (${b.atual}/${b.max}).`);
}
function danoCard(s) {
  const tipos = [["", "Sem tipo"], ...TIPOS_DANO];
  return `<section class="card">
    <h3>Dano e cura <span class="muted">RD ${rdTotal(s, "")}${(s.rdTipos || []).length ? " + por tipo" : ""}</span></h3>
    <div class="row"><input id="dmgVal" type="number" min="0" placeholder="Valor" style="max-width:90px"><select id="dmgTipo">${normOpts(tipos).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select></div>
    ${s.hexa?.batalha ? `<label class="check"><input type="checkbox" id="dmgRival"> O dano veio de ${esc(s.hexa.batalha)} (sem reduzir à metade)</label>` : ""}
    <div class="row wrap" style="margin-top:6px"><button class="primary" id="btnDmg">Sofrer dano</button><button id="btnHealPV">Curar PV</button><button id="btnHealPD">Recuperar ${resSig(s)}</button>${isDet(s) ? "" : `<button id="btnHealSAN">Recuperar SAN</button>`}</div>
    <p class="muted small" data-keep>Dano mental vai para a ${isDet(s) ? "Determinação" : "Sanidade"}. PV temporários absorvem o dano antes dos PV normais.</p>
    <div class="grid3" style="margin-top:6px">
      <label>PV temporários ${inp("pvTemp", s.pvTemp, "num", 'min="0"')}</label>
      <label>RD geral ${inp("rdGeral", s.rdGeral, "num", 'min="0"')}</label>
      <label>&nbsp;<button id="btnAddRd" class="ghost">+ RD por tipo</button></label>
    </div>
    ${(s.rdTipos || []).map((r, i) => `<div class="row" style="margin-top:4px">${sel(`rdTipos.${i}.tipo`, r.tipo, TIPOS_DANO)}${inp(`rdTipos.${i}.valor`, r.valor, "num", 'style="max-width:80px"')}${delBtn(`rdTipos.${i}`)}</div>`).join("")}
  </section>`;
}

/* ---------- Próxima rolagem (ajuda / vantagem) ---------- */
let nextMod = { dados: 0, bonus: 0 };
function nextModBar() {
  return `<div class="nextmod card"><span>Próxima rolagem:</span>
    +<input id="nmD" type="number" value="${nextMod.dados}" title="Dados extras (ajuda, vantagem)">d20
    <input id="nmB" type="number" value="${nextMod.bonus}" title="Bônus ou penalidade fixa">
    <button class="ghost icon" id="nmClear">limpar</button></div>`;
}
function takeNextMod() {
  const m = { ...nextMod }; nextMod = { dados: 0, bonus: 0 };
  document.querySelectorAll("#nmD,#nmB").forEach((i) => { i.value = 0; });
  return m;
}
function modTxt(m) { return m.dados || m.bonus ? ` (ajuda: ${m.dados ? `+${m.dados}d` : ""}${m.dados && m.bonus ? " " : ""}${m.bonus ? fmt(m.bonus) : ""})` : ""; }

/* ---------- Interlúdio ---------- */
const DESCANSO = [["Precária", 0.5], ["Normal", 1], ["Confortável", 2], ["Luxuosa", 3]];
const INTER_ACOES = [
  { k: "alimentar", nome: "Alimentar-se", expr: "", desc: "Benefício do prato escolhido." },
  { k: "exercitar", nome: "Exercitar-se", expr: "1d6", desc: "Bônus num teste de FOR, AGI ou VIG." },
  { k: "ler", nome: "Ler", expr: "1d6", desc: "Bônus num teste de INT ou PRE." },
  { k: "manutencao", nome: "Manutenção", expr: "", desc: "Benefício no equipamento cuidado." },

];
function dormirBase(s) {
  const m = (DESCANSO.find((d) => d[0] === s.descanso) || DESCANSO[1])[1];
  return Math.max(1, Math.round(pdLimite(s) * m));
}
function tabInterludio(s) {
  const base = dormirBase(s);
  return `<section class="card"><h3>Interlúdio</h3>
    <p class="muted">Os valores abaixo são um ponto de partida editável: confira no livro (cenas de interlúdio) e ajuste antes de aplicar.${s.hexa ? " <b>No Hexatombe, cada personagem só faz uma ação ao descansar.</b>" : ""}</p>
    <label>Condição de descanso ${sel("descanso", s.descanso, DESCANSO.map(([n, m]) => [n, `${n} (×${String(m).replace(".", ",")})`]), 'data-rerender="1"')}</label>
  </section>
  ${isDet(s) ? `<section class="card"><h3>Dormir</h3>
    <p class="muted small">Com a regra de Determinação (SaH, p. 104), dormir recupera só PV. Base: limite de PD (${pdLimite(s)}) × condição de descanso.</p>
    <div class="row"><label class="inline">PV <input type="number" id="slPV" value="${base}" style="width:70px"></label>
    <button class="primary" id="btnDormir">😴 Dormir</button></div>
  </section>
  <section class="card"><h3>Relaxar</h3>
    <p class="muted small">Com a regra de Determinação, relaxar recupera PD (em vez de Sanidade).</p>
    <div class="row"><label class="inline">PD <input type="number" id="slPD" value="${base}" style="width:70px"></label>
    <button class="primary" id="btnRelaxar">🕯 Relaxar</button></div>
  </section>
  <section class="card"><h3>Prato favorito</h3>
    <div class="row"><span class="muted small">Comer o prato favorito dá 2 PD temporários (SaH, p. 104).</span><button id="btnPrato">🍲 +2 PD temporários</button></div>
    ${num(s.pdTemp) ? `<p class="muted small">PD temporários agora: ${num(s.pdTemp)}</p>` : ""}
  </section>` : `<section class="card"><h3>Dormir</h3>
    <p class="muted small">Dormir recupera PV e PE. Base: limite de PE (${pdLimite(s)}) × condição de descanso.</p>
    <div class="row"><label class="inline">PV <input type="number" id="slPV" value="${base}" style="width:70px"></label><label class="inline">PE <input type="number" id="slPE" value="${base}" style="width:70px"></label>
    <button class="primary" id="btnDormir">😴 Dormir</button></div>
  </section>
  <section class="card"><h3>Relaxar</h3>
    <p class="muted small">Relaxar recupera Sanidade. Base: limite de PE × condição de descanso.</p>
    <div class="row"><label class="inline">SAN <input type="number" id="slSAN" value="${base}" style="width:70px"></label>
    <button class="primary" id="btnRelaxar">🕯 Relaxar</button></div>
  </section>`}
  <section class="card"><h3>Outras ações</h3>
    ${INTER_ACOES.map((a) => `<div class="inter"><b>${esc(a.nome)}</b>
      <input id="ia-${a.k}-x" placeholder="dados (ex.: 1d6)" value="${esc(a.expr)}" style="max-width:110px">
      <input id="ia-${a.k}-d" value="${esc(a.desc)}">
      <button data-inter="${a.k}">Fazer</button></div>`).join("")}
  </section>
  <section class="card"><h3>Benefícios guardados</h3>
    ${(s.buffs || []).length ? `<ul class="buffs">${s.buffs.map((b, i) => `<li><div><b>${esc(b.nome)}</b>${b.expr ? ` <span class="tag">${esc(b.expr)}</span>` : ""}<div class="muted small">${esc(b.desc)}</div></div>
      ${b.expr ? `<button class="primary" data-usebuff="${i}" title="Rola e soma na próxima rolagem">Usar</button>` : `<button data-usebuff="${i}">Usado</button>`}${delBtn(`buffs.${i}`)}</li>`).join("")}</ul>` : `<p class="muted">Nenhum. As ações de interlúdio aparecem aqui até serem usadas.</p>`}
  </section>`;
}

/* ---------- Efeitos para a mesa (v3.8) ---------- */
let animOn = lsGet(NS + ":anim") !== "0";        // animações de crítico e ritual nesta ficha
let fundoOn = lsGet(NS + ":fundo") !== "0";      // fundo animado do elemento
let mesaCfg = { ritual: true, crit: true };     // o mestre liga/desliga para a sala toda
let drama = null;
// Guarda o crítico (20 natural) ou o 1 natural da rolagem que acabou de acontecer; o anúncio solta o efeito
function marcarDrama(pick, sub, extra = "") {
  if (pick === 20) drama = { tipo: "crit", sub, extra, at: Date.now() };
  else if (pick === 1) drama = { tipo: "nat1", sub, extra, at: Date.now() };
  else drama = null;
}
function soltarDrama(escondido) {
  const d = drama; drama = null;
  if (!d || Date.now() - d.at > 1500) return;
  const s = cur(); const nome = s?.header?.personagem || me.name || "";
  const el = ELEMENTOS.includes(temaEf(s)) ? temaEf(s) : "";
  const info = { tipo: d.tipo, nome, sub: [d.sub, d.extra].filter(Boolean).join(" · "), titulo: d.tipo === "crit" ? "Crítico!" : "1 natural", cor: d.tipo === "crit" ? (el ? FX.corDe(el) : "#ffd36b") : "" };
  // espera os dados pararem no prato, para dar suspense
  setTimeout(() => {
    if (animOn) FX.mostrar(info, { tremer: app });
    if (somOn) FX.som(d.tipo);
    if (escondido || !obrOk || mesaCfg.crit === false) return;
    OBR.broadcast.sendMessage(FX_CH, { t: "drama", de: me.id, ...info }, { destination: "REMOTE" }).catch(() => {});
    OBR.broadcast.sendMessage(MESTRE_CH, { kind: "som", k: d.tipo === "crit" ? "critico" : "falha" }, { destination: "REMOTE" }).catch(() => {});
  }, 1050);
}
async function efeitoRitual(s, el, nome, sub) {
  el = FX.EL_COR[el] ? el : "Conhecimento";
  const escondido = (isGM() && hiddenRolls) || (!isGM() && secretRoll);
  if (somOn) FX.som("ritual", el);
  if (mesaCfg.ritual === false) return;
  if (animOn) FX.mostrar({ tipo: "ritual", el, nome: s.header.personagem, titulo: nome, sub });
  if (!obrOk || escondido) return;
  OBR.broadcast.sendMessage(MESTRE_CH, { kind: "som", k: `ritual-${el}` }, { destination: "REMOTE" }).catch(() => {});
  // selo embaixo do token de quem conjurou, visto por todos
  if (!sceneOk) return;
  try {
    const tokens = (await OBR.scene.items.getItems((it) => it.metadata?.[LINK_KEY]?.sheetId === s.id)).map((i) => i.id).slice(0, 3);
    if (tokens.length) OBR.broadcast.sendMessage(FX_CH, { t: "selo", el, tokens }, { destination: "ALL" }).catch(() => {});
  } catch { /* sem cena */ }
}
function cfgMesaHTML() {
  return `<section class="card"><h3>Efeitos na mesa</h3>
    <label class="check"><input type="checkbox" id="cfgRitual" ${mesaCfg.ritual !== false ? "checked" : ""}> Animação ao conjurar ritual (na ficha de quem conjura e o selo embaixo do token)</label>
    <label class="check"><input type="checkbox" id="cfgCrit" ${mesaCfg.crit !== false ? "checked" : ""}> Críticos e 1 natural aparecem na tela de todos</label>
    <p class="muted small">Vale para a sala toda, na hora. Rolagens secretas e ocultas nunca aparecem para os outros.</p></section>`;
}
async function salvarCfg(patch) {
  mesaCfg = { ...mesaCfg, ...patch };
  if (!obrOk) return;
  try { await OBR.room.setMetadata({ [CFG_KEY]: mesaCfg }); } catch { toast("Não deu para salvar na sala."); }
}

/* ---------- Animação e som ---------- */
let somOn = lsGet(NS + ":som") !== "0";
let audioCtx = null;
function rollSound() {
  if (!somOn) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < 5; i++) {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = "triangle"; o.frequency.value = 500 + Math.random() * 700;
      const t = t0 + i * 0.07 + Math.random() * 0.03;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.08);
    }
  } catch { /* sem áudio */ }
}
/* ---------- Prato de dados (v3) ---------- */
const DICE_DEF = { cor: "#c8102e", num: "#ffffff", borda: "#ffffff", estilo: "solido", prato: "feltro-vermelho", tam: 50, tempo: 5, fixo: false };
let diceCfg = { ...DICE_DEF, ...(() => { try { return JSON.parse(lsGet(NS + ":dice") || "{}"); } catch { return {}; } })() };
const PRATOS = [["feltro-vermelho", "Feltro vermelho"], ["feltro-verde", "Feltro verde"], ["couro", "Couro preto"], ["madeira", "Madeira"], ["pedra", "Pedra"], ["sangue", "Poça de sangue"], ["papel", "Papel de arquivo"]];
const ESTILOS = [["solido", "Sólido"], ["translucido", "Translúcido"], ["metalico", "Metálico"], ["osso", "Osso"], ["contorno", "Só contorno"]];
const SHAPES = {
  4: "50,6 95,90 5,90", 6: "10,10 90,10 90,90 10,90", 8: "50,3 95,50 50,97 5,50", 10: "50,3 93,42 50,97 7,42",
  12: "50,3 96,36 78,94 22,94 4,36", 20: "50,3 93,27 93,73 50,97 7,73 7,27",
};
const INNER = { 20: '<polygon points="50,24 80,70 20,70"/><path d="M50,24 L7,27 M50,24 L93,27 M50,24 L50,3 M20,70 L7,27 M20,70 L7,73 M20,70 L50,97 M80,70 L93,27 M80,70 L93,73 M80,70 L50,97"/>',
  8: '<line x1="5" y1="50" x2="95" y2="50"/>', 10: '<polyline points="7,42 50,60 93,42"/><line x1="50" y1="60" x2="50" y2="97"/>', 12: '<polygon points="50,22 76,40 66,72 34,72 24,40"/>' };
let trayTimer = null, trayPinned = false, trayAt = 0;
function dieHTML(f, cls = "") {
  return `<div class="die s-${diceCfg.estilo} ${cls}"><svg viewBox="0 0 100 100"><polygon class="body" points="${SHAPES[f] || SHAPES[20]}"/><g class="lines">${INNER[f] || ""}</g></svg><span>?</span><small>d${f}</small></div>`;
}
function ensureTray() {
  let t = document.getElementById("tray");
  if (!t) {
    t = document.createElement("div"); t.id = "tray";
    t.innerHTML = `<div class="tray-head"><span class="tray-title"></span><span class="tray-btns"><button class="icon" data-traypin title="Manter aberto">📌</button><button class="icon" data-trayclose title="Fechar">✕</button></span></div><div class="tray-felt"></div><div class="tray-res"></div>`;
    document.body.appendChild(t);
    t.addEventListener("click", (e) => {
      if (e.target.closest("[data-trayclose]")) { trayPinned = false; t.classList.remove("open"); }
      if (e.target.closest("[data-traypin]")) { trayPinned = !trayPinned; t.classList.toggle("pinned", trayPinned); if (trayPinned) clearTimeout(trayTimer); else hideTraySoon(); }
    });
  }
  t.className = `prato-${diceCfg.prato}${trayPinned ? " pinned" : ""} open`;
  t.style.setProperty("--dcor", diceCfg.cor); t.style.setProperty("--dnum", diceCfg.num); t.style.setProperty("--dborda", diceCfg.borda); t.style.setProperty("--dtam", diceCfg.tam + "px");
  return t;
}
function hideTraySoon() { clearTimeout(trayTimer); if (!trayPinned && !diceCfg.fixo) trayTimer = setTimeout(() => document.getElementById("tray")?.classList.remove("open"), diceCfg.tempo * 1000); }
// groups: [{ f: faces, vals: [...], keep: índice destacado ou -1, worst: bool }]
function trayRoll(groups, append = false) {
  const t = ensureTray(); const felt = t.querySelector(".tray-felt");
  if (!append) { felt.innerHTML = ""; t.querySelector(".tray-title").textContent = ""; t.querySelector(".tray-res").textContent = ""; }
  rollSound(); trayAt = Date.now();
  if (append && Date.now() - curRoll.at < 4000) curRoll.groups.push(...groups); else curRoll = { groups: [...groups], at: Date.now() };
  const W = felt.clientWidth || 400, H = felt.clientHeight || 130, sz = diceCfg.tam;
  const placed = [...felt.querySelectorAll(".die")].map((d) => [num(d.dataset.x), num(d.dataset.y)]);
  for (const g of groups) {
    g.vals.slice(0, 24).forEach((v, i) => {
      const wrap = document.createElement("div"); wrap.innerHTML = dieHTML(g.f, g.keep === i ? (g.worst ? "keep worst" : "keep") : g.keep >= 0 ? "drop" : "");
      const el = wrap.firstChild; felt.appendChild(el);
      let x, y, tries = 0;
      do { x = 8 + Math.random() * Math.max(10, W - sz - 16); y = 6 + Math.random() * Math.max(10, H - sz - 12); tries++; }
      while (tries < 40 && placed.some(([px, py]) => Math.abs(px - x) < sz * 0.95 && Math.abs(py - y) < sz * 0.95));
      placed.push([x, y]); el.dataset.x = x; el.dataset.y = y;
      const sx = Math.random() < 0.5 ? -sz * 1.5 : W + sz * 0.5, sy = H * Math.random();
      const mx = (sx + x) / 2, my = Math.max(0, y - 30 - Math.random() * 30);
      const r0 = (Math.random() - 0.5) * 900, r1 = r0 / 3, r2 = (Math.random() - 0.5) * 50;
      const dur = 750 + Math.random() * 450;
      el.animate([
        { transform: `translate(${sx}px,${sy}px) rotate(${r0}deg) scale(.7)` },
        { transform: `translate(${mx}px,${my}px) rotate(${r1}deg) scale(1.12)`, offset: 0.55 },
        { transform: `translate(${x}px,${y}px) rotate(${r2}deg) scale(.96)`, offset: 0.8 },
        { transform: `translate(${x}px,${y}px) rotate(${r2 / 4}deg) scale(1)` },
      ], { duration: dur, easing: "cubic-bezier(.25,.7,.35,1)", fill: "forwards" });
      const span = el.querySelector("span"); let n = 0;
      const iv = setInterval(() => { span.textContent = 1 + Math.floor(Math.random() * g.f); if ((n += 60) >= dur - 80) { clearInterval(iv); span.textContent = v; el.classList.add("done"); if (g.f === 20 && v === 20) el.classList.add("nat20"); if (g.f === 20 && v === 1) el.classList.add("nat1"); } }, 60);
    });
  }
  hideTraySoon();
}
function trayText(text) {
  const t = document.getElementById("tray"); if (!t || Date.now() - trayAt > 4000) return;
  const [a, ...rest] = text.split("\n");
  t.querySelector(".tray-title").textContent = a.split(":")[0];
  t.querySelector(".tray-res").innerHTML = [a.slice(a.indexOf(":") + 1), ...rest].map((l) => `<div>${esc(l.trim())}</div>`).join("");
}
function diceAnim(dice, pick, worst) { trayRoll([{ f: 20, vals: dice, keep: dice.indexOf(pick), worst }]); }
function diceDialog() {
  const w = dialog(`<h3>Aparência dos dados</h3>
    <div class="grid2">
      <label>Cor do dado <input type="color" id="dcCor" value="${diceCfg.cor}"></label>
      <label>Cor do número <input type="color" id="dcNum" value="${diceCfg.num}"></label>
      <label>Cor da borda <input type="color" id="dcBorda" value="${diceCfg.borda}"></label>
      <label>Estilo <select id="dcEst">${ESTILOS.map(([v, l]) => `<option value="${v}" ${v === diceCfg.estilo ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>Prato <select id="dcPrato">${PRATOS.map(([v, l]) => `<option value="${v}" ${v === diceCfg.prato ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label>Tamanho <input type="range" id="dcTam" min="34" max="72" value="${diceCfg.tam}"></label>
      <label>Tempo na tela (s) <input type="number" id="dcTempo" min="2" max="30" value="${diceCfg.tempo}" ${diceCfg.fixo ? "disabled" : ""}></label>
    </div>
    <label class="check"><input type="checkbox" id="dcFixo" ${diceCfg.fixo ? "checked" : ""}> Deixar o prato na tela até eu fechar no ✕ ou rolar de novo (sem tempo)</label>
    <div class="row"><button class="primary" id="dcTest">🎲 Testar</button><button id="dcReset" class="ghost">Padrão</button><button data-close>Fechar</button></div>`);
  const apply = () => {
    diceCfg = { cor: w.querySelector("#dcCor").value, num: w.querySelector("#dcNum").value, borda: w.querySelector("#dcBorda").value, estilo: w.querySelector("#dcEst").value,
      prato: w.querySelector("#dcPrato").value, tam: num(w.querySelector("#dcTam").value), tempo: clamp(num(w.querySelector("#dcTempo").value) || 5, 2, 30),
      fixo: w.querySelector("#dcFixo").checked };
    w.querySelector("#dcTempo").disabled = diceCfg.fixo;
    lsSet(NS + ":dice", JSON.stringify(diceCfg));
    if (diceCfg.fixo) clearTimeout(trayTimer);
    if (tab === "dados") softRender();
  };
  w.querySelectorAll("input,select").forEach((i) => i.addEventListener("input", apply));
  w.querySelector("#dcTest").addEventListener("click", () => { apply(); const a = [die(20), die(20)]; trayRoll([{ f: 20, vals: a, keep: a.indexOf(Math.max(...a)) }, { f: 6, vals: [die(6), die(6)], keep: -1 }, { f: 8, vals: [die(8)], keep: -1 }, { f: 4, vals: [die(4)], keep: -1 }, { f: 10, vals: [die(10)], keep: -1 }, { f: 12, vals: [die(12)], keep: -1 }]); });
  w.querySelector("#dcReset").addEventListener("click", () => { diceCfg = { ...DICE_DEF }; lsSet(NS + ":dice", JSON.stringify(diceCfg)); w.remove(); diceDialog(); });
}

/* ---------- Uma ficha por jogador (v3) ---------- */
const reqKey = () => storeKey + ":reqs";
const allowKey = () => storeKey + ":allow";
function readLs(k, def) { try { return JSON.parse(lsGet(k) || "null") ?? def; } catch { return def; } }
function precisaPedir() { return obrOk && !isGM() && Object.keys(store.own).length >= 1; }
function consumeAllow() {
  const a = readLs(allowKey(), { ok: [], used: [] }); const id = a.ok.shift(); if (!id) return false;
  a.used.push(id); lsSet(allowKey(), JSON.stringify(a)); return true;
}
function addAllow(id) {
  const a = readLs(allowKey(), { ok: [], used: [] }); if (a.used.includes(id) || a.ok.includes(id)) return;
  a.ok.push(id); lsSet(allowKey(), JSON.stringify(a));
}
function pedirFicha() {
  const req = { id: uid(), pid: me.id, name: me.name || "Jogador", at: Date.now() };
  send({ t: "newreq", req });
  toast("Você já tem uma ficha. Pedido enviado ao mestre: a nova ficha é criada assim que ele aceitar.");
}
// Cria a ficha, se permitido; retorna false se precisou pedir ao mestre
function criarFichaPermitida(fn) {
  if (precisaPedir() && !consumeAllow()) { pedirFicha(); return false; }
  fn(); return true;
}
function reqsBanner() {
  if (!isGM()) return "";
  const rs = readLs(reqKey(), []); if (!rs.length) return "";
  return rs.map((r) => `<div class="banner req"><span>📝 <b>${esc(r.name)}</b> pediu para criar uma nova ficha.</span>
    <div class="row"><button class="primary" data-reqok="${r.id}">Aceitar</button><button data-reqno="${r.id}">Recusar</button></div></div>`).join("");
}
function respReq(id, ok) {
  const rs = readLs(reqKey(), []); const r = rs.find((x) => x.id === id); if (!r) return;
  lsSet(reqKey(), JSON.stringify(rs.filter((x) => x.id !== id)));
  send({ t: ok ? "newok" : "newno", pid: r.pid, reqId: r.id }); render();
}

/* ---------- Fome e sede (v3) ---------- */
function sobrevivenciaHTML(h) {
  const a = num(h.semAgua), c = num(h.semComida); const u = h.ultimoConsumo;
  return `<div class="surv">
    <div class="${a ? "bad" : "ok"}"><b>💧 ${a ? "Com sede" : "Hidratado"}</b><span>${a ? `−${10 * a} PV máximos · beba 1 água extra para recuperar` : "Sem penalidade"}</span></div>
    <div class="${c ? "bad" : "ok"}"><b>🍖 ${c ? "Com fome" : "Alimentado"}</b><span>${c ? `−${10 * c} PD máximos · coma 1 comida extra para recuperar` : "Sem penalidade"}</span></div>
  </div>${u ? `<p class="muted small">Último consumo: dia ${u.dia} — ${u.agua} água, ${u.comida} comida${h.equipe ? ` · Equipe: ${esc(h.equipe)}` : ""}</p>` : h.equipe ? `<p class="muted small">Equipe: ${esc(h.equipe)}</p>` : ""}`;
}

/* ---------- Impressão ---------- */
function printHTML(s) {
  const e = esc; const per = PERICIAS.map(([n]) => { const p = s.pericias[n]; return `<tr><td>${e(n)}</td><td>${p.attr}</td><td>${fmt(periciaTeste(s, n))}</td><td>${(TREINO.find((t) => t[0] === num(p.treino)) || TREINO[0])[1]}</td></tr>`; }).join("");
  const list = (title, arr, f) => arr.length ? `<h2>${title}</h2>${arr.map((it) => `<div class="it"><b>${e(it.nome || "(sem nome)")}</b> ${f(it)}${it.desc ? `<p>${e(it.desc).replace(/\n/g, "<br>")}</p>` : ""}</div>`).join("")}` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${e(s.header.personagem)} — Ficha</title>
<style>body{font:12px/1.4 Georgia,serif;color:#111;max-width:800px;margin:20px auto;padding:0 16px}h1{font-size:26px;margin:0}h2{font-size:14px;text-transform:uppercase;letter-spacing:.1em;border-bottom:2px solid #111;margin:18px 0 6px}
.top{display:flex;gap:16px;align-items:flex-start}.top img{width:120px;height:120px;object-fit:cover;border:2px solid #111}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;text-align:center}.box{border:1px solid #111;padding:4px}.box b{display:block;font-size:18px}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ccc;padding:2px 4px;text-align:left}.cols{columns:2;column-gap:20px}.it{break-inside:avoid;margin-bottom:6px}.it p{margin:2px 0 0;color:#333}@media print{button{display:none}}</style></head><body>
<button onclick="print()">Imprimir / salvar em PDF</button>
<div class="top">${s.header.img ? `<img src="${e(s.header.img)}">` : ""}<div><h1>${e(s.header.personagem)}</h1>
<p>Jogador: ${e(s.header.jogador)} · Origem: ${e(s.header.origem)} · Classe: ${e(s.header.classe)}${s.header.trilha ? ` · Trilha: ${e(s.header.trilha)}` : ""} · NEX ${s.nex}%${s.header.afinidade ? ` · Afinidade: ${e(s.header.afinidade)}` : ""}</p>
<p>Patente: ${e(s.equip.patente)} · Prestígio: ${s.equip.prestigio} · Crédito: ${e(s.equip.credito)}</p></div></div>
<h2>Atributos e status</h2><div class="grid">${ATTRS.map(([a, n]) => `<div class="box">${n}<b>${attrVal(s, a)}</b></div>`).join("")}</div>
<div class="grid" style="margin-top:6px"><div class="box">PV<b>${s.pv.atual}/${s.pv.max}</b></div><div class="box">${resNome(s)}<b>${s.pd.atual}/${s.pd.max}</b></div>${isDet(s) ? "" : `<div class="box">Sanidade<b>${s.san.atual}/${s.san.max}</b></div>`}<div class="box">Defesa<b>${defesaTotal(s)}</b></div><div class="box">Esquiva<b>${defesaTotal(s) + periciaTotal(s, "Reflexos")}</b></div><div class="box">Desloc.<b>${deslocEfetivo(s)}m</b></div></div>
<p>Limite de ${resSig(s)} por rodada: ${pdLimite(s)} · Bloqueio: ${periciaTotal(s, "Fortitude")} · DT de rituais: ${s.rituais.dt} · Carga: ${cargaAtual(s)}/${cargaMax(s)}${s.condicoes.length ? ` · Condições: ${e(s.condicoes.join(", "))}` : ""}</p>
${s.resistencias ? `<p><b>Resistências:</b> ${e(s.resistencias)}</p>` : ""}${s.proficiencias ? `<p><b>Proficiências:</b> ${e(s.proficiencias)}</p>` : ""}
<h2>Perícias</h2><div class="cols"><table><tr><th>Perícia</th><th>Atr.</th><th>Bônus</th><th>Treino</th></tr>${per}</table></div>
${list("Ataques", s.ataques, (a) => `— ${e(a.pericia)}, ${e(a.dano)} ${e(a.tipo)}, crítico ${a.critico}/×${a.mult}, ${e(a.alcance)}`)}
${list("Habilidades", s.habilidades, (h) => (num(h.custo) ? `— ${h.custo} PD` : ""))}
${list("Rituais", s.rituais.lista, (r) => `— ${e(r.elemento)} ${r.circulo}º · ${e(r.execucao)} · ${e(r.alcance)}${r.area ? ` · ${e(r.area)}` : ""}${r.dados ? ` · ${e(r.dados)}` : ""}`)}
${list("Armas", s.armas, (w) => `— ${e(w.prof)}, ${e(dmgTxt(w.dano, w.danoFixo))} ${e(w.tipoDano)}, crítico ${w.critico}/×${w.mult}, Cat. ${nomeCat(w.categoria)}`)}
${list("Proteções", s.protecoes, (p) => `— +${p.defesa} Defesa, Cat. ${nomeCat(p.categoria)}`)}
${list("Munições", s.municoes, (m) => `— ${m.atual}/${m.max}`)}
${list("Itens gerais", s.gerais, (g) => `— ${e(g.tipo)}, Cat. ${nomeCat(g.categoria)}`)}
${list("Itens amaldiçoados", s.amaldicoados, (g) => `— ${e(g.elemento)}, Cat. ${nomeCat(g.categoria)}`)}
${[["anotacoes", "Anotações"], ["aparencia", "Aparência"], ["personalidade", "Personalidade"], ["historico", "Histórico"], ["objetivo", "Objetivo"]].filter(([k]) => s.notas[k]).map(([k, l]) => `<h2>${l}</h2><p>${e(s.notas[k]).replace(/\n/g, "<br>")}</p>`).join("")}
</body></html>`;
}
function downloadFile(name, content, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
}

/* ---------- Backup completo (arquivo) e backup na cena ---------- */
const BACKUP_KEY = NS + "/backup";
async function gz(str) {
  const buf = new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function gunz(b64) {
  const bin = atob(b64); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
}
function stripImgs(o) { return JSON.parse(JSON.stringify(o, (k, v) => (typeof v === "string" && v.startsWith("data:image") ? "" : v))); }
function keepLocalImgs(oldS, newS) {
  if (!oldS) return newS;
  if (!newS.header.img && oldS.header?.img) newS.header.img = oldS.header.img;
  for (const path of Object.values(LIST_PATHS)) {
    const olds = Object.fromEntries((getPath(oldS, path) || []).map((it) => [it.id, it]));
    for (const it of getPath(newS, path) || []) if (!it.img && olds[it.id]?.img) it.img = olds[it.id].img;
  }
  return newS;
}
// Coloca fichas restauradas no lugar certo e avisa os donos
function restoreSheets(sheets) {
  let n = 0;
  for (const raw of sheets) {
    const s = upgrade(raw); const mine = s.owner?.id === me.id || (!s.owner?.id);
    if (!mine && !isGM()) continue;
    const bucket = store.own[s.id] || mine ? "own" : "others";
    const old = store.own[s.id] || store.others[s.id];
    keepLocalImgs(old, s); s.updatedAt = Date.now();
    if (bucket === "own") { delete store.others[s.id]; store.own[s.id] = s; } else store.others[s.id] = s;
    committed[s.id] = JSON.stringify(s); scheduleSync(s); n++;
  }
  persist(); render(); return n;
}
async function backupToScene() {
  if (!sceneOk) return toast("Abra uma cena no Owlbear para salvar o backup nela.");
  const sheets = allVisible().map((v) => stripImgs(v.s));
  const json = JSON.stringify({ at: Date.now(), by: me.name, sheets });
  let data; try { data = await gz(json); } catch { return toast("Este navegador não consegue compactar o backup. Use o backup em arquivo."); }
  if (data.length > 60000) return toast(`O backup ficou grande demais para a cena (${Math.round(data.length / 1024)} KB). Use o backup em arquivo.`);
  try {
    await OBR.scene.setMetadata({ [BACKUP_KEY]: { at: Date.now(), by: me.name, n: sheets.length, data } });
    toast(`Backup de ${sheets.length} ficha(s) salvo nesta cena (${Math.round(data.length / 1024)} KB). Imagens enviadas do computador não entram — guarde-as no backup em arquivo.`);
  } catch (e) { console.warn(e); toast("O Owlbear recusou o backup (talvez pelo tamanho). Use o backup em arquivo."); }
}
async function restoreFromScene() {
  if (!sceneOk) return toast("Abra a cena onde o backup foi salvo.");
  const b = (await OBR.scene.getMetadata())[BACKUP_KEY];
  if (!b) return toast("Esta cena não tem backup de fichas.");
  const quando = new Date(b.at).toLocaleString("pt-BR");
  const w = dialog(`<h3>Restaurar backup da cena</h3><p>Backup de ${b.n} ficha(s), salvo por ${esc(b.by || "?")} em ${quando}.</p>
    <p class="muted">${isGM() ? "Todas as fichas voltam para esse ponto e os jogadores recebem a versão restaurada." : "Só as suas fichas serão restauradas."} As imagens que você tem neste navegador são mantidas.</p>
    <div class="row"><button class="primary" id="rsGo">Restaurar</button><button data-close>Cancelar</button></div>`);
  w.querySelector("#rsGo").addEventListener("click", async () => {
    try { const d = JSON.parse(await gunz(b.data)); const n = restoreSheets(d.sheets || []); w.remove(); toast(`${n} ficha(s) restaurada(s).`); }
    catch (e) { console.warn(e); toast("Não consegui ler o backup."); }
  });
}
function downloadFullBackup() {
  const sheets = allVisible().map((v) => v.s);
  downloadFile(`backup-fichas-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ tipo: "backup-ficha-op", at: Date.now(), sheets }), "application/json");
  for (const s of sheets) if (store.own[s.id]) s.lastExport = Date.now();
  persist(); render();
}

/* =========================================================
   v3.1 — pratos da mesa, rolagem secreta, NEX guiado,
   iniciativa nos tokens
   ========================================================= */

/* ---------- Pratos da mesa (rolagens dos outros, só se quiser ver) ---------- */
let curRoll = { groups: [], at: 0 };
let diceShareTimer = null;
const feedKey = () => storeKey + ":feed";
function readFeed() { return readLs(feedKey(), {}); }
function shareDiceSoon(text) {
  if (!obrOk || isGM()) return; // as rolagens do mestre não aparecem nos pratos da mesa
  clearTimeout(diceShareTimer);
  diceShareTimer = setTimeout(() => {
    if (Date.now() - curRoll.at > 4000 || !curRoll.groups.length) return;
    const c = cur();
    send({ t: "dice", pid: me.id, who: me.name, char: c?.header?.personagem || "", text, groups: curRoll.groups.slice(0, 12), cfg: diceCfg, at: Date.now() });
  }, 700);
}
function storeFeed(msg) {
  const f = readFeed(); const e = (f[msg.pid] ||= { who: msg.who, char: msg.char, rolls: [] });
  e.who = msg.who; e.char = msg.char;
  if (!e.rolls.some((r) => r.at === msg.at)) e.rolls.unshift({ text: msg.text, groups: msg.groups, cfg: msg.cfg, at: msg.at });
  e.rolls = e.rolls.slice(0, 5); lsSet(feedKey(), JSON.stringify(f));
}
function staticDice(groups, cfg) {
  const st = `--dcor:${cfg?.cor || DICE_DEF.cor};--dnum:${cfg?.num || DICE_DEF.num};--dborda:${cfg?.borda || DICE_DEF.borda};--dtam:38px`;
  return `<div class="mini-felt prato-${esc(cfg?.prato || DICE_DEF.prato)}" style="${st}">${groups.flatMap((g) => g.vals.map((v, i) =>
    `<div class="die mini s-${esc(cfg?.estilo || "solido")} done ${g.keep === i ? (g.worst ? "keep worst" : "keep") : g.keep >= 0 ? "drop" : ""} ${g.f === 20 && v === 20 ? "nat20" : ""}">
      <svg viewBox="0 0 100 100"><polygon class="body" points="${SHAPES[g.f] || SHAPES[20]}"/><g class="lines">${INNER[g.f] || ""}</g></svg><span>${v}</span></div>`)).join("")}</div>`;
}
function tabPratos() {
  const f = readFeed(); const ids = Object.keys(f).sort((a, b) => (f[b].rolls[0]?.at || 0) - (f[a].rolls[0]?.at || 0));
  const fmtT = (t) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `<section class="card"><h3>Pratos da mesa</h3><p class="muted">As últimas rolagens de cada jogador, com os dados do jeito que cada um personalizou. Só aparecem aqui: ninguém é obrigado a ver. As rolagens do mestre e as secretas não entram.</p>
    ${ids.length ? "" : `<p class="muted">Nenhuma rolagem dos outros jogadores ainda.</p>`}</section>
    ${ids.map((pid) => { const e = f[pid]; const r = e.rolls[0]; if (!r) return "";
      return `<section class="card prato-card ${Date.now() - r.at < 3000 ? "new" : ""}"><div class="row between"><b class="pc-name">${esc(e.char || e.who)}</b><span class="muted small">${esc(e.who)} · ${fmtT(r.at)}</span></div>
        ${staticDice(r.groups, r.cfg)}
        <div class="pc-res">${r.text.split("\n").map((l) => `<div>${esc(l)}</div>`).join("")}</div>
        ${e.rolls.length > 1 ? `<details><summary class="muted small">Rolagens anteriores</summary>${e.rolls.slice(1).map((o) => `<div class="pc-old"><span class="muted small">${fmtT(o.at)}</span> ${esc(o.text.split("\n")[0])}</div>`).join("")}</details>` : ""}
      </section>`; }).join("")}
    ${ids.length ? `<button class="ghost" id="btnFeedClear">Limpar pratos</button>` : ""}`;
}

/* ---------- Rolagem secreta (só o mestre vê) ---------- */
let secretRoll = false;

/* ---------- Subir de NEX guiado ---------- */
// Lembretes de progressão: confira no livro, a ficha só avisa
// Tabelas 1.3 a 1.5 do livro básico
const NEX_LEMBRETES = [[15, "poder de classe"], [20, "aumento de atributo (+1, máx. 5)"], [30, "poder de classe"], [35, "grau de treinamento"], [45, "poder de classe"], [50, "aumento de atributo, versatilidade (e afinidade elemental)"], [60, "poder de classe"], [70, "grau de treinamento"], [75, "poder de classe"], [80, "aumento de atributo"], [90, "poder de classe"], [95, "aumento de atributo"]];
const NEX_CLASSE = {
  Combatente: [[25, "Ataque Especial: 3 PE, +10"], [55, "Ataque Especial: 4 PE, +15"], [85, "Ataque Especial: 5 PE, +20"]],
  Especialista: [[25, "Perito: 3 PE, +1d8"], [40, "Engenhosidade (veterano)"], [55, "Perito: 4 PE, +1d10"], [75, "Engenhosidade (expert)"], [85, "Perito: 5 PE, +1d12"]],
  Ocultista: [[25, "rituais de 2º círculo"], [55, "rituais de 3º círculo"], [85, "rituais de 4º círculo"]],
};
const GRAU_BASE = { Combatente: 2, Especialista: 5, Ocultista: 3 }; // perícias no grau de treinamento = base + Int
const lvlOf = (n) => (num(n) >= 99 ? 20 : Math.max(1, Math.round(num(n) / 5)));
function trilhaAviso(s) {
  const t = trilhaAtual(s); const nex = num(s.nex);
  if (!libLoad()?.itens?.length) return "";
  if (!s.header.trilha) return nex >= 10 ? `<p class="wide warn small">Sem trilha escolhida. Use 📚 Escolher para pegar uma trilha dos livros.</p>` : "";
  if (!t) return `<p class="wide muted small">Trilha “${esc(s.header.trilha)}” não está nas bibliotecas carregadas: as habilidades ficam por sua conta.</p>`;
  const falta = faltandoTrilha(s, t, -1, nex);
  return `<p class="wide muted small">Trilha do livro: ${esc(t.livro)}${t.classe ? ` · ${esc(t.classe)}` : ""}.</p>${falta.length ? `<p class="wide warn small">Faltam na aba Habilidades: ${falta.map((it) => `${esc(it.nome)} (NEX ${num(it.nex)}%)`).join(", ")}. <button class="small" data-trilhaok="1">Adicionar</button></p>` : ""}`;
}
function nexDialog(s, de, para) {
  const dl = lvlOf(para) - lvlOf(de); if (dl <= 0) return;
  const st = CLASSE_STATS[s.header.classe] || CLASSE_STATS.Combatente;
  const vig = attrVal(s, "VIG"), pre = attrVal(s, "PRE");
  const rr = isDet(s) ? st.pd : st.pe;
  const dPV = dl * (st.pv[1] + vig), dPD = dl * (rr[1] + pre), dSAN = isDet(s) ? 0 : dl * st.san[1];
  const limDe = Math.round(num(de) / 5), limPara = Math.round(num(para) / 5);
  const trilhas = TRILHA_NEX.filter((n) => de < n && para >= n);
  const cls = s.header.classe;
  const tAt = trilhaAtual(s); const novas = faltandoTrilha(s, tAt, de, para);
  const temLib = !!libLoad()?.itens?.length;
  const trilhaLi = novas.length
    ? `<li data-keep><label class="check"><input type="checkbox" id="nxTr" checked> <span><b>Trilha ${esc(tAt.nome)}:</b> adicionar ${novas.map((it) => `<b>${esc(it.nome)}</b> (NEX ${num(it.nex)}%)`).join(", ")} na aba Habilidades</span></label></li>`
    : !s.header.trilha && trilhas.length && temLib
      ? `<li><b>Trilha:</b> ainda não escolhida. <button class="small" id="nxTrEsc">📚 Escolher trilha</button></li>`
      : !tAt ? trilhas.map((n) => `<li><b>Habilidade de trilha (NEX ${n}%):</b> anote na aba Principal, em “Trilha e afinidade”.</li>`).join("") : "";
  const lembra = [...NEX_LEMBRETES, ...(NEX_CLASSE[cls] || [])].filter(([n]) => de < n && para >= n).sort((x, y) => x[0] - y[0])
    .map(([n, t]) => [n, t === "poder de classe" ? `poder de ${String(cls || "classe").toLowerCase()}` : t === "grau de treinamento" && GRAU_BASE[cls] ? `grau de treinamento em ${GRAU_BASE[cls] + attrVal(s, "INT")} perícias (${GRAU_BASE[cls]} + Int)` : t]);
  if (cls === "Ocultista") lembra.push([para, `aprenda ${dl} ritual(is) de um círculo que possa lançar`]);
  const w = dialog(`<h3>NEX ${de}% → ${para}%</h3>
    <ul class="nexlist">
      <li><b>PV máximos:</b> ${s.pv.max} → <b>${num(s.pv.max) + dPV}</b> <span class="muted">(+${dPV}: ${st.pv[1]} da classe + ${vig} de Vigor por nível)</span></li>
      <li><b>Determinação máxima:</b> ${s.pd.max} → <b>${num(s.pd.max) + dPD}</b> <span class="muted">(+${dPD}: ${rr[1]} da classe + ${pre} de Presença por nível)</span></li>
      ${dSAN ? `<li data-keep><b>Sanidade máxima:</b> ${s.san.max} → <b>${num(s.san.max) + dSAN}</b> <span class="muted">(+${dSAN}: ${st.san[1]} da classe por nível)</span></li>` : ""}
      <li><b>Limite de PD por rodada:</b> ${limDe} → <b>${limPara}</b> <span class="muted">(automático)</span></li>
      ${trilhaLi}
      ${lembra.length ? `<li class="muted">Lembretes (confira no livro): ${lembra.map(([n, t]) => `${n}% — ${t}`).join("; ")}.</li>` : ""}
    </ul>
    <p class="muted small">Aplicar soma os aumentos aos PV e à Determinação, máximos e atuais.</p>
    <div class="row"><button class="primary" id="nxGo">Aplicar</button><button id="nxSkip">Só mudar o NEX</button></div>`);
  const addTrilha = () => { if (novas.length && w.querySelector("#nxTr")?.checked) { const n = aplicarTrilha(s, tAt, de, para); if (n) toast(`${n} habilidade(s) da trilha ${tAt.nome} adicionada(s) na aba Habilidades.`); return n; } return 0; };
  w.querySelector("#nxSkip").addEventListener("click", () => { if (addTrilha()) { touchSheet(s); render(); } w.remove(); });
  w.querySelector("#nxTrEsc")?.addEventListener("click", () => trilhaDialog(s));
  w.querySelector("#nxGo").addEventListener("click", () => {
    addTrilha();
    s.pv.max = num(s.pv.max) + dPV; s.pv.atual = num(s.pv.atual) + dPV; s.pd.max = num(s.pd.max) + dPD; s.pd.atual = num(s.pd.atual) + dPD;
    if (dSAN) { s.san.max = num(s.san.max) + dSAN; s.san.atual = num(s.san.atual) + dSAN; }
    touchSheet(s); w.remove(); render(); announce(`${s.header.personagem} chegou a NEX ${para}%: +${dPV} PV e +${dPD} PD máximos.`);
  });
}

/* ---------- Iniciativa nos tokens ---------- */
const INI_KEY = NS + "/ini";
async function syncIniTokens() {
  if (!sceneOk || !isGM()) return;
  try {
    const old = await OBR.scene.items.getItems((it) => it.metadata?.[INI_KEY]);
    if (old.length) await OBR.scene.items.deleteItems(old.map((i) => i.id));
    if (!ini.list.length) return;
    const add = [];
    for (const [i, e] of ini.list.entries()) {
      if (!e.sheetId) continue;
      const toks = await OBR.scene.items.getItems((it) => it.metadata?.[LINK_KEY]?.sheetId === e.sheetId);
      for (const tk of toks) {
        const b = await OBR.scene.items.getItemBounds([tk.id]); const sz = Math.max(22, Math.round(b.width * 0.32));
        const atual = i === ini.turn;
        add.push(buildShape().shapeType("RECTANGLE").width(sz).height(sz).position({ x: b.min.x - sz * 0.25, y: b.min.y - sz * 0.25 })
          .fillColor(atual ? "#d0122f" : "#000000").fillOpacity(0.9).strokeColor("#ffffff").strokeWidth(2).attachedTo(tk.id).layer("ATTACHMENT")
          .locked(true).disableHit(true).disableAttachmentBehavior(["ROTATION", "SCALE"]).metadata({ [INI_KEY]: true }).zIndex(10).build());
        add.push(buildText().textType("PLAIN").plainText(String(i + 1)).width(sz).height(sz).position({ x: b.min.x - sz * 0.25, y: b.min.y - sz * 0.25 })
          .fontSize(Math.round(sz * 0.62)).fontWeight(700).fillColor("#ffffff").textAlign("CENTER").textAlignVertical("MIDDLE").padding(0).lineHeight(1)
          .attachedTo(tk.id).layer("ATTACHMENT").locked(true).disableHit(true).disableAttachmentBehavior(["ROTATION", "SCALE"]).metadata({ [INI_KEY]: true }).zIndex(11).build());
        if (atual) add.push(buildShape().shapeType("RECTANGLE").width(b.width + 12).height(b.height + 12).position({ x: b.min.x - 6, y: b.min.y - 6 })
          .fillOpacity(0).strokeColor("#d0122f").strokeWidth(5).strokeDash([14, 8]).attachedTo(tk.id).layer("ATTACHMENT")
          .locked(true).disableHit(true).disableAttachmentBehavior(["ROTATION", "SCALE"]).metadata({ [INI_KEY]: true }).zIndex(9).build());
      }
    }
    if (add.length) await OBR.scene.items.addItems(add);
  } catch (e) { console.warn("Iniciativa nos tokens:", e); }
}

/* =========================================================
   v3.2 — biblioteca do livro e explicação dos dados
   ========================================================= */

/* ---------- Por que a rolagem tem esses dados ---------- */
function penReasons(s, attr, pericia, isAttack) {
  const out = [];
  for (const c of activeConds(s)) {
    const e = COND_MAP[c]?.e; if (!e) continue;
    const n = (e.dAll || 0) + (["FOR", "AGI", "VIG"].includes(attr) ? e.dFis || 0 : 0) + (["INT", "PRE"].includes(attr) ? e.dMen || 0 : 0) + (isAttack ? e.dAtk || 0 : 0) + (pericia && e.dPer?.[pericia] ? e.dPer[pericia] : 0);
    if (n) out.push(c);
  }
  if (s.hexa?.desertor) out.push("desertor");
  return out;
}
function diceWhy(s, attr, pericia, isAttack, extra) {
  const base = attrVal(s, attr); const pen = dicePenalty(s, attr, pericia, isAttack); const n = base - pen + num(extra);
  const parts = [`${attr} ${base}`];
  if (pen) parts.push(`−${pen}d (${penReasons(s, attr, pericia, isAttack).join(", ")})`);
  if (extra) parts.push(`+${extra}d (ajuda)`);
  return (pen || extra || base <= 0) ? ` · ${parts.join(" ")} = ${n > 0 ? `${n}d20` : `${n} dado(s): rola ${2 - n}d20 e fica com o pior`}` : "";
}

/* ---------- Biblioteca do livro ---------- */
const LIB_KEY = NS + ":lib";
let libCache = null;
function libLoad() { if (libCache) return libCache; try { libCache = JSON.parse(lsGet(LIB_KEY) || "null"); } catch { libCache = null; } return libCache; }
function libSave(lib) {
  libCache = lib;
  if (!lsSet(LIB_KEY, JSON.stringify(lib))) { toast("Não coube no armazenamento do navegador. Tente apagar fichas antigas ou imagens."); return false; }
  return true;
}
function libMerge(add) {
  const cur = libLoad() || { formato: "biblioteca-ficha-op", versao: 1, livros: {}, itens: [] };
  const livros = Object.keys(add.livros || {});
  cur.itens = cur.itens.filter((i) => !livros.some((l) => i.fonte?.startsWith(l + " "))).concat(add.itens || []);
  cur.livros = { ...cur.livros, ...(add.livros || {}) };
  return libSave(cur) ? cur : null;
}
const TIPO_NOME = { poder: "Poder", trilha: "Trilha", origem: "Origem", ritual: "Ritual" };
function libDialog(modo) {
  const lib = libLoad();
  if (!lib?.itens?.length) {
    return dialog(`<h3>Biblioteca do livro</h3><p>Nenhuma biblioteca carregada neste navegador.</p>
      <p class="muted">${isGM() ? "Importe o arquivo de biblioteca no menu ⋯ → Biblioteca do livro, e depois envie aos jogadores." : "Peça ao mestre para enviar a biblioteca pela sala, ou importe o arquivo no menu ⋯ → Biblioteca do livro."}</p><button data-close>Fechar</button>`);
  }
  const s = cur();
  const itemLista = String(modo).startsWith("item:") ? modo.slice(5) : null;
  const tipos = itemLista ? ["item"] : modo === "rituais" ? ["ritual"] : ["poder", "trilha", "origem"];
  const okItem = (it) => !itemLista || it.lista === itemLista;
  const grupos = [...new Set(lib.itens.filter((i) => tipos.includes(i.tipo) && okItem(i)).map((i) => i.tipo === "trilha" ? `Trilha: ${i.grupo}` : i.grupo))].sort();
  const TIT = { armas: "Armas", municoes: "Munições", protecoes: "Proteções", gerais: "Itens gerais", amaldicoados: "Itens amaldiçoados" };
  const w = dialog(`<h3>${itemLista ? `${TIT[itemLista] || "Itens"} do livro` : modo === "rituais" ? "Rituais do livro" : "Habilidades do livro"}</h3>
    <div class="row"><input id="lbQ" placeholder="🔍 Buscar por nome ou texto…"><select id="lbG"><option value="">Tudo</option>${grupos.map((g) => `<option>${esc(g)}</option>`).join("")}</select></div>
    ${itemLista && !lib.itens.some((i) => i.tipo === "item" && i.lista === itemLista) ? `<p class="muted">Nenhum item desta lista nas bibliotecas carregadas. Importe as bibliotecas novas (com itens) no menu ⋯ → Biblioteca do livro.</p>` : ""}
    ${!itemLista && modo !== "rituais" ? `<label class="check"><input type="checkbox" id="lbCls" checked> Só da classe ${esc(s.header.classe)} (e gerais)</label>` : ""}
    <p class="muted small" id="lbCount"></p>
    <div class="lb-list" id="lbList"></div><button data-close>Fechar</button>`);
  w.querySelector(".box").classList.add("lb-box");
  const draw = () => {
    const q = w.querySelector("#lbQ").value.trim().toLowerCase(); const g = w.querySelector("#lbG").value; const cls = w.querySelector("#lbCls")?.checked;
    const list = lib.itens.map((it, i) => ({ it, i })).filter(({ it }) => tipos.includes(it.tipo) && okItem(it)
      && (!g || (it.tipo === "trilha" ? `Trilha: ${it.grupo}` : it.grupo) === g)
      && (!cls || !it.classe || it.classe === s.header.classe)
      && (!q || (it.nome + " " + it.desc).toLowerCase().includes(q)));
    w.querySelector("#lbCount").textContent = `${list.length} entrada(s)`;
    w.querySelector("#lbList").innerHTML = list.length ? list.map(({ it, i }) => `<details class="lb-item"><summary><b>${esc(it.nome)}</b> <span class="muted small">${esc(it.tipo === "trilha" ? `Trilha ${it.grupo}, NEX ${it.nex}%` : it.tipo === "ritual" ? `${it.elemento || ""} ${it.circulo || ""}º` : it.tipo === "item" ? itemResumo(it) : it.grupo)} · ${esc(it.fonte)}</span>
        <button class="primary icon" data-libadd="${i}">+ Adicionar</button></summary>
        ${it.prereq ? `<p class="muted small"><b>Pré-requisito:</b> ${esc(it.prereq)}</p>` : ""}${it.pericias ? `<p class="muted small"><b>Perícias treinadas:</b> ${esc(it.pericias)}</p>` : ""}${it.poder ? `<p class="muted small"><b>Poder:</b> ${esc(it.poder)}</p>` : ""}
        ${it.tipo === "ritual" ? `<p class="muted small">${[["Execução", it.execucao], ["Alcance", it.alcance], ["Alvo", it.alvo], ["Área", it.area], ["Duração", it.duracao], ["Resistência", it.resistencia]].filter((x) => x[1]).map((x) => `<b>${x[0]}:</b> ${esc(x[1])}`).join(" · ")}</p>` : ""}
        <p class="lb-desc">${esc(it.desc)}</p>
        ${it.discente ? `<p class="small"><b>Discente (+${it.discenteCusto} PE):</b> ${esc(it.discente)}</p>` : ""}${it.verdadeiro ? `<p class="small"><b>Verdadeiro (+${it.verdadeiroCusto} PE):</b> ${esc(it.verdadeiro)}</p>` : ""}
      </details>`).join("") : `<p class="muted">Nada encontrado.</p>`;
  };
  w.querySelector("#lbQ").addEventListener("input", draw); w.querySelector("#lbG").addEventListener("change", draw); w.querySelector("#lbCls")?.addEventListener("change", draw);
  w.addEventListener("click", (e) => {
    const b = e.target.closest("[data-libadd]"); if (!b) return; e.preventDefault();
    libAdd(lib.itens[Number(b.dataset.libadd)]); b.textContent = "✓ Adicionado"; b.disabled = true;
  });
  draw(); setTimeout(() => w.querySelector("#lbQ").focus(), 50);
}
const firstDice = (t) => (String(t || "").match(/\d+d\d+(?:\s*[+−-]\s*\d+)?/) || [""])[0].replace(/\s+/g, "").replace("−", "-");
function mapOpt(v, opts) { const n = String(v || "").toLowerCase(); return opts.find((o) => n.includes(o.toLowerCase())) || opts[0]; }
function itemResumo(it) {
  const p = [it.grupo, `Cat. ${nomeCat(it.categoria)}`, `${String(it.espacos ?? 1).replace(".", ",")} esp.`];
  if (it.dano) p.push(`${it.dano} ${String(it.tipoDano || "").toLowerCase()}`);
  if (it.critico) p.push(`crít. ${it.critico}/×${it.mult || 2}`);
  if (it.defesa) p.push(`+${it.defesa} Defesa`);
  return p.join(" · ");
}
function libAddItem(s, it) {
  const lista = SCHEMAS[it.lista] ? it.lista : "gerais";
  const o = newItem(SCHEMAS[lista]);
  o.nome = it.nome; o.categoria = clamp(num(it.categoria), 0, 4); o.espacos = num(it.espacos);
  const extra = [];
  if (lista === "armas") {
    const m = /^(\d*d\d+(?:\+\d*d\d+)*)([+-]\d+)?$/i.exec(String(it.dano || "").replace(/\s+/g, ""));
    Object.assign(o, {
      prof: ["Arma Simples", "Arma Tática", "Arma Pesada"].includes(it.prof) ? it.prof : o.prof,
      tipo: ["Corpo a Corpo", "Arma de Arremesso", "Arma de Disparo", "Arma de Fogo"].includes(it.armaTipo) ? it.armaTipo : o.tipo,
      empunhadura: ["Leve", "Uma Mão", "Duas Mãos"].includes(it.empunhadura) ? it.empunhadura : o.empunhadura,
      tipoDano: TIPOS_DANO.includes(it.tipoDano) ? it.tipoDano : o.tipoDano,
      dano: m ? m[1] : (it.dano || ""), danoFixo: m && m[2] ? num(m[2]) : 0,
      critico: clamp(num(it.critico) || 20, 1, 20), mult: clamp(num(it.mult) || 2, 1, 9),
      alcance: ALCANCES.includes(it.alcance) ? it.alcance : o.alcance,
    });
    if (it.elemento) extra.push(`Item amaldiçoado (${it.elemento}).`);
  }
  if (lista === "protecoes") o.defesa = num(it.defesa);
  if (lista === "gerais" && it.subtipo) o.tipo = it.subtipo;
  if (lista === "amaldicoados") o.elemento = ["Sangue", "Morte", "Energia", "Conhecimento", "Medo", "Varia"].includes(it.elemento) ? it.elemento : "Varia";
  if (lista === "municoes") { o.atual = num(it.qtd); o.max = num(it.qtd); }
  o.desc = `${extra.join(" ")}${extra.length ? "\n" : ""}${it.desc || ""}\n(${it.fonte})`.trim();
  s[lista].push(o); openCards.add(o.id);
  return lista;
}
function libAdd(it) {
  const s = cur(); if (!s) return;
  if (it.tipo === "item") { const l = libAddItem(s, it); touch(); render(); toast(`${it.nome} adicionado ao inventário (${l === "gerais" ? "itens gerais" : l}).`); return; }
  const custo = num((String(it.desc).match(/(\d+)\s*PE\b/) || [])[1]);
  if (it.tipo === "ritual") {
    const r = newItem(SCHEMAS.rituais);
    const res = String(it.resistencia || "");
    Object.assign(r, {
      nome: it.nome, elemento: ELEMENTOS.includes(it.elemento) ? it.elemento : r.elemento, circulo: clamp(num(it.circulo) || 1, 1, 4),
      execucao: mapOpt(it.execucao, EXECUCOES), alcance: mapOpt(it.alcance, ALC_RITUAL), area: [it.alvo, it.area].filter(Boolean).join(" / "), duracao: it.duracao || "",
      resPericia: RES_PERICIA.find((p) => p !== "—" && res.includes(p)) || "—",
      resEfeito: /anula/i.test(res) ? "Anula" : /desacredita/i.test(res) ? "Desacredita" : /parcial/i.test(res) ? "Parcial" : /metade/i.test(res) ? "Reduz à Metade" : "—",
      dados: firstDice(it.desc), dadosDiscente: firstDice(it.discente), dadosVerdadeiro: firstDice(it.verdadeiro),
      custoDiscente: num(it.discenteCusto), custoVerdadeiro: num(it.verdadeiroCusto),
      desc: `${it.desc}\n(${it.fonte})`, descDiscente: it.discente || "", descVerdadeiro: it.verdadeiro || "",
    });
    s.rituais.lista.push(r); openCards.add(r.id);
  } else {
    const h = habDeLib(it);
    s.habilidades.push(h); openCards.add(h.id);
    if (it.tipo === "trilha") {
      if (!s.header.trilha) { s.header.trilha = it.grupo; s.header.trilhaKey = trilhaKeyDe(it); }
      if (TRILHA_NEX.includes(num(it.nex)) && !s.trilhaHab[num(it.nex)]) s.trilhaHab[num(it.nex)] = `${it.nome}: ${it.desc}`;
      if (s.header.trilhaKey === trilhaKeyDe(it)) h.trilhaRef = `${trilhaKeyDe(it)}|${it.nome}`;
    }
    if (it.tipo === "origem" && !s.header.origem) s.header.origem = it.nome;
  }
  touch(); render();
}
/* ---------- Trilhas pela biblioteca (v3.9) ---------- */
const normTxt = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function livroDe(it) { const lib = libLoad(); const k = Object.keys(lib?.livros || {}).find((l) => String(it.fonte || "").startsWith(l + " ")); return k ? { k, nome: lib.livros[k] } : { k: "", nome: "" }; }
const trilhaKeyDe = (it) => `${it.grupo}|${livroDe(it).k}`;
function habDeLib(it) {
  const h = newItem(SCHEMAS.habilidades);
  const titulo = it.tipo === "origem" ? `${it.nome} — ${it.poder || "poder de origem"}` : it.nome;
  const pre = [it.tipo === "trilha" ? `Trilha ${it.grupo}, NEX ${it.nex}%` : it.grupo, it.prereq ? `Pré-requisito: ${it.prereq}` : "", it.pericias ? `Perícias treinadas: ${it.pericias}` : ""].filter(Boolean).join(" · ");
  Object.assign(h, { nome: titulo, custo: num((String(it.desc).match(/(\d+)\s*PE\b/) || [])[1]), desc: `${pre}\n\n${it.desc}\n(${it.fonte})` });
  return h;
}
// Todas as trilhas das bibliotecas carregadas (de qualquer livro), com as habilidades em ordem de NEX
function trilhasLib(classe) {
  const lib = libLoad(); if (!lib?.itens?.length) return [];
  const m = new Map();
  for (const it of lib.itens) {
    if (it.tipo !== "trilha" || !it.grupo) continue;
    if (classe && it.classe && it.classe !== classe) continue;
    const key = trilhaKeyDe(it);
    if (!m.has(key)) m.set(key, { key, nome: it.grupo, classe: it.classe || "", livro: livroDe(it).nome || String(it.fonte || "").replace(/\s*p\.?\s*\d.*$/i, ""), habs: [] });
    m.get(key).habs.push(it);
  }
  const arr = [...m.values()];
  arr.forEach((t) => t.habs.sort((a, b) => num(a.nex) - num(b.nex)));
  return arr.sort((a, b) => a.nome.localeCompare(b.nome, "pt") || a.livro.localeCompare(b.livro, "pt"));
}
function trilhaAtual(s) {
  if (!s?.header?.trilha) return null;
  const ts = trilhasLib(null);
  return ts.find((t) => t.key === s.header.trilhaKey && t.nome === s.header.trilha)
    || ts.find((t) => normTxt(t.nome) === normTxt(s.header.trilha) && (!t.classe || t.classe === s.header.classe))
    || ts.find((t) => normTxt(t.nome) === normTxt(s.header.trilha)) || null;
}
const temHabTrilha = (s, t, it) => s.habilidades.some((h) => h.trilhaRef === `${t.key}|${it.nome}` || normTxt(h.nome) === normTxt(it.nome));
// Habilidades da trilha com NEX em (de, ate] que ainda não estão na ficha
const faltandoTrilha = (s, t, de, ate) => (t ? t.habs.filter((it) => num(it.nex) > de && num(it.nex) <= ate && !temHabTrilha(s, t, it)) : []);
function aplicarTrilha(s, t, de, ate, trocar = false) {
  let n = 0;
  for (const it of t.habs) {
    const nx = num(it.nex); if (nx <= de || nx > ate) continue;
    if (TRILHA_NEX.includes(nx) && (trocar || !s.trilhaHab[nx])) s.trilhaHab[nx] = `${it.nome}: ${it.desc}`;
    if (!temHabTrilha(s, t, it)) { const h = habDeLib(it); h.trilhaRef = `${t.key}|${it.nome}`; s.habilidades.push(h); n++; }
  }
  return n;
}
function trilhaDialog(s) {
  if (!s) return;
  if (!libLoad()?.itens?.length) {
    return dialog(`<h3>Escolher trilha</h3><p>Este navegador ainda não tem nenhuma biblioteca dos livros, então não há trilhas para escolher.</p>
      <p class="muted">${isGM() ? "Importe os arquivos de biblioteca em ⋯ → Biblioteca do livro e depois use “Enviar a biblioteca para os jogadores da sala”." : "Peça ao mestre para enviar a biblioteca pela sala (no menu ⋯ → Biblioteca do livro dele), com você conectado. Ou importe o arquivo em ⋯ → Biblioteca do livro."}</p>
      <p class="muted small">Enquanto isso, dá para digitar o nome da trilha no campo.</p><button data-close>Fechar</button>`);
  }
  const atual = trilhaAtual(s); const nex = num(s.nex);
  const w = dialog(`<h3>Escolher trilha</h3>
    <p class="muted small">As trilhas vêm das bibliotecas carregadas (${Object.values(libLoad().livros || {}).map(esc).join(", ")}). Ao escolher, entram na aba Habilidades as habilidades da trilha até o NEX atual (${nex}%), e as próximas entram quando o NEX subir.${atual ? " Trocar de trilha remove as habilidades que a trilha anterior adicionou." : ""}</p>
    <label class="check"><input type="checkbox" id="trCls" checked> Só da classe ${esc(s.header.classe)}</label>
    <div class="lb-list" id="trList"></div>
    <div class="row">${s.header.trilha ? `<button class="danger" id="trNone">Ficar sem trilha</button>` : ""}<button data-close>Fechar</button></div>`);
  w.querySelector(".box").classList.add("lb-box");
  const draw = () => {
    const ts = trilhasLib(w.querySelector("#trCls").checked ? s.header.classe : null);
    w.querySelector("#trList").innerHTML = ts.length ? ts.map((t, i) => `<details class="lb-item"><summary><b>${esc(t.nome)}</b> <span class="muted small">${esc([t.classe, t.livro].filter(Boolean).join(" · "))}</span>
        ${atual?.key === t.key ? `<span class="small">✓ atual</span>` : `<button class="primary icon" data-trpick="${i}">Escolher</button>`}</summary>
        <ul class="nexlist">${t.habs.map((it) => `<li class="${num(it.nex) <= nex ? "" : "muted"}"><b>NEX ${num(it.nex)}% — ${esc(it.nome)}</b> ${num(it.nex) <= nex ? "✓" : "🔒"}<div class="lb-desc">${esc(it.desc)}</div></li>`).join("")}</ul>
      </details>`).join("") : `<p class="muted">Nenhuma trilha ${w.querySelector("#trCls").checked ? `de ${esc(s.header.classe)} ` : ""}nas bibliotecas carregadas.</p>`;
    w._ts = ts;
  };
  const tirarAntiga = () => {
    const old = atual; if (!old) return 0;
    const antes = s.habilidades.length;
    s.habilidades = s.habilidades.filter((h) => !String(h.trilhaRef || "").startsWith(old.key + "|"));
    for (const n of TRILHA_NEX) s.trilhaHab[n] = "";
    return antes - s.habilidades.length;
  };
  w.querySelector("#trCls").addEventListener("change", draw);
  w.querySelector("#trNone")?.addEventListener("click", () => {
    const r = tirarAntiga(); s.header.trilha = ""; s.header.trilhaKey = "";
    touchSheet(s); w.remove(); render(); toast(`Ficha sem trilha${r ? ` (${r} habilidade(s) da trilha removida(s))` : ""}.`);
  });
  w.addEventListener("click", (e) => {
    const b = e.target.closest("[data-trpick]"); if (!b) return; e.preventDefault();
    const t = w._ts[Number(b.dataset.trpick)]; if (!t) return;
    const r = tirarAntiga();
    s.header.trilha = t.nome; s.header.trilhaKey = t.key;
    const n = aplicarTrilha(s, t, -1, nex, true);
    touchSheet(s); w.remove(); tab = "principal"; render();
    toast(`Trilha ${t.nome}: ${n ? `${n} habilidade(s) até NEX ${nex}% adicionada(s) na aba Habilidades` : `nenhuma habilidade até NEX ${nex}% ainda`}${r ? `; ${r} da trilha anterior removida(s)` : ""}.`);
  });
  draw();
}
function libMenuDialog() {
  const lib = libLoad();
  const w = dialog(`<h3>Biblioteca do livro</h3>
    ${lib?.itens?.length ? `<p>${lib.itens.length} entradas carregadas: ${Object.values(lib.livros || {}).map(esc).join(", ")}.</p>` : `<p class="muted">Nenhuma biblioteca carregada neste navegador.</p>`}
    <p class="muted small">A biblioteca fica só no seu navegador. Ela tem texto dos livros: não envie o arquivo para o GitHub (o repositório é público).</p>
    <button id="lbImp">Importar arquivo de biblioteca (.json)</button>
    ${isGM() && lib?.itens?.length && obrOk ? `<button id="lbSend">Enviar a biblioteca para os jogadores da sala</button>` : ""}
    ${lib?.itens?.length ? `<button id="lbDel" class="danger">Apagar biblioteca deste navegador</button>` : ""}
    <button data-close>Fechar</button>`);
  w.querySelector("#lbImp").addEventListener("click", () => {
    const pick = document.getElementById("jsonPick");
    pick.onchange = async () => {
      const f = pick.files[0]; pick.value = ""; if (!f) return;
      try { const o = JSON.parse(await f.text()); if (o.formato !== "biblioteca-ficha-op") throw 0; const r = libMerge(o); if (r) { toast(`Biblioteca carregada: ${r.itens.length} entradas.`); w.remove(); } }
      catch { toast("Esse arquivo não é uma biblioteca da ficha."); }
    };
    pick.click();
  });
  w.querySelector("#lbSend")?.addEventListener("click", async () => { w.remove(); toast("Enviando a biblioteca… (pode levar alguns segundos)"); await send({ t: "lib", lib: libLoad() }); toast("Biblioteca enviada aos jogadores conectados."); });
  w.querySelector("#lbDel")?.addEventListener("click", () => { try { localStorage.removeItem(LIB_KEY); } catch { /* */ } libCache = null; w.remove(); toast("Biblioteca apagada."); });
}

/* ---------- Render ---------- */
const app = document.getElementById("app");

function render() {
  renderPending = false;
  if (QUICK_ID) return renderQuick();
  const vis = allVisible();
  if (!cur() && vis.length) store.currentId = vis[0].s.id;
  const s = cur();
  if (!tabsFor().some(([k]) => k === tab) && !(tab === "ult" && s)) tab = "principal";
  document.body.classList.toggle("ult-on", !!(s && ultOn(s)));
  const scroll = window.scrollY;
  document.body.dataset.tema = temaEf(s);
  document.body.classList.toggle("sem-fundo", !fundoOn);

  const opts = (list) => list.map(({ s: x }) => `<option value="${x.id}" ${x.id === store.currentId ? "selected" : ""}>${esc(x.header.personagem || "(sem nome)")}${isGM() && x.owner?.name ? " — " + esc(x.owner.name) : ""}</option>`).join("");
  const own = vis.filter((v) => v.own), others = vis.filter((v) => !v.own);
  const selector = vis.length
    ? `<select id="sheetSel">${isGM() ? `<optgroup label="Minhas fichas">${opts(own)}</optgroup><optgroup label="Fichas dos jogadores">${opts(others)}</optgroup>` : opts(own)}</select>`
    : `<span class="muted" style="flex:1">Nenhuma ficha</span>`;
  const backupDot = Object.values(store.own).some(needsBackup);

  const top = `<div class="topbar">
    <span class="role ${isGM() ? "gm" : ""}">${isGM() ? "Mestre" : "Jogador"}</span>
    ${selector}
    ${isGM() ? `<button class="icon ${hiddenRolls ? "on" : ""}" id="btnHidden" title="Rolagens ocultas (só você vê)">${hiddenRolls ? "🙈" : "👁"}</button>`
      : obrOk ? `<button class="icon ${secretRoll ? "on" : ""}" id="btnSecret" title="${secretRoll ? "Rolagem secreta ligada: só o mestre vê" : "Rolar em segredo (só o mestre vê)"}">${secretRoll ? "🙈" : "👁"}</button>` : ""}
    ${s ? `<button class="icon ult-btn ${ultOn(s) ? "on" : s.ult?.habilitada ? "ready" : ""}" data-tab="ult" title="${ultOn(s) ? `Forma suprema ativa (rodada ${num(s.ult.rodada)})` : "Versão ultimate da ficha (forma suprema)"}">ULT</button>` : ""}
    ${s ? `<button class="icon" id="btnUndo" title="Desfazer a última alteração" ${(undoStack[s.id] || []).length ? "" : "disabled"}>↶</button>` : ""}
    <button class="icon" id="btnNew" title="Nova ficha">＋</button>
    <button class="icon ${backupDot ? "dot" : ""}" id="btnMenu" title="${backupDot ? "Há fichas sem backup recente" : "Mais opções"}">⋯</button>
    ${obrOk ? `<button class="icon" id="btnModal" title="${IS_MODAL ? "Fechar" : "Abrir em tela grande"}">${IS_MODAL ? "✕" : "⤢"}</button>` : ""}
  </div>`;

  if (!s && tab !== "mesa" && tab !== "rolagens" && tab !== "pratos" && tab !== "dados") {
    app.innerHTML = top + reqsBanner() + `<div class="empty-state"><h2>Ordem Paranormal</h2><p>Crie a ficha do seu agente para começar.</p>
      <button class="primary" id="btnNew2">Criar ficha</button><button data-tab="dados">🎲 Só rolar dados</button>${isGM() ? `<p class="muted">Como mestre, as fichas dos jogadores aparecem aqui assim que eles as criarem ou abrirem a extensão.</p><button id="btnGoMesa">Abrir painel da mesa</button>` : ""}</div>`;
    return;
  }
  const reqs = reqsBanner();
  const ownerNote = s && !isOwnCurrent() ? `<p class="owner-note">Ficha de <b>${esc(s.owner?.name || "jogador")}</b> — suas alterações são enviadas a ele.</p>` : "";
  app.innerHTML = top + reqs + ownerNote +
    `<nav class="tabs">${tabsFor().map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}</nav>
     <main>${tabContent(s)}</main>`;
  commitBase(s); refreshDerived(); applyFilters();
  if (s && !isDet(s)) translateDom(app);
  if (tab === "principal") refreshLinkCount();
  window.scrollTo(0, scroll);
}
// Re-render sem atrapalhar quem está digitando
function softRender() {
  const a = document.activeElement;
  if (a && app.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { renderPending = true; return; }
  render();
}
app.addEventListener("focusout", () => { if (renderPending) setTimeout(() => { if (renderPending) softRender(); }, 50); });

/* ---------- Eventos ---------- */
const NUM_SELECT = /^(nex|pericias\..*\.treino|.*\.categoria|.*\.circulo)$/;
app.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "nmD" || el.id === "nmB") { nextMod[el.id === "nmD" ? "dados" : "bonus"] = num(el.value); return; }
  if (el.id === "dpMod") { dp.mod = num(el.value); updDpBtn(); return; }
  if (el.id === "dpModo") { dp.modo = el.value; return; }
  if (el.id === "dpExpr") { dp.expr = el.value; updDpBtn(); return; }
  if (el.id === "dpMotivo") { dp.motivo = el.value; return; }
  if (el.id === "dpFixo") { diceCfg.fixo = el.checked; lsSet(NS + ":dice", JSON.stringify(diceCfg)); if (diceCfg.fixo) clearTimeout(trayTimer); else hideTraySoon(); render(); return; }
  if (el.dataset.filter) {
    const [scope, k] = el.dataset.filter.split("|"); (filters[scope] ||= {})[k] = el.value; applyFilters(); return;
  }
  const p = el.dataset.path; const s = cur();
  if (el.id === "sheetSel" || !p || !s) return;
  let v = el.value;
  if (el.type === "checkbox") v = el.checked;
  else if (el.dataset.type === "num" || (el.tagName === "SELECT" && NUM_SELECT.test(p))) {
    v = el.value === "" ? 0 : Number(el.value);
    if (el.dataset.min != null) v = clamp(v, Number(el.dataset.min), Number(el.dataset.max));
  }
  const nexAntes = p === "nex" ? num(s.nex) : null;
  if (p === "ult.habilitada" && !v && s.ult.ativo) ultDesativar(s, true);
  setPath(s, p, v);
  if (p === "nex" && num(v) > nexAntes) setTimeout(() => nexDialog(s, nexAntes, num(v)), 50);
  if (p === "equip.patente" && PATENTE_TAB[v]) { s.equip.credito = PATENTE_TAB[v].credito; s.equip.limites = [...PATENTE_TAB[v].lim]; toast(`${v}: crédito ${PATENTE_TAB[v].credito} e limites de itens aplicados (Tabela 3.1).`); }
  if (p === "pv.atual" && num(v) > 0) s.morrendo = 0;
  if ((p === "pd.atual" || p === "san.atual") && num(mentalBar(s).atual) > 0) s.enlouquecendo = 0;
  if (p === "regra") lsSet(NS + ":regra", v);
  touch(); refreshDerived();
});
app.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "sheetSel") { store.currentId = el.value; persist(); render(); return; }
  if (el.id === "cfgRitual") { salvarCfg({ ritual: el.checked }); return; }
  if (el.id === "cfgCrit") { salvarCfg({ crit: el.checked }); return; }
  if (el.dataset.min != null) el.value = clamp(num(el.value), Number(el.dataset.min), Number(el.dataset.max));
  if (el.dataset.rerender) {
    // Campo de texto: o "change" dispara quando o campo perde o foco, muitas vezes porque a pessoa clicou num botão.
    // Redesenhar na hora troca o botão e o clique se perde; por isso o redesenho espera o clique terminar.
    if (el.tagName === "INPUT" && el.type === "text") setTimeout(render, 250); else render();
  }
});
app.addEventListener("toggle", (e) => {
  const d = e.target; if (!d.matches?.("details.item")) return;
  d.open ? openCards.add(d.dataset.id) : openCards.delete(d.dataset.id);
}, true);

/* Arrastar para reordenar */
let drag = null;
app.addEventListener("dragstart", (e) => {
  const h = e.target.closest?.("[data-drag]"); if (!h) return;
  const [key, i] = h.dataset.drag.split("|"); drag = { key, i: Number(i) };
  e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", h.dataset.drag);
  h.closest("details").classList.add("dragging");
});
app.addEventListener("dragover", (e) => {
  if (!drag) return; const d = e.target.closest?.("details.item"); const list = d?.closest(".list");
  if (!d || list?.dataset.list !== drag.key) return;
  e.preventDefault();
  document.querySelectorAll(".drop-before,.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
  const r = d.getBoundingClientRect(); d.classList.add(e.clientY < r.top + r.height / 2 ? "drop-before" : "drop-after");
});
app.addEventListener("drop", (e) => {
  if (!drag) return; const d = e.target.closest?.("details.item"); const s = cur();
  if (!d || !s || d.closest(".list")?.dataset.list !== drag.key) return;
  e.preventDefault();
  const arr = getPath(s, LIST_PATHS[drag.key]); let to = Number(d.dataset.idx);
  if (d.classList.contains("drop-after")) to++;
  const [it] = arr.splice(drag.i, 1); if (to > drag.i) to--; arr.splice(to, 0, it);
  drag = null; touch(); render();
});
app.addEventListener("dragend", () => { drag = null; document.querySelectorAll(".dragging,.drop-before,.drop-after").forEach((x) => x.classList.remove("dragging", "drop-before", "drop-after")); });

app.addEventListener("click", async (e) => {
  if (e.target.closest("[data-drag]")) { e.preventDefault(); return; }
  const b = e.target.closest("button"); if (!b) return;
  const s = cur(); const d = b.dataset;
  if (b.closest("summary") && !d.tab) e.preventDefault(); // botões no resumo não abrem/fecham o card

  if (b.id === "btnNew" || b.id === "btnNew2") {
    criarFichaPermitida(() => escolherRegra((regra) => { const n = newSheet(); n.regra = regra; aplicarSugInicial(n); store.own[n.id] = n; store.currentId = n.id; tab = "principal"; persist(); scheduleSync(n); render(); }));
    return;
  }
  if (d.reqok) return respReq(d.reqok, true);
  if (d.reqno) return respReq(d.reqno, false);
  if (b.id === "btnMenu") return menuDialog();
  if (d.lib) return libDialog(d.lib);
  if (d.trilha) return trilhaDialog(s);
  if (d.trilhaok && s) { const t = trilhaAtual(s); if (t) { const n = aplicarTrilha(s, t, -1, num(s.nex)); s.header.trilhaKey = t.key; touch(); render(); toast(`${n} habilidade(s) da trilha adicionada(s) na aba Habilidades.`); } return; }
  if (b.id === "btnSecret") { secretRoll = !secretRoll; toast(secretRoll ? "Rolagem secreta: só o mestre verá os resultados." : "Rolagens visíveis para todos de novo."); render(); return; }
  if (b.id === "btnFeedClear") { lsSet(feedKey(), "{}"); render(); return; }
  if (b.id === "btnHidden") { hiddenRolls = !hiddenRolls; toast(hiddenRolls ? "Rolagens ocultas: só você vê os resultados." : "Rolagens visíveis para todos."); render(); return; }
  if (b.id === "btnGoMesa") { tab = "mesa"; render(); return; }
  if (b.id === "btnModal") {
    if (IS_MODAL) OBR.modal.close(MODAL_ID);
    else OBR.modal.open({ id: MODAL_ID, url: new URL("index.html?modal=1", location.href).href, width: 900, height: 1000 });
    return;
  }
  if (d.tab) { tab = d.tab; render(); window.scrollTo(0, 0); return; }
  if (d.open) { store.currentId = d.open; tab = "principal"; persist(); render(); window.scrollTo(0, 0); return; }
  if (b.id === "btnClearLog") { rollLog = []; lsSet(storeKey + ":log", "[]"); render(); return; }
  // Aba Dados
  if (d.dpadd) { const f = num(d.dpadd); dp.pool[f] = Math.min(50, (dp.pool[f] || 0) + 1); dp.expr = ""; render(); return; }
  if (d.dpsub) { const f = num(d.dpsub); dp.pool[f] = Math.max(0, (dp.pool[f] || 0) - 1); render(); return; }
  if (b.id === "btnDpClear") { dp.pool = {}; dp.mod = 0; render(); return; }
  if (b.id === "btnDpRoll") { rollDados(dp.expr.trim() || dpPoolExpr(), dp.modo, dp.motivo.trim()); return; }
  if (b.id === "btnDpFav") {
    const expr = (dp.expr.trim() || dpPoolExpr()).replace(/\s+/g, "");
    if (!/\d*d\d+/i.test(expr)) { toast("Monte uma rolagem antes de guardar."); return; }
    const favs = dpFavs(); favs.push({ nome: dp.motivo.trim(), expr, modo: dp.modo }); lsSet(dpFavKey(), JSON.stringify(favs.slice(-20)));
    toast("Rolagem guardada."); render(); return;
  }
  if (d.dpfav !== undefined) { const f = dpFavs()[num(d.dpfav)]; if (f) rollDados(f.expr, f.modo, f.nome); return; }
  if (d.dpfavdel !== undefined) { const favs = dpFavs(); favs.splice(num(d.dpfavdel), 1); lsSet(dpFavKey(), JSON.stringify(favs)); render(); return; }
  if (b.id === "btnDpLook") return diceDialog();

  // Painel da mesa
  if (b.id === "btnAskSheets") { send({ t: "request" }); toast("Pedido enviado."); return; }
  if (b.id === "btnRoundAll") { rodadaTodos(); return; }
  if (b.id === "btnCenaAll") {
    const out = []; for (const { s: x } of allVisible()) { const fim = fimDeCena(x); touchSheet(x); if (fim.length) out.push(`${x.header.personagem}: ${fim.join(", ")}`); }
    render(); announce(`🎬 Fim de cena.${out.length ? " Terminou — " + out.join("; ") : ""}`); return;
  }
  if (b.id === "btnIni") return rollIniciativa();
  if (b.id === "btnIniNext") {
    if (ini.list.length) { ini.turn = (ini.turn + 1) % ini.list.length; saveIni(); if (ini.turn === 0) rodadaTodos(); announce(`Vez de ${ini.list[ini.turn].nome}`); render(); syncIniTokens(); }
    return;
  }
  if (b.id === "btnIniClear") { ini = { list: [], turn: 0 }; saveIni(); render(); syncIniTokens(); return; }
  if (b.id === "btnIniTokens") { syncIniTokens(); toast("Ordem atualizada nos tokens vinculados."); return; }
  if (b.id === "btnNpc") {
    const n = document.getElementById("npcName").value.trim(); const v = num(document.getElementById("npcVal").value);
    if (!n) return; ini.list.push({ nome: n, total: v, pick: 0 }); sortIni(); saveIni(); render(); return;
  }
  if (d.inidel) { ini.list.splice(Number(d.inidel), 1); ini.turn = Math.min(ini.turn, Math.max(0, ini.list.length - 1)); saveIni(); render(); syncIniTokens(); return; }
  if (b.id === "btnGrp") return rollGroup(document.getElementById("grpPer").value, document.getElementById("grpHidden").checked);

  if (!s) return;
  if (b.id === "btnLink") return linkSelected(s);
  if (b.id === "btnUnlink") return unlinkAll(s);
  if (b.id === "btnUndo") return undo();
  if (b.id === "btnDmg") return sofrerDano(s, document.getElementById("dmgVal").value, document.getElementById("dmgTipo").value, !!document.getElementById("dmgRival")?.checked);
  if (b.id === "btnHealPV") return curar(s, document.getElementById("dmgVal").value, "pv");
  if (b.id === "btnHealPD") return curar(s, document.getElementById("dmgVal").value, "pd");
  if (b.id === "btnHealSAN") return curar(s, document.getElementById("dmgVal").value, "san");
  if (b.id === "btnAddRd") { (s.rdTipos ||= []).push({ tipo: TIPOS_DANO[0], valor: 5 }); touch(); render(); return; }
  if (b.id === "btnUltOn") return ultAtivar(s, b);
  if (b.id === "btnUltOff") return ultDesativar(s, false, b);
  if (b.id === "btnDesejo") {
    s.pvTemp = num(s.pvTemp) + 15; if (num(s.pv.atual) <= 0) s.pv.atual = 1; s.morrendo = 0;
    touch(); render(); announce(`${s.header.personagem} encara o limiar e retorna (Desejo): +15 PV temporários.`); return;
  }
  if (b.id === "nmClear") { takeNextMod(); return; }
  if (b.id === "btnDormir") {
    const pv = num(document.getElementById("slPV").value); const a = num(s.pv.atual);
    s.pv.atual = Math.min(num(s.pv.max), a + pv); s.pdRodada = 0; if (s.pv.atual > 0) s.morrendo = 0;
    let extra = "";
    if (!isDet(s)) { const pe = num(document.getElementById("slPE")?.value); const c = num(s.pd.atual); s.pd.atual = Math.min(num(s.pd.max), c + pe); extra = `, +${s.pd.atual - c} PE`; }
    const fim = tickEfeitos(s, "interludio");
    touch(); render(); announce(`${s.header.personagem} dormiu (${s.descanso}): +${s.pv.atual - a} PV${extra}.${fim.length ? ` Efeitos encerrados: ${fim.join(", ")}.` : ""}`); return;
  }
  if (b.id === "btnRelaxar") {
    const fim = tickEfeitos(s, "interludio");
    if (!isDet(s)) {
      const v = num(document.getElementById("slSAN").value); const c = num(s.san.atual);
      s.san.atual = Math.min(num(s.san.max), c + v); if (s.san.atual > 0) s.enlouquecendo = 0;
      touch(); render(); announce(`${s.header.personagem} relaxou: +${s.san.atual - c} SAN.${fim.length ? ` Efeitos encerrados: ${fim.join(", ")}.` : ""}`); return;
    }
    const pd = num(document.getElementById("slPD").value); const c = num(s.pd.atual);
    s.pd.atual = Math.min(num(s.pd.max), c + pd); if (s.pd.atual > 0) s.enlouquecendo = 0;
    touch(); render(); announce(`${s.header.personagem} relaxou: +${s.pd.atual - c} PD.${fim.length ? ` Efeitos encerrados: ${fim.join(", ")}.` : ""}`); return;
  }
  if (b.id === "btnPrato") { s.pdTemp = num(s.pdTemp) + 2; touch(); render(); announce(`${s.header.personagem} comeu o prato favorito: +2 PD temporários.`); return; }
  if (d.inter) {
    const a = INTER_ACOES.find((x) => x.k === d.inter);
    (s.buffs ||= []).push({ nome: a.nome, expr: document.getElementById(`ia-${a.k}-x`).value.trim(), desc: document.getElementById(`ia-${a.k}-d`).value.trim() });
    touch(); render(); announce(`${s.header.personagem} usou o interlúdio para: ${a.nome}.`); return;
  }
  if (d.usebuff) {
    const bf = s.buffs[Number(d.usebuff)]; if (!bf) return;
    if (bf.expr) { const r = rollExpr(bf.expr); nextMod.bonus = num(nextMod.bonus) + r.total; toast(`${bf.nome}: +${r.total} somado à próxima rolagem.`); }
    s.buffs.splice(Number(d.usebuff), 1); touch(); render(); return;
  }
  if (b.id === "btnRound") { const fim = novaRodada(s); touch(); render(); toast(`Nova rodada.${fim.length ? ` Terminou: ${fim.join(", ")}.` : ""}`); return; }
  if (b.id === "btnApplySug") {
    const g = sugerido(s); s.pv.max = g.pv; s.pd.max = g.pd; s.pv.atual = Math.min(num(s.pv.atual), g.pv); s.pd.atual = Math.min(num(s.pd.atual), g.pd);
    if (!isDet(s)) { s.san.max = g.san; s.san.atual = Math.min(num(s.san.atual), g.san); }
    touch(); render(); toast(`Máximos aplicados: PV ${g.pv}, ${resSig(s)} ${g.pd}${isDet(s) ? "" : `, SAN ${g.san}`}.`); return;
  }
  if (d.cond) {
    const i = s.condicoes.indexOf(d.cond); i >= 0 ? s.condicoes.splice(i, 1) : s.condicoes.push(d.cond);
    touch(); render(); return;
  }
  if (d.rapido) {
    const [k, id] = d.rapido.split("|"); s.rapido ||= [];
    const i = s.rapido.findIndex((r) => r.k === k && r.id === id);
    if (i >= 0) s.rapido.splice(i, 1);
    else { if (s.rapido.length >= RAPIDO_MAX) return toast(`O acesso rápido já tem ${RAPIDO_MAX} itens. Tire um (⚡) antes de pôr outro.`); s.rapido.push({ k, id }); }
    e.preventDefault(); touch(); render(); return;
  }
  if (d.dying) { const [k, op] = d.dying.split("|"); return dyingAction(s, k, op); }
  if (b.id === "efAdd") {
    const nome = document.getElementById("efNome").value.trim(); const cond = document.getElementById("efCond").value;
    if (!nome && !cond) return toast("Dê um nome ao efeito ou escolha uma condição.");
    const dur = document.getElementById("efDur").value;
    (s.efeitos ||= []).push({ id: uid(), nome: nome || cond, dur, rest: Math.max(1, num(document.getElementById("efRod").value) || 1), cond, desc: document.getElementById("efDesc").value.trim() });
    touch(); render(); return;
  }
  if (d.efdel) { s.efeitos.splice(Number(d.efdel), 1); touch(); render(); return; }
  if (d.efstep) { const [i, dv] = d.efstep.split("|").map(Number); const e = s.efeitos[i]; if (!e) return; e.rest = num(e.rest) + dv; if (e.rest <= 0) { s.efeitos.splice(i, 1); toast(`${e.nome} terminou.`); } touch(); render(); return; }
  if (b.id === "btnRound2") { const fim = novaRodada(s); touch(); render(); toast(`Nova rodada.${fim.length ? ` Terminou: ${fim.join(", ")}.` : ""}`); return; }
  if (b.id === "btnCena") { const fim = fimDeCena(s); touch(); render(); announce(`🎬 Fim de cena para ${s.header.personagem}.${fim.length ? ` Terminou: ${fim.join(", ")}.` : ""}`); return; }
  if (d.add) {
    const it = newItem(SCHEMAS[d.add]); getPath(s, LIST_PATHS[d.add]).push(it); openCards.add(it.id);
    touch(); render(); return;
  }
  if (d.addstr) { getPath(s, d.addstr).push(""); touch(); render(); return; }
  if (d.adddmg) { getPath(s, d.adddmg).push({ dano: "", tipo: TIPOS_DANO[0] }); touch(); render(); return; }
  if (d.del) {
    e.stopPropagation();
    if (!b.classList.contains("confirm")) { // segundo clique confirma
      b.classList.add("confirm"); b.textContent = "Remover?";
      setTimeout(() => { if (b.isConnected) { b.classList.remove("confirm"); b.textContent = "✕"; } }, 2500);
      return;
    }
    delPath(s, d.del); touch(); render(); return;
  }
  if (d.step) {
    const v = num(getPath(s, d.step)) + Number(d.delta);
    setPath(s, d.step, v);
    if (num(s.pv.atual) > 0) s.morrendo = 0;
    if (num(mentalBar(s).atual) > 0) s.enlouquecendo = 0;
    touch(); render(); return;
  }
  if (d.ammo) {
    const [p, op] = d.ammo.split("|"); const m = getPath(s, p);
    m.atual = op === "max" ? num(m.max) : Math.max(0, num(m.atual) - 1);
    if (op !== "max" && num(m.atual) === 0) toast(`${m.nome || "Munição"} acabou!`);
    touch(); refreshDerived(); return;
  }
  if (d.imgup) { pendingImgPath = d.imgup; document.getElementById("filePick").click(); return; }
  if (d.imgdel) { setPath(s, d.imgdel, ""); touch(); render(); return; }
  if (d.rollper) return rollPericia(s, d.rollper);
  if (d.rollattr) return rollAttr(s, d.rollattr);
  if (d.atk) return rollAttack(s, attackFromAtaque(getPath(s, d.atk)));
  if (d.arma) { const [p, w] = d.arma.split("|"); return rollAttack(s, attackFromArma(getPath(s, p), Number(w))); }
  if (d.cast) { const [p, v] = d.cast.split("|"); return castRitual(s, p, v, b); }
  if (d.usehab) return useHab(s, d.usehab, b);
  if (d.hablog) { const h = getPath(s, d.hablog); if (h) announce(`${s.header.personagem} usou ${h.nome}.${h.desc ? "\n" + resumo(h.desc, 200) : ""}`); return; }
});

/* ---------- Iniciativa e testes em grupo (mestre) ---------- */
function saveIni() { lsSet(storeKey + ":ini", JSON.stringify(ini)); }
function sortIni() { ini.list.sort((a, b) => b.total - a.total || b.pick - a.pick); ini.turn = 0; }
function rollIniciativa() {
  const npcs = ini.list.filter((e) => !e.sheetId);
  const pcs = allVisible().map(({ s }) => { const t = testLine(s, "Iniciativa", false, 0, { noMod: true, noAnim: true }); return { sheetId: s.id, nome: s.header.personagem, total: t.total, pick: t.pick, txt: t.txt }; });
  if (!pcs.length) return toast("Nenhuma ficha para rolar.");
  ini.list = [...pcs, ...npcs]; sortIni(); saveIni();
  announce("Iniciativa:\n" + ini.list.map((e, i) => `${i + 1}. ${e.nome} — ${e.total}`).join("\n"));
  render(); syncIniTokens();
}
function rollGroup(pericia, hidden) {
  const res = allVisible().map(({ s }) => { const t = testLine(s, pericia, false, 0, { noMod: true, noAnim: true }); return `${s.header.personagem}: ${t.total}  ${t.txt}`; });
  if (!res.length) return toast("Nenhuma ficha para rolar.");
  announce(`Teste de ${pericia} (grupo):\n` + res.join("\n"), hidden);
  if (tab !== "rolagens") toast("Resultado salvo na aba Rolagens.");
}

/* ---------- Imagens (reduzidas para caber no envio) ---------- */
document.getElementById("filePick").addEventListener("change", async (e) => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file || !pendingImgPath || !cur()) return;
  try {
    const url = await shrinkImage(file, 280, 0.72);
    setPath(cur(), pendingImgPath, url); touch(); render();
  } catch { toast("Não consegui abrir essa imagem."); }
});
function shrinkImage(file, max, q) {
  return new Promise((res, rej) => {
    const img = new Image(); const r = new FileReader();
    r.onload = () => { img.src = r.result; };
    r.onerror = rej;
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext("2d"); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", q));
    };
    img.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ---------- Menu: exportar / importar / apagar ---------- */
function dialog(html) {
  const wrap = document.createElement("div"); wrap.className = "dialog";
  wrap.innerHTML = `<div class="box">${html}</div>`;
  if (cur() && !isDet(cur())) translateDom(wrap);
  wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.dataset.close != null) wrap.remove(); });
  document.body.appendChild(wrap); return wrap;
}
function menuDialog() {
  const s = cur();
  const pend = Object.values(store.own).filter(needsBackup);
  const w = dialog(`<h3>Opções</h3>
    ${pend.length ? `<p class="warn">⚠ Sem backup recente: ${pend.map((x) => esc(x.header.personagem)).join(", ")}. Exporte para não perder nada.</p>` : ""}
    ${s ? `<button id="mExport">Exportar esta ficha (backup)</button>` : ""}
    <button id="mImport">Importar ficha ou backup (.json)</button>
    <button id="mCris">Importar da CRIS (link da ficha)</button>
    ${s?.cris ? `<button id="mCrisUp">Atualizar PV e recursos pela CRIS</button>` : ""}
    ${s ? `<button id="mPrint">Baixar versão para imprimir / PDF</button>` : ""}
    ${obrOk ? `<div class="sep">Backup na cena do Owlbear</div>
      ${isGM() ? `<button id="mSceneSave">Salvar backup de todas as fichas nesta cena</button>` : ""}
      <button id="mSceneLoad">${isGM() ? "Restaurar backup da cena" : "Restaurar minhas fichas do backup da cena"}</button>` : ""}
    ${isGM() ? `<button id="mFull">Baixar backup completo (todas as fichas, com imagens)</button>` : ""}
    <button id="mLib">📚 Biblioteca do livro</button>
    <button id="mDice">🎲 Aparência dos dados e do prato</button>
    <label class="check"><input type="checkbox" id="mSom" ${somOn ? "checked" : ""}> Som dos dados e dos efeitos</label>
    <label class="check"><input type="checkbox" id="mAnim" ${animOn ? "checked" : ""}> Animações de crítico e ritual na minha ficha</label>
    ${obrOk ? `<label class="check"><input type="checkbox" id="mFxOutros" ${lsGet(NS + ":fxOutros") !== "0" ? "checked" : ""}> Ver na minha tela os críticos dos outros</label>` : ""}
    <label class="check"><input type="checkbox" id="mFundo" ${fundoOn ? "checked" : ""}> Fundo animado do elemento (tema da ficha)</label>
    ${isGM() ? `<button id="mSync">Pedir fichas aos jogadores conectados</button>` : ""}
    ${s ? `<button id="mDup">Duplicar esta ficha</button><button id="mDel" class="danger">Apagar esta ficha</button>` : ""}
    <button data-close>Fechar</button>`);
  w.querySelector("#mExport")?.addEventListener("click", () => { w.remove(); exportDialog(s); });
  w.querySelector("#mImport").addEventListener("click", () => { w.remove(); importDialog(); });
  w.querySelector("#mCris").addEventListener("click", () => { w.remove(); crisDialog(); });
  w.querySelector("#mCrisUp")?.addEventListener("click", () => { w.remove(); crisAtualizar(s); });
  w.querySelector("#mPrint")?.addEventListener("click", () => { w.remove(); downloadFile(`${(s.header.personagem || "ficha").replace(/[^\w\-]+/g, "_")}-imprimir.html`, printHTML(s), "text/html"); toast("Abra o arquivo baixado e use “Imprimir / salvar em PDF”."); });
  w.querySelector("#mSceneSave")?.addEventListener("click", () => { w.remove(); backupToScene(); });
  w.querySelector("#mSceneLoad")?.addEventListener("click", () => { w.remove(); restoreFromScene(); });
  w.querySelector("#mFull")?.addEventListener("click", () => { downloadFullBackup(); w.remove(); });
  w.querySelector("#mDice").addEventListener("click", () => { w.remove(); diceDialog(); });
  w.querySelector("#mLib").addEventListener("click", () => { w.remove(); libMenuDialog(); });
  w.querySelector("#mSom").addEventListener("change", (e) => { somOn = e.target.checked; lsSet(NS + ":som", somOn ? "1" : "0"); });
  w.querySelector("#mAnim").addEventListener("change", (e) => { animOn = e.target.checked; lsSet(NS + ":anim", animOn ? "1" : "0"); });
  w.querySelector("#mFxOutros")?.addEventListener("change", (e) => lsSet(NS + ":fxOutros", e.target.checked ? "1" : "0"));
  w.querySelector("#mFundo").addEventListener("change", (e) => { fundoOn = e.target.checked; lsSet(NS + ":fundo", fundoOn ? "1" : "0"); document.body.classList.toggle("sem-fundo", !fundoOn); });
  w.querySelector("#mSync")?.addEventListener("click", () => { send({ t: "request" }); toast("Pedido enviado."); w.remove(); });
  w.querySelector("#mDup")?.addEventListener("click", () => {
    w.remove(); if (precisaPedir() && !consumeAllow()) return pedirFicha();
    const c = upgrade(JSON.parse(JSON.stringify(s))); c.id = uid(); c.owner = { id: me.id, name: me.name }; c.lastExport = 0;
    c.header.personagem += " (cópia)"; store.own[c.id] = c; store.currentId = c.id; persist(); scheduleSync(c); w.remove(); render();
  });
  const del = w.querySelector("#mDel");
  del?.addEventListener("click", () => {
    if (!del.classList.contains("confirm")) { del.classList.add("confirm"); del.textContent = `Confirmar: apagar "${s.header.personagem}"?`; return; }
    delete store.own[s.id]; delete store.others[s.id]; store.currentId = null;
    persist(); send({ t: "delete", id: s.id }); w.remove(); render();
  });
}
function markExported(s) { if (store.own[s.id]) { s.lastExport = Date.now(); persist(); render(); } }
function exportDialog(s) {
  const json = JSON.stringify(s);
  const w = dialog(`<h3>Exportar ficha</h3><p class="muted">Guarde este texto (ou o arquivo) como backup. Para restaurar, use “Importar”.</p>
    <textarea readonly>${esc(json)}</textarea><div class="row"><button id="eDown" class="primary">Baixar arquivo</button><button id="eCopy">Copiar</button><button data-close>Fechar</button></div>`);
  w.querySelector("#eDown").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = (s.header.personagem || "ficha").replace(/[^\w\-]+/g, "_") + ".json"; a.click();
    markExported(s);
  });
  w.querySelector("#eCopy").addEventListener("click", async () => {
    const t = w.querySelector("textarea"); t.select();
    try { await navigator.clipboard.writeText(json); toast("Copiado!"); } catch { document.execCommand("copy"); }
    markExported(s);
  });
}
function importDialog() {
  const w = dialog(`<h3>Importar ficha</h3><p class="muted">Cole o texto exportado ou escolha um arquivo .json.</p>
    <textarea id="iText" placeholder="{ … }"></textarea>
    <div class="row"><button id="iFile">Escolher arquivo</button><button id="iGo" class="primary">Importar</button><button data-close>Cancelar</button></div>`);
  const go = (txt) => {
    try {
      const obj = JSON.parse(txt);
      if (obj.tipo === "backup-ficha-op") { const n = restoreSheets(obj.sheets || []); w.remove(); toast(`${n} ficha(s) restaurada(s) do backup.`); return; }
      if (precisaPedir() && !consumeAllow()) { w.remove(); return pedirFicha(); }
      const s = upgrade(obj); s.id = uid(); s.owner = { id: me.id, name: me.name }; s.updatedAt = Date.now(); s.lastExport = Date.now();
      store.own[s.id] = s; store.currentId = s.id; persist(); scheduleSync(s); w.remove(); render(); toast("Ficha importada.");
    } catch { toast("Esse texto não é uma ficha válida."); }
  };
  w.querySelector("#iGo").addEventListener("click", () => go(w.querySelector("#iText").value));
  const pick = document.getElementById("jsonPick");
  w.querySelector("#iFile").addEventListener("click", () => {
    pick.onchange = async () => { const f = pick.files[0]; pick.value = ""; if (f) go(await f.text()); };
    pick.click();
  });
}
/* ---------- Importar da CRIS (crisordemparanormal.com) ---------- */
const CRIS_CTX = { newSheet, newItem, SCHEMAS, PERICIAS, CLASSES, TIPOS_DANO, ALCANCES, ELEMENTOS, EXECUCOES, ALC_RITUAL };
function crisDialog() {
  const w = dialog(`<h3>Importar da CRIS</h3>
    <p class="muted">Cole o link da ficha no site da CRIS (crisordemparanormal.com/agente/…). A ficha vira uma cópia aqui: o que você mudar depois não volta para a CRIS.</p>
    <input id="crisLink" placeholder="https://crisordemparanormal.com/agente/..." autocomplete="off">
    <p class="muted small" id="crisMsg"></p>
    <div class="row"><button id="crisGo" class="primary">Importar</button><button data-close>Cancelar</button></div>`);
  const inp = w.querySelector("#crisLink"); const msg = w.querySelector("#crisMsg"); const go = w.querySelector("#crisGo");
  inp.focus();
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
  go.addEventListener("click", async () => {
    const link = inp.value.trim();
    if (!crisId(link)) { msg.textContent = "Esse link não parece ser de uma ficha da CRIS."; return; }
    if (precisaPedir() && !consumeAllow()) { w.remove(); return pedirFicha(); }
    go.disabled = true; msg.textContent = "Buscando na CRIS…";
    try {
      const { id, doc } = await buscarCris(link);
      const { sheet, avisos, resumo } = crisParaFicha(doc, CRIS_CTX, link);
      const s = upgrade(sheet); s.owner = { id: me.id, name: me.name }; s.updatedAt = Date.now(); s.lastExport = 0; s.cris = id;
      store.own[s.id] = s; store.currentId = s.id; tab = "principal"; persist(); scheduleSync(s); w.remove(); render();
      toast(`${s.header.personagem} importado da CRIS: ${resumo.pericias} perícias, ${resumo.itens} itens, ${resumo.ataques} ataques, ${resumo.rituais} rituais.${avisos.length ? " Veja os avisos nas Notas." : ""}`);
    } catch (err) { go.disabled = false; msg.textContent = err.message || "Não deu para importar."; }
  });
}
// Traz só os números que mudam na mesa (PV, PE/PD, SAN, NEX) da ficha original na CRIS
async function crisAtualizar(s) {
  if (!s?.cris) return;
  toast("Buscando na CRIS…");
  try {
    const { doc } = await buscarCris(s.cris);
    const { sheet: n } = crisParaFicha(doc, CRIS_CTX);
    s.pv = n.pv; s.nex = n.nex; s.attrs = n.attrs;
    if (n.regra === s.regra) { s.pd = n.pd; if (n.san) s.san = n.san; }
    touchSheet(s); render(); toast(`${s.header.personagem}: PV ${s.pv.atual}/${s.pv.max} atualizado pela CRIS.`);
  } catch (err) { toast(err.message || "Não deu para atualizar."); }
}

let toastTimer;
function toast(text) {
  if (cur() && !isDet(cur())) text = trPE(text);
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div"); t.className = "toast"; t.textContent = text; document.body.appendChild(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 4500);
}

/* Pedido do menu do token para abrir uma ficha */
function checkOpenRequest() {
  try {
    const req = JSON.parse(lsGet(OPEN_KEY) || "null");
    if (!req || Date.now() - req.at > 15000) return;
    localStorage.removeItem(OPEN_KEY);
    if (sheetById(req.sheetId)) { store.currentId = req.sheetId; tab = "principal"; persist(); render(); }
    else toast("Essa ficha pertence a outro jogador.");
  } catch { /* */ }
}

// Mantém janela pequena, tela grande e menu do token sincronizados
window.addEventListener("storage", (e) => {
  if (e.key === OPEN_KEY) return checkOpenRequest();
  if (e.key === reqKey()) return softRender();
  if (e.key === feedKey()) { if (tab === "pratos") softRender(); return; }
  if (e.key === storeKey + ":log") { // rolagem feita na janelinha do acesso rápido (ou em outra janela da ficha)
    try { rollLog = JSON.parse(e.newValue || "[]"); } catch { rollLog = []; }
    if (tab === "rolagens" || tab === "dados") softRender();
    return;
  }
  if (e.key !== storeKey) return;
  const keepId = store.currentId; load(); store.currentId = keepId; softRender();
});

/* ---------- Inicialização ---------- */
async function start() {
  if (OBR.isAvailable) {
    OBR.onReady(async () => {
      obrOk = true;
      storeKey = `${NS}:${OBR.room.id}`;
      [role, me.id, me.name] = await Promise.all([OBR.player.getRole(), OBR.player.getId(), OBR.player.getName()]);
      try { mesaCfg = { ...mesaCfg, ...((await OBR.room.getMetadata())[CFG_KEY] || {}) }; } catch { /* */ }
      OBR.room.onMetadataChange((md) => { if (md[CFG_KEY]) { mesaCfg = { ...mesaCfg, ...md[CFG_KEY] }; if (tab === "mesa") softRender(); } });
      load(); render(); checkOpenRequest();
      if (!isGM() && readLs(allowKey(), { ok: [] }).ok.length) toast("O mestre aceitou seu pedido: clique em ＋ para criar a nova ficha.");
      OBR.broadcast.onMessage(CHANNEL, (ev) => onChunk(ev.data));
      OBR.player.onChange((p) => {
        const changedRole = p.role !== role; role = p.role; me.name = p.name;
        if (changedRole) { if (isGM()) send({ t: "request" }); render(); }
      });
      sceneOk = await OBR.scene.isReady();
      OBR.scene.onReadyChange((r) => { sceneOk = r; if (tab === "principal") refreshLinkCount(); });
      if (tab === "principal") refreshLinkCount();
      if (isGM()) {
        send({ t: "request" });
        let known = new Set();
        OBR.party.onChange((players) => {
          const ids = new Set(players.map((p) => p.id));
          const novo = [...ids].some((id) => !known.has(id)); known = ids;
          if (novo && isGM()) setTimeout(() => send({ t: "request" }), 1500);
        });
      } else pushAllOwn();
    });
  } else {
    // Fora do Owlbear (teste local no navegador)
    me = { id: "local", name: "Teste" };
    if (new URLSearchParams(location.search).has("gm")) role = "GM";
    load(); render();
  }
}
start();
