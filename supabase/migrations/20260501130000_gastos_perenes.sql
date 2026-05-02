-- Gastos perenes (obrigações recorrentes) + vínculo em compromissos

create table if not exists public.gastos_perenes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fornecedor text not null,
  valor_previsto numeric not null,
  periodicidade text not null check (periodicidade in ('mensal', 'trimestral', 'semestral', 'anual')),
  dia_vencimento integer not null check (dia_vencimento >= 1 and dia_vencimento <= 31),
  mes_vencimento integer null check (mes_vencimento is null or (mes_vencimento >= 1 and mes_vencimento <= 12)),
  data_inicio date not null,
  data_termino date null,
  observacoes text null,
  status text not null check (status in ('ativo', 'encerrado')),
  created_at timestamptz not null default now(),
  constraint gastos_perenes_anual_mes check (
    periodicidade <> 'anual' or mes_vencimento is not null
  )
);

create index if not exists gastos_perenes_user_status_idx on public.gastos_perenes (user_id, status);

alter table public.compromissos
  add column if not exists gasto_perene_id uuid references public.gastos_perenes (id) on delete set null,
  add column if not exists competencia_chave text null;

create unique index if not exists compromissos_perene_competencia_unique
  on public.compromissos (gasto_perene_id, competencia_chave)
  where gasto_perene_id is not null and competencia_chave is not null;

alter table public.gastos_perenes enable row level security;

drop policy if exists "Users manage own gastos_perenes" on public.gastos_perenes;
create policy "Users manage own gastos_perenes"
  on public.gastos_perenes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
