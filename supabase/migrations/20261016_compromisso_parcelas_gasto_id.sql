-- Baixa de compromisso em uma transação.
-- Ainda não aplicada no banco de produção.
-- Acrescenta colunas e uma função. Não altera nem apaga registros existentes.

alter table public.compromisso_parcelas
  add column if not exists gasto_id uuid references public.gastos (id) on delete set null;

create unique index if not exists compromisso_parcelas_gasto_id_unique
  on public.compromisso_parcelas (gasto_id)
  where gasto_id is not null;

alter table public.gastos
  add column if not exists comprovante_pendente boolean not null default false;

comment on column public.gastos.comprovante_pendente is
  'Pagamento confirmado acima de R$ 500,00 cujo comprovante ainda não foi anexado.';

create or replace function public.gastos_limpar_comprovante_pendente()
returns trigger
language plpgsql
as $$
begin
  if new.comprovante_url is not null and btrim(new.comprovante_url) <> '' then
    new.comprovante_pendente := false;
  end if;
  return new;
end;
$$;

drop trigger if exists gastos_limpar_comprovante_pendente on public.gastos;
create trigger gastos_limpar_comprovante_pendente
  before insert or update of comprovante_url, comprovante_pendente
  on public.gastos
  for each row
  execute function public.gastos_limpar_comprovante_pendente();

create or replace function public.quitar_compromisso(
  p_compromisso_id uuid,
  p_parcela_id uuid,
  p_data_pagamento date,
  p_fornecedor text,
  p_forma_pagamento text,
  p_meio_pagamento text,
  p_instituicao_financeira text,
  p_observacoes text,
  p_total_centavos integer,
  p_numero_parcelas integer,
  p_itens jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_status text;
  v_gasto_id uuid;
  v_tipo text;
  v_new_gasto uuid;
  v_parcela_status text;
  v_parcela_gasto uuid;
  v_pendentes integer;
  v_sum integer;
  v_numero integer;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_data_pagamento is null or p_data_pagamento > current_date then
    raise exception 'Informe a data do pagamento. Ela não pode ser futura.';
  end if;

  if p_fornecedor is null or btrim(p_fornecedor) = '' then
    raise exception 'Informe o fornecedor.';
  end if;

  if p_total_centavos is null or p_total_centavos <= 0 then
    raise exception 'Informe o valor realizado maior que zero.';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'A baixa precisa ter ao menos um item.';
  end if;

  select coalesce(sum((item->>'valor_centavos')::integer), 0)
    into v_sum
  from jsonb_array_elements(p_itens) as item;

  if v_sum <> p_total_centavos then
    raise exception 'A soma dos itens não confere com o valor pago.';
  end if;

  select c.org_id, c.status, c.gasto_id, coalesce(c.tipo, 'unico')
    into v_org, v_status, v_gasto_id, v_tipo
  from public.compromissos c
  where c.id = p_compromisso_id
  for update;

  if not found then
    raise exception 'Compromisso não encontrado';
  end if;

  if not exists (
    select 1
    from public.organizacao_membros om
    where om.org_id = v_org
      and om.user_id = v_user
  ) then
    raise exception 'Compromisso não encontrado';
  end if;

  if lower(btrim(coalesce(p_forma_pagamento, ''))) = 'parcelado' then
    v_numero := p_numero_parcelas;
    if v_numero is null or v_numero < 2 or v_numero > 48 then
      raise exception 'A quantidade de parcelas deve estar entre 2 e 48.';
    end if;
  else
    v_numero := null;
  end if;

  if p_parcela_id is null then
    if v_tipo = 'parcelado' then
      raise exception 'Quite uma parcela deste compromisso.';
    end if;

    if v_status in ('quitado', 'cancelado') or v_gasto_id is not null then
      if v_gasto_id is null then
        raise exception 'Este compromisso já foi encerrado sem gasto vinculado.';
      end if;
      return v_gasto_id;
    end if;

    if v_status not in ('pendente', 'vencido') then
      raise exception 'Este compromisso não pode ser quitado.';
    end if;
  else
    if v_tipo <> 'parcelado' then
      raise exception 'Este compromisso não é parcelado.';
    end if;

    select p.status, p.gasto_id
      into v_parcela_status, v_parcela_gasto
    from public.compromisso_parcelas p
    where p.id = p_parcela_id
      and p.compromisso_id = p_compromisso_id
    for update;

    if not found then
      raise exception 'Parcela não encontrada';
    end if;

    if v_parcela_status = 'cancelado' then
      raise exception 'Esta parcela já foi encerrada. Nenhum novo gasto foi criado.';
    end if;

    if v_parcela_status = 'quitado' or v_parcela_gasto is not null then
      if v_parcela_gasto is null then
        raise exception 'Esta parcela já foi encerrada sem gasto vinculado.';
      end if;
      return v_parcela_gasto;
    end if;

    if v_parcela_status not in ('pendente', 'vencido') then
      raise exception 'Esta parcela não pode ser quitada.';
    end if;
  end if;

  insert into public.gastos (
    user_id,
    org_id,
    data_compra,
    fornecedor,
    forma_pagamento,
    meio_pagamento,
    instituicao_financeira,
    observacoes,
    total,
    comprovante_url,
    numero_parcelas,
    comprovante_pendente
  ) values (
    v_user,
    v_org,
    p_data_pagamento,
    btrim(p_fornecedor),
    coalesce(nullif(btrim(p_forma_pagamento), ''), 'À Vista'),
    coalesce(nullif(btrim(p_meio_pagamento), ''), ''),
    coalesce(nullif(btrim(p_instituicao_financeira), ''), ''),
    nullif(btrim(coalesce(p_observacoes, '')), ''),
    p_total_centavos::numeric / 100,
    null,
    v_numero,
    p_total_centavos > 50000
  )
  returning id into v_new_gasto;

  insert into public.itens_gasto (
    gasto_id,
    ordem,
    descricao_produto_servico,
    quantidade_adquirida,
    unidade_medida,
    valor_total
  )
  select
    v_new_gasto,
    (item->>'ordem')::integer,
    item->>'descricao',
    (item->>'quantidade')::numeric,
    item->>'unidade',
    (item->>'valor_centavos')::numeric / 100
  from jsonb_array_elements(p_itens) as item;

  if p_parcela_id is null then
    update public.compromissos
      set status = 'quitado',
          gasto_id = v_new_gasto
    where id = p_compromisso_id;
  else
    update public.compromisso_parcelas
      set status = 'quitado',
          gasto_id = v_new_gasto
    where id = p_parcela_id;

    select count(*)
      into v_pendentes
    from public.compromisso_parcelas
    where compromisso_id = p_compromisso_id
      and status in ('pendente', 'vencido');

    if v_pendentes = 0 then
      update public.compromissos
        set status = 'quitado'
      where id = p_compromisso_id;
    end if;
  end if;

  return v_new_gasto;
end;
$$;

revoke all on function public.quitar_compromisso(
  uuid, uuid, date, text, text, text, text, text, integer, integer, jsonb
) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.quitar_compromisso(
      uuid, uuid, date, text, text, text, text, text, integer, integer, jsonb
    ) to authenticated;
  end if;
end;
$$;
