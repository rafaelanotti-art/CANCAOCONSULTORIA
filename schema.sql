-- =====================================================================
-- Canção Incentiva · estrutura do banco de dados (Supabase)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- =====================================================================

-- Quem administra o site (a Canção). Preenchido no fim da instalação.
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
grant execute on function public.is_admin() to anon, authenticated;

create policy "admin vê admins" on public.admins for select using (public.is_admin());

-- Dados de contato de cada pessoa cadastrada
create table if not exists public.perfis (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  nome text,
  whats text,
  email text,
  created_at timestamptz not null default now()
);
alter table public.perfis enable row level security;
create policy "perfil: dono lê" on public.perfis for select using (user_id = auth.uid() or public.is_admin());
create policy "perfil: dono cria" on public.perfis for insert with check (user_id = auth.uid());
create policy "perfil: dono altera" on public.perfis for update using (user_id = auth.uid());

-- Projetos montados no assistente (respostas, diagnóstico e projeto completo)
create table if not exists public.rascunhos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rascunhos enable row level security;
create policy "rascunho: dono lê" on public.rascunhos for select using (user_id = auth.uid() or public.is_admin());
create policy "rascunho: dono cria" on public.rascunhos for insert with check (user_id = auth.uid());
create policy "rascunho: dono altera" on public.rascunhos for update using (user_id = auth.uid());
create policy "rascunho: dono apaga" on public.rascunhos for delete using (user_id = auth.uid());

-- Pedidos do projeto completo (pagamento)
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  rascunho_id uuid references public.rascunhos on delete set null,
  titulo text, lei text, nome text, whats text, email text,
  valor numeric(12,2),
  status text not null default 'aguardando' check (status in ('aguardando','pago','cancelado')),
  forma text,
  mp_preference_id text, mp_payment_id text,
  pago_em timestamptz,
  created_at timestamptz not null default now()
);
alter table public.pedidos enable row level security;
create policy "pedido: dono lê" on public.pedidos for select using (user_id = auth.uid() or public.is_admin());
create policy "pedido: dono cria aguardando" on public.pedidos for insert with check (user_id = auth.uid() and status = 'aguardando');
create policy "pedido: admin altera" on public.pedidos for update using (public.is_admin());

-- Projetos aprovados enviados para a vitrine (aguardam conferência)
create table if not exists public.projetos_captacao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'analise' check (status in ('analise','aprovado','recusado','removido')),
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projetos_captacao enable row level security;
create policy "captação: dono lê" on public.projetos_captacao for select using (user_id = auth.uid() or public.is_admin());
create policy "captação: dono envia" on public.projetos_captacao for insert with check (user_id = auth.uid() and status = 'analise');
create policy "captação: dono corrige" on public.projetos_captacao for update
  using (user_id = auth.uid() and status in ('analise','recusado')) with check (user_id = auth.uid() and status = 'analise');
create policy "captação: admin altera" on public.projetos_captacao for update using (public.is_admin());

-- Vitrine pública de projetos aptos a captar
create table if not exists public.vitrine (
  id uuid primary key default gen_random_uuid(),
  origem_id uuid references public.projetos_captacao on delete set null,
  data jsonb not null default '{}'::jsonb,
  publicado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.vitrine enable row level security;
create policy "vitrine: todos leem" on public.vitrine for select using (true);
create policy "vitrine: admin cria" on public.vitrine for insert with check (public.is_admin());
create policy "vitrine: admin altera" on public.vitrine for update using (public.is_admin());
create policy "vitrine: admin apaga" on public.vitrine for delete using (public.is_admin());

-- Contatos de empresários e contribuintes (não exige cadastro)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  status text not null default 'novo' check (status in ('novo','contatado')),
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy "contato: qualquer um envia" on public.leads for insert with check (status = 'novo');
create policy "contato: admin lê" on public.leads for select using (public.is_admin());
create policy "contato: admin altera" on public.leads for update using (public.is_admin());

-- Configurações do site (preço, WhatsApp, etc.)
create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);
alter table public.config enable row level security;
create policy "config: todos leem" on public.config for select using (true);
create policy "config: admin altera" on public.config for update using (public.is_admin());
insert into public.config (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- Registro de uso da IA (só o servidor acessa)
create table if not exists public.uso_ia (
  id bigserial primary key,
  user_id uuid not null,
  acao text not null,
  created_at timestamptz not null default now()
);
create index if not exists uso_ia_busca on public.uso_ia (user_id, acao, created_at);
alter table public.uso_ia enable row level security;

-- Atualiza "updated_at" automaticamente
create or replace function public.tocar_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists t_rascunhos on public.rascunhos;
create trigger t_rascunhos before update on public.rascunhos for each row execute function public.tocar_updated_at();
drop trigger if exists t_captacao on public.projetos_captacao;
create trigger t_captacao before update on public.projetos_captacao for each row execute function public.tocar_updated_at();
