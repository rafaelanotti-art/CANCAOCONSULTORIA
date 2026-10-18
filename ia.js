/* Todas as chamadas de IA passam por aqui. Os textos enviados à IA são montados no servidor,
   a partir das regras em public/regras.js, para que a chave da Anthropic não seja usada para outros fins. */
import { Falha, json, erro, exigirEnv, sb, usuario, ehAdmin, limitarUso, claude } from "../../lib/server.js";
import {
  promptDiagnostico, promptPlanilha, promptPlano, promptCampo, promptAjuste, promptMetas, promptAjusteMetas,
  CAMPOS, META_LIM, alvo, cnt, limpar, cortar, leiDoProjeto, metasFora, normMetas, lerJSON, categorias, UNIDADES
} from "../../public/regras.js";

const LIMITES = { diagnostico: 12, planilha: 12, projeto: 150 };
const MAX_RESPOSTAS = 60000;

function checarRespostas(d) {
  if (!d || typeof d !== "object") throw new Falha(400, "invalido", "Respostas ausentes.");
  if (JSON.stringify(d).length > MAX_RESPOSTAS) throw new Falha(400, "invalido", "As respostas estão muito longas.");
  if (!String(d.descricao || "").trim()) throw new Falha(400, "invalido", "Descreva o projeto antes de usar a IA.");
}
async function pedirJSON(env, prompt, maxTokens = 4096) {
  const instr = "\n\nIMPORTANTE: responda apenas com JSON válido, sem nenhum texto antes ou depois.";
  for (let i = 0; i < 2; i++) {
    const { text } = await claude(env, prompt + instr, { maxTokens });
    const j = lerJSON(text);
    if (j && typeof j === "object") return j;
  }
  throw new Falha(502, "invalid_json", "A resposta da IA veio fora do formato esperado. Tente de novo.");
}

async function carregarRascunho(env, uid, rid, admin) {
  if (!rid) throw new Falha(400, "invalido", "Projeto não informado.");
  const filtro = admin ? `id=eq.${encodeURIComponent(rid)}` : `id=eq.${encodeURIComponent(rid)}&user_id=eq.${uid}`;
  const r = await sb(env, `rascunhos?${filtro}&select=id,user_id,data`);
  if (!r.length) throw new Falha(404, "nao_encontrado", "Projeto não encontrado.");
  return { id: r[0].id, ...r[0].data };
}
async function exigirPago(env, uid, rid, admin) {
  if (admin) return;
  const p = await sb(env, `pedidos?rascunho_id=eq.${encodeURIComponent(rid)}&user_id=eq.${uid}&status=eq.pago&select=id&limit=1`);
  if (!p.length) throw new Falha(403, "nao_liberado", "O projeto completo é liberado após a compra.");
}

async function gerarCampo(env, r, lei, f) {
  const a = alvo(f.lim);
  const maxTokens = Math.max(1500, Math.ceil(f.lim / 2));
  let { text } = await claude(env, promptCampo(r, lei, f), { maxTokens });
  text = limpar(text, f.t);
  for (let i = 0; i < 2; i++) {
    const n = cnt(text);
    if (n >= a.min * 0.97 && n <= f.lim * 1.06) break;
    const res = await claude(env, promptAjuste(f, text, a, lei), { maxTokens });
    const novo = limpar(res.text, f.t);
    if (Math.abs(cnt(novo) - a.max) < Math.abs(n - a.max)) text = novo;
  }
  return cortar(text, f.lim);
}
async function gerarMetas(env, r) {
  let m = await pedirJSON(env, promptMetas(r), 4096);
  if (!Array.isArray(m.qualitativas) || !Array.isArray(m.quantitativas)) throw new Falha(502, "invalid_json", "As metas vieram fora do formato. Tente de novo.");
  if (metasFora(m)) {
    try { const m2 = await pedirJSON(env, promptAjusteMetas(m), 4096); if (Array.isArray(m2.qualitativas) && Array.isArray(m2.quantitativas)) m = m2; } catch {}
  }
  return normMetas(m);
}

export async function onRequestPost({ request, env }) {
  try {
    exigirEnv(env, "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY");
    const u = await usuario(env, request);
    const admin = await ehAdmin(env, u.id);
    const body = await request.json().catch(() => ({}));
    const acao = String(body.acao || "");

    if (acao === "diagnostico") {
      checarRespostas(body.respostas);
      if (!admin) await limitarUso(env, u.id, "diagnostico", LIMITES.diagnostico);
      const diag = await pedirJSON(env, promptDiagnostico(body.respostas), 4096);
      if (!diag.resumo) throw new Falha(502, "invalid_json", "O diagnóstico veio incompleto. Tente de novo.");
      return json({ diagnostico: diag });
    }

    if (acao === "planilha") {
      checarRespostas(body.respostas);
      if (!admin) await limitarUso(env, u.id, "planilha", LIMITES.planilha);
      const res = await pedirJSON(env, promptPlanilha(body.respostas), 6000);
      const lei = body.respostas.lei === "esporte" ? "esporte" : "cultura";
      const cats = new Set(categorias(lei, body.respostas).map(c => c.k));
      const itens = (Array.isArray(res.itens) ? res.itens : []).slice(0, 40).map(x => ({
        cat: cats.has(x.cat) ? x.cat : [...cats][1], item: String(x.item || "").slice(0, 120),
        un: UNIDADES.includes(x.un) ? x.un : "Serviço", qtd: Math.max(0, Number(x.qtd) || 0), vu: Math.max(0, Number(x.vu) || 0), obs: String(x.obs || "").slice(0, 140)
      }));
      if (!itens.length) throw new Falha(502, "invalid_json", "A planilha veio vazia. Tente de novo.");
      return json({ itens });
    }

    if (acao === "plano" || acao === "campo" || acao === "metas") {
      const r = await carregarRascunho(env, u.id, body.rid, admin);
      await exigirPago(env, u.id, r.id, admin);
      if (!admin) await limitarUso(env, u.id, "projeto", LIMITES.projeto);
      const lei = leiDoProjeto(r);
      if (acao === "plano") {
        const plano = await pedirJSON(env, promptPlano({ ...r, projeto: null }, lei), 6000);
        return json({ plano, lei });
      }
      if (!r.projeto?.plano) throw new Falha(409, "sem_plano", "Gere o projeto do início para criar o plano-base.");
      if (acao === "metas") {
        if (lei !== "esporte") throw new Falha(400, "invalido", "Metas são do projeto de esporte.");
        return json({ metas: await gerarMetas(env, r) });
      }
      const f = CAMPOS[lei].find(x => x.k === body.k);
      if (!f) throw new Falha(400, "invalido", "Campo desconhecido.");
      return json({ k: f.k, texto: await gerarCampo(env, r, lei, f) });
    }

    throw new Falha(400, "invalido", "Ação desconhecida.");
  } catch (e) { return erro(e); }
}
