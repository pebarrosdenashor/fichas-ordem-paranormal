import OBR, { buildShape, buildText } from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3.1.0/+esm";

/* Roda em segundo plano enquanto a sala está aberta:
   - menu de clique direito nos tokens (abrir / vincular / desvincular ficha)
   - desenha as barras de PV e Determinação embaixo dos tokens vinculados */

const NS = "io.github.pebarrosdenashor.ficha-op";
const LINK_KEY = NS + "/link";
const OPEN_KEY = NS + ":open";
const ICON = new URL("icon.svg", location.href).href;
const CHANNEL = NS + "/sync";

let role = "PLAYER", myId = "", storeKey = "";
const drawn = new Map(); // tokenId -> assinatura do que foi desenhado

function readStore() {
  try { return JSON.parse(localStorage.getItem(storeKey) || "null"); } catch { return null; }
}

function setupMenus() {
  OBR.contextMenu.create({
    id: NS + "/open",
    icons: [{ icon: ICON, label: "Abrir ficha", filter: { max: 1, every: [{ key: ["metadata", LINK_KEY], value: undefined, operator: "!=" }] } }],
    async onClick(ctx) {
      const link = ctx.items[0]?.metadata?.[LINK_KEY]; if (!link) return;
      if (role !== "GM" && link.ownerId !== myId) return OBR.notification.show(`A ficha de ${link.nome} é de outro jogador.`, "WARNING");
      try { localStorage.setItem(OPEN_KEY, JSON.stringify({ sheetId: link.sheetId, at: Date.now() })); } catch { /* */ }
      await OBR.action.open();
    },
  });
  OBR.contextMenu.create({
    id: NS + "/link",
    icons: [{ icon: ICON, label: "Vincular à ficha aberta", filter: { max: 1, every: [{ key: "layer", value: "CHARACTER" }, { key: ["metadata", LINK_KEY], value: undefined }] } }],
    async onClick(ctx) {
      const st = readStore(); const id = st?.currentId;
      const s = st && (st.own?.[id] || (role === "GM" ? st.others?.[id] : null));
      if (!s) return OBR.notification.show("Abra a ficha que quer vincular na extensão e tente de novo.", "WARNING");
      const data = { sheetId: s.id, ownerId: s.owner?.id || myId, nome: s.header?.personagem || "", pv: [Number(s.pv?.atual) || 0, Number(s.pv?.max) || 0], pd: s.regra === "padrao" ? [Number(s.san?.atual) || 0, Number(s.san?.max) || 0] : [Number(s.pd?.atual) || 0, Number(s.pd?.max) || 0], cor2: s.regra === "padrao" ? "#2f9ed1" : "#7b5cff", todos: s.token?.barrasTodos !== false };
      try {
        await OBR.scene.items.updateItems([ctx.items[0].id], (ds) => { for (const d of ds) d.metadata[LINK_KEY] = data; });
        OBR.notification.show(`Token vinculado à ficha de ${data.nome}.`, "SUCCESS");
      } catch { OBR.notification.show("Sem permissão para alterar esse token.", "ERROR"); }
    },
  });
  OBR.contextMenu.create({
    id: NS + "/unlink",
    icons: [{ icon: ICON, label: "Desvincular ficha", filter: { every: [{ key: ["metadata", LINK_KEY], value: undefined, operator: "!=" }] } }],
    async onClick(ctx) {
      try { await OBR.scene.items.updateItems(ctx.items.map((i) => i.id), (ds) => { for (const d of ds) delete d.metadata[LINK_KEY]; }); }
      catch { OBR.notification.show("Sem permissão para alterar esse token.", "ERROR"); }
    },
  });
}

/* ---------- Barras ---------- */
const barIds = (id) => [`${id}-op-pvbg`, `${id}-op-pv`, `${id}-op-pvtx`, `${id}-op-pdbg`, `${id}-op-pd`, `${id}-op-pdtx`];

async function drawBars(items) {
  const linked = new Map();
  for (const it of items) {
    const l = it.metadata?.[LINK_KEY]; if (!l) continue;
    const canSee = l.todos || role === "GM" || l.ownerId === myId;
    if (!canSee || (!it.visible && role !== "GM")) continue;
    linked.set(it.id, { it, l });
  }
  const toDelete = [];
  for (const id of drawn.keys()) if (!linked.has(id)) { toDelete.push(...barIds(id)); drawn.delete(id); }

  const toAdd = [];
  for (const [id, { it, l }] of linked) {
    const sig = JSON.stringify([l.pv, l.pd, l.cor2, it.scale, it.visible]);
    if (drawn.get(id) === sig) continue;
    let b;
    try { b = await OBR.scene.items.getItemBounds([id]); } catch { continue; }
    if (drawn.has(id)) toDelete.push(...barIds(id));
    drawn.set(id, sig);
    const w = b.width, h = Math.max(8, Math.round(w * 0.11)), gap = 2;
    const x = b.min.x, y1 = b.max.y + gap, y2 = y1 + h + gap;
    const mk = (bid, y, frac, color, val) => {
      const out = [
        buildShape().id(bid[0]).shapeType("RECTANGLE").width(w).height(h).position({ x, y }).fillColor("#000000").fillOpacity(0.75)
          .strokeColor("#ffffff").strokeOpacity(0.35).strokeWidth(1).attachedTo(id).layer("ATTACHMENT").locked(true).disableHit(true)
          .disableAttachmentBehavior(["ROTATION", "SCALE"]).visible(it.visible).zIndex(1).build(),
      ];
      if (frac > 0) out.push(buildShape().id(bid[1]).shapeType("RECTANGLE").width(Math.max(1, w * frac)).height(h).position({ x, y }).fillColor(color).fillOpacity(1)
        .strokeWidth(0).attachedTo(id).layer("ATTACHMENT").locked(true).disableHit(true)
        .disableAttachmentBehavior(["ROTATION", "SCALE"]).visible(it.visible).zIndex(2).build());
      out.push(buildText().id(bid[2]).textType("PLAIN").plainText(val).width(w).height(h).position({ x, y })
        .fontSize(Math.round(h * 0.8)).fontWeight(700).fillColor("#ffffff").strokeColor("#000000").strokeWidth(2)
        .textAlign("CENTER").textAlignVertical("MIDDLE").padding(0).lineHeight(1)
        .attachedTo(id).layer("ATTACHMENT").locked(true).disableHit(true)
        .disableAttachmentBehavior(["ROTATION", "SCALE"]).visible(it.visible).zIndex(3).build());
      return out;
    };
    const ids6 = barIds(id);
    const f = (a) => (a[1] > 0 ? Math.max(0, Math.min(1, a[0] / a[1])) : 0);
    toAdd.push(...mk(ids6.slice(0, 3), y1, f(l.pv), "#c8102e", `${l.pv[0]}/${l.pv[1]}`));
    toAdd.push(...mk(ids6.slice(3, 6), y2, f(l.pd), l.cor2 || "#7b5cff", `${l.pd[0]}/${l.pd[1]}`));
  }
  try {
    if (toDelete.length) await OBR.scene.local.deleteItems(toDelete);
    if (toAdd.length) await OBR.scene.local.addItems(toAdd);
  } catch (e) { console.warn("Ficha OP: não foi possível desenhar as barras", e); }
}

let queued = null, busy = false;
async function schedule(items) {
  queued = items; if (busy) return;
  busy = true;
  while (queued) { const it = queued; queued = null; await drawBars(it); }
  busy = false;
}
async function startScene() {
  drawn.clear();
  try {
    const old = await OBR.scene.local.getItems((i) => /-op-(pv|pd)/.test(i.id));
    if (old.length) await OBR.scene.local.deleteItems(old.map((i) => i.id));
  } catch { /* */ }
  schedule(await OBR.scene.items.getItems());
}

/* ---------- Sincronia em segundo plano ----------
   Mantém as fichas atualizadas mesmo com a janela da ficha fechada:
   guarda no navegador as mudanças que o mestre (ou o Hexatombe) enviar,
   responde aos pedidos de fichas e devolve a versão mais nova a quem estiver desatualizado. */
const CHUNK = 5000;
const partial = {};
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
async function send(msg) {
  const str = JSON.stringify(msg); const n = Math.max(1, Math.ceil(str.length / CHUNK)); const m = uid();
  for (let i = 0; i < n; i++) {
    try { await OBR.broadcast.sendMessage(CHANNEL, { m, i, n, d: str.slice(i * CHUNK, (i + 1) * CHUNK) }); } catch { return; }
    if (n > 1) await new Promise((r) => setTimeout(r, 70));
  }
}
function writeStore(st) { try { localStorage.setItem(storeKey, JSON.stringify(st)); } catch { /* cheio */ } }
async function handleSync(msg) {
  const st = readStore() || { own: {}, others: {}, currentId: null };
  st.own ||= {}; st.others ||= {};
  if (msg.t === "sheet" && msg.sheet?.id) {
    const s = msg.sheet; const ts = Number(s.updatedAt) || 0;
    if (st.own[s.id]) {
      const mine = st.own[s.id];
      if (ts > (Number(mine.updatedAt) || 0)) { s.lastExport = mine.lastExport; st.own[s.id] = s; writeStore(st); }
    } else if (role === "GM") {
      const old = st.others[s.id];
      if (old && ts < (Number(old.updatedAt) || 0)) return send({ t: "sheet", sheet: old });
      if (!old || ts > (Number(old.updatedAt) || 0)) { st.others[s.id] = s; writeStore(st); }
    }
  } else if (msg.t === "newreq" && msg.req && role === "GM") {
    const k = storeKey + ":reqs"; let rs = [];
    try { rs = JSON.parse(localStorage.getItem(k) || "[]"); } catch { /* */ }
    if (!rs.some((r) => r.id === msg.req.id)) { rs.push(msg.req); try { localStorage.setItem(k, JSON.stringify(rs)); } catch { /* */ } OBR.notification.show(`${msg.req.name} pediu para criar uma nova ficha (abra a ficha para responder).`); }
  } else if (msg.t === "newok" && msg.pid === myId) {
    const k = storeKey + ":allow"; let a = { ok: [], used: [] };
    try { a = JSON.parse(localStorage.getItem(k) || "null") || a; } catch { /* */ }
    if (!a.used.includes(msg.reqId) && !a.ok.includes(msg.reqId)) { a.ok.push(msg.reqId); try { localStorage.setItem(k, JSON.stringify(a)); } catch { /* */ } }
  } else if (msg.t === "lib" && msg.lib?.itens && role !== "GM") {
    // biblioteca do livro enviada pelo mestre: guarda para quando a ficha abrir
    try {
      const k = NS + ":lib"; const cur = JSON.parse(localStorage.getItem(k) || "null") || { formato: "biblioteca-ficha-op", versao: 1, livros: {}, itens: [] };
      const livros = Object.keys(msg.lib.livros || {});
      cur.itens = cur.itens.filter((i) => !livros.some((l) => (i.fonte || "").startsWith(l + " "))).concat(msg.lib.itens);
      cur.livros = { ...cur.livros, ...(msg.lib.livros || {}) }; localStorage.setItem(k, JSON.stringify(cur));
    } catch { /* */ }
  } else if (msg.t === "dice" && msg.pid && msg.pid !== myId) {
    const k = storeKey + ":feed"; let f = {};
    try { f = JSON.parse(localStorage.getItem(k) || "{}"); } catch { /* */ }
    const e = (f[msg.pid] ||= { who: msg.who, char: msg.char, rolls: [] }); e.who = msg.who; e.char = msg.char;
    if (!e.rolls.some((r) => r.at === msg.at)) e.rolls.unshift({ text: msg.text, groups: msg.groups, cfg: msg.cfg, at: msg.at });
    e.rolls = e.rolls.slice(0, 5); try { localStorage.setItem(k, JSON.stringify(f)); } catch { /* */ }
  } else if (msg.t === "request" && role !== "GM") {
    for (const s of Object.values(st.own)) await send({ t: "sheet", sheet: s });
  } else if (msg.t === "delete" && msg.id) {
    if (st.own[msg.id] || st.others[msg.id]) { delete st.own[msg.id]; delete st.others[msg.id]; writeStore(st); }
  }
}
function onChunk(data) {
  if (!data || !data.m) return;
  const p = (partial[data.m] ||= { n: data.n, parts: [], got: 0, at: Date.now() });
  if (p.parts[data.i] === undefined) { p.parts[data.i] = data.d; p.got++; }
  if (p.got === p.n) { delete partial[data.m]; try { handleSync(JSON.parse(p.parts.join(""))); } catch { /* */ } }
  for (const [k, v] of Object.entries(partial)) if (Date.now() - v.at > 60000) delete partial[k];
}

OBR.onReady(async () => {
  storeKey = `${NS}:${OBR.room.id}`;
  OBR.broadcast.onMessage(CHANNEL, (ev) => onChunk(ev.data));
  [role, myId] = await Promise.all([OBR.player.getRole(), OBR.player.getId()]);
  setupMenus();
  if (role !== "GM") handleSync({ t: "request" }); // envia as fichas ao mestre assim que entra na sala
  OBR.player.onChange(async (p) => { if (p.role !== role) { role = p.role; drawn.clear(); if (await OBR.scene.isReady()) startScene(); } });
  OBR.scene.items.onChange((items) => schedule(items));
  OBR.scene.onReadyChange((ready) => { if (ready) startScene(); else drawn.clear(); });
  if (await OBR.scene.isReady()) startScene();
});
