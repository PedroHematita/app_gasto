import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const USER = '11111111-1111-1111-1111-111111111111';
const OUTRO = '22222222-2222-2222-2222-222222222222';
const ORG = '33333333-3333-3333-3333-333333333333';

let db: PGlite;

async function sql(text: string, params: unknown[] = []) {
  return db.query(text, params);
}

async function scalar<T>(text: string, params: unknown[] = []): Promise<T> {
  const result = await sql(text, params);
  return result.rows[0] as T;
}

function itens(centavos: number) {
  return JSON.stringify([
    {
      ordem: 1,
      descricao: 'Serviço',
      quantidade: 1,
      unidade: 'un',
      valor_centavos: centavos,
    },
  ]);
}

async function quitar(args: {
  compromissoId: string;
  parcelaId?: string | null;
  centavos: number;
  fornecedor?: string;
  forma?: string;
  meio?: string;
  instituicao?: string;
  observacoes?: string;
  parcelas?: number | null;
  data?: string;
}) {
  const hoje = await scalar<{ hoje: string }>('select current_date::text as hoje');
  const result = await sql(
    `select public.quitar_compromisso(
      $1::uuid, $2::uuid, $3::date, $4, $5, $6, $7, $8, $9, $10, $11::jsonb
    ) as gasto_id`,
    [
      args.compromissoId,
      args.parcelaId ?? null,
      args.data ?? hoje.hoje,
      args.fornecedor ?? 'ProLife',
      args.forma ?? 'À Vista',
      args.meio ?? 'Boleto',
      args.instituicao ?? 'Nubank',
      args.observacoes ?? 'pago no balcão',
      args.centavos,
      args.parcelas ?? null,
      itens(args.centavos),
    ]
  );
  return (result.rows[0] as { gasto_id: string }).gasto_id;
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
      user_id uuid not null,
      org_id uuid not null,
      data_compra date not null,
      fornecedor text,
      forma_pagamento text,
      meio_pagamento text,
      instituicao_financeira text,
      observacoes text,
      total numeric not null,
      comprovante_url text,
      numero_parcelas integer,
      created_at timestamptz not null default now()
    );

    create table public.itens_gasto (
      id uuid primary key default gen_random_uuid(),
      gasto_id uuid not null references public.gastos (id) on delete cascade,
      ordem integer not null,
      descricao_produto_servico text not null,
      quantidade_adquirida numeric not null,
      unidade_medida text not null,
      valor_total numeric not null
    );

    create table public.compromissos (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      org_id uuid not null,
      data_compra date not null,
      data_prevista_pagamento date not null,
      fornecedor text,
      status text not null,
      tipo text not null default 'unico',
      gasto_id uuid references public.gastos (id),
      created_at timestamptz not null default now()
    );

    create table public.compromisso_parcelas (
      id uuid primary key default gen_random_uuid(),
      compromisso_id uuid not null references public.compromissos (id),
      numero_parcela integer not null,
      total_parcelas integer not null,
      valor_centavos integer not null,
      data_vencimento date not null,
      status text not null
    );

    insert into public.organizacao_membros (org_id, user_id) values ('${ORG}', '${USER}');
    select set_config('request.jwt.claim.sub', '${USER}', false);
  `);

  const migration = readFileSync(
    resolve('supabase/migrations/20261016_compromisso_parcelas_gasto_id.sql'),
    'utf8'
  );
  await db.exec(migration);

  await db.exec(`
    create or replace function public.fail_compromisso_update()
    returns trigger language plpgsql as $$
    begin
      if coalesce(current_setting('test.fail_compromisso_update', true), '') = 'on' then
        raise exception 'falha forçada';
      end if;
      return new;
    end;
    $$;

    create trigger fail_compromisso_update
      before update on public.compromissos
      for each row execute function public.fail_compromisso_update();
  `);
});

afterAll(async () => {
  await db.close();
});

async function novoCompromisso(tipo: 'unico' | 'parcelado', status = 'pendente') {
  const row = await scalar<{ id: string }>(
    `insert into public.compromissos (
      user_id, org_id, data_compra, data_prevista_pagamento, fornecedor, status, tipo
    ) values ($1, $2, current_date - 2, current_date - 1, 'Original', $3, $4)
    returning id`,
    [USER, ORG, status, tipo]
  );
  return row.id;
}

describe('quitar_compromisso', () => {
  it('quita compromisso único, grava o pagamento e não mexe nas datas originais', async () => {
    const id = await novoCompromisso('unico');
    const gastoId = await quitar({
      compromissoId: id,
      centavos: 25000,
      fornecedor: 'FIES Banco do Brasil',
      observacoes: 'parcela do mês',
    });

    const gasto = await scalar<{
      fornecedor: string;
      total: string;
      meio_pagamento: string;
      observacoes: string;
      comprovante_pendente: boolean;
      data_compra: string;
    }>('select fornecedor, total::text, meio_pagamento, observacoes, comprovante_pendente, data_compra::text from public.gastos where id = $1', [
      gastoId,
    ]);
    const compromisso = await scalar<{
      status: string;
      gasto_id: string;
      data_compra: string;
      data_prevista_pagamento: string;
      fornecedor: string;
    }>(
      `select status, gasto_id, data_compra::text, data_prevista_pagamento::text, fornecedor
       from public.compromissos where id = $1`,
      [id]
    );
    const item = await scalar<{ valor_total: string }>(
      'select valor_total::text from public.itens_gasto where gasto_id = $1',
      [gastoId]
    );

    expect(gasto.fornecedor).toBe('FIES Banco do Brasil');
    expect(gasto.meio_pagamento).toBe('Boleto');
    expect(gasto.observacoes).toBe('parcela do mês');
    expect(Number(gasto.total)).toBe(250);
    expect(gasto.comprovante_pendente).toBe(false);
    expect(Number(item.valor_total)).toBe(250);
    expect(compromisso.status).toBe('quitado');
    expect(compromisso.gasto_id).toBe(gastoId);
    expect(compromisso.fornecedor).toBe('Original');
    expect(compromisso.data_compra < compromisso.data_prevista_pagamento || compromisso.data_compra !== gasto.data_compra).toBe(true);
    expect(compromisso.data_prevista_pagamento).not.toBe(gasto.data_compra);
  });

  it('marca comprovante pendente acima de R$ 500 e limpa a marca quando a URL é gravada', async () => {
    const id = await novoCompromisso('unico', 'vencido');
    const gastoId = await quitar({ compromissoId: id, centavos: 50900, fornecedor: 'ProLife' });
    const antes = await scalar<{ comprovante_pendente: boolean; comprovante_url: string | null }>(
      'select comprovante_pendente, comprovante_url from public.gastos where id = $1',
      [gastoId]
    );
    expect(antes.comprovante_pendente).toBe(true);
    expect(antes.comprovante_url).toBeNull();

    await sql(`update public.gastos set comprovante_url = 'https://exemplo/comprovante.jpg' where id = $1`, [gastoId]);
    const depois = await scalar<{ comprovante_pendente: boolean }>(
      'select comprovante_pendente from public.gastos where id = $1',
      [gastoId]
    );
    expect(depois.comprovante_pendente).toBe(false);
  });

  it('desfaz gasto e itens se a quitação do compromisso falhar', async () => {
    const id = await novoCompromisso('unico');
    const antes = await scalar<{ n: string }>('select count(*)::text as n from public.gastos');
    await sql(`select set_config('test.fail_compromisso_update', 'on', false)`);
    await expect(quitar({ compromissoId: id, centavos: 1000 })).rejects.toThrow(/falha forçada/);
    await sql(`select set_config('test.fail_compromisso_update', 'off', false)`);

    const depois = await scalar<{ n: string }>('select count(*)::text as n from public.gastos');
    const compromisso = await scalar<{ status: string; gasto_id: string | null }>(
      'select status, gasto_id from public.compromissos where id = $1',
      [id]
    );
    expect(depois.n).toBe(antes.n);
    expect(compromisso.status).toBe('pendente');
    expect(compromisso.gasto_id).toBeNull();
  });

  it('repete a quitação sem criar outro gasto', async () => {
    const id = await novoCompromisso('unico');
    const primeiro = await quitar({ compromissoId: id, centavos: 8000 });
    const segundo = await quitar({ compromissoId: id, centavos: 8000, fornecedor: 'Outro nome' });
    const total = await scalar<{ n: string }>(
      `select count(*)::text as n from public.compromissos where id = $1`,
      [id]
    );
    const gastos = await scalar<{ n: string }>(
      'select count(*)::text as n from public.gastos where id = $1',
      [primeiro]
    );
    const todosDesseValor = await scalar<{ n: string }>(
      'select count(*)::text as n from public.gastos where total = 80'
    );
    expect(segundo).toBe(primeiro);
    expect(total.n).toBe('1');
    expect(gastos.n).toBe('1');
    expect(Number(todosDesseValor.n)).toBe(1);
  });

  it('mantém a trava da linha até o fim da transação', async () => {
    const id = await novoCompromisso('unico');
    await db.exec('begin');
    try {
      await quitar({ compromissoId: id, centavos: 1500 });
      const lock = await scalar<{ n: string }>(
        `select count(*)::text as n
         from pg_locks
         where pid = pg_backend_pid()
           and relation = 'public.compromissos'::regclass
           and mode = 'RowShareLock'`
      );
      expect(Number(lock.n)).toBeGreaterThan(0);
    } finally {
      await db.exec('rollback');
    }

    const compromisso = await scalar<{ status: string }>(
      'select status from public.compromissos where id = $1',
      [id]
    );
    expect(compromisso.status).toBe('pendente');
  });

  it('quita só a parcela escolhida e encerra o pai quando não resta parcela aberta', async () => {
    const id = await novoCompromisso('parcelado');
    const p1 = await scalar<{ id: string }>(
      `insert into public.compromisso_parcelas (
        compromisso_id, numero_parcela, total_parcelas, valor_centavos, data_vencimento, status
      ) values ($1, 1, 2, 10000, current_date, 'pendente') returning id`,
      [id]
    );
    const p2 = await scalar<{ id: string }>(
      `insert into public.compromisso_parcelas (
        compromisso_id, numero_parcela, total_parcelas, valor_centavos, data_vencimento, status
      ) values ($1, 2, 2, 12000, current_date + 30, 'pendente') returning id`,
      [id]
    );

    const gasto1 = await quitar({ compromissoId: id, parcelaId: p1.id, centavos: 10000 });
    const meio = await scalar<{ status: string; p1: string; p2: string }>(
      `select c.status,
              (select status from public.compromisso_parcelas where id = $2) as p1,
              (select status from public.compromisso_parcelas where id = $3) as p2
       from public.compromissos c where c.id = $1`,
      [id, p1.id, p2.id]
    );
    expect(meio.p1).toBe('quitado');
    expect(meio.p2).toBe('pendente');
    expect(meio.status).toBe('pendente');

    const gasto2 = await quitar({ compromissoId: id, parcelaId: p2.id, centavos: 12000 });
    const fim = await scalar<{ status: string }>(
      'select status from public.compromissos where id = $1',
      [id]
    );
    const deNovo = await quitar({ compromissoId: id, parcelaId: p1.id, centavos: 99999 });
    const nGastos = await scalar<{ n: string }>(
      `select count(*)::text as n from public.gastos where id in ($1, $2)`,
      [gasto1, gasto2]
    );

    expect(fim.status).toBe('quitado');
    expect(gasto2).not.toBe(gasto1);
    expect(deNovo).toBe(gasto1);
    expect(nGastos.n).toBe('2');
  });

  it('recusa parcela cancelada e usuário de outra organização', async () => {
    const id = await novoCompromisso('parcelado');
    const parcela = await scalar<{ id: string }>(
      `insert into public.compromisso_parcelas (
        compromisso_id, numero_parcela, total_parcelas, valor_centavos, data_vencimento, status
      ) values ($1, 1, 1, 5000, current_date, 'cancelado') returning id`,
      [id]
    );
    await expect(quitar({ compromissoId: id, parcelaId: parcela.id, centavos: 5000 })).rejects.toThrow(
      /já foi encerrada/
    );

    await sql(`select set_config('request.jwt.claim.sub', $1, false)`, [OUTRO]);
    const aberto = await novoCompromisso('unico');
    await expect(quitar({ compromissoId: aberto, centavos: 5000 })).rejects.toThrow(/não encontrado/);
    await sql(`select set_config('request.jwt.claim.sub', $1, false)`, [USER]);

    const gastosDoAberto = await scalar<{ n: string }>(
      'select count(*)::text as n from public.gastos where id in (select gasto_id from public.compromissos where id = $1)',
      [aberto]
    );
    expect(gastosDoAberto.n).toBe('0');
  });
});
