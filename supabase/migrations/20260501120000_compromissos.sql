-- Compromissos financeiros (gastos sem pagamento definido)
-- Execute no SQL Editor do Supabase ou via CLI após revisar políticas.

create table if not exists public.compromissos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data_compra date not null,
  data_prevista_pagamento date not null,
  fornecedor text,
  status text not null check (status in ('pendente', 'vencido', 'quitado', 'cancelado')),
  created_at timestamptz not null default now(),
  gasto_id uuid references public.gastos (id) on delete set null
);

create index if not exists compromissos_user_status_idx on public.compromissos (user_id, status);
create index if not exists compromissos_user_prevista_idx on public.compromissos (user_id, data_prevista_pagamento);

create table if not exists public.compromisso_itens (
  id uuid primary key default gen_random_uuid(),
  compromisso_id uuid not null references public.compromissos (id) on delete cascade,
  ordem integer not null,
  descricao_produto_servico text not null,
  quantidade_adquirida numeric not null,
  unidade_medida text not null,
  valor_total numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists compromisso_itens_compromisso_idx on public.compromisso_itens (compromisso_id);

alter table public.compromissos enable row level security;
alter table public.compromisso_itens enable row level security;

drop policy if exists "Users manage own compromissos" on public.compromissos;
create policy "Users manage own compromissos"
  on public.compromissos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage compromisso_itens via compromisso" on public.compromisso_itens;
create policy "Users manage compromisso_itens via compromisso"
  on public.compromisso_itens
  for all
  using (
    exists (
      select 1 from public.compromissos c
      where c.id = compromisso_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.compromissos c
      where c.id = compromisso_id and c.user_id = auth.uid()
    )
  );
