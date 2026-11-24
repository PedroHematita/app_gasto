import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  alterarDataGasto,
  classificarItemLinha,
  contarItensCompletos,
  criarGastoRascunho,
  criarItemRascunho,
  criarRascunhoVazio,
  duplicarGasto,
  gruposPorDia,
  limparRascunhoLocal,
  lerRascunhoLocal,
  LINHAS_ITEM_INICIAIS,
  ordenarGastosNaTela,
  resetAutoSeqCriacaoForTests,
  salvarRascunhoLocal,
  storageKeyCadastroMultiplo,
  totalGastoCentavos,
} from './modelo';

const memoria = new Map<string, string>();

beforeEach(() => {
  resetAutoSeqCriacaoForTests(1);
  memoria.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memoria.set(k, v);
    },
    removeItem: (k: string) => {
      memoria.delete(k);
    },
    clear: () => memoria.clear(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('criarGastoRascunho', () => {
  it('primeiro gasto usa padrões do individual e UUID estável no rascunho', () => {
    const g = criarGastoRascunho({ hoje: new Date(2026, 10, 18) });
    expect(g.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(g.dataCompraBR).toBe('18/11/2026');
    expect(g.dataHerdadaPendente).toBe(false);
    expect(g.pagamento.formaPagamento).toBe('a_vista');
    expect(g.pagamento.meioPagamento).toBe('PIX');
    expect(g.pagamento.instituicaoFinanceira).toBe('Nubank');
    expect(g.itens).toHaveLength(LINHAS_ITEM_INICIAIS);
  });

  it('gasto novo já vem com 3 linhas vazias (qtd e unidade vazias)', () => {
    const g = criarGastoRascunho({ hoje: new Date(2026, 10, 18), seqItem: 1 });
    expect(g.itens).toHaveLength(3);
    for (const item of g.itens) {
      expect(item.descricao).toBe('');
      expect(item.quantidade).toBe('');
      expect(item.unidade).toBe('');
      expect(item.valorCentavos).toBeNull();
      expect(classificarItemLinha(item)).toBe('vazia');
    }
    expect(g.itens.map((i) => i.seqCriacao)).toEqual([1, 2, 3]);
    expect(contarItensCompletos(g)).toBe(0);
    expect(totalGastoCentavos(g)).toBe(0);
  });

  it('criarItemRascunho começa com qtd e unidade vazias por padrão', () => {
    const item = criarItemRascunho();
    expect(item.quantidade).toBe('');
    expect(item.unidade).toBe('');
  });

  it('gasto seguinte herda data, meio e instituição e marca data pendente', () => {
    const primeiro = criarGastoRascunho({ hoje: new Date(2026, 10, 18) });
    primeiro.pagamento.meioPagamento = 'PIX';
    primeiro.pagamento.instituicaoFinanceira = 'C6 Madrigal';
    const segundo = criarGastoRascunho({ herdarDe: primeiro });
    expect(segundo.id).not.toBe(primeiro.id);
    expect(segundo.dataCompraBR).toBe('18/11/2026');
    expect(segundo.dataHerdadaPendente).toBe(true);
    expect(segundo.pagamento.meioPagamento).toBe('PIX');
    expect(segundo.pagamento.instituicaoFinanceira).toBe('C6 Madrigal');
    expect(segundo.pagamento.formaPagamento).toBe('a_vista');
    expect(segundo.itens).toHaveLength(LINHAS_ITEM_INICIAIS);
  });
});

describe('classificação de linhas', () => {
  it('ignora linha vazia no total e conta só completas', () => {
    const g = criarGastoRascunho({ hoje: new Date(2026, 10, 18), seqItem: 1 });
    g.itens[0] = criarItemRascunho({
      seqCriacao: 1,
      descricao: 'Gasolina',
      quantidade: '10',
      unidade: 'Litro',
      valorCentavos: 5000,
    });
    g.itens[1] = criarItemRascunho({
      seqCriacao: 2,
      descricao: 'Ab',
      quantidade: '',
      unidade: '',
      valorCentavos: null,
    });
    expect(classificarItemLinha(g.itens[0])).toBe('completa');
    expect(classificarItemLinha(g.itens[1])).toBe('incompleta');
    expect(classificarItemLinha(g.itens[2])).toBe('vazia');
    expect(contarItensCompletos(g)).toBe(1);
    expect(totalGastoCentavos(g)).toBe(5000);
  });
});

describe('ordenar e grupos', () => {
  it('agrupa por dia na ordem de aparição', () => {
    const a = criarGastoRascunho({ hoje: new Date(2026, 10, 18) });
    const b = criarGastoRascunho({ herdarDe: a });
    b.dataCompraBR = '19/11/2026';
    b.dataHerdadaPendente = false;
    const c = criarGastoRascunho({ herdarDe: a });
    const ordenados = ordenarGastosNaTela([a, b, c]);
    expect(ordenados.map((g) => g.id)).toEqual([a.id, c.id, b.id]);
    const grupos = gruposPorDia([a, b, c]);
    expect(grupos.map((g) => g.dataCompraBR)).toEqual(['18/11/2026', '19/11/2026']);
    expect(grupos[0].gastos.map((g) => g.id)).toEqual([a.id, c.id]);
  });
});

describe('duplicar e data', () => {
  it('duplicar gera novos UUIDs/seq e alterar data limpa pendência', () => {
    const g = criarGastoRascunho({ hoje: new Date(2026, 10, 18), seqItem: 1 });
    g.dataHerdadaPendente = true;
    g.itens[0] = criarItemRascunho({
      seqCriacao: 1,
      descricao: 'Gasolina',
      quantidade: '1',
      unidade: 'Litro',
      valorCentavos: 1000,
    });
    const { gasto: copia, proximaSeqItem } = duplicarGasto(g, 4);
    expect(copia.id).not.toBe(g.id);
    expect(copia.itens).toHaveLength(LINHAS_ITEM_INICIAIS);
    expect(copia.itens[0].id).not.toBe(g.itens[0].id);
    expect(copia.itens[0].descricao).toBe('Gasolina');
    expect(copia.itens[0].seqCriacao).toBe(4);
    expect(classificarItemLinha(copia.itens[1])).toBe('vazia');
    expect(classificarItemLinha(copia.itens[2])).toBe('vazia');
    expect(proximaSeqItem).toBe(7);
    const alterado = alterarDataGasto(g, '17/11/2026');
    expect(alterado.dataCompraBR).toBe('17/11/2026');
    expect(alterado.dataHerdadaPendente).toBe(false);
  });

  it('duplicar só copia linhas preenchidas e completa até 3 vazias', () => {
    const g = criarGastoRascunho({ hoje: new Date(2026, 10, 18), seqItem: 1 });
    const { gasto: soVazias } = duplicarGasto(g, 10);
    expect(soVazias.itens).toHaveLength(3);
    expect(soVazias.itens.every((i) => classificarItemLinha(i) === 'vazia')).toBe(true);
  });
});

describe('localStorage', () => {
  it('persiste por orgId e limpa após sucesso', () => {
    const r = criarRascunhoVazio('org-a', new Date(2026, 10, 18));
    const idOriginal = r.gastos[0].id;
    salvarRascunhoLocal(r);
    const lido = lerRascunhoLocal('org-a');
    expect(lido?.gastos[0].id).toBe(idOriginal);
    expect(localStorage.getItem(storageKeyCadastroMultiplo('org-a'))).toBeTruthy();
    limparRascunhoLocal('org-a');
    expect(lerRascunhoLocal('org-a')).toBeNull();
  });
});
