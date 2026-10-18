/* Canção Incentiva · site */
import {
  fmt, fmt0, parseBRL, moneyStr, UFS, SEG, LEI_NOME, UNIDADES, categorias, itemTotal, totalCustos,
  CAMPOS, PERIODO_ESPORTE, META_LIM, cnt, leiDoProjeto, nomeProjeto
} from "./regras.js";

/* ================== Utilidades ================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid4 = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o || {}));
const dateBR = d => { if (!d) return "—"; const x = typeof d === "number" ? new Date(d) : new Date(d + "T12:00:00"); return isNaN(x) ? "—" : x.toLocaleDateString("pt-BR"); };
const daysTo = d => { if (!d) return null; const x = new Date(d + "T23:59:59"); return Math.ceil((x - Date.now()) / 864e5); };
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 3200); }
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

const leiChip = l => l === "cultura" ? '<span class="chip cultura">Cultura · Rouanet</span>' : l === "esporte" ? '<span class="chip esporte">Esporte · LIE</span>' : '<span class="chip">A definir</span>';

function fillUF(sel, first) { sel.innerHTML = (first ? `<option value="">${first}</option>` : '<option value="">Selecione</option>') + UFS.map(u => `<option>${u}</option>`).join(""); }
function fillSeg(sel, lei) {
  const list = lei === "cultura" ? SEG.cultura : lei === "esporte" ? SEG.esporte : [...SEG.cultura, ...SEG.esporte];
  const cur = sel.value;
  sel.innerHTML = '<option value="">Selecione</option>' + list.map(s => `<option>${esc(s)}</option>`).join("") + '<option>Ainda não defini, a IA sugere</option>';
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}

/* Mini renderizador de Markdown (texto da IA) */
function md(src) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const L = String(src || "").replace(/\r/g, "").split("\n"); const out = []; let i = 0;
  const isList = l => /^\s*([-*•]|\d+[.)])\s+/.test(l), isTbl = l => /^\s*\|/.test(l), isH = l => /^#{1,5}\s+/.test(l);
  while (i < L.length) {
    const l = L[i];
    if (/^\s*$/.test(l)) { i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr class="sep">'); i++; continue; }
    let m = l.match(/^(#{1,5})\s+(.*)/);
    if (m) { const n = Math.min(m[1].length + 1, 5); out.push(`<h${n}>${inline(m[2].replace(/\*\*/g, ""))}</h${n}>`); i++; continue; }
    if (isTbl(l)) {
      const rows = []; while (i < L.length && isTbl(L[i])) rows.push(L[i++]);
      const cells = r => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
      const body = rows.filter(r => !/^[\s|:\-]+$/.test(r)); const [head, ...rest] = body;
      if (head) out.push('<div class="tbl"><table><thead><tr>' + cells(head).map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" + rest.map(r => "<tr>" + cells(r).map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table></div>");
      continue;
    }
    if (isList(l)) {
      const ord = /^\s*\d/.test(l); const items = [];
      while (i < L.length && isList(L[i])) items.push(L[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      const t = ord ? "ol" : "ul"; out.push(`<${t}>` + items.map(x => `<li>${inline(x)}</li>`).join("") + `</${t}>`); continue;
    }
    const p = []; while (i < L.length && !/^\s*$/.test(L[i]) && !isH(L[i]) && !isTbl(L[i]) && !isList(L[i])) p.push(L[i++]);
    out.push("<p>" + inline(p.join(" ")) + "</p>");
  }
  return out.join("\n");
}

/* ================== Estado, login e servidor ================== */
const S = {
  sb: null, pub: {}, user: null, perfil: null, isAdmin: false, ready: false,
  vitrine: [], config: {}, rascunhos: [], pedidos: [], meusProjetos: [],
  adm: { projetos: [], leads: [], pedidos: [], perfis: {} },
  view: "inicio", atual: null, gerando: null, adminTab: "analise"
};

async function api(caminho, body, { signal, method } = {}) {
  const headers = { "content-type": "application/json" };
  if (S.sb) { const { data } = await S.sb.auth.getSession(); if (data?.session) headers.authorization = "Bearer " + data.session.access_token; }
  let r;
  try { r = await fetch(caminho, { method: method || (body ? "POST" : "GET"), headers, body: body ? JSON.stringify(body) : undefined, signal }); }
  catch (e) { if (e?.name === "AbortError") throw { code: "cancelled" }; throw { code: "rede", message: "Sem conexão com o servidor. Verifique sua internet." }; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw { code: j.erro || "erro", message: j.mensagem || "Algo deu errado. Tente de novo." };
  return j;
}
function aiErro(e) {
  if (!e) return "Algo deu errado. Tente de novo.";
  if (e.code === "cancelled") return "Geração interrompida.";
  return e.message || "Não foi possível falar com a IA agora. Tente de novo em instantes.";
}

/* ---------- Conta (cadastro e login) ---------- */
function renderConta() {
  const b = $("#btn-conta");
  if (!S.sb) { b.hidden = true; return; }
  b.hidden = false;
  b.textContent = S.user ? "Minha conta" : "Entrar";
  $$(".only-owner").forEach(el => el.hidden = !S.isAdmin);
}
$("#btn-conta").onclick = () => S.user ? abrirConta() : abrirLogin();

function abrirConta() {
  const p = S.perfil || {};
  openSheet(`<div class="sheet-head"><div><span class="eyebrow">Minha conta</span><h2 id="sheet-title">${esc(p.nome || "Olá!")}</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
    <dl class="kv"><dt>E-mail</dt><dd>${esc(S.user.email)}</dd><dt>WhatsApp</dt><dd>${esc(p.whats || "—")}</dd><dt>Projetos montados</dt><dd>${S.rascunhos.length}</dd></dl>
    <div class="row"><button class="btn btn-ghost" data-go="montar" data-close>Meus projetos</button><button class="btn btn-danger" id="ct-sair">Sair da conta</button></div>`,
    (inn, close) => { $("#ct-sair", inn).onclick = async () => { await S.sb.auth.signOut(); close(); toast("Você saiu da conta"); }; });
}

let loginEspera = null;
function garantirLogin(motivo) {
  if (S.user) return Promise.resolve(true);
  if (!S.sb) { toast("O site ainda está sendo configurado. Tente mais tarde."); return Promise.resolve(false); }
  return new Promise(res => { loginEspera = res; abrirLogin(motivo); });
}
function abrirLogin(motivo, aba = "criar") {
  openSheet(`<div class="sheet-head"><div><span class="eyebrow">Sua conta gratuita</span><h2 id="sheet-title">${aba === "criar" ? "Criar conta" : "Entrar"}</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
    ${motivo ? `<p class="dica-txt">${esc(motivo)}</p>` : ""}
    <div class="seg" role="group" aria-label="Escolha"><button type="button" id="lg-a-criar" aria-pressed="${aba === "criar"}">Sou novo aqui</button><button type="button" id="lg-a-entrar" aria-pressed="${aba !== "criar"}">Já tenho conta</button></div>
    <form class="stack" id="lg-form" novalidate>
      ${aba === "criar" ? `<label class="f">Seu nome<input type="text" id="lg-nome" autocomplete="name" required></label>
      <label class="f">WhatsApp<input type="tel" id="lg-whats" autocomplete="tel" placeholder="(44) 9 9999-9999" required></label>` : ""}
      <label class="f">E-mail<input type="email" id="lg-mail" autocomplete="email" required></label>
      <label class="f">Senha ${aba === "criar" ? '<span class="hint">Pelo menos 6 letras ou números. Anote para não esquecer.</span>' : ""}<input type="password" id="lg-senha" autocomplete="${aba === "criar" ? "new-password" : "current-password"}" required></label>
      <p class="notice bad" id="lg-err" hidden></p>
      <button class="btn btn-primary" type="submit">${aba === "criar" ? "Criar minha conta" : "Entrar"}</button>
      ${aba !== "criar" ? '<button class="btn btn-ghost btn-sm" type="button" id="lg-esqueci">Esqueci minha senha</button>' : ""}
    </form>`,
    (inn, close) => {
      $("#lg-a-criar", inn).onclick = () => abrirLogin(motivo, "criar");
      $("#lg-a-entrar", inn).onclick = () => abrirLogin(motivo, "entrar");
      const err = $("#lg-err", inn);
      const falha = m => { err.textContent = m; err.hidden = false; };
      const esq = $("#lg-esqueci", inn);
      if (esq) esq.onclick = async () => {
        const email = $("#lg-mail", inn).value.trim();
        if (!email) return falha("Digite seu e-mail acima e toque de novo em Esqueci minha senha.");
        const { error } = await S.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/" });
        if (error) return falha("Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.");
        err.hidden = true; toast("Enviamos um link para criar uma nova senha no seu e-mail");
      };
      $("#lg-form", inn).onsubmit = async e => {
        e.preventDefault(); err.hidden = true;
        const email = $("#lg-mail", inn).value.trim(), senha = $("#lg-senha", inn).value;
        const btn = $('button[type="submit"]', inn); btn.disabled = true;
        try {
          if (aba === "criar") {
            const nome = $("#lg-nome", inn).value.trim(), whats = $("#lg-whats", inn).value.trim();
            if (!nome || !whats || !email) return falha("Preencha nome, WhatsApp e e-mail.");
            if (senha.length < 6) return falha("A senha precisa ter pelo menos 6 caracteres.");
            const { data, error } = await S.sb.auth.signUp({ email, password: senha, options: { data: { nome, whats } } });
            if (error) return falha(/registered|already/i.test(error.message) ? "Este e-mail já tem conta. Toque em Já tenho conta." : "Não foi possível criar a conta: " + error.message);
            if (!data.session) { close(); openSheet(`<div class="sheet-head"><h2 id="sheet-title">Confirme seu e-mail</h2><button class="x" data-close aria-label="Fechar">×</button></div><p>Enviamos uma mensagem para <strong>${esc(email)}</strong>. Abra o e-mail, toque no link de confirmação e depois volte aqui para entrar.</p>`); return; }
          } else {
            if (!email || !senha) return falha("Digite e-mail e senha.");
            const { error } = await S.sb.auth.signInWithPassword({ email, password: senha });
            if (error) return falha(/confirm/i.test(error.message) ? "Confirme seu e-mail antes de entrar (veja sua caixa de entrada)." : "E-mail ou senha incorretos.");
          }
          const { data: ses } = await S.sb.auth.getSession();
          if (ses?.session?.user && S.user?.id !== ses.session.user.id) { S.user = ses.session.user; await carregarUsuario(); refreshAll(); }
          const cb = loginEspera; loginEspera = null;
          close(); toast("Pronto, você está conectado");
          cb && setTimeout(() => cb(true), 200);
        } finally { btn.disabled = false; }
      };
    },
    () => { if (loginEspera && !S.user) { const cb = loginEspera; loginEspera = null; cb(false); } });
}
function abrirNovaSenha() {
  openSheet(`<div class="sheet-head"><h2 id="sheet-title">Criar nova senha</h2><button class="x" data-close aria-label="Fechar">×</button></div>
    <form class="stack" id="ns-form" novalidate><label class="f">Nova senha<input type="password" id="ns-senha" autocomplete="new-password"></label><p class="notice bad" id="ns-err" hidden></p><button class="btn btn-primary" type="submit">Salvar nova senha</button></form>`,
    (inn, close) => {
      $("#ns-form", inn).onsubmit = async e => {
        e.preventDefault(); const s = $("#ns-senha", inn).value;
        if (s.length < 6) { const er = $("#ns-err", inn); er.textContent = "Use pelo menos 6 caracteres."; er.hidden = false; return; }
        const { error } = await S.sb.auth.updateUser({ password: s });
        if (error) { const er = $("#ns-err", inn); er.textContent = "Não foi possível salvar: " + error.message; er.hidden = false; return; }
        close(); toast("Senha alterada");
      };
    });
}

/* ---------- Carregamento de dados ---------- */
const achatar = row => ({ ...(row.data || {}), id: row.id });
async function carregarPublico() {
  if (!S.sb) return;
  const [v, c] = await Promise.all([
    S.sb.from("vitrine").select("*").order("publicado_em", { ascending: false }),
    S.sb.from("config").select("data").eq("id", 1).maybeSingle()
  ]);
  if (!v.error) S.vitrine = v.data.map(x => ({ ...x.data, id: x.id, origemId: x.origem_id, publicadoEm: Date.parse(x.publicado_em) }));
  if (!c.error) S.config = c.data?.data || {};
  loadCfgForm();
}
async function carregarUsuario() {
  if (!S.user) { S.rascunhos = []; S.pedidos = []; S.meusProjetos = []; S.isAdmin = false; S.perfil = null; return; }
  const uid = S.user.id;
  const [p, r, pd, mp, adm] = await Promise.all([
    S.sb.from("perfis").select("*").eq("user_id", uid).maybeSingle(),
    S.sb.from("rascunhos").select("id,data,created_at").eq("user_id", uid).order("created_at", { ascending: false }),
    S.sb.from("pedidos").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    S.sb.from("projetos_captacao").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
    S.sb.rpc("is_admin")
  ]);
  S.perfil = p.data || null;
  if (!S.perfil) {
    const md0 = S.user.user_metadata || {};
    const novo = { user_id: uid, nome: md0.nome || "", whats: md0.whats || "", email: S.user.email };
    const ins = await S.sb.from("perfis").insert(novo).select().maybeSingle();
    S.perfil = ins.data || novo;
  }
  if (!r.error) S.rascunhos = r.data.map(achatar);
  if (!pd.error) S.pedidos = pd.data;
  if (!mp.error) S.meusProjetos = mp.data.map(x => ({ ...x.data, id: x.id, status: x.status, nota: x.nota, criadoEm: Date.parse(x.created_at) }));
  S.isAdmin = adm.data === true;
  if (S.isAdmin) await carregarAdmin();
}
async function carregarAdmin() {
  const [pj, ld, pd, pf] = await Promise.all([
    S.sb.from("projetos_captacao").select("*").order("created_at", { ascending: false }),
    S.sb.from("leads").select("*").order("created_at", { ascending: false }),
    S.sb.from("pedidos").select("*").order("created_at", { ascending: false }),
    S.sb.from("perfis").select("*")
  ]);
  S.adm = {
    projetos: (pj.data || []).map(x => ({ ...x.data, id: x.id, _uid: x.user_id, status: x.status, nota: x.nota, criadoEm: Date.parse(x.created_at) })),
    leads: (ld.data || []).map(x => ({ ...x.data, id: x.id, status: x.status, criadoEm: Date.parse(x.created_at) })),
    pedidos: (pd.data || []).map(x => ({ ...x, criadoEm: Date.parse(x.created_at) })),
    perfis: Object.fromEntries((pf.data || []).map(x => [x.user_id, x]))
  };
}

/* ---------- Salvar projetos montados ---------- */
let saveChain = Promise.resolve();
function dadosRascunho(r) { const { id, ...d } = clone(r); delete d.projeto?.status; return d; }
async function gravarRascunho(r) {
  if (!S.sb || !S.user) return;
  if (r.id && !String(r.id).startsWith("tmp-")) {
    const { error } = await S.sb.from("rascunhos").update({ data: dadosRascunho(r) }).eq("id", r.id);
    if (error) throw error;
  } else {
    const { data, error } = await S.sb.from("rascunhos").insert({ data: dadosRascunho(r) }).select("id").single();
    if (error) throw error;
    r.id = data.id;
  }
  const i = S.rascunhos.findIndex(x => x.id === r.id);
  const copia = clone(r);
  if (i >= 0) S.rascunhos[i] = copia; else S.rascunhos.unshift(copia);
}
function salvarAtual() {
  if (!S.atual) return Promise.resolve();
  const r = S.atual;
  saveChain = saveChain.then(() => gravarRascunho(r)).catch(e => { console.warn("salvar", e); toast("Não foi possível salvar agora. Verifique sua internet."); });
  return saveChain;
}

/* ================== Navegação ================== */
const VIEWS = ["inicio", "montar", "captar", "vitrine", "calc", "admin"];
function go(v, push = true) {
  if (!VIEWS.includes(v)) v = "inicio";
  if (v === "admin" && !S.isAdmin) v = "inicio";
  S.view = v;
  VIEWS.forEach(x => { const el = $("#v-" + x); if (el) el.hidden = x !== v; });
  $$(".nav button").forEach(b => b.setAttribute("aria-current", b.dataset.go === v ? "page" : "false"));
  if (push) { try { history.replaceState(null, "", "#" + v); } catch {} }
  window.scrollTo({ top: 0 });
  if (v === "admin") renderAdmin();
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-go]"); if (!t) return;
  e.preventDefault(); go(t.dataset.go);
});

/* ================== Assistente (wizard) ================== */
const W_FIELDS = ["tipo","tempo","cidade","uf","experiencia","titulo","segmento","descricao","publico","beneficiarios","local","periodo","valor","atividades","produtos","equipe","curriculos","acesso","ingresso","patrocinio"];
const NS_FIELDS = ["beneficiarios","local","periodo","valor","ingresso"];
const W_LAST = 5;
let step = 0;
let CUSTOS = [];
const wform = $("#wform");
const gLink = q => "https://www.google.com/search?q=" + encodeURIComponent(q);
const LUPA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';

function leiAtual() { const r = wform.querySelector('input[name="lei"]:checked'); return r ? r.value : ""; }
function leiTexto(l) { return l === "cultura" ? "Lei Rouanet" : l === "esporte" ? "Lei de Incentivo ao Esporte" : "leis de incentivo cultura esporte"; }
function updGoogle(root = document) {
  const l = leiAtual();
  const segq = l === "esporte" ? "formação esportiva excelência esportiva esporte para toda a vida lei de incentivo ao esporte diferença" : l === "cultura" ? "segmentos culturais Lei Rouanet artigo 18 artigo 26" : "segmentos Lei Rouanet e manifestações Lei de Incentivo ao Esporte";
  $$("[data-google]", root).forEach(sp => {
    const q = sp.dataset.google.replace(/\{lei\}/g, leiTexto(l)).replace(/\{segq\}/g, segq);
    sp.innerHTML = `<a class="ajuda" href="${esc(gLink(q))}" target="_blank" rel="noopener">${LUPA}Dúvida? Pesquisar exemplos no Google</a>`;
  });
}
function initNS() {
  $$(".ns[data-ns]").forEach(sp => {
    const k = sp.dataset.ns;
    sp.innerHTML = `<label class="nsei"><input type="checkbox" id="ns-${k}" data-nsk="${k}"><span class="ns-off"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>Deixar a IA sugerir</span><span class="ns-on"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>A IA vai sugerir · desfazer</span></label>`;
    $("input", sp).addEventListener("change", e => { aplicarNS(k, e.target.checked); wSave(); });
  });
}
function aplicarNS(k, on) {
  const el = wform.elements[k]; const cb = $("#ns-" + k);
  if (cb) cb.checked = on;
  if (!el) return;
  el.disabled = on; if (on) el.value = "";
  el.closest("label.f")?.classList.toggle("is-ns", on);
}
function wData() {
  const fd = new FormData(wform); const d = {};
  d.lei = fd.get("lei") || ""; W_FIELDS.forEach(k => d[k] = (fd.get(k) || "").toString().trim());
  d.naosei = {}; NS_FIELDS.forEach(k => { if ($("#ns-" + k)?.checked) d.naosei[k] = true; });
  d.custos = clone(CUSTOS);
  return d;
}
function wLoad(d) {
  d = d || {};
  $$('input[name="lei"]').forEach(r => r.checked = r.value === d.lei);
  fillSeg($("#w-seg"), d.lei);
  NS_FIELDS.forEach(k => aplicarNS(k, false));
  W_FIELDS.forEach(k => { const el = wform.elements[k]; if (el) el.value = d[k] || ""; });
  NS_FIELDS.forEach(k => aplicarNS(k, !!d.naosei?.[k]));
  CUSTOS = Array.isArray(d.custos) ? clone(d.custos) : [];
  updGoogle(); renderPlanilha();
}
function wSave() { store.set("ci-wizard", { d: wData(), step }); }
function wShow(n) {
  step = n;
  $$(".wstep").forEach(s => s.hidden = Number(s.dataset.step) !== n);
  $$("#steps span").forEach((s, i) => { s.className = i < n ? "done" : i === n ? "on" : ""; });
  $("#w-back").disabled = n === 0;
  $("#w-next").textContent = n === W_LAST ? "Gerar diagnóstico gratuito" : n === 4 ? "Continuar para revisar" : "Continuar";
  $("#w-err").hidden = true;
  if (n === 4) renderPlanilha();
  if (n === W_LAST) wReview();
  wSave();
  $("#wizard").scrollIntoView({ behavior: "smooth", block: "start" });
}
function wValidate(n) {
  const d = wData(); const miss = [];
  if (n === 0 && !d.lei) miss.push("escolha uma opção (se tiver dúvida, toque em Me ajude a escolher)");
  if (n === 1) { if (!d.tipo) miss.push("quem é você ou sua instituição"); if (!d.cidade) miss.push("cidade"); if (!d.uf) miss.push("estado"); }
  if (n === 2) {
    if (!d.titulo) miss.push("nome do projeto (pode ser provisório)");
    if (d.descricao.length < 30) miss.push("o que você quer fazer (escreva pelo menos 2 frases)");
    if (!parseBRL(d.valor) && !d.naosei.valor) miss.push("valor aproximado ou toque em Deixar a IA sugerir");
  }
  if (miss.length) { const e = $("#w-err"); e.textContent = "Falta: " + miss.join("; ") + "."; e.hidden = false; e.scrollIntoView({ behavior: "smooth", block: "center" }); return false; }
  return true;
}
function valorTexto(d) {
  const tot = totalCustos(d.custos);
  if (parseBRL(d.valor)) return fmt(parseBRL(d.valor));
  if (tot) return fmt(tot) + " (total da planilha)";
  return "A IA vai sugerir";
}
function wReview() {
  const d = wData(); const nsv = v => v || "A IA vai sugerir";
  const rows = [["Lei", LEI_NOME[d.lei]], ["Quem propõe", d.tipo], ["CNPJ", d.tempo || "—"], ["Cidade", `${d.cidade}/${d.uf}`], ["Projeto", d.titulo], ["Área", d.segmento || "A IA vai sugerir"], ["Público", d.publico || "—"], ["Pessoas", nsv(d.beneficiarios)], ["Local", nsv(d.local)], ["Período", nsv(d.periodo)], ["Valor", valorTexto(d)], ["Planilha de custos", d.custos.length ? `${d.custos.length} itens · ${fmt(totalCustos(d.custos))}` : "Não preenchida"]];
  $("#w-review").innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  $("#w-review").classList.toggle("protegido", !S.isAdmin);
  const off = $("#w-ai-off");
  if (S.ready && !S.pub.iaConfigurada) { off.hidden = false; off.textContent = "A IA ainda está sendo configurada. Tente novamente mais tarde."; }
  else if (S.ready && !S.user) { off.hidden = false; off.textContent = "Para gerar o diagnóstico, você vai criar uma conta gratuita com nome, WhatsApp, e-mail e senha. Assim seu projeto fica salvo."; }
  else off.hidden = true;
}
$$('input[name="lei"]').forEach(r => r.addEventListener("change", () => { fillSeg($("#w-seg"), r.value); updGoogle(); renderPlanilha(); wSave(); }));
wform.addEventListener("input", e => { if (e.target.closest("#pl-cats")) return; clearTimeout(wSave._t); wSave._t = setTimeout(wSave, 400); });
$("#w-back").onclick = () => step > 0 && wShow(step - 1);
$("#w-next").onclick = () => { if (!wValidate(step)) return; if (step < W_LAST) wShow(step + 1); else gerarDiagnostico(); };
$("#w-reset").onclick = () => {
  const b = $("#w-reset");
  if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "Confirmar: apagar respostas"; setTimeout(() => { b.dataset.conf = ""; b.textContent = "Limpar"; }, 4000); return; }
  b.dataset.conf = ""; b.textContent = "Limpar";
  wLoad({ uf: "PR" }); S.atual = null; $("#resultado").innerHTML = ""; wShow(0); toast("Respostas apagadas");
};

/* ================== Planilha de custos ================== */
function planLei() { const l = leiAtual(); return l === "esporte" ? "esporte" : "cultura"; }

function renderPlanilha() {
  const box = $("#pl-cats"); if (!box) return;
  const d = wData(); const lei = planLei(); const cats = categorias(lei, d);
  const valid = new Set(cats.map(c => c.k));
  CUSTOS.forEach(c => { if (!valid.has(c.cat)) c.cat = cats[1].k; });
  const cidade = d.cidade || "";
  box.innerHTML = cats.map(cat => {
    const itens = CUSTOS.filter(c => c.cat === cat.k);
    const sub = totalCustos(itens);
    return `<section class="pl-cat card flat stack">
      <div class="item-head"><div class="stack" style="gap:2px"><h3 style="font-size:1.15rem">${esc(cat.t)}</h3><span class="small muted">${esc(cat.dica)}</span></div><strong class="num" data-sub="${esc(cat.k)}">${fmt(sub)}</strong></div>
      ${itens.map(c => `<div class="pl-row" data-id="${esc(c.id)}">
        <label class="f pl-item">Item<input type="text" value="${esc(c.item)}" data-f="item" placeholder="O que vai pagar"></label>
        <label class="f">Unidade<select data-f="un">${UNIDADES.map(u => `<option ${u === c.un ? "selected" : ""}>${u}</option>`).join("")}</select></label>
        <label class="f">Quantidade<input type="number" min="0" step="1" value="${esc(c.qtd)}" data-f="qtd"></label>
        <label class="f">Valor de cada<span class="money"><input type="text" inputmode="decimal" value="${c.vu ? moneyStr(c.vu) : ""}" data-f="vu" placeholder="0,00"></span></label>
        <div class="pl-tot"><span class="small muted">Total</span><strong class="num" data-tot>${fmt(itemTotal(c))}</strong></div>
        <div class="pl-acts">
          <a class="ajuda" href="${esc(gLink(`preço ${c.item || "serviço"} ${cidade} ${new Date().getFullYear()}`))}" target="_blank" rel="noopener">${LUPA}Pesquisar preço</a>
          <button type="button" class="btn btn-ghost btn-sm" data-rm="${esc(c.id)}" aria-label="Remover ${esc(c.item || "item")}">Remover</button>
        </div>
        ${c.obs ? `<p class="small muted pl-obs">${esc(c.obs)}</p>` : ""}
      </div>`).join("")}
      <div class="pl-sug"><span class="small muted">Toque para adicionar:</span>${cat.sug.map(s => `<button type="button" class="chip pl-chip" data-add="${esc(cat.k)}" data-item="${esc(s)}">+ ${esc(s)}</button>`).join("")}<button type="button" class="chip pl-chip" data-add="${esc(cat.k)}" data-item="">+ Outro item</button></div>
    </section>`;
  }).join("");
  renderResumoPlanilha();
  $$("[data-add]", box).forEach(b => b.onclick = () => {
    CUSTOS.push({ id: uid4(), cat: b.dataset.add, item: b.dataset.item, un: /cachê/i.test(b.dataset.item) ? "Cachê" : /coorden|professor|monitor|contador|assistente|psicólog|nutricion|preparador/i.test(b.dataset.item) ? "Mês" : "Serviço", qtd: 1, vu: 0 });
    renderPlanilha(); wSave();
    const rows = $$(`.pl-row`, box); const last = rows.find(r => r.dataset.id === CUSTOS[CUSTOS.length - 1].id);
    last && $(b.dataset.item ? '[data-f="vu"]' : '[data-f="item"]', last)?.focus();
  });
  $$("[data-rm]", box).forEach(b => b.onclick = () => { CUSTOS = CUSTOS.filter(c => c.id !== b.dataset.rm); renderPlanilha(); wSave(); });
  $$(".pl-row", box).forEach(row => {
    const c = CUSTOS.find(x => x.id === row.dataset.id);
    $$("[data-f]", row).forEach(inp => {
      const upd = () => {
        const f = inp.dataset.f;
        c[f] = f === "vu" ? parseBRL(inp.value) : f === "qtd" ? Number(inp.value) || 0 : inp.value;
        $("[data-tot]", row).textContent = fmt(itemTotal(c));
        const sb = $(`[data-sub="${c.cat}"]`, box); if (sb) sb.textContent = fmt(totalCustos(CUSTOS.filter(x => x.cat === c.cat)));
        if (f === "item") $(".ajuda", row).href = gLink(`preço ${c.item || "serviço"} ${cidade} ${new Date().getFullYear()}`);
        renderResumoPlanilha(); clearTimeout(wSave._t); wSave._t = setTimeout(wSave, 400);
      };
      inp.addEventListener("input", upd); inp.addEventListener("change", upd);
      if (inp.dataset.f === "vu") inp.addEventListener("blur", () => { if (c.vu) inp.value = moneyStr(c.vu); });
    });
  });
}
function renderResumoPlanilha() {
  const box = $("#pl-resumo"); if (!box) return;
  const d = wData(); const lei = planLei(); const cats = categorias(lei, d);
  const tot = totalCustos(CUSTOS);
  if (!CUSTOS.length) { box.innerHTML = `<div class="notice small">A planilha está vazia. Toque em <strong>Montar planilha sugerida com IA</strong> ou adicione itens nas categorias abaixo.</div>`; return; }
  const linhas = cats.map(cat => {
    const sub = totalCustos(CUSTOS.filter(c => c.cat === cat.k)); const pct = tot ? sub / tot : 0;
    let chip = "";
    if (cat.lim) {
      const acima = pct > cat.lim + 1e-9 || (cat.teto && sub > cat.teto);
      chip = `<span class="chip ${acima ? "bad" : "ok"}">${acima ? "Acima do limite" : "Dentro do limite"} · máx. ${Math.round(cat.lim * 100)}%${cat.teto ? " e " + fmt0(cat.teto) : ""}</span>`;
    }
    return `<div class="pl-sum-row"><span>${esc(cat.t)}</span><span class="num small muted">${(pct * 100).toFixed(1).replace(".", ",")}%</span><span class="num">${fmt(sub)}</span><span>${chip}</span></div>`;
  }).join("");
  const val = parseBRL(d.valor);
  box.innerHTML = `<div class="card flat stack">
    <div class="lim total"><span>Total da planilha<br><span class="small muted">${CUSTOS.length} itens</span></span><span class="v num">${fmt(tot)}</span></div>
    <div class="pl-sum">${linhas}</div>
    ${tot && Math.abs(tot - val) > 0.5 ? `<div class="row"><button type="button" class="btn btn-ghost btn-sm" id="pl-usar">Usar ${fmt0(tot)} como valor do projeto</button>${val ? `<span class="small muted">Valor informado antes: ${fmt(val)}</span>` : ""}</div>` : ""}
    ${lei === "cultura" ? `<p class="small muted">Cachê de artista ou técnico: até R$ 3.000 por apresentação. Projetos comuns: até R$ 1,5 milhão. Confira a instrução normativa vigente.</p>` : `<p class="small muted">Não é permitido pagar atletas profissionais nem manter equipes profissionais. Cada item precisa de 3 orçamentos (cotações).</p>`}
  </div>`;
  const u = $("#pl-usar"); if (u) u.onclick = () => { aplicarNS("valor", false); wform.elements.valor.value = moneyStr(tot); wSave(); renderResumoPlanilha(); toast("Valor do projeto atualizado"); };
}
$("#pl-limpar").onclick = () => {
  const b = $("#pl-limpar");
  if (!CUSTOS.length) return;
  if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "Confirmar: apagar planilha"; setTimeout(() => { b.dataset.conf = ""; b.textContent = "Limpar planilha"; }, 4000); return; }
  b.dataset.conf = ""; b.textContent = "Limpar planilha"; CUSTOS = []; renderPlanilha(); wSave();
};
$("#pl-csv").onclick = () => {
  if (!CUSTOS.length) { toast("A planilha está vazia"); return; }
  const cats = categorias(planLei(), wData()); const nome = k => cats.find(c => c.k === k)?.t || k;
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const num = n => (Number(n) || 0).toFixed(2).replace(".", ",");
  const linhas = [["Categoria", "Item", "Unidade", "Quantidade", "Valor unitário (R$)", "Total (R$)"].map(q).join(";")];
  cats.forEach(cat => CUSTOS.filter(c => c.cat === cat.k).forEach(c => linhas.push([nome(c.cat), c.item, c.un, c.qtd, num(c.vu), num(itemTotal(c))].map((v, i) => i >= 3 ? v : q(v)).join(";"))));
  linhas.push(["", "TOTAL", "", "", "", num(totalCustos(CUSTOS))].map((v, i) => i >= 3 ? v : q(v)).join(";"));
  const nomeArq = (wData().titulo || "planilha").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").toLowerCase().slice(0, 50) || "planilha";
  baixar(`custos-${nomeArq}.csv`, "﻿" + linhas.join("\r\n"));
};
$("#pl-ia").onclick = async () => {
  const msg = $("#pl-msg"); const btn = $("#pl-ia");
  if (!S.pub.iaConfigurada) { msg.hidden = false; msg.textContent = "A IA ainda está sendo configurada. Tente novamente mais tarde."; return; }
  const d = wData(); if (!d.descricao || d.descricao.length < 30) { msg.hidden = false; msg.textContent = "Preencha antes o passo A ideia, dizendo o que você quer fazer."; return; }
  if (CUSTOS.length && btn.dataset.conf !== "1") { btn.dataset.conf = "1"; btn.textContent = "Confirmar: substituir a planilha atual"; return; }
  if (!(await garantirLogin("Para montar a planilha com IA, crie sua conta gratuita. Leva 1 minuto."))) return;
  btn.dataset.conf = ""; btn.disabled = true; btn.textContent = "Montando planilha…";
  msg.hidden = false; msg.innerHTML = `<span class="thinking"><i></i> A IA está montando a planilha com valores de referência. Leva cerca de 30 segundos.</span>`;
  try {
    const { itens } = await api("/api/ia", { acao: "planilha", respostas: d });
    CUSTOS = itens.map(x => ({ ...x, id: uid4() }));
    renderPlanilha(); wSave();
    msg.innerHTML = "Planilha sugerida pronta. Os valores são estimativas: toque em <strong>Pesquisar preço</strong> em cada item para conferir e ajuste o que precisar.";
  } catch (e) { msg.textContent = aiErro(e); }
  finally { btn.disabled = false; btn.textContent = "Montar planilha sugerida com IA"; }
};

/* ================== Diagnóstico ================== */
async function gerarDiagnostico() {
  if (!S.pub.iaConfigurada) { const e = $("#w-err"); e.textContent = "A IA ainda está sendo configurada. Tente novamente mais tarde."; e.hidden = false; return; }
  if (!(await garantirLogin("Para gerar o diagnóstico gratuito, crie sua conta. Leva 1 minuto e seu projeto fica salvo."))) return;
  const d = wData();
  const btn = $("#w-next"); btn.disabled = true;
  const box = $("#resultado");
  box.innerHTML = `<div class="card"><div class="thinking"><i></i> Analisando o enquadramento do seu projeto… isso leva de 20 a 60 segundos.</div></div>`;
  box.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const { diagnostico: diag } = await api("/api/ia", { acao: "diagnostico", respostas: d });
    const r = { id: "tmp-" + uid4(), criadoEm: Date.now(), titulo: diag.titulo_sugerido || d.titulo, lei: diag.lei || d.lei, respostas: d, diagnostico: diag };
    S.atual = r;
    renderResultado();
    await salvarAtual(); renderRascunhos(); renderResultado();
  } catch (e) {
    box.innerHTML = `<div class="notice bad">${esc(aiErro(e))}</div>`;
  } finally { btn.disabled = false; }
}

function pedidosDe(rid) { return S.pedidos.filter(p => p.rascunho_id === rid); }
function pedidoDe(rid) { const l = pedidosDe(rid); return l.find(p => p.status === "pago") || l.find(p => p.status === "aguardando"); }
function liberado(rid) { return S.isAdmin || pedidosDe(rid).some(p => p.status === "pago"); }

/* ================== Compra do projeto completo ================== */
function abrirCompra(r) {
  const c = S.config || {}; const preco = parseBRL(c.preco); const p = S.perfil || {};
  const online = S.pub.pagamentoOnline && preco > 0;
  openSheet(`<div class="sheet-head"><div><span class="eyebrow">Projeto completo</span><h2 id="sheet-title">Comprar projeto completo</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
    <div class="lim total"><span>${esc(r.titulo)}<br><span class="small muted">Todos os campos do formulário oficial, prontos para copiar</span></span><span class="v num">${preco ? fmt(preco) : "Sob consulta"}</span></div>
    <form class="stack" id="cp-form" novalidate>
      <div class="grid2"><label class="f">Seu nome<input type="text" id="cp-nome" value="${esc(p.nome || "")}"></label><label class="f">WhatsApp<input type="tel" id="cp-whats" value="${esc(p.whats || "")}"></label></div>
      <p class="notice bad" id="cp-err" hidden></p>
      ${online ? `<button class="btn btn-sun" type="submit" id="cp-pagar">Pagar com Pix, cartão ou boleto</button>
      <p class="small muted">Você será levado ao Mercado Pago, um ambiente seguro. Assim que o pagamento for aprovado, o projeto é liberado aqui automaticamente.</p>` : ""}
      <button class="btn ${online ? "btn-ghost" : "btn-sun"}" type="button" id="cp-manual">${online ? "Prefiro combinar pelo WhatsApp" : "Solicitar projeto completo"}</button>
    </form>
    ${contatoCancao()}`,
    (inn, close) => {
      const err = $("#cp-err", inn);
      const dados = () => ({ nome: $("#cp-nome", inn).value.trim(), whats: $("#cp-whats", inn).value.trim() });
      const valida = () => { const d = dados(); if (!d.nome || !d.whats) { err.textContent = "Informe nome e WhatsApp."; err.hidden = false; return null; } return d; };
      $("#cp-form", inn).onsubmit = async e => {
        e.preventDefault(); const d = valida(); if (!d) return;
        const b = $("#cp-pagar", inn); b.disabled = true; b.textContent = "Abrindo o Mercado Pago…";
        try {
          await saveChain;
          const res = await api("/api/pagamento/criar", { rid: r.id, ...d });
          if (res.jaPago) { close(); await carregarUsuario(); refreshAll(); toast("Este projeto já está pago e liberado"); return; }
          location.href = res.url;
        } catch (e2) { err.textContent = aiErro(e2); err.hidden = false; b.disabled = false; b.textContent = "Pagar com Pix, cartão ou boleto"; }
      };
      $("#cp-manual", inn).onclick = async () => {
        const d = valida(); if (!d) return;
        const { error } = await S.sb.from("pedidos").insert({ rascunho_id: r.id, titulo: r.titulo, lei: r.lei, nome: d.nome, whats: d.whats, email: S.user.email, valor: preco || null, status: "aguardando", forma: "manual" });
        if (error) { err.textContent = "Não foi possível enviar o pedido. Tente de novo."; err.hidden = false; return; }
        close(); await carregarUsuario(); refreshAll(); toast("Pedido enviado. A Canção vai falar com você pelo WhatsApp.");
      };
    });
}
async function acompanharPagamento(pedidoId, falhou) {
  try { history.replaceState(null, "", location.pathname + "#montar"); } catch {}
  if (falhou) { toast("O pagamento não foi concluído. Você pode tentar de novo."); }
  if (!S.user) return;
  const aviso = $("#resultado");
  for (let i = 0; i < 25; i++) {
    let st;
    try { st = await api("/api/pagamento/status?pedido=" + encodeURIComponent(pedidoId)); } catch { break; }
    if (st.status === "pago") {
      await carregarUsuario();
      const r = S.rascunhos.find(x => x.id === st.rascunho_id);
      if (r) { S.atual = clone(r); wLoad(r.respostas); wShow(W_LAST); }
      go("montar"); refreshAll(); toast("Pagamento aprovado! Seu projeto completo está liberado.");
      return;
    }
    if (i === 0 && !falhou) { go("montar"); aviso.innerHTML = `<div class="card"><div class="thinking"><i></i> Confirmando seu pagamento com o Mercado Pago… Pix costuma confirmar em segundos.</div></div>`; }
    await new Promise(r => setTimeout(r, 4000));
  }
  if (!falhou) { aviso.innerHTML = `<div class="notice">Ainda não recebemos a confirmação do pagamento. Se você pagou por boleto, pode levar até 3 dias úteis. Assim que for aprovado, o projeto aparece liberado aqui.</div>`; }
}

/* ================== Geração do projeto completo ================== */
async function pool(fns, n) {
  let i = 0; const run = async () => { while (i < fns.length) { const f = fns[i++]; await f(); } };
  await Promise.all(Array.from({ length: Math.min(n, fns.length) }, run));
}
function setSt(k, v) { if (!S.atual?.projeto) return; S.atual.projeto.status = { ...(S.atual.projeto.status || {}), [k]: v }; renderResultado(); }

async function gerarProjeto() {
  const r = S.atual; if (!r || S.gerando) return;
  await saveChain;
  const lei = leiDoProjeto(r);
  const ctl = new AbortController(); S.gerando = ctl;
  r.projeto = { lei, plano: null, nomes: [], nomeEscolhido: 0, campos: {}, metas: null, status: {}, iniciadoEm: Date.now() };
  setSt("plano", "gerando");
  try {
    const res = await api("/api/ia", { acao: "plano", rid: r.id }, { signal: ctl.signal });
    r.projeto.lei = res.lei || lei; r.projeto.plano = res.plano;
    r.projeto.nomes = (Array.isArray(res.plano?.nomes) ? res.plano.nomes : []).map(String).slice(0, 5);
    setSt("plano", "ok"); await salvarAtual();
    const L = r.projeto.lei;
    const tarefas = CAMPOS[L].map(f => async () => {
      if (ctl.signal.aborted) return;
      setSt(f.k, "gerando");
      try { const x = await api("/api/ia", { acao: "campo", rid: r.id, k: f.k }, { signal: ctl.signal }); r.projeto.campos[f.k] = x.texto; setSt(f.k, "ok"); salvarAtual(); }
      catch (e) { if (e?.code === "cancelled") throw e; setSt(f.k, "erro"); if (["limite", "nao_liberado", "nao_autenticado"].includes(e?.code)) throw e; }
    });
    if (L === "esporte") tarefas.push(async () => {
      if (ctl.signal.aborted) return;
      setSt("metas", "gerando");
      try { const x = await api("/api/ia", { acao: "metas", rid: r.id }, { signal: ctl.signal }); r.projeto.metas = x.metas; setSt("metas", "ok"); salvarAtual(); }
      catch (e) { if (e?.code === "cancelled") throw e; setSt("metas", "erro"); }
    });
    await pool(tarefas, 3);
    r.projeto.geradoEm = Date.now(); await salvarAtual();
    toast("Projeto gerado. Revise cada campo antes de protocolar.");
  } catch (e) {
    if (e?.code !== "cancelled") { r.projeto.erro = aiErro(e); ctl.abort(); }
    else r.projeto.erro = "Geração interrompida. Os campos prontos foram mantidos; refaça os que faltam.";
    salvarAtual();
  } finally { S.gerando = null; renderResultado(); }
}

async function refazerCampo(k) {
  const r = S.atual; if (!r?.projeto || S.gerando) return;
  if (!r.projeto.plano) { gerarProjeto(); return; }
  const ctl = new AbortController(); S.gerando = ctl;
  r.projeto.erro = "";
  setSt(k, "gerando");
  try {
    await saveChain;
    if (k === "metas") r.projeto.metas = (await api("/api/ia", { acao: "metas", rid: r.id }, { signal: ctl.signal })).metas;
    else r.projeto.campos[k] = (await api("/api/ia", { acao: "campo", rid: r.id, k }, { signal: ctl.signal })).texto;
    setSt(k, "ok"); salvarAtual(); toast("Campo refeito");
  } catch (e) { setSt(k, "erro"); if (e?.code !== "cancelled") toast(aiErro(e)); }
  finally { S.gerando = null; renderResultado(); }
}

function renderResultado() {
  const r = S.atual; const box = $("#resultado");
  if (!r) { box.innerHTML = ""; return; }
  const g = r.diagnostico || {};
  const sit = g.situacao === "apto" ? ["ok", "Pode seguir"] : g.situacao === "inapto" ? ["bad", "Não enquadra como está"] : ["warn", "Precisa de ajustes"];
  const li = a => (Array.isArray(a) && a.length) ? "<ul>" + a.map(x => `<li>${esc(x)}</li>`).join("") + "</ul>" : '<p class="muted">—</p>';
  const orc = g.orcamento || {};
  const prot = !liberado(r.id);
  let html = `<div class="card stack${prot ? " protegido" : ""}">
    ${prot ? `<p class="aviso-prot"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Texto protegido. A cópia é liberada com a compra do projeto completo.</p>` : ""}
    <div class="item-head"><div class="stack" style="gap:6px"><span class="eyebrow">Diagnóstico gratuito</span><h2>${esc(r.titulo)}</h2></div>
      <div class="status-row">${leiChip(g.lei || r.lei)}<span class="chip ${sit[0]}"><span class="dot"></span>${sit[1]}</span></div></div>
    <p><strong>${esc(g.enquadramento || "")}</strong></p>
    <p class="muted">${esc(g.situacao_texto || "")}</p>
    <hr class="sep">
    <div class="stack"><h3>Resumo técnico</h3><p>${esc(g.resumo || "")}</p></div>
    <div class="grid2">
      <div class="stack"><h3>Pontos fortes</h3><div class="doc">${li(g.pontos_fortes)}</div></div>
      <div class="stack"><h3>Pontos de atenção</h3><div class="doc">${li(g.pontos_de_atencao)}</div></div>
    </div>
    <div class="lim"><span>Faixa de orçamento sugerida<br><span class="small muted">${esc(orc.comentario || "")}</span></span><span class="v num" style="font-size:1.05rem">${orc.minimo ? fmt0(orc.minimo) + " a " + fmt0(orc.maximo) : "—"}</span></div>
    <div class="grid2">
      <div class="stack"><h3>Documentos para reunir</h3><div class="doc">${li(g.documentos)}</div></div>
      <div class="stack"><h3>Próximos passos</h3><div class="doc">${li(g.proximos_passos)}</div></div>
    </div>
  </div>`;
  html += renderCompletoBox(r);
  const abertos = new Set($$("details.campo", box).filter(d => d.open).map(d => d.dataset.k));
  const tinha = $$("details.campo", box).length > 0;
  box.innerHTML = html;
  if (tinha) $$("details.campo", box).forEach(d => d.open = abertos.has(d.dataset.k));
  bindResultado();
}

/* ================== Exibição do projeto ================== */
function contador(n, lim) {
  const cls = n > lim ? "bad" : n >= lim * 0.9 ? "ok" : "warn";
  return `<span class="chip ${cls} num">${n.toLocaleString("pt-BR")} / ${lim.toLocaleString("pt-BR")}</span>`;
}
function stChip(s) { return s === "ok" ? '<span class="chip ok">Pronto</span>' : s === "gerando" ? '<span class="chip warn"><span class="dot"></span>Escrevendo…</span>' : s === "erro" ? '<span class="chip bad">Falhou</span>' : '<span class="chip">Na fila</span>'; }

function renderCompletoBox(r) {
  const lei = leiDoProjeto(r);
  const lista = CAMPOS[lei].map(f => `${f.t} (${f.lim.toLocaleString("pt-BR")} caracteres)`);
  lista.unshift("5 sugestões de nome");
  if (lei === "esporte") { lista.splice(2, 0, `Período de execução previsto: ${PERIODO_ESPORTE}`); lista.push("3 metas qualitativas e 3 quantitativas, com indicador e instrumento de verificação (400 caracteres cada)"); }
  const sistema = lei === "cultura" ? "SALIC · Lei Rouanet" : "SLI · Ministério do Esporte";

  if (r.projeto) return renderProjeto(r, lei, sistema);

  if (liberado(r.id)) {
    return `<div class="card stack" id="completo">
      <span class="eyebrow">Projeto liberado · ${sistema}</span>
      <h3>Gerar o projeto campo a campo para protocolar</h3>
      <p class="muted">A IA redige cada campo do formulário oficial, usando quase todo o limite de caracteres de cada um. Leva de 5 a 10 minutos; os campos prontos ficam salvos mesmo se você sair.</p>
      <div class="doc"><ul>${lista.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="row"><button class="btn btn-primary" id="pc-gerar">Gerar projeto completo</button></div>
    </div>`;
  }
  const p = pedidoDe(r.id); const c = S.config || {}; const preco = parseBRL(c.preco);
  return `<div class="card stack lock" id="completo">
    <span class="eyebrow">Projeto completo · ${sistema}</span>
    <h3>Receba o projeto pronto para protocolar${preco ? ` por <span class="num">${fmt(preco)}</span>` : ""}</h3>
    <p class="muted small">Todos os campos do formulário oficial, redigidos perto do limite de caracteres de cada um:</p>
    <div class="doc"><ul>${lista.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
    ${c.cond ? `<p class="small">Pagamento: ${esc(c.cond)}</p>` : ""}
    ${p ? `<p class="notice ok small">Pedido registrado em ${dateBR(Date.parse(p.created_at))}. ${esc(c.msg || "Assim que o pagamento for confirmado, o botão para gerar o projeto aparece aqui.")}</p>` : ""}
    <div class="row"><button class="btn btn-sun" id="pc-pedir">${p ? "Pagar agora" : "Comprar projeto completo"}</button></div>
    ${contatoCancao()}
  </div>`;
}

function renderProjeto(r, lei, sistema) {
  const P = r.projeto; const st = P.status || {}; const gerando = !!S.gerando;
  const campos = CAMPOS[lei];
  const etapas = [["plano", "Plano-base e nomes"], ...campos.map(f => [f.k, f.t]), ...(lei === "esporte" ? [["metas", "Metas qualitativas e quantitativas"]] : [])];
  const prontos = etapas.filter(([k]) => st[k] === "ok" || (k !== "plano" && k !== "metas" && P.campos?.[k]) || (k === "metas" && P.metas)).length;
  let h = `<div class="card stack" id="completo">
    <div class="item-head"><div class="stack" style="gap:6px"><span class="eyebrow">Projeto para protocolo · ${sistema}</span><h2>${esc(nomeProjeto(r))}</h2></div>
      <div class="row">${P.geradoEm && !gerando ? `<button class="btn btn-ghost btn-sm" id="pc-md">Baixar .md</button><button class="btn btn-ghost btn-sm" id="pc-html">Baixar para Word</button>` : ""}${!gerando && liberado(r.id) ? `<button class="btn btn-ghost btn-sm" id="pc-regen">Gerar tudo de novo</button>` : ""}</div></div>`;
  if (gerando || !P.geradoEm) {
    h += `<div class="stack"><div class="row" style="justify-content:space-between"><span class="small muted">${prontos} de ${etapas.length} etapas prontas${gerando ? " · pode levar alguns minutos" : ""}</span>${gerando ? '<button class="btn btn-ghost btn-sm" id="pc-stop">Parar</button>' : ""}</div>
      <div class="bar"><i style="width:${Math.round(prontos / etapas.length * 100)}%"></i></div>
      <div class="prog">${etapas.map(([k, t]) => `<div class="row" style="justify-content:space-between"><span class="small">${esc(t)}</span>${stChip(st[k] || ((k === "metas" ? P.metas : P.campos?.[k]) ? "ok" : ""))}</div>`).join("")}</div></div>`;
  }
  if (P.erro) h += `<p class="notice bad small">${esc(P.erro)}</p>`;
  if (P.nomes?.length) {
    h += `<div class="stack"><h3>Sugestões de nome</h3><div class="choice nomes">${P.nomes.map((n, i) => `<label><input type="radio" name="nome-escolhido" value="${i}" ${i === (P.nomeEscolhido || 0) ? "checked" : ""}><b style="font-size:1.1rem">${esc(n)}</b><span class="small muted">${i === (P.nomeEscolhido || 0) ? "Nome escolhido" : "Usar este nome"}</span></label>`).join("")}</div></div>`;
  }
  if (lei === "esporte") h += `<div class="lim"><span>Período de execução previsto</span><span class="v">${PERIODO_ESPORTE}</span></div>`;
  h += campos.map((f, i) => campoCard(f, P.campos?.[f.k], st[f.k], i === 0)).join("");
  if (lei === "esporte") h += metasCard(P.metas, st.metas);
  h += `<p class="notice sun small">Revise os trechos com [PREENCHER] e [NOME A DEFINIR] e confira valores e datas antes de protocolar. Os contadores mostram os caracteres exatamente como o sistema conta, com espaços.</p></div>`;
  return h;
}
function campoCard(f, txt, st, open) {
  const n = cnt(txt);
  return `<details class="campo" data-k="${f.k}" ${open ? "open" : ""}>
    <summary><span class="stack" style="gap:2px"><span class="eyebrow">${esc(f.q)}</span><strong class="campo-t">${esc(f.t)}</strong></span><span class="status-row">${txt ? contador(n, f.lim) : stChip(st)}</span></summary>
    ${txt ? `<div class="campo-txt" id="txt-${f.k}">${esc(txt)}</div>` : `<p class="small muted">${st === "gerando" ? "Escrevendo este campo…" : st === "erro" ? "Este campo não foi gerado." : "Aguardando."}</p>`}
    <div class="row">${txt ? `<button class="btn btn-ghost btn-sm" data-copy="${f.k}">Copiar</button>` : ""}<a class="ajuda" href="${esc(gLink(`como preencher campo ${f.t} ${S.atual?.projeto?.lei === "esporte" ? "SLI Lei de Incentivo ao Esporte" : "SALIC Lei Rouanet"} exemplo`))}" target="_blank" rel="noopener">${LUPA}Ver orientações no Google</a>${!S.gerando && liberado(S.atual?.id) ? `<button class="btn btn-ghost btn-sm" data-refazer="${f.k}">${txt ? "Refazer campo" : "Gerar este campo"}</button>` : ""}</div>
  </details>`;
}
function metasCard(m, st) {
  const bloco = (g, titulo, desc) => (m?.[g] || []).map((x, i) => `<div class="meta-box stack">
      <strong>${titulo} ${i + 1}</strong>
      ${[["meta", "Meta"], ["indicador", "Indicador da meta"], ["instrumento", "Instrumento de verificação"]].map(([k, lab]) => `<div class="stack" style="gap:6px"><div class="row" style="justify-content:space-between"><span class="eyebrow">${lab}</span><span class="row">${contador(cnt(x[k]), META_LIM)}<button class="btn btn-ghost btn-sm" data-copy="meta-${g}-${i}-${k}">Copiar</button></span></div><div class="campo-txt" id="txt-meta-${g}-${i}-${k}">${esc(x[k])}</div></div>`).join("")}
    </div>`).join("");
  return `<details class="campo" data-k="metas" ${m ? "open" : ""}>
    <summary><span class="stack" style="gap:2px"><span class="eyebrow">6 METAS · 400 CARACTERES POR TEXTO</span><strong class="campo-t">Metas qualitativas e quantitativas</strong></span><span class="status-row">${m ? '<span class="chip ok">Pronto</span>' : stChip(st)}</span></summary>
    ${m ? `<p class="small muted">Qualitativas: não numéricas, medidas por indicadores numéricos, percentuais ou situacionais. Quantitativas: numéricas e diretamente mensuráveis.</p>${bloco("qualitativas", "Meta qualitativa")}${bloco("quantitativas", "Meta quantitativa")}` : `<p class="small muted">${st === "gerando" ? "Escrevendo as metas…" : st === "erro" ? "As metas não foram geradas." : "Aguardando."}</p>`}
    <div class="row">${!S.gerando && liberado(S.atual?.id) ? `<button class="btn btn-ghost btn-sm" data-refazer="metas">${m ? "Refazer metas" : "Gerar metas"}</button>` : ""}</div>
  </details>`;
}

function contatoCancao() {
  const c = S.config || {};
  if (!c.whats && !c.mail) return "";
  return `<p class="small">Fale com a Canção: ${c.whats ? `WhatsApp <span class="num" style="user-select:all">${esc(c.whats)}</span>` : ""}${c.whats && c.mail ? " · " : ""}${c.mail ? `<span style="user-select:all">${esc(c.mail)}</span>` : ""}</p>`;
}

async function copiar(texto, el) {
  try { await navigator.clipboard.writeText(texto); toast("Copiado · " + cnt(texto).toLocaleString("pt-BR") + " caracteres"); }
  catch { if (el) { const s = getSelection(), rg = document.createRange(); rg.selectNodeContents(el); s.removeAllRanges(); s.addRange(rg); } toast("Texto selecionado: use Ctrl+C"); }
}
function projetoMarkdown(r) {
  const P = r.projeto; const lei = P.lei; const L = [];
  L.push(`# ${nomeProjeto(r)}`, "", `${lei === "cultura" ? "Proposta cultural · SALIC (Lei Rouanet)" : "Projeto · SLI (Ministério do Esporte)"} · gerado pela Canção Incentiva em ${dateBR(P.geradoEm || Date.now())}`, "");
  if (P.nomes?.length) { L.push("## Sugestões de nome", ""); P.nomes.forEach((n, i) => L.push(`${i + 1}. ${n}${i === (P.nomeEscolhido || 0) ? " (escolhido)" : ""}`)); L.push(""); }
  if (lei === "esporte") L.push(`## Período de execução previsto`, "", PERIODO_ESPORTE, "");
  CAMPOS[lei].forEach(f => { const t = P.campos?.[f.k] || ""; L.push(`## ${f.t}`, "", `Pergunta-chave: ${f.q} · ${cnt(t)} de ${f.lim} caracteres`, "", t, ""); });
  if (lei === "esporte" && P.metas) {
    [["qualitativas", "Meta qualitativa"], ["quantitativas", "Meta quantitativa"]].forEach(([g, tt]) => (P.metas[g] || []).forEach((x, i) => {
      L.push(`## ${tt} ${i + 1}`, "", x.meta, "", `Indicador: ${x.indicador}`, "", `Instrumento de verificação: ${x.instrumento}`, "");
    }));
  }
  return L.join("\n");
}
function projetoHTML(r) {
  const P = r.projeto; const lei = P.lei;
  const bloco = (t, sub, txt) => `<h2>${esc(t)}</h2>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}<div class="t">${esc(txt || "")}</div>`;
  let b = `<h1>${esc(nomeProjeto(r))}</h1><p class="sub">${lei === "cultura" ? "Proposta cultural · SALIC (Lei Rouanet)" : "Projeto · SLI (Ministério do Esporte)"}</p>`;
  if (P.nomes?.length) b += `<h2>Sugestões de nome</h2><ol>${P.nomes.map(n => `<li>${esc(n)}</li>`).join("")}</ol>`;
  if (lei === "esporte") b += bloco("Período de execução previsto", "", PERIODO_ESPORTE);
  CAMPOS[lei].forEach(f => { const t = P.campos?.[f.k] || ""; b += bloco(f.t, `Pergunta-chave: ${f.q} · ${cnt(t)} de ${f.lim} caracteres`, t); });
  if (lei === "esporte" && P.metas) [["qualitativas", "Meta qualitativa"], ["quantitativas", "Meta quantitativa"]].forEach(([g, tt]) => (P.metas[g] || []).forEach((x, i) => {
    b += `<h2>${tt} ${i + 1}</h2><div class="t">${esc(x.meta)}</div><h3>Indicador</h3><div class="t">${esc(x.indicador)}</div><h3>Instrumento de verificação</h3><div class="t">${esc(x.instrumento)}</div>`;
  }));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(nomeProjeto(r))}</title><style>body{font-family:Calibri,Arial,sans-serif;max-width:820px;margin:32px auto;line-height:1.5;padding:0 16px;color:#111}h1{font-size:24px}h2{font-size:18px;margin-top:28px;border-bottom:1px solid #b8963f;padding-bottom:4px}h3{font-size:15px}.sub{color:#666;font-size:13px}.t{white-space:pre-wrap}</style></head><body>${b}</body></html>`;
}

function bindResultado() {
  const r = S.atual; if (!r) return;
  const box = $("#resultado");
  const pedir = $("#pc-pedir"); if (pedir) pedir.onclick = () => abrirCompra(r);
  const gerar = $("#pc-gerar"); if (gerar) gerar.onclick = () => gerarProjeto();
  const regen = $("#pc-regen"); if (regen) regen.onclick = () => { if (regen.dataset.conf !== "1") { regen.dataset.conf = "1"; regen.textContent = "Confirmar: substituir todos os campos"; return; } gerarProjeto(); };
  const stop = $("#pc-stop"); if (stop) stop.onclick = () => S.gerando?.abort();
  $$('input[name="nome-escolhido"]', box).forEach(x => x.onchange = () => { r.projeto.nomeEscolhido = Number(x.value); salvarAtual(); renderResultado(); });
  $$("[data-copy]", box).forEach(b => b.onclick = () => {
    const k = b.dataset.copy; let t = "";
    if (k.startsWith("meta-")) { const [, g, i, f] = k.split("-"); t = r.projeto?.metas?.[g]?.[Number(i)]?.[f] || ""; }
    else t = r.projeto?.campos?.[k] || "";
    copiar(t, $("#txt-" + k));
  });
  $$("[data-refazer]", box).forEach(b => b.onclick = () => refazerCampo(b.dataset.refazer));
  const fn = nomeProjeto(r).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "projeto";
  const dm = $("#pc-md"); if (dm) dm.onclick = () => baixar(fn + ".md", projetoMarkdown(r));
  const dh = $("#pc-html"); if (dh) dh.onclick = () => baixar(fn + ".html", projetoHTML(r));
}
/* Lista de rascunhos do usuário */
function renderRascunhos() {
  const box = $("#rascunhos-box");
  if (!S.rascunhos.length) { box.innerHTML = ""; return; }
  const itens = S.rascunhos.slice().sort((a, b) => b.criadoEm - a.criadoEm).map(r => {
    const p = pedidoDe(r.id);
    const st = r.projeto?.geradoEm ? '<span class="chip ok">Projeto gerado</span>' : r.projeto ? '<span class="chip warn">Projeto incompleto</span>' : liberado(r.id) ? '<span class="chip ok">Liberado</span>' : p ? '<span class="chip warn">Aguardando liberação</span>' : '<span class="chip">Diagnóstico</span>';
    return `<button class="card flat item" data-rasc="${esc(r.id)}" style="text-align:left;cursor:pointer;font:inherit;color:inherit">
      <div class="item-head"><strong>${esc(r.titulo)}</strong><div class="status-row">${leiChip(r.lei)}${st}</div></div>
      <span class="small muted">Criado em ${dateBR(r.criadoEm)}</span></button>`;
  }).join("");
  box.innerHTML = `<details class="card stack" ${S.atual ? "" : "open"}><summary style="cursor:pointer;font-weight:700">Meus projetos (${S.rascunhos.length})</summary><div class="stack" style="margin-top:12px">${itens}</div></details>`;
  $$("[data-rasc]", box).forEach(b => b.onclick = () => {
    const r = S.rascunhos.find(x => x.id === b.dataset.rasc); if (!r) return;
    S.atual = clone(r); wLoad(r.respostas); wShow(W_LAST); renderResultado();
    $("#resultado").scrollIntoView({ behavior: "smooth" });
  });
}

function baixar(filename, data) {
  const tipo = filename.endsWith(".csv") ? "text/csv;charset=utf-8" : filename.endsWith(".html") ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8";
  const url = URL.createObjectURL(new Blob([data], { type: tipo }));
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/* ================== Sheet genérico ================== */
function openSheet(html, onBind, onClose) {
  const sh = $("#sheet"), inn = $("#sheet-in");
  inn.innerHTML = html; sh.hidden = false;
  const close = () => { if (sh.hidden) return; sh.hidden = true; inn.innerHTML = ""; onClose && onClose(); };
  $$("[data-close]", inn).forEach(b => b.onclick = close);
  sh.onclick = e => { if (e.target === sh) close(); };
  document.onkeydown = e => { if (e.key === "Escape" && !sh.hidden) close(); };
  onBind && onBind(inn, close);
  const f = inn.querySelector("input,select,textarea,button:not([data-close])"); f && f.focus();
}

/* ================== Contato de empresários (sem cadastro) ================== */
function abrirLead(pre = {}) {
  const p = S.perfil || {};
  openSheet(`<div class="sheet-head"><div><span class="eyebrow">Receber contato</span><h2 id="sheet-title">Quero destinar parte do meu imposto</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
    ${pre.projeto ? `<div class="notice">Projeto de interesse: <strong>${esc(pre.projeto.nome)}</strong></div>` : ""}
    <form class="stack" id="ld-form" novalidate>
      <div class="grid2">
        <label class="f">Seu nome<input type="text" id="ld-nome" autocomplete="name" value="${esc(p.nome || "")}" required></label>
        <label class="f">Empresa<span class="hint">Deixe em branco se for pessoa física.</span><input type="text" id="ld-emp" autocomplete="organization"></label>
        <label class="f">WhatsApp<input type="tel" id="ld-whats" autocomplete="tel" value="${esc(p.whats || "")}" required></label>
        <label class="f">E-mail<input type="email" id="ld-mail" autocomplete="email" value="${esc(S.user?.email || "")}"></label>
        <label class="f">Quanto pretende destinar<span class="money"><input type="text" inputmode="decimal" id="ld-valor" value="${pre.valor ? moneyStr(pre.valor) : ""}"></span></label>
        <label class="f">Interesse<select id="ld-int"><option value="ambos">Cultura e esporte</option><option value="cultura">Cultura</option><option value="esporte">Esporte</option></select></label>
      </div>
      <label class="f">Mensagem<textarea id="ld-msg" placeholder="Ex.: queremos apoiar projetos em Maringá com crianças"></textarea></label>
      <p class="notice bad" id="ld-err" hidden></p>
      <button class="btn btn-sun" type="submit">Enviar e receber contato</button>
    </form>`,
    (inn, close) => {
      if (pre.projeto) $("#ld-int", inn).value = pre.projeto.lei || "ambos";
      $("#ld-form", inn).onsubmit = async e => {
        e.preventDefault();
        const g = id => $(id, inn).value.trim();
        const lead = { nome: g("#ld-nome"), empresa: g("#ld-emp"), whats: g("#ld-whats"), mail: g("#ld-mail"), valor: parseBRL(g("#ld-valor")), interesse: g("#ld-int"), msg: g("#ld-msg"), projetoId: pre.projeto?.id || "", projetoNome: pre.projeto?.nome || "", calculo: pre.calculo || null };
        const err = $("#ld-err", inn);
        if (!lead.nome || !lead.whats) { err.textContent = "Informe nome e WhatsApp."; err.hidden = false; return; }
        if (!S.sb) { err.textContent = "O site ainda está sendo configurado. Fale com a Canção pelo WhatsApp."; err.hidden = false; return; }
        const { error } = await S.sb.from("leads").insert({ data: lead, status: "novo" });
        if (error) { err.textContent = "Não foi possível enviar agora. Tente de novo em instantes."; err.hidden = false; return; }
        close(); toast("Recebemos seu contato. A Canção vai falar com você em breve.");
        if (S.isAdmin) { await carregarAdmin(); refreshAll(); }
      };
    });
}

/* ================== Captar: formulário ================== */
const C_IDS = { nome: "c-nome", lei: "c-lei", numero: "c-numero", segmento: "c-seg", proponente: "c-prop", doc: "c-doc", cidade: "c-cidade", uf: "c-uf", aprovado: "c-aprov", captado: "c-capt", prazo: "c-prazo", link: "c-link", resumo: "c-resumo", contrapartidas: "c-contra", contatoNome: "c-cnome", contatoWhats: "c-cwhats", contatoMail: "c-cmail" };
let cMode = { tipo: "envio", id: null }; // envio | vitrine (gestão)
function cData() { const o = {}; for (const [k, id] of Object.entries(C_IDS)) o[k] = $("#" + id).value.trim(); o.aprovado = parseBRL(o.aprovado); o.captado = parseBRL(o.captado); return o; }
function cLoad(p) { p = p || {}; fillSeg($("#c-seg"), p.lei || ""); for (const [k, id] of Object.entries(C_IDS)) { let v = p[k] ?? ""; if ((k === "aprovado" || k === "captado") && v !== "") v = moneyStr(v); $("#" + id).value = v; } $("#c-decl").checked = !!p.nome; }
$("#c-lei").addEventListener("change", e => fillSeg($("#c-seg"), e.target.value));
$("#c-cancel").onclick = () => { cMode = { tipo: "envio", id: null }; cLoad({}); $("#c-cancel").hidden = true; $("#cform-title").textContent = "Dados do projeto"; $("#c-submit").textContent = "Enviar para análise"; if (S.isAdmin && S.view === "captar") go("admin"); };
$("#cform").addEventListener("submit", async e => {
  e.preventDefault();
  const p = cData(); const err = $("#c-err"); err.hidden = true;
  const miss = [];
  if (!p.nome) miss.push("nome"); if (!p.lei) miss.push("lei"); if (!p.numero) miss.push("nº PRONAC/processo"); if (!p.proponente) miss.push("proponente"); if (!p.cidade || !p.uf) miss.push("cidade e estado"); if (!p.aprovado) miss.push("valor aprovado"); if (!p.prazo) miss.push("prazo"); if (!p.resumo) miss.push("resumo"); if (!p.contatoNome || !p.contatoWhats) miss.push("contato");
  if (cMode.tipo === "envio" && !$("#c-decl").checked) miss.push("declaração");
  if (miss.length) { err.textContent = "Falta preencher: " + miss.join(", ") + "."; err.hidden = false; return; }
  if (!(await garantirLogin("Para enviar seu projeto para a vitrine, crie sua conta. Assim você acompanha a análise."))) return;
  const btn = $("#c-submit"); btn.disabled = true;
  try {
    if (cMode.tipo === "vitrine") {
      const q = cMode.id ? S.sb.from("vitrine").update({ data: p, atualizado_em: new Date().toISOString() }).eq("id", cMode.id) : S.sb.from("vitrine").insert({ data: p });
      const { error } = await q; if (error) throw error;
      toast("Vitrine atualizada"); await carregarPublico(); $("#c-cancel").click(); S.adminTab = "vitrine"; go("admin");
    } else {
      const q = cMode.id ? S.sb.from("projetos_captacao").update({ data: p, status: "analise", nota: null }).eq("id", cMode.id) : S.sb.from("projetos_captacao").insert({ data: p, status: "analise" });
      const { error } = await q; if (error) throw error;
      toast("Projeto enviado para análise"); cMode = { tipo: "envio", id: null }; cLoad({}); $("#c-cancel").hidden = true;
      await carregarUsuario(); refreshAll(); window.scrollTo({ top: 0, behavior: "smooth" });
    }
  } catch (e2) { console.warn(e2); err.textContent = "Não foi possível salvar. Tente de novo em instantes."; err.hidden = false; }
  finally { btn.disabled = false; }
});

function renderMeusEnvios() {
  const box = $("#meus-envios"); const lista = S.meusProjetos || [];
  if (!lista.length) { box.innerHTML = ""; return; }
  const st = { analise: ["warn", "Em análise"], aprovado: ["ok", "Publicado na vitrine"], recusado: ["bad", "Precisa de correção"], removido: ["", "Retirado da vitrine"] };
  box.innerHTML = `<div class="card stack"><h3>Meus projetos enviados</h3>${lista.slice().reverse().map(p => {
    const s = st[p.status] || st.analise;
    return `<div class="item card flat"><div class="item-head"><div class="stack" style="gap:4px"><strong>${esc(p.nome)}</strong><span class="pronac">${p.lei === "cultura" ? "PRONAC" : "Processo"} ${esc(p.numero)}</span></div><div class="status-row">${leiChip(p.lei)}<span class="chip ${s[0]}"><span class="dot"></span>${s[1]}</span></div></div>
      ${p.nota ? `<p class="small notice">${esc(p.nota)}</p>` : ""}
      ${p.status === "recusado" ? `<div><button class="btn btn-ghost btn-sm" data-edit-envio="${esc(p.id)}">Corrigir e reenviar</button></div>` : ""}</div>`;
  }).join("")}</div>`;
  $$("[data-edit-envio]", box).forEach(b => b.onclick = () => {
    const p = lista.find(x => x.id === b.dataset.editEnvio); cMode = { tipo: "envio", id: p.id }; cLoad(p);
    $("#c-cancel").hidden = false; $("#cform-title").textContent = "Corrigir projeto"; $("#cform").scrollIntoView({ behavior: "smooth" });
  });
}

/* ================== Gestão (Canção) ================== */
function updCounts() {
  const A = S.adm;
  const n = { analise: A.projetos.filter(p => p.status === "analise").length, leads: A.leads.filter(l => l.status === "novo").length, pedidos: A.pedidos.filter(p => p.status === "aguardando").length };
  for (const k in n) { const el = $("#n-" + k); el.textContent = n[k]; el.hidden = !n[k]; }
}
$$("#a-tabs button").forEach(b => b.onclick = () => { S.adminTab = b.dataset.tab; renderAdmin(); });
function wa(n) { const d = String(n || "").replace(/\D/g, ""); return d ? `https://wa.me/${d.length <= 11 ? "55" + d : d}` : ""; }
const quem = uid => { const p = S.adm.perfis[uid]; return p ? `${p.nome || "Sem nome"} · ${p.email || ""}` : ""; };

async function atualizarAdmin() { await Promise.all([carregarAdmin(), carregarPublico()]); refreshAll(); }

function renderAdmin() {
  if (!S.isAdmin) return;
  updCounts();
  $$("#a-tabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === S.adminTab ? "true" : "false"));
  const body = $("#a-body"); const cfg = $("#cfg"); cfg.hidden = S.adminTab !== "config"; body.hidden = S.adminTab === "config";
  const vazio = t => `<div class="card empty"><p class="muted">${t}</p></div>`;
  const A = S.adm;
  if (S.adminTab === "analise") {
    const l = A.projetos.filter(p => p.status === "analise");
    body.innerHTML = l.length ? l.map(p => `<div class="card item">
      <div class="item-head"><div class="stack" style="gap:4px"><h3>${esc(p.nome)}</h3><span class="pronac">${p.lei === "cultura" ? "PRONAC" : "Processo"} ${esc(p.numero)} · enviado em ${dateBR(p.criadoEm)} · ${esc(quem(p._uid))}</span></div>${leiChip(p.lei)}</div>
      <dl class="kv"><dt>Proponente</dt><dd>${esc(p.proponente)} ${p.doc ? "· " + esc(p.doc) : ""}</dd><dt>Local</dt><dd>${esc(p.cidade)}/${esc(p.uf)}</dd><dt>Aprovado</dt><dd class="num">${fmt(p.aprovado)}</dd><dt>Captado</dt><dd class="num">${fmt(p.captado)}</dd><dt>Prazo</dt><dd>${dateBR(p.prazo)}</dd><dt>Contato</dt><dd>${esc(p.contatoNome)} · <span class="num">${esc(p.contatoWhats)}</span></dd></dl>
      <p class="small">${esc(p.resumo)}</p>
      ${p.link ? `<a class="small" href="${esc(p.link)}" target="_blank" rel="noopener">Conferir publicação ↗</a>` : '<span class="small muted">Sem link de publicação: confira no SALIC ou no DOU.</span>'}
      <label class="f small">Observação ao proponente (opcional)<input type="text" data-nota="${esc(p.id)}"></label>
      <div class="row"><button class="btn btn-primary btn-sm" data-aprovar="${esc(p.id)}">Aprovar e publicar</button><button class="btn btn-danger btn-sm" data-recusar="${esc(p.id)}">Devolver para correção</button></div>
    </div>`).join("") : vazio("Nenhum projeto aguardando análise.");
    $$("[data-aprovar]", body).forEach(b => b.onclick = () => decidir(b.dataset.aprovar, true, b));
    $$("[data-recusar]", body).forEach(b => b.onclick = () => decidir(b.dataset.recusar, false, b));
  } else if (S.adminTab === "leads") {
    body.innerHTML = A.leads.length ? A.leads.map(x => `<div class="card item">
      <div class="item-head"><div class="stack" style="gap:4px"><h3>${esc(x.nome)}${x.empresa ? " · " + esc(x.empresa) : ""}</h3><span class="small muted">${dateBR(x.criadoEm)} · ${x.empresa ? "Empresa" : "Pessoa física"} · interesse: ${esc(x.interesse)}</span></div><span class="chip ${x.status === "novo" ? "warn" : "ok"}">${x.status === "novo" ? "Novo" : "Contatado"}</span></div>
      <dl class="kv"><dt>WhatsApp</dt><dd class="num" style="user-select:all">${esc(x.whats)}</dd>${x.mail ? `<dt>E-mail</dt><dd style="user-select:all">${esc(x.mail)}</dd>` : ""}<dt>Pretende destinar</dt><dd class="num">${x.valor ? fmt(x.valor) : "—"}</dd>${x.projetoNome ? `<dt>Projeto</dt><dd>${esc(x.projetoNome)}</dd>` : ""}${x.calculo ? `<dt>Simulação</dt><dd class="num">${fmt(x.calculo.total)} (${x.calculo.tipo === "pj" ? "empresa" : "PF"})</dd>` : ""}</dl>
      ${x.msg ? `<p class="small">${esc(x.msg)}</p>` : ""}
      <div class="row">${wa(x.whats) ? `<a class="btn btn-primary btn-sm" href="${wa(x.whats)}" target="_blank" rel="noopener">Abrir WhatsApp ↗</a>` : ""}<button class="btn btn-ghost btn-sm" data-lead="${esc(x.id)}" data-st="${x.status === "novo" ? "contatado" : "novo"}">${x.status === "novo" ? "Marcar como contatado" : "Marcar como novo"}</button></div>
    </div>`).join("") : vazio("Nenhum contato recebido ainda.");
    $$("[data-lead]", body).forEach(b => b.onclick = async () => {
      b.disabled = true; const { error } = await S.sb.from("leads").update({ status: b.dataset.st }).eq("id", b.dataset.lead);
      if (error) { toast("Não foi possível atualizar"); b.disabled = false; return; } atualizarAdmin();
    });
  } else if (S.adminTab === "pedidos") {
    body.innerHTML = A.pedidos.length ? A.pedidos.map(x => `<div class="card item">
      <div class="item-head"><div class="stack" style="gap:4px"><h3>${esc(x.titulo || "Projeto")}</h3><span class="small muted">${esc(x.nome || "")} · pedido em ${dateBR(x.criadoEm)}${x.valor ? " · " + fmt(x.valor) : ""}</span></div><div class="status-row">${leiChip(x.lei)}<span class="chip ${x.status === "pago" ? "ok" : x.status === "cancelado" ? "bad" : "warn"}">${x.status === "pago" ? (x.forma === "mercadopago" ? "Pago no Mercado Pago" : "Liberado") : x.status === "cancelado" ? "Cancelado" : "Aguardando pagamento"}</span></div></div>
      <dl class="kv"><dt>WhatsApp</dt><dd class="num" style="user-select:all">${esc(x.whats || "—")}</dd><dt>E-mail</dt><dd style="user-select:all">${esc(x.email || "—")}</dd>${x.mp_payment_id ? `<dt>Pagamento MP</dt><dd class="num">${esc(x.mp_payment_id)}</dd>` : ""}</dl>
      <div class="row">${wa(x.whats) ? `<a class="btn btn-ghost btn-sm" href="${wa(x.whats)}" target="_blank" rel="noopener">WhatsApp ↗</a>` : ""}${x.status === "aguardando" ? `<button class="btn btn-primary btn-sm" data-liberar="${esc(x.id)}">Pagamento recebido · liberar</button><button class="btn btn-ghost btn-sm" data-cancelar="${esc(x.id)}">Cancelar pedido</button>` : ""}</div>
    </div>`).join("") : vazio("Nenhum pedido de projeto completo.");
    $$("[data-liberar]", body).forEach(b => b.onclick = async () => {
      b.disabled = true; const { error } = await S.sb.from("pedidos").update({ status: "pago", forma: "manual", pago_em: new Date().toISOString() }).eq("id", b.dataset.liberar);
      if (error) { toast("Não foi possível liberar"); b.disabled = false; return; } toast("Projeto liberado para o cliente"); atualizarAdmin();
    });
    $$("[data-cancelar]", body).forEach(b => b.onclick = async () => {
      if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "Confirmar cancelamento"; return; }
      const { error } = await S.sb.from("pedidos").update({ status: "cancelado" }).eq("id", b.dataset.cancelar);
      if (error) { toast("Não foi possível cancelar"); return; } atualizarAdmin();
    });
  } else if (S.adminTab === "vitrine") {
    const l = S.vitrine;
    body.innerHTML = `<div class="row"><button class="btn btn-primary btn-sm" id="a-novo">Adicionar projeto da Canção</button></div>` + (l.length ? l.map(p => `<div class="card item">
      <div class="item-head"><div class="stack" style="gap:4px"><h3>${esc(p.nome)}</h3><span class="pronac">${esc(p.numero)} · capta até ${dateBR(p.prazo)}</span></div>${leiChip(p.lei)}</div>
      <div class="row"><label class="f small" style="flex:1;min-width:180px">Valor já captado<span class="money"><input type="text" inputmode="decimal" value="${moneyStr(p.captado)}" data-capt="${esc(p.id)}"></span></label>
      <span class="small muted">de <span class="num">${fmt(p.aprovado)}</span></span></div>
      <div class="row"><button class="btn btn-ghost btn-sm" data-salvar-capt="${esc(p.id)}">Salvar captado</button><button class="btn btn-ghost btn-sm" data-editar="${esc(p.id)}">Editar</button><button class="btn btn-danger btn-sm" data-remover="${esc(p.id)}">Retirar da vitrine</button></div>
    </div>`).join("") : vazio("A vitrine está vazia. Aprove envios ou adicione projetos da Canção."));
    $("#a-novo").onclick = () => { cMode = { tipo: "vitrine", id: null }; cLoad({}); prepEdicaoVitrine("Novo projeto na vitrine"); };
    $$("[data-salvar-capt]", body).forEach(b => b.onclick = async () => {
      const id = b.dataset.salvarCapt; const p = S.vitrine.find(x => x.id === id);
      const v = parseBRL($(`[data-capt="${CSS.escape(id)}"]`, body).value);
      const { id: _i, origemId, publicadoEm, ...dados } = p;
      const { error } = await S.sb.from("vitrine").update({ data: { ...dados, captado: v }, atualizado_em: new Date().toISOString() }).eq("id", id);
      if (error) { toast("Não foi possível salvar"); return; } toast("Valor captado atualizado"); atualizarAdmin();
    });
    $$("[data-editar]", body).forEach(b => b.onclick = () => { const p = S.vitrine.find(x => x.id === b.dataset.editar); cMode = { tipo: "vitrine", id: p.id }; cLoad(p); prepEdicaoVitrine("Editar projeto da vitrine"); });
    $$("[data-remover]", body).forEach(b => b.onclick = async () => {
      if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "Confirmar retirada"; return; }
      const p = S.vitrine.find(x => x.id === b.dataset.remover);
      const { error } = await S.sb.from("vitrine").delete().eq("id", p.id);
      if (error) { toast("Não foi possível retirar"); return; }
      if (p.origemId) await S.sb.from("projetos_captacao").update({ status: "removido" }).eq("id", p.origemId);
      toast("Projeto retirado da vitrine"); atualizarAdmin();
    });
  }
}
function prepEdicaoVitrine(t) { $("#cform-title").textContent = t; $("#c-submit").textContent = "Salvar na vitrine"; $("#c-cancel").hidden = false; go("captar"); setTimeout(() => $("#cform").scrollIntoView({ behavior: "smooth" }), 50); }

async function decidir(id, aprovar, btn) {
  btn.disabled = true;
  const nota = ($(`[data-nota="${CSS.escape(id)}"]`)?.value || "").trim();
  const p = S.adm.projetos.find(x => x.id === id);
  try {
    const { error } = await S.sb.from("projetos_captacao").update({ status: aprovar ? "aprovado" : "recusado", nota: nota || null }).eq("id", id);
    if (error) throw error;
    if (aprovar) {
      const { id: _i, _uid, status, nota: _n, criadoEm, ...dados } = p;
      const ins = await S.sb.from("vitrine").insert({ origem_id: id, data: dados });
      if (ins.error) throw ins.error;
    }
    toast(aprovar ? "Projeto publicado na vitrine" : "Projeto devolvido ao proponente"); atualizarAdmin();
  } catch (e) { console.warn(e); toast("Não foi possível concluir"); btn.disabled = false; }
}

$("#cfg").addEventListener("submit", async e => {
  e.preventDefault();
  const c = { preco: parseBRL($("#g-preco").value), whats: $("#g-whats").value.trim(), mail: $("#g-mail").value.trim(), cond: $("#g-cond").value.trim(), msg: $("#g-msg").value.trim(), atualizadoEm: Date.now() };
  const { error } = await S.sb.from("config").update({ data: c }).eq("id", 1);
  if (error) { toast("Não foi possível salvar"); return; }
  toast("Configurações salvas"); await carregarPublico(); refreshAll();
});
function loadCfgForm() { const c = S.config || {}; $("#g-preco").value = c.preco ? moneyStr(c.preco) : ""; $("#g-whats").value = c.whats || ""; $("#g-mail").value = c.mail || ""; $("#g-cond").value = c.cond || ""; $("#g-msg").value = c.msg || ""; }

/* ================== Inicialização ================== */
function refreshAll() {
  renderConta(); renderVitrine(); renderMeusEnvios(); renderRascunhos();
  if (S.atual && !S.gerando) { const fresh = S.rascunhos.find(r => r.id === S.atual.id); if (fresh && !S.atual.projeto?.status) S.atual = clone(fresh); renderResultado(); }
  if (step === W_LAST) wReview();
  if (S.view === "admin") { if (S.isAdmin) renderAdmin(); else go("inicio"); } else if (S.isAdmin) updCounts();
}

async function boot() {
  fillUF($("#w-uf")); fillUF($("#c-uf")); fillUF($("#f-uf"), "Todos");
  fillSeg($("#c-seg"), "");
  const saved = store.get("ci-wizard", null);
  initNS(); wLoad(saved?.d || { uf: "PR" }); wShow(Math.min(saved?.step || 0, W_LAST));
  calc(); renderVitrine();
  const hash = (location.hash || "").replace("#", ""); go(VIEWS.includes(hash) ? hash : "inicio", false);
  window.scrollTo({ top: 0 });

  try { S.pub = await (await fetch("/api/config")).json(); } catch { S.pub = {}; }
  if (S.pub.supabaseUrl && S.pub.supabaseAnonKey && window.supabase) {
    S.sb = window.supabase.createClient(S.pub.supabaseUrl, S.pub.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    S.sb.auth.onAuthStateChange((ev, session) => {
      if (ev === "PASSWORD_RECOVERY") setTimeout(abrirNovaSenha, 300);
      const novo = session?.user || null;
      if ((novo?.id || null) !== (S.user?.id || null)) { S.user = novo; if (!novo) S.atual = null; carregarUsuario().then(refreshAll); }
    });
    const { data } = await S.sb.auth.getSession();
    S.user = data?.session?.user || null;
    await Promise.all([carregarPublico(), carregarUsuario()]);
  } else {
    $("#aviso-config").hidden = false;
  }
  S.ready = true;
  refreshAll();
  if (hash === "admin" && S.isAdmin) go("admin", false);

  const q = new URLSearchParams(location.search);
  if (q.get("pedido")) acompanharPagamento(q.get("pedido"), q.get("falhou") === "1");

  let ultimo = Date.now();
  addEventListener("focus", async () => { if (!S.sb || Date.now() - ultimo < 30000 || S.gerando) return; ultimo = Date.now(); await Promise.all([carregarPublico(), carregarUsuario()]); refreshAll(); });
}

/* ================== Vitrine ================== */
function projCard(p, compact) {
  const falta = Math.max(0, (p.aprovado || 0) - (p.captado || 0));
  const pct = p.aprovado ? Math.min(100, Math.round((p.captado || 0) / p.aprovado * 100)) : 0;
  const dias = daysTo(p.prazo);
  const prazoChip = dias == null ? "" : dias < 0 ? '<span class="chip bad">Prazo encerrado</span>' : dias <= 60 ? `<span class="chip warn">${dias} dias para captar</span>` : `<span class="chip">Capta até ${dateBR(p.prazo)}</span>`;
  return `<article class="card proj">
    <div class="status-row">${leiChip(p.lei)}${prazoChip}</div>
    <div class="stack" style="gap:4px"><h3>${esc(p.nome)}</h3><span class="pronac">${p.lei === "cultura" ? "PRONAC" : "Processo"} ${esc(p.numero)}</span></div>
    <div class="meta"><span>${esc(p.cidade)}/${esc(p.uf)}</span>${p.segmento ? `<span>${esc(p.segmento)}</span>` : ""}</div>
    ${compact ? "" : `<p class="small">${esc((p.resumo || "").slice(0, 180))}${(p.resumo || "").length > 180 ? "…" : ""}</p>`}
    <div class="stack" style="gap:6px"><div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <div class="row small" style="justify-content:space-between"><span class="muted">${pct}% captado</span><span>Falta <strong class="num">${fmt0(falta)}</strong></span></div></div>
    <div class="row"><button class="btn btn-ghost btn-sm" data-ver="${esc(p.id)}">Ver detalhes</button><button class="btn btn-sun btn-sm" data-apoiar="${esc(p.id)}">Quero apoiar</button></div>
  </article>`;
}
function bindProj(root) {
  $$("[data-apoiar]", root).forEach(b => b.onclick = () => { const p = S.vitrine.find(x => x.id === b.dataset.apoiar); abrirLead({ projeto: p }); });
  $$("[data-ver]", root).forEach(b => b.onclick = () => verProjeto(b.dataset.ver));
}
function verProjeto(id) {
  const p = S.vitrine.find(x => x.id === id); if (!p) return;
  const falta = Math.max(0, (p.aprovado || 0) - (p.captado || 0));
  openSheet(`<div class="sheet-head"><div class="stack" style="gap:6px"><div class="status-row">${leiChip(p.lei)}</div><h2 id="sheet-title">${esc(p.nome)}</h2><span class="pronac">${p.lei === "cultura" ? "PRONAC" : "Processo"} ${esc(p.numero)}</span></div><button class="x" data-close aria-label="Fechar">×</button></div>
    <dl class="kv"><dt>Proponente</dt><dd>${esc(p.proponente)}</dd><dt>Local</dt><dd>${esc(p.cidade)}/${esc(p.uf)}</dd><dt>Área</dt><dd>${esc(p.segmento || "—")}</dd><dt>Valor aprovado</dt><dd class="num">${fmt(p.aprovado)}</dd><dt>Já captado</dt><dd class="num">${fmt(p.captado)}</dd><dt>Falta captar</dt><dd class="num"><strong>${fmt(falta)}</strong></dd><dt>Prazo de captação</dt><dd>${dateBR(p.prazo)}</dd></dl>
    <div class="stack"><h3>Sobre o projeto</h3><p>${esc(p.resumo)}</p></div>
    ${p.contrapartidas ? `<div class="stack"><h3>Contrapartidas para o patrocinador</h3><p>${esc(p.contrapartidas)}</p></div>` : ""}
    ${p.link ? `<p class="small"><a href="${esc(p.link)}" target="_blank" rel="noopener">Ver publicação oficial ↗</a></p>` : ""}
    <button class="btn btn-sun" id="sv-apoiar">Quero apoiar este projeto</button>`,
    (inn, close) => { $("#sv-apoiar", inn).onclick = () => { close(); abrirLead({ projeto: p }); }; });
}
function vitrineAtiva() { return S.vitrine.filter(p => { const d = daysTo(p.prazo); return d == null || d >= 0; }); }
function renderVitrine() {
  const q = $("#f-q").value.trim().toLowerCase(), lei = $("#f-lei").value, uf = $("#f-uf").value, ord = $("#f-ord").value;
  let list = vitrineAtiva().filter(p => (!lei || p.lei === lei) && (!uf || p.uf === uf) && (!q || [p.nome, p.cidade, p.proponente, p.segmento, p.resumo].join(" ").toLowerCase().includes(q)));
  const falta = p => (p.aprovado || 0) - (p.captado || 0);
  list.sort(ord === "falta" ? (a, b) => falta(b) - falta(a) : ord === "novo" ? (a, b) => (b.publicadoEm || 0) - (a.publicadoEm || 0) : (a, b) => String(a.prazo || "9").localeCompare(String(b.prazo || "9")));
  const box = $("#projs");
  if (!S.ready) { box.innerHTML = `<div class="card empty" style="grid-column:1/-1"><div class="thinking"><i></i> Carregando projetos…</div></div>`; return; }
  if (!S.vitrine.length) {
    box.innerHTML = `<div class="card empty" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><h3>A vitrine ainda está vazia</h3><p class="muted small">Os projetos aparecem aqui depois de conferidos pela Canção. Tem um projeto aprovado?</p><button class="btn btn-primary btn-sm" data-go="captar">Enviar meu projeto</button></div>`;
    return;
  }
  box.innerHTML = list.length ? list.map(p => projCard(p)).join("") : `<div class="card empty" style="grid-column:1/-1"><h3>Nenhum projeto com esses filtros</h3><p class="muted small">Tente outra lei ou estado.</p></div>`;
  bindProj(box);
  // Home: destaques
  const home = $("#home-vitrine"); const dest = vitrineAtiva().slice(0, 3);
  home.innerHTML = dest.length ? `<div class="row" style="justify-content:space-between"><h3>Projetos captando agora</h3><button class="btn btn-ghost btn-sm" data-go="vitrine">Ver todos</button></div><div class="projs">${dest.map(p => projCard(p, true)).join("")}</div>` : "";
  bindProj(home);
}
["#f-q", "#f-lei", "#f-uf", "#f-ord"].forEach(s => $(s).addEventListener("input", renderVitrine));

/* ================== Calculadora ================== */
const K = { tipo: "pj", base: "lucro" };
function calc() {
  let cult = 0, esp = 0, base = 0, pc = "", pe = "", baseTxt = "";
  if (K.tipo === "pj") {
    const ano = Number($("#k-ano").value), incl = $("#k-incl").checked;
    base = K.base === "lucro" ? parseBRL($("#k-lucro").value) * 0.15 : parseBRL($("#k-irpj").value);
    const red = $("#k-lc224").checked ? 0.9 : 1;
    const pCult = 0.04 * red, pEsp = (incl ? 0.04 : (ano >= 2028 ? 0.03 : 0.02)) * red;
    const pct = p => (p * 100).toFixed(1).replace(".0", "").replace(".", ",") + "%";
    cult = base * pCult; esp = base * pEsp;
    pc = `${pct(pCult)} do IRPJ devido`; pe = `${pct(pEsp)} do IRPJ devido${incl ? " (inclusão social)" : ""}`;
    baseTxt = `IRPJ devido considerado: ${fmt(base)}${K.base === "lucro" ? " (15% do lucro real)" : ""}.`;
  } else {
    base = parseBRL($("#k-irpf").value); cult = base * 0.06; esp = base * 0.07;
    pc = "6% do IR devido"; pe = "7% do IR devido"; baseTxt = `Imposto devido considerado: ${fmt(base)}.`;
  }
  $("#k-c").textContent = fmt(cult); $("#k-e").textContent = fmt(esp); $("#k-t").textContent = fmt(cult + esp);
  $("#k-c-p").textContent = pc; $("#k-e-p").textContent = pe; $("#k-base").textContent = baseTxt;
  K.res = { tipo: K.tipo, base, cultura: cult, esporte: esp, total: cult + esp };
}
function segPress(on, off) { $(on).setAttribute("aria-pressed", "true"); $(off).setAttribute("aria-pressed", "false"); }
$("#k-pj").onclick = () => { K.tipo = "pj"; segPress("#k-pj", "#k-pf"); $("#k-pj-box").hidden = false; $("#k-pf-box").hidden = true; calc(); };
$("#k-pf").onclick = () => { K.tipo = "pf"; segPress("#k-pf", "#k-pj"); $("#k-pj-box").hidden = true; $("#k-pf-box").hidden = false; calc(); };
$("#k-b-lucro").onclick = () => { K.base = "lucro"; segPress("#k-b-lucro", "#k-b-irpj"); $("#k-lucro-l").hidden = false; $("#k-irpj-l").hidden = true; calc(); };
$("#k-b-irpj").onclick = () => { K.base = "irpj"; segPress("#k-b-irpj", "#k-b-lucro"); $("#k-lucro-l").hidden = true; $("#k-irpj-l").hidden = false; calc(); };
["#k-lucro", "#k-irpj", "#k-ano", "#k-incl", "#k-lc224", "#k-irpf"].forEach(s => $(s).addEventListener("input", calc));
$("#k-ano").addEventListener("change", calc); $("#k-incl").addEventListener("change", calc); $("#k-lc224").addEventListener("change", calc);
$("#k-lead").onclick = () => abrirLead({ valor: K.res?.total || 0, calculo: K.res });

/* Proteção contra cópia (revisão e diagnóstico, até a compra) */
function naProtecao(n) { const el = n && (n.nodeType === 1 ? n : n.parentElement); return !!el?.closest?.(".protegido"); }
function selecaoProtegida() { const s = getSelection(); return !!(s && s.rangeCount && (naProtecao(s.anchorNode) || naProtecao(s.focusNode))); }
["copy", "cut"].forEach(ev => document.addEventListener(ev, e => { if (selecaoProtegida() || naProtecao(e.target)) { e.preventDefault(); e.clipboardData?.setData("text/plain", ""); toast("A cópia é liberada com a compra do projeto completo"); } }));
["contextmenu", "selectstart", "dragstart"].forEach(ev => document.addEventListener(ev, e => { if (naProtecao(e.target)) { e.preventDefault(); if (ev === "contextmenu") toast("A cópia é liberada com a compra do projeto completo"); } }));

boot();
