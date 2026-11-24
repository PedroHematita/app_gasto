import { describe, expect, it } from 'vitest';
import {
  criarGastoRascunho,
  criarItemRascunho,
  removerLinhasVaziasDosGastos,
} from './modelo';
import { AVISO_LOTE_GRANDE_GASTOS, validarLote } from './validacao';

const hoje = new Date(2026, 10, 24);

function gastoOk() {
  const g = criarGastoRascunho({ hoje: new Date(2026, 10, 18) });
  g.fornecedor = 'Posto Y';
  g.itens = [
    criarItemRascunho({
      descricao: 'Gasolina',
      quantidade: '38,5',
      unidade: 'Litro',
      valorCentavos: 20000,
    }),
  ];
  return g;
}

describe('validarLote', () => {
  it('valida todos os gastos inclusive de dias recolhidos', () => {
    const a = gastoOk();
    const b = gastoOk();
    b.fornecedor = '';
    b.dataCompraBR = '17/11/2026';
    const r = validarLote([a, b], hoje);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.gastoId === b.id && e.campo === 'fornecedor')).toBe(true);
    expect(r.posicaoPorGastoId[a.id]).toBe(1);
    expect(r.posicaoPorGastoId[b.id]).toBe(2);
  });

  it('valor em branco e zero bloqueiam', () => {
    const g = gastoOk();
    g.itens[0].valorCentavos = null;
    expect(validarLote([g], hoje).ok).toBe(false);

    g.itens[0].valorCentavos = 0;
    const r = validarLote([g], hoje);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.campo === 'valor' && e.mensagem.includes('zero'))).toBe(true);
  });

  it('item com valor zero conta como incompleto e bloqueia', () => {
    const g = gastoOk();
    g.itens[0].valorCentavos = 0;
    const r = validarLote([g], hoje);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.campo === 'valor' && e.mensagem.includes('zero'))).toBe(true);
    expect(r.erros.some((e) => e.mensagem === 'Adicione pelo menos um item')).toBe(true);
  });

  it('unidade vazia bloqueia', () => {
    const g = gastoOk();
    g.itens[0].unidade = '   ';
    const r = validarLote([g], hoje);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.campo === 'unidade' && e.mensagem.includes('unidade'))).toBe(true);
  });

  it('data herdada pendente bloqueia', () => {
    const g = gastoOk();
    g.dataHerdadaPendente = true;
    const r = validarLote([g], hoje);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.campo === 'data' && e.mensagem.includes('herdada'))).toBe(true);
  });

  it('data futura e descrição curta geram erro com posição', () => {
    const g = gastoOk();
    g.dataCompraBR = '25/11/2026';
    g.itens[0].descricao = 'ab';
    const r = validarLote([g], hoje);
    expect(r.erros.some((e) => e.campo === 'data' && e.posicaoGasto === 1)).toBe(true);
    expect(r.erros.some((e) => e.campo === 'descricao')).toBe(true);
  });

  it('alerta possível duplicidade de gasto sem bloquear', () => {
    const a = gastoOk();
    const b = gastoOk();
    b.id = crypto.randomUUID();
    const r = validarLote([a, b], hoje);
    expect(r.ok).toBe(true);
    expect(r.avisos.some((x) => x.tipo === 'possivel_duplicidade')).toBe(true);
  });

  it('alerta item duplicado no mesmo gasto sem bloquear', () => {
    const g = gastoOk();
    g.itens.push(
      criarItemRascunho({
        descricao: 'gasolina',
        quantidade: '1',
        unidade: 'Litro',
        valorCentavos: 1000,
      })
    );
    const r = validarLote([g], hoje);
    expect(r.ok).toBe(true);
    expect(r.avisos.some((a) => a.tipo === 'item_duplicado')).toBe(true);
  });

  it('alerta lote grande sem bloquear', () => {
    const gastos = Array.from({ length: AVISO_LOTE_GRANDE_GASTOS }, (_, i) => {
      const g = gastoOk();
      g.id = crypto.randomUUID();
      g.fornecedor = `Forn ${i}`;
      return g;
    });
    const r = validarLote(gastos, hoje);
    expect(r.ok).toBe(true);
    expect(r.avisos.some((a) => a.tipo === 'lote_grande')).toBe(true);
  });

  it('marca conflito de unidade quando o banco manda outra unidade', () => {
    const g = gastoOk();
    g.itens[0].unidade = 'Unidade';
    const banco = new Map<string, string | null | undefined>([['gasolina', 'Litro']]);
    const r = validarLote([g], hoje, banco);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.campo === 'unidade' && e.mensagem.includes('Litro'))).toBe(true);
  });

  it('bloqueia salvamento quando a consulta de unidade falhou', () => {
    const g = gastoOk();
    const banco = new Map<string, string | null | undefined>();
    const falhas = new Set(['gasolina']);
    const r = validarLote([g], hoje, banco, falhas);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.campo === 'unidade' && e.mensagem.includes('Tente de novo'))).toBe(
      true
    );
  });

  it('lote sem gastos bloqueia', () => {
    const r = validarLote([], hoje);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.mensagem.includes('ao menos um gasto'))).toBe(true);
  });

  it('linha vazia é ignorada na validação após remoção', () => {
    const g = gastoOk();
    g.itens.push(criarItemRascunho());
    const limpos = removerLinhasVaziasDosGastos([g]);
    expect(limpos[0].itens).toHaveLength(1);
    const r = validarLote(limpos, hoje);
    expect(r.ok).toBe(true);
  });

  it('linha incompleta bloqueia o salvamento', () => {
    const g = gastoOk();
    g.itens.push(
      criarItemRascunho({
        descricao: 'Óleo',
        quantidade: '',
        unidade: '',
        valorCentavos: null,
      })
    );
    const limpos = removerLinhasVaziasDosGastos([g]);
    const r = validarLote(limpos, hoje);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.itemId === g.itens[1].id)).toBe(true);
  });

  it('gasto sem itens completos bloqueia', () => {
    const g = criarGastoRascunho({ hoje: new Date(2026, 10, 18) });
    g.fornecedor = 'Posto Y';
    const limpos = removerLinhasVaziasDosGastos([g]);
    expect(limpos[0].itens).toHaveLength(0);
    const r = validarLote(limpos, hoje);
    expect(r.ok).toBe(false);
    expect(r.erros.some((e) => e.mensagem === 'Adicione pelo menos um item')).toBe(true);
  });
});
