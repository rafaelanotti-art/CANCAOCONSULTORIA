/* Entrega ao navegador apenas as configurações públicas. */
import { json } from "../../lib/server.js";

export function onRequestGet({ env }) {
  return json({
    supabaseUrl: env.SUPABASE_URL || "",
    supabaseAnonKey: env.SUPABASE_ANON_KEY || "",
    pagamentoOnline: !!env.MP_ACCESS_TOKEN,
    iaConfigurada: !!env.ANTHROPIC_API_KEY
  }, 200, { "cache-control": "public, max-age=300" });
}
