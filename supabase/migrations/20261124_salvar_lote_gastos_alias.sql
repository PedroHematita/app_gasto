-- Alias com o nome pedido no fluxo do app (rpc salvar_lote_gastos).
create or replace function public.salvar_lote_gastos(p_org_id uuid, p_gastos jsonb)
returns uuid[]
language sql
security invoker
set search_path = public
as $$
  select public.salvar_gastos_lote(p_org_id, p_gastos);
$$;

revoke all on function public.salvar_lote_gastos(uuid, jsonb) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.salvar_lote_gastos(uuid, jsonb) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.salvar_lote_gastos(uuid, jsonb) to authenticated;
  end if;
end;
$$;
