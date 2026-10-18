/* Funções auxiliares do servidor (Cloudflare Pages Functions). */

export class Falha extends Error {
  constructor(status, codigo, mensagem) { super(mensagem || codigo); this.status = status; this.codigo = codigo; }
}

export function json(dados, status = 200, headers = {}) {
  return new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}

export function erro(e) {
  if (e instanceof Falha) return json({ erro: e.codigo, mensagem: e.message }, e.status);
  console.error(e);
  return json({ erro: "interno", mensagem: "Erro inesperado. Tente de novo em instantes." }, 500);
}

export function exigirEnv(env, ...nomes) {
  const faltando = nomes.filter(n => !env[n]);
  if (faltando.length) throw new Falha(500, "configuracao", "O site ainda não foi configurado: falta " + faltando.join(", ") + ".");
}

/* ---------- Supabase (REST com a chave de serviço) ---------- */
function sbHeaders(env, extra = {}) {
  return { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY, "content-type": "application/json", ...extra };
}
export async function sb(env, caminho, { method = "GET", body, prefer } = {}) {
  const r = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + caminho, {
    method, headers: sbHeaders(env, prefer ? { prefer } : {}), body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Falha(502, "banco", "Falha ao acessar o banco de dados (" + r.status + "): " + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

/* Valida o token de login enviado pelo navegador e devolve o usuário. */
export async function usuario(env, request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) throw new Falha(401, "nao_autenticado", "Entre na sua conta para continuar.");
  const r = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: "Bearer " + token } });
  if (!r.ok) throw new Falha(401, "nao_autenticado", "Sua sessão expirou. Entre novamente.");
  const u = await r.json();
  if (!u?.id) throw new Falha(401, "nao_autenticado", "Entre na sua conta para continuar.");
  return u;
}
export async function ehAdmin(env, uid) {
  const r = await sb(env, `admins?user_id=eq.${encodeURIComponent(uid)}&select=user_id`);
  return Array.isArray(r) && r.length > 0;
}

/* Limite de uso da IA por pessoa (últimas 24 horas). */
export async function limitarUso(env, uid, acao, maximo) {
  const desde = new Date(Date.now() - 864e5).toISOString();
  const r = await sb(env, `uso_ia?user_id=eq.${uid}&acao=eq.${encodeURIComponent(acao)}&created_at=gte.${encodeURIComponent(desde)}&select=id&limit=${maximo + 1}`);
  if (r.length >= maximo) throw new Falha(429, "limite", "Você atingiu o limite de uso por hoje. Tente novamente amanhã ou fale com a Canção.");
  await sb(env, "uso_ia", { method: "POST", body: { user_id: uid, acao }, prefer: "return=minimal" });
}

/* ---------- Claude (API da Anthropic) ---------- */
export async function claude(env, prompt, { maxTokens = 4096, signal } = {}) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal,
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] })
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 300);
    console.error("Anthropic", r.status, t);
    if (r.status === 429 || r.status === 529) throw new Falha(503, "ia_ocupada", "A IA está muito ocupada agora. Tente de novo em alguns minutos.");
    throw new Falha(502, "ia_indisponivel", "Não foi possível falar com a IA agora. Tente de novo em instantes.");
  }
  const j = await r.json();
  const text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  if (!text) throw new Falha(502, "ia_vazia", "A IA não devolveu texto. Tente de novo.");
  return { text, truncated: j.stop_reason === "max_tokens" };
}

/* ---------- Mercado Pago ---------- */
export async function mp(env, caminho, { method = "GET", body, idem } = {}) {
  const r = await fetch("https://api.mercadopago.com" + caminho, {
    method,
    headers: { authorization: "Bearer " + env.MP_ACCESS_TOKEN, "content-type": "application/json", ...(idem ? { "x-idempotency-key": idem } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Falha(502, "pagamento", "Falha ao falar com o Mercado Pago (" + r.status + "): " + (await r.text()).slice(0, 200));
  return r.json();
}
export function siteUrl(env, request) {
  return (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
}
/* Marca um pedido como pago se o Mercado Pago confirmar um pagamento aprovado. */
export async function conferirPedido(env, pedidoId) {
  const busca = await mp(env, `/v1/payments/search?external_reference=${encodeURIComponent(pedidoId)}&sort=date_created&criteria=desc`);
  const aprovado = (busca.results || []).find(p => p.status === "approved");
  if (!aprovado) return null;
  await marcarPago(env, pedidoId, aprovado);
  return aprovado;
}
export async function marcarPago(env, pedidoId, pagamento) {
  await sb(env, `pedidos?id=eq.${encodeURIComponent(pedidoId)}&status=neq.pago`, {
    method: "PATCH", prefer: "return=minimal",
    body: { status: "pago", mp_payment_id: String(pagamento.id), pago_em: new Date().toISOString(), forma: "mercadopago" }
  });
}
