import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const USER = '11111111-1111-1111-1111-111111111111';
const OUTRO = '22222222-2222-2222-2222-222222222222';
const ORG = '33333333-3333-3333-3333-333333333333';
const ORG2 = '44444444-4444-4444-4444-444444444444';
const G1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const G2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const G3 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const G_OUTRA = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

let db: PGlite;

async function sql(text: string, params: unknown[] = []) {
  return db.query(text, params);
}

async function scalar<T>(text: string, params: unknown[] = []): Promise<T> {
  const result = await sql(text, params);
  return result.rows[0] as T;
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    ordem: 1,
    descricao: 'Serviço de limpeza',
    quantidade: 1,
    unidade: 'Unidade',
    valor_centavos: 25000,
    ...overrides,
  };
}

function gasto(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data_compra: null as string | null,
    fornecedor: 'Mercado Central',
    forma_pagamento: 'À Vista',
    meio_pagamento: 'PIX',
    instituicao_financeira: 'Nubank',
    observacoes: '',
    numero_parcelas: null,
    itens: [item()],
    ...overrides,
  };
}

async function hoje(): Promise<string> {
  return (await scalar<{ hoje: string }>('select current_date::text as hoje')).hoje;
}

async function salvar(payload: unknown[], orgId = ORG): Promise<string[]> {
  const data = await hoje();
  const comData = (payload as Array<Record<string, unknown>>).map((g) => ({
    ...g,
    data_compra: g.data_compra ?? data,
  }));
  const result = await sql('select public.salvar_gastos_lote($1::uuid, $2::jsonb) as ids', [
    orgId,
    JSON.stringify(comData),
  ]);
  return (result.rows[0] as { ids: string[] }).ids;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    create table public.organizacao_membros (
      org_id uuid not null,
      user_id uuid not null
    );

    create table public.gastos (
      id uuid primary key default gen_random_uuid(),
      user_id uuid,
      org_id uuid not null,
      data_compra date not null,
      fornecedor text,
      forma_pagamento text,
      meio_pagamento text,
      instituicao_financeira text,
      observacoes text,
      total numeric(10,2),
      comprovante_url text,
      numero_parcelas integer,
      created_at timestamp without time zone default now(),
      tipo_gasto text default 'Não Classificado',
      comprovante_pendente boolean not null default false
    );

    create table public.itens_gasto (
      id uuid primary key default gen_random_uuid(),
      gasto_id uuid references public.gastos (id) on delete cascade,
      ordem integer not null,
      descricao_produto_servico text not null,
      quantidade_adquirida numeric not null,
      unidade_medida text not null,
      valor_total numeric(10,2) not null,
      created_at timestamp without time zone default now()
    );

    insert into public.organizacao_membros (org_id, user_id) values ('${ORG}', '${USER}');
    select set_config('request.jwt.claim.sub', '${USER}', false);
  `);

  await db.exec(
    readFileSync(resolve('supabase/migrations/20261124_salvar_gastos_lote.sql'), 'utf8')
  );
});

afterAll(async () => {
  await db.close();
});

describe('salvar_gastos_lote', () => {
  it('grava o lote na ordem enviada, com classificação padrão e sem comprovante', async () => {
    const ids = await salvar([
      gasto(G1, { observacoes: 'nota 1', itens: [item({ valor_centavos: 1999 })] }),
      gasto(G2, {
        forma_pagamento: 'Parcelado',
        numero_parcelas: 3,
        itens: [item({ ordem: 1, descricao: 'Parcela teste', valor_centavos: 30000 })],
      }),
    ]);

    expect(ids).toEqual([G1, G2]);

    const g1 = await scalar<{
      tipo_gasto: string;
      comprovante_pendente: boolean;
      comprovante_url: string | null;
      total: string;
      numero_parcelas: number | null;
      user_id: string;
      org_id: string;
    }>(
      `select tipo_gasto, comprovante_pendente, comprovante_url, total::text, numero_parcelas, user_id::text, org_id::text
       from public.gastos where id = $1`,
      [G1]
    );
    const g2 = await scalar<{ numero_parcelas: number; forma_pagamento: string; total: string }>(
      'select numero_parcelas, forma_pagamento, total::text from public.gastos where id = $1',
      [G2]
    );
    const item1 = await scalar<{ valor_total: string }>(
      'select valor_total::text from public.itens_gasto where gasto_id = $1',
      [G1]
    );

    expect(g1.tipo_gasto).toBe('Não Classificado');
    expect(g1.comprovante_pendente).toBe(false);
    expect(g1.comprovante_url).toBeNull();
    expect(Number(g1.total)).toBe(19.99);
    expect(g1.numero_parcelas).toBeNull();
    expect(g1.user_id).toBe(USER);
    expect(g1.org_id).toBe(ORG);
    expect(Number(item1.valor_total)).toBe(19.99);
    expect(g2.numero_parcelas).toBe(3);
    expect(g2.forma_pagamento).toBe('Parcelado');
    expect(Number(g2.total)).toBe(300);
  });

  it('desfaz o lote inteiro se um gasto do meio falhar', async () => {
    await sql('delete from public.gastos');
    const antesG = await scalar<{ n: string }>('select count(*)::text as n from public.gastos');
    const antesI = await scalar<{ n: string }>('select count(*)::text as n from public.itens_gasto');

    await expect(
      salvar([gasto(G1), gasto(G2), gasto(G3, { itens: [item({ descricao: 'ab' })] })])
    ).rejects.toThrow(/Gasto 3: A descrição do item é muito curta/);

    const depoisG = await scalar<{ n: string }>('select count(*)::text as n from public.gastos');
    const depoisI = await scalar<{ n: string }>('select count(*)::text as n from public.itens_gasto');
    expect(depoisG.n).toBe(antesG.n);
    expect(depoisI.n).toBe(antesI.n);
    expect(depoisG.n).toBe('0');
  });

  it('reenvio com os mesmos IDs não duplica gastos nem itens', async () => {
    await sql('delete from public.gastos');
    const payload = [
      gasto(G1, { itens: [item({ valor_centavos: 1000 })] }),
      gasto(G2, { itens: [item({ valor_centavos: 2000 })] }),
    ];
    const primeiro = await salvar(payload);
    const segundo = await salvar(payload);
    const nGastos = await scalar<{ n: string }>('select count(*)::text as n from public.gastos');
    const nItens = await scalar<{ n: string }>('select count(*)::text as n from public.itens_gasto');

    expect(primeiro).toEqual([G1, G2]);
    expect(segundo).toEqual([G1, G2]);
    expect(nGastos.n).toBe('2');
    expect(nItens.n).toBe('2');
  });

  it('recusa usuário de outra organização e não grava nada', async () => {
    await sql('delete from public.gastos');
    await sql(`select set_config('request.jwt.claim.sub', $1, false)`, [OUTRO]);
    await expect(salvar([gasto(G1)])).rejects.toThrow(/Organização não encontrada/);
    await sql(`select set_config('request.jwt.claim.sub', $1, false)`, [USER]);
    const n = await scalar<{ n: string }>('select count(*)::text as n from public.gastos');
    expect(n.n).toBe('0');
  });

  it('recusa lote vazio, JSON que não é array e IDs repetidos no mesmo lote', async () => {
    await expect(sql('select public.salvar_gastos_lote($1::uuid, $2::jsonb)', [ORG, '[]'])).rejects.toThrow(
      /ao menos um gasto/
    );
    await expect(
      sql('select public.salvar_gastos_lote($1::uuid, $2::jsonb)', [ORG, '{"id":"x"}'])
    ).rejects.toThrow(/array de gastos/);
    await expect(salvar([gasto(G1), gasto(G1)])).rejects.toThrow(
      /Gasto 2: Há identificadores repetidos ou ausentes no lote/
    );
  });

  it('recusa forma inválida, parcelas fora de 2 a 48 e data futura', async () => {
    await sql('delete from public.gastos');
    await expect(salvar([gasto(G1, { forma_pagamento: 'a_vista' })])).rejects.toThrow(
      /Gasto 1: Informe a forma de pagamento: À Vista ou Parcelado/
    );
    await expect(salvar([gasto(G1, { forma_pagamento: 'Parcelado', numero_parcelas: 1 })])).rejects.toThrow(
      /Gasto 1: A quantidade de parcelas deve estar entre 2 e 48/
    );
    const amanha = await scalar<{ d: string }>('select (current_date + 1)::text as d');
    await expect(salvar([gasto(G1, { data_compra: amanha.d })])).rejects.toThrow(
      /Gasto 1: Informe a data da compra. Ela não pode ser futura/
    );
    const n = await scalar<{ n: string }>('select count(*)::text as n from public.gastos');
    expect(n.n).toBe('0');
  });

  it('recusa reenvio com ID de outra organização', async () => {
    await sql('delete from public.gastos');
    await sql(
      `insert into public.gastos (id, user_id, org_id, data_compra, fornecedor, total, comprovante_pendente)
       values ($1, $2, $3, current_date, 'Outra org', 10, false)`,
      [G_OUTRA, USER, ORG2]
    );
    await expect(salvar([gasto(G_OUTRA)])).rejects.toThrow(
      /Gasto 1: Este identificador já pertence a outro registro/
    );
  });

  it('trata o mesmo UUID em caixa diferente como ID repetido no lote', async () => {
    await sql('delete from public.gastos');
    await expect(salvar([gasto(G1), gasto(G1.toUpperCase())])).rejects.toThrow(
      /Gasto 2: Há identificadores repetidos ou ausentes no lote/
    );
    const n = await scalar<{ n: string }>('select count(*)::text as n from public.gastos');
    expect(n.n).toBe('0');
  });

  it('recusa mais de 50 gastos', async () => {
    const muitos = Array.from({ length: 51 }, (_, i) =>
      gasto(`aaaaaaaa-aaaa-aaaa-aaaa-${String(i + 1).padStart(12, '0')}`)
    );
    await expect(salvar(muitos)).rejects.toThrow(/não pode ter mais de 50 gastos/);
  });

  it('numera itens pela posição no array mesmo com ordem repetida ou ausente', async () => {
    await sql('delete from public.gastos');
    await salvar([
      gasto(G1, {
        itens: [
          item({ ordem: 99, descricao: 'Primeiro item xx', valor_centavos: 100 }),
          item({ ordem: 99, descricao: 'Segundo item xx', valor_centavos: 200 }),
          { descricao: 'Terceiro item x', quantidade: 1, unidade: 'Unidade', valor_centavos: 300 },
        ],
      }),
    ]);
    const rows = await sql(
      'select ordem, descricao_produto_servico from public.itens_gasto where gasto_id = $1 order by ordem',
      [G1]
    );
    expect(rows.rows).toEqual([
      { ordem: 1, descricao_produto_servico: 'Primeiro item xx' },
      { ordem: 2, descricao_produto_servico: 'Segundo item xx' },
      { ordem: 3, descricao_produto_servico: 'Terceiro item x' },
    ]);
  });

  it('grava parcelado em grafia canônica e recusa quantidade NaN', async () => {
    await sql('delete from public.gastos');
    const ids = await salvar([gasto(G2, { forma_pagamento: 'parcelado', numero_parcelas: 4 })]);
    const forma = await scalar<{ forma_pagamento: string }>(
      'select forma_pagamento from public.gastos where id = $1',
      [ids[0]]
    );
    expect(forma.forma_pagamento).toBe('Parcelado');

    await expect(
      salvar([gasto(G1, { itens: [item({ quantidade: 'NaN' })] })])
    ).rejects.toThrow(/Gasto 1: A quantidade informada é inválida/);
  });
});
