import { describe, it, expect } from 'vitest';
import {
  MTD_STATUS_CLASSIFICADO,
  MTD_STATUS_NAO_CLASSIFICADO,
  MTD_STATUS_PARCIALMENTE_CLASSIFICADO,
} from './mtdTaxonomia';
import {
  computarMtdStatusGasto,
  contagemMtdItens,
  itemMtdEstaClassificado,
  statusMtdLinhaItem,
  statusMtdResumoGasto,
} from './mtdClassificacao';

const itemClassificado = {
  mtdStatus: MTD_STATUS_CLASSIFICADO,
  direcionamentoMtd: 'CP',
  classificacaoGeralMtd: 'compra_material',
  naturezaMtdRaiz: 'material',
  naturezaMtdCaminho: ['material', 'material_consumo'],
};

const itemPendente = {
  mtdStatus: MTD_STATUS_NAO_CLASSIFICADO,
  direcionamentoMtd: null,
  classificacaoGeralMtd: null,
  naturezaMtdRaiz: null,
  naturezaMtdCaminho: null,
};

describe('MTD por item — consolidado do gasto', () => {
  it('itemMtdEstaClassificado', () => {
    expect(itemMtdEstaClassificado(itemClassificado)).toBe(true);
    expect(itemMtdEstaClassificado(itemPendente)).toBe(false);
  });

  it('computarMtdStatusGasto — nenhum item classificado', () => {
    expect(computarMtdStatusGasto([itemPendente, itemPendente])).toBe(MTD_STATUS_NAO_CLASSIFICADO);
  });

  it('computarMtdStatusGasto — parcial', () => {
    expect(computarMtdStatusGasto([itemClassificado, itemPendente])).toBe(
      MTD_STATUS_PARCIALMENTE_CLASSIFICADO
    );
  });

  it('computarMtdStatusGasto — todos classificados', () => {
    expect(computarMtdStatusGasto([itemClassificado, itemClassificado])).toBe(
      MTD_STATUS_CLASSIFICADO
    );
  });

  it('contagemMtdItens e statusMtdResumoGasto', () => {
    const grupo = {
      mtdStatus: MTD_STATUS_PARCIALMENTE_CLASSIFICADO,
      itens: [itemClassificado, itemPendente],
    };
    expect(contagemMtdItens(grupo.itens)).toEqual({ classificados: 1, total: 2 });
    expect(statusMtdResumoGasto(grupo)).toBe('MTD 1/2');
    expect(statusMtdLinhaItem(itemPendente)).toBe('Pendente MTD');
  });
});
