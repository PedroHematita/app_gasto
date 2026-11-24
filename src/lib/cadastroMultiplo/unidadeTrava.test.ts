import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  alterarDataGasto,
  criarGastoRascunho,
  criarItemRascunho,
  duplicarGasto,
  resetAutoSeqCriacaoForTests,
  type GastoRascunhoLote,
} from './modelo';
import {
  conflitosUnidadeLote,
  limparCacheUnidadeTrava,
  listarItensOrdemCriacao,
  resolverTravasUnidade,
  type ItemParaTrava,
} from './unidadeTrava';

beforeEach(() => {
  resetAutoSeqCriacaoForTests(1);
});

afterEach(() => {
  limparCacheUnidadeTrava();
});

function item(
  id: string,
  descricao: string,
  unidade: string,
  seqCriacao: number,
  gastoId = 'g1'
): ItemParaTrava {
  return { itemId: id, gastoId, descricao, unidade, seqCriacao };
}

describe('resolverTravasUnidade', () => {
  it('banco tem prioridade sobre item local', () => {
    const itens = [
      item('a', 'Gasolina', 'Unidade', 1),
      item('b', 'Gasolina', 'Litro', 2),
    ];
    const banco = new Map<string, string | null | undefined>([['gasolina', 'Litro']]);
    const r = resolverTravasUnidade(itens, banco);
    expect(r.get('a')).toMatchObject({
      travado: true,
      fonte: 'banco',
      unidadeAlvo: 'Litro',
      dica: null,
    });
    expect(r.get('b')).toMatchObject({
      travado: true,
      fonte: 'banco',
      unidadeAlvo: 'Litro',
    });
  });

  it('sem banco, a primeira ocorrência manda e fica editável', () => {
    const itens = [
      item('a', 'Arroz Tipo 1', 'Quilograma', 1),
      item('b', 'arroz  tipo  1', 'Unidade', 2),
    ];
    const banco = new Map<string, string | null | undefined>([['arroz tipo 1', null]]);
    const r = resolverTravasUnidade(itens, banco);
    expect(r.get('a')).toMatchObject({ travado: false, fonte: null, unidadeAlvo: null });
    expect(r.get('b')).toMatchObject({
      travado: true,
      fonte: 'rascunho',
      unidadeAlvo: 'Quilograma',
      dica: null,
    });
  });

  it('seguinte acompanha a mudança da primeira', () => {
    const banco = new Map<string, string | null | undefined>([['carne', null]]);
    const depois = resolverTravasUnidade(
      [item('a', 'Carne', 'Unidade', 1), item('b', 'Carne', 'Quilograma', 2)],
      banco
    );
    expect(depois.get('a')?.travado).toBe(false);
    expect(depois.get('b')).toMatchObject({ travado: true, unidadeAlvo: 'Unidade' });
  });

  it('exclusão da primeira passa a referência para a seguinte', () => {
    const banco = new Map<string, string | null | undefined>([['leite', null]]);
    const depois = resolverTravasUnidade(
      [item('b', 'Leite', 'Litro', 2), item('c', 'Leite', 'Unidade', 3)],
      banco
    );
    expect(depois.get('b')?.travado).toBe(false);
    expect(depois.get('c')).toMatchObject({ travado: true, unidadeAlvo: 'Litro' });
  });

  it('libera a trava ao mudar a descrição', () => {
    const banco = new Map<string, string | null | undefined>([
      ['gasolina', 'Litro'],
      ['diesel', null],
    ]);
    const r = resolverTravasUnidade([item('a', 'Diesel', 'Litro', 1)], banco);
    expect(r.get('a')).toMatchObject({
      travado: false,
      fonte: null,
      unidadeAlvo: null,
      pendenteBanco: false,
    });
  });

  it('marca pendente enquanto o banco não respondeu', () => {
    const itens = [item('a', 'Novo Produto X', 'Unidade', 1)];
    const banco = new Map<string, string | null | undefined>();
    const r = resolverTravasUnidade(itens, banco);
    expect(r.get('a')?.pendenteBanco).toBe(true);
  });

  it('falha de consulta bloqueia (pendente + dica tentar de novo), sem tratar como inexistente', () => {
    const itens = [item('a', 'Cimento', 'Quilograma', 1)];
    const banco = new Map<string, string | null | undefined>();
    const falhas = new Set(['cimento']);
    const r = resolverTravasUnidade(itens, banco, falhas);
    expect(r.get('a')).toMatchObject({
      pendenteBanco: true,
      falhaConsulta: true,
      dica: 'falha ao consultar — tentar de novo',
      travado: false,
    });
  });
});

describe('ordem de criação estável (seqCriacao), não posição no array', () => {
  it('Cimento criado no gasto 2 permanece referência quando um Cimento novo entra no gasto 1', () => {
    resetAutoSeqCriacaoForTests(1);
    // Gasto 1 criado primeiro, sem Cimento
    const g1 = criarGastoRascunho({ hoje: new Date(2026, 10, 18), seqItem: 1 });
    g1.id = 'gasto-1';
    g1.itens = [criarItemRascunho({ id: 'i-outros', seqCriacao: 1, descricao: 'Areia', unidade: 'Quilograma' })];

    // Gasto 2 criado depois, com Cimento Kg (seq 2) — esta é a PRIMEIRA ocorrência de Cimento
    const g2 = criarGastoRascunho({ herdarDe: g1, seqItem: 2 });
    g2.id = 'gasto-2';
    g2.itens = [
      criarItemRascunho({ id: 'i-cimento-ref', seqCriacao: 2, descricao: 'Cimento', unidade: 'Quilograma' }),
    ];

    // Depois: adiciona Cimento no gasto 1 (posição anterior no array, seq 3 — criado depois)
    g1.itens.push(
      criarItemRascunho({ id: 'i-cimento-novo', seqCriacao: 3, descricao: 'Cimento', unidade: 'Unidade' })
    );

    const gastos: GastoRascunhoLote[] = [g1, g2]; // array: gasto1 antes do gasto2
    const itens = listarItensOrdemCriacao(gastos);
    expect(itens.map((i) => i.itemId)).toEqual(['i-outros', 'i-cimento-ref', 'i-cimento-novo']);

    const banco = new Map<string, string | null | undefined>([
      ['areia', null],
      ['cimento', null],
    ]);
    const r = resolverTravasUnidade(itens, banco);
    expect(r.get('i-cimento-ref')).toMatchObject({ travado: false, unidadeAlvo: null });
    expect(r.get('i-cimento-novo')).toMatchObject({
      travado: true,
      fonte: 'rascunho',
      unidadeAlvo: 'Quilograma',
    });
  });

  it('duplicar gasto e mudar data não alteram a referência (seqCriacao)', () => {
    const g2 = criarGastoRascunho({ hoje: new Date(2026, 10, 18), seqItem: 1 });
    g2.id = 'g2';
    g2.itens = [
      criarItemRascunho({ id: 'ref', seqCriacao: 1, descricao: 'Cimento', unidade: 'Quilograma' }),
    ];
    const { gasto: copia, proximaSeqItem } = duplicarGasto(g2, 2);
    // 1 linha preenchida + 2 vazias para completar o mínimo de 3
    expect(proximaSeqItem).toBe(5);
    expect(copia.itens).toHaveLength(3);
    expect(copia.itens[0].seqCriacao).toBe(2);
    expect(copia.itens[0].id).not.toBe('ref');

    const g2Reordenado = alterarDataGasto(g2, '20/11/2026');
    const gastos: GastoRascunhoLote[] = [copia, g2Reordenado];
    const itens = listarItensOrdemCriacao(gastos);
    const banco = new Map<string, string | null | undefined>([['cimento', null]]);
    const r = resolverTravasUnidade(itens, banco);
    expect(r.get('ref')).toMatchObject({ travado: false });
    expect(r.get(copia.itens[0].id)).toMatchObject({
      travado: true,
      unidadeAlvo: 'Quilograma',
    });
  });

  it('lista itens por seqCriacao, não pela ordem do array de gastos', () => {
    const g1 = criarGastoRascunho({ hoje: new Date(2026, 10, 19), seqItem: 10 });
    g1.itens = [criarItemRascunho({ id: 'i1', seqCriacao: 10, descricao: 'A', unidade: 'Unidade' })];
    const g2 = criarGastoRascunho({ herdarDe: g1, seqItem: 5 });
    g2.dataCompraBR = '18/11/2026';
    g2.itens = [criarItemRascunho({ id: 'i2', seqCriacao: 5, descricao: 'B', unidade: 'Unidade' })];
    const ids = listarItensOrdemCriacao([g1, g2]).map((i) => i.itemId);
    expect(ids).toEqual(['i2', 'i1']);
  });
});

describe('conflitosUnidadeLote', () => {
  it('marca conflito na validação do lote', () => {
    const itens = [
      item('a', 'Gasolina', 'Unidade', 1, 'g1'),
      item('b', 'Gasolina', 'Caixa', 2, 'g2'),
    ];
    const banco = new Map<string, string | null | undefined>([['gasolina', 'Litro']]);
    const c = conflitosUnidadeLote(itens, banco);
    expect(c).toHaveLength(2);
    expect(c.every((x) => x.mensagem.includes('Litro'))).toBe(true);
  });
});
