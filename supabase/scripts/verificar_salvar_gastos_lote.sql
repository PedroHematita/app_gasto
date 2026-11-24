-- Relatório em UMA grade via set_config de sessão (sem tabela temporária).
-- INSERTS da verificação desfazem no EXCEPTION interno.
-- Não é migração. Não usa set local role (evita 42501 no editor SQL).
-- auth.uid() vem de request.jwt.claim.sub / request.jwt.claims.
--
-- Usuário: 28bfc2ff-ffe9-4ea5-ab3e-18477f2d16c0
-- Org Minha Empresa: cb93cfe5-db81-4aa9-91e9-75d0bf9be9d0

select set_config('verif.salvar_gastos_lote', '', false);

do $$
declare
  v_org uuid := 'cb93cfe5-db81-4aa9-91e9-75d0bf9be9d0';
  v_user text := '28bfc2ff-ffe9-4ea5-ab3e-18477f2d16c0';
  v_id1 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  v_id2 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  v_id3 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  v_id4 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
  v_id5 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
  v_ids_1 uuid[];
  v_ids_2 uuid[];
  v_msg_invalido text;
  v_relatorio jsonb;
  v_detail text;
begin
  perform set_config('request.jwt.claim.sub', v_user, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user)::text,
    true
  );

  begin
    v_ids_1 := public.salvar_gastos_lote(
      v_org,
      jsonb_build_array(
        jsonb_build_object(
          'id', v_id1,
          'data_compra', current_date,
          'fornecedor', 'Verificacao Lote A',
          'forma_pagamento', 'À Vista',
          'meio_pagamento', 'PIX',
          'instituicao_financeira', 'Nubank',
          'observacoes', 'script de verificacao',
          'numero_parcelas', null,
          'itens', jsonb_build_array(
            jsonb_build_object(
              'ordem', 99,
              'descricao', 'Item verificacao A',
              'quantidade', 1,
              'unidade', 'Unidade',
              'valor_centavos', 1999
            )
          )
        ),
        jsonb_build_object(
          'id', v_id2,
          'data_compra', current_date,
          'fornecedor', 'Verificacao Lote B',
          'forma_pagamento', 'Parcelado',
          'meio_pagamento', 'Cartão de Crédito',
          'instituicao_financeira', 'Nubank',
          'observacoes', '',
          'numero_parcelas', 3,
          'itens', jsonb_build_array(
            jsonb_build_object(
              'descricao', 'Item verificacao B',
              'quantidade', 2,
              'unidade', 'Unidade',
              'valor_centavos', 30000
            )
          )
        )
      )
    );

    v_ids_2 := public.salvar_gastos_lote(
      v_org,
      jsonb_build_array(
        jsonb_build_object(
          'id', v_id1,
          'data_compra', current_date,
          'fornecedor', 'Verificacao Lote A',
          'forma_pagamento', 'À Vista',
          'meio_pagamento', 'PIX',
          'instituicao_financeira', 'Nubank',
          'observacoes', 'reenvio',
          'itens', jsonb_build_array(
            jsonb_build_object(
              'descricao', 'Item verificacao A',
              'quantidade', 1,
              'unidade', 'Unidade',
              'valor_centavos', 1999
            )
          )
        ),
        jsonb_build_object(
          'id', v_id2,
          'data_compra', current_date,
          'fornecedor', 'Verificacao Lote B',
          'forma_pagamento', 'Parcelado',
          'meio_pagamento', 'Cartão de Crédito',
          'instituicao_financeira', 'Nubank',
          'numero_parcelas', 3,
          'itens', jsonb_build_array(
            jsonb_build_object(
              'descricao', 'Item verificacao B',
              'quantidade', 2,
              'unidade', 'Unidade',
              'valor_centavos', 30000
            )
          )
        )
      )
    );

    begin
      perform public.salvar_gastos_lote(
        v_org,
        jsonb_build_array(
          jsonb_build_object(
            'id', v_id3,
            'data_compra', current_date,
            'fornecedor', 'Deveria desfazer',
            'forma_pagamento', 'À Vista',
            'meio_pagamento', 'PIX',
            'instituicao_financeira', 'Nubank',
            'itens', jsonb_build_array(
              jsonb_build_object(
                'descricao', 'Item valido xxx',
                'quantidade', 1,
                'unidade', 'Unidade',
                'valor_centavos', 100
              )
            )
          ),
          jsonb_build_object(
            'id', v_id4,
            'data_compra', current_date,
            'fornecedor', 'Invalido no meio',
            'forma_pagamento', 'À Vista',
            'meio_pagamento', 'PIX',
            'instituicao_financeira', 'Nubank',
            'itens', jsonb_build_array(
              jsonb_build_object(
                'descricao', 'ab',
                'quantidade', 1,
                'unidade', 'Unidade',
                'valor_centavos', 100
              )
            )
          ),
          jsonb_build_object(
            'id', v_id5,
            'data_compra', current_date,
            'fornecedor', 'Nem chega aqui',
            'forma_pagamento', 'À Vista',
            'meio_pagamento', 'PIX',
            'instituicao_financeira', 'Nubank',
            'itens', jsonb_build_array(
              jsonb_build_object(
                'descricao', 'Item depois xxx',
                'quantidade', 1,
                'unidade', 'Unidade',
                'valor_centavos', 100
              )
            )
          )
        )
      );
      v_msg_invalido := 'FALHA: o lote inválido não levantou erro.';
    exception
      when others then
        v_msg_invalido := sqlerrm;
    end;

    select jsonb_build_object(
      'auth_uid', auth.uid(),
      'ids_primeiro_envio', to_jsonb(v_ids_1),
      'ids_reenvio', to_jsonb(v_ids_2),
      'gastos', (
        select coalesce(jsonb_agg(t order by t.id), '[]'::jsonb)
        from (
          select id, org_id, user_id, data_compra, fornecedor, forma_pagamento,
                 meio_pagamento, instituicao_financeira, observacoes, total,
                 numero_parcelas, comprovante_url, comprovante_pendente, tipo_gasto
          from public.gastos
          where id in (v_id1, v_id2)
        ) t
      ),
      'itens', (
        select coalesce(jsonb_agg(t order by t.gasto_id, t.ordem), '[]'::jsonb)
        from (
          select gasto_id, ordem, descricao_produto_servico,
                 quantidade_adquirida, unidade_medida, valor_total
          from public.itens_gasto
          where gasto_id in (v_id1, v_id2)
        ) t
      ),
      'n_gastos_apos_reenvio', (
        select count(*) from public.gastos where id in (v_id1, v_id2)
      ),
      'n_itens_apos_reenvio', (
        select count(*) from public.itens_gasto where gasto_id in (v_id1, v_id2)
      ),
      'lote_invalido_mensagem', v_msg_invalido,
      'n_gastos_invalidos', (
        select count(*) from public.gastos where id in (v_id3, v_id4, v_id5)
      )
    )
    into v_relatorio;

    raise exception 'VERIF_LOTE_OK' using detail = v_relatorio::text;
  exception
    when others then
      get stacked diagnostics v_detail = pg_exception_detail;
      if sqlerrm = 'VERIF_LOTE_OK' then
        perform set_config('verif.salvar_gastos_lote', v_detail, false);
      else
        perform set_config(
          'verif.salvar_gastos_lote',
          jsonb_build_object(
            'falhou', true,
            'auth_uid', auth.uid(),
            'mensagem', sqlerrm
          )::text,
          false
        );
      end if;
  end;
end;
$$;

select current_setting('verif.salvar_gastos_lote')::jsonb as relatorio;
