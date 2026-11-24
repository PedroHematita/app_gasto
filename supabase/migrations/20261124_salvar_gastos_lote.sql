-- Cadastro múltiplo: um lote transacional de gastos + itens.
-- IDs de gasto vêm do cliente (uuid). PK aceita id explícito; gen_random_uuid() só entra se id for omitido.
-- org_id e user_id não vêm do JSON: user_id = auth.uid(); org_id = p_org_id com checagem em organizacao_membros.
-- ordem do item = posição no array (1-based), igual ao saveGasto (nextOrdem começa em 1).
-- Não destrutivo. Não aplicar automaticamente.

create or replace function public.salvar_gastos_lote(
  p_org_id uuid,
  p_gastos jsonb
) returns uuid[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ids uuid[] := '{}';
  v_vistos uuid[] := '{}';
  v_gasto jsonb;
  v_id uuid;
  v_existente_org uuid;
  v_data date;
  v_forma_in text;
  v_forma text;
  v_numero integer;
  v_itens jsonb;
  v_item jsonb;
  v_desc text;
  v_qtd numeric;
  v_unidade text;
  v_centavos bigint;
  v_total_centavos bigint;
  v_n integer;
  v_idx integer := 0;
  v_prefixo text;
  v_fornecedor text;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado';
  end if;

  if p_org_id is null then
    raise exception 'Organização não informada.';
  end if;

  if not exists (
    select 1
    from public.organizacao_membros om
    where om.org_id = p_org_id
      and om.user_id = v_user
  ) then
    raise exception 'Organização não encontrada';
  end if;

  if p_gastos is null or jsonb_typeof(p_gastos) <> 'array' then
    raise exception 'O lote precisa ser um array de gastos.';
  end if;

  v_n := jsonb_array_length(p_gastos);

  if v_n = 0 then
    raise exception 'O lote precisa ter ao menos um gasto.';
  end if;

  if v_n > 50 then
    raise exception 'O lote não pode ter mais de 50 gastos.';
  end if;

  for v_gasto in
    select value
    from jsonb_array_elements(p_gastos)
  loop
    v_idx := v_idx + 1;
    v_prefixo := 'Gasto ' || v_idx || ': ';

    begin
      v_id := (v_gasto->>'id')::uuid;
    exception
      when invalid_text_representation then
        raise exception '%Informe um identificador válido.', v_prefixo;
    end;

    if v_id is null then
      raise exception '%Informe um identificador válido.', v_prefixo;
    end if;

    if v_id = any (v_vistos) then
      raise exception '%Há identificadores repetidos ou ausentes no lote.', v_prefixo;
    end if;
    v_vistos := array_append(v_vistos, v_id);

    begin
      v_data := (v_gasto->>'data_compra')::date;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        raise exception '%Informe a data da compra. Ela não pode ser futura.', v_prefixo;
    end;

    if v_data is null or v_data > current_date then
      raise exception '%Informe a data da compra. Ela não pode ser futura.', v_prefixo;
    end if;

    v_fornecedor := btrim(coalesce(v_gasto->>'fornecedor', ''));
    if v_fornecedor = '' then
      raise exception '%Informe o fornecedor.', v_prefixo;
    end if;

    v_forma_in := btrim(coalesce(v_gasto->>'forma_pagamento', ''));
    if lower(v_forma_in) = 'parcelado' then
      v_forma := 'Parcelado';
    elsif lower(v_forma_in) = lower('À Vista') then
      v_forma := 'À Vista';
    else
      raise exception '%Informe a forma de pagamento: À Vista ou Parcelado.', v_prefixo;
    end if;

    if v_forma = 'Parcelado' then
      begin
        v_numero := (v_gasto->>'numero_parcelas')::integer;
      exception
        when invalid_text_representation then
          raise exception '%A quantidade de parcelas deve estar entre 2 e 48.', v_prefixo;
      end;
      if v_numero is null or v_numero < 2 or v_numero > 48 then
        raise exception '%A quantidade de parcelas deve estar entre 2 e 48.', v_prefixo;
      end if;
    else
      v_numero := null;
    end if;

    v_itens := v_gasto->'itens';
    if v_itens is null or jsonb_typeof(v_itens) <> 'array' or jsonb_array_length(v_itens) = 0 then
      raise exception '%Cada gasto precisa ter ao menos um item.', v_prefixo;
    end if;

    if jsonb_array_length(v_itens) > 100 then
      raise exception '%O gasto não pode ter mais de 100 itens.', v_prefixo;
    end if;

    v_total_centavos := 0;
    for v_item in
      select value
      from jsonb_array_elements(v_itens)
    loop
      v_desc := btrim(regexp_replace(coalesce(v_item->>'descricao', ''), '\s+', ' ', 'g'));
      if char_length(v_desc) < 3 then
        raise exception '%A descrição do item é muito curta.', v_prefixo;
      end if;

      begin
        v_qtd := (v_item->>'quantidade')::numeric;
      exception
        when invalid_text_representation then
          raise exception '%A quantidade informada é inválida.', v_prefixo;
      end;
      if v_qtd is null or v_qtd <= 0 or v_qtd = 'NaN'::numeric
         or v_qtd = 'Infinity'::numeric or v_qtd = '-Infinity'::numeric then
        raise exception '%A quantidade informada é inválida.', v_prefixo;
      end if;

      v_unidade := btrim(coalesce(v_item->>'unidade', ''));
      if v_unidade = '' then
        raise exception '%Informe a unidade de medida.', v_prefixo;
      end if;

      begin
        v_centavos := (v_item->>'valor_centavos')::bigint;
      exception
        when invalid_text_representation or numeric_value_out_of_range then
          raise exception '%O valor do item está fora da faixa.', v_prefixo;
      end;
      if v_centavos is null or v_centavos < 0 or v_centavos > 9999999999 then
        raise exception '%O valor do item está fora da faixa.', v_prefixo;
      end if;

      v_total_centavos := v_total_centavos + v_centavos;
    end loop;

    if v_total_centavos > 9999999999 then
      raise exception '%O total do gasto excede o limite.', v_prefixo;
    end if;

    v_existente_org := null;
    select g.org_id
      into v_existente_org
    from public.gastos g
    where g.id = v_id
    for update;

    if found then
      if v_existente_org is distinct from p_org_id then
        raise exception '%Este identificador já pertence a outro registro.', v_prefixo;
      end if;
      v_ids := array_append(v_ids, v_id);
      continue;
    end if;

    insert into public.gastos (
      id,
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
      comprovante_pendente,
      tipo_gasto
    ) values (
      v_id,
      v_user,
      p_org_id,
      v_data,
      v_fornecedor,
      v_forma,
      coalesce(nullif(btrim(coalesce(v_gasto->>'meio_pagamento', '')), ''), ''),
      coalesce(nullif(btrim(coalesce(v_gasto->>'instituicao_financeira', '')), ''), ''),
      nullif(btrim(coalesce(v_gasto->>'observacoes', '')), ''),
      v_total_centavos::numeric / 100,
      null,
      v_numero,
      false,
      'Não Classificado'
    );

    insert into public.itens_gasto (
      gasto_id,
      ordem,
      descricao_produto_servico,
      quantidade_adquirida,
      unidade_medida,
      valor_total
    )
    select
      v_id,
      item.pos::integer,
      btrim(regexp_replace(coalesce(item.elem->>'descricao', ''), '\s+', ' ', 'g')),
      (item.elem->>'quantidade')::numeric,
      btrim(item.elem->>'unidade'),
      (item.elem->>'valor_centavos')::numeric / 100
    from jsonb_array_elements(v_itens) with ordinality as item(elem, pos);

    v_ids := array_append(v_ids, v_id);
  end loop;

  if coalesce(array_length(v_ids, 1), 0) <> v_n then
    raise exception 'O lote não pôde ser gravado por completo.';
  end if;

  return v_ids;
end;
$$;

revoke all on function public.salvar_gastos_lote(uuid, jsonb) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.salvar_gastos_lote(uuid, jsonb) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.salvar_gastos_lote(uuid, jsonb) to authenticated;
  end if;
end;
$$;
