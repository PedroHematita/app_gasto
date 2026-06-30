import { describe, it, expect } from 'vitest';
import {
  caminhoNaturezaMtdValido,
  mtdCaminhoExibicao,
  mtdPayloadEstaCompleto,
  mtdSlugParaLabel,
  raizFromCaminho,
  listarCaminhosNaturezaSelecionaveis,
  raizMtdSugeridaPorClassificacaoGeral,
  avisoCoerenciaMtdClassificacaoNatureza,
} from './mtdTaxonomia';
import {
  gastoElegivelMtd,
  mapGastoMtdGrupoFromDb,
  mtdPayloadFromForm,
  statusMtdExibicaoItem,
  validarClassificacaoMtdMassa,
} from './mtdClassificacao';
import { MTD_STATUS_CLASSIFICADO, MTD_STATUS_NAO_CLASSIFICADO } from './mtdTaxonomia';

describe('mtdTaxonomia', () => {
  it('resolve slug para label', () => {
    expect(mtdSlugParaLabel('servicos_basicos_producao')).toBe('Serviços Básicos à Produção');
    expect(mtdSlugParaLabel('CP')).toBe('Departamento Operacional (CP)');
  });

  it('valida caminho de natureza', () => {
    expect(
      caminhoNaturezaMtdValido(['material', 'material_consumo'])
    ).toBe(true);
    expect(
      caminhoNaturezaMtdValido(['material', 'material_permanente', 'ativo_capital_capex', 'equipamento'])
    ).toBe(true);
    expect(caminhoNaturezaMtdValido(['material', 'invalido'])).toBe(false);
  });

  it('formata caminho para exibição', () => {
    expect(
      mtdCaminhoExibicao(['material', 'material_consumo'])
    ).toBe('Material → Material de Consumo');
  });

  it('lista caminhos selecionáveis por raiz', () => {
    const paths = listarCaminhosNaturezaSelecionaveis('servico');
    expect(paths.some((p) => p[p.length - 1] === 'servicos_basicos_producao')).toBe(true);
  });

  it('raizFromCaminho', () => {
    expect(raizFromCaminho(['mao_obra', 'mao_obra_direta'])).toBe('mao_obra');
  });

  it('sugere raiz a partir da classificação geral', () => {
    expect(raizMtdSugeridaPorClassificacaoGeral('compra_material')).toBe('material');
    expect(raizMtdSugeridaPorClassificacaoGeral('servico')).toBe('servico');
    expect(raizMtdSugeridaPorClassificacaoGeral('mao_obra')).toBe('mao_obra');
    expect(raizMtdSugeridaPorClassificacaoGeral('compra_material_servico')).toBeNull();
  });

  it('alerta incoerência entre classificação geral e raiz', () => {
    expect(avisoCoerenciaMtdClassificacaoNatureza('compra_material', 'material')).toBeNull();
    expect(avisoCoerenciaMtdClassificacaoNatureza('servico', 'servico')).toBeNull();
    expect(avisoCoerenciaMtdClassificacaoNatureza('compra_material_servico', 'servico')).toBeNull();
    expect(avisoCoerenciaMtdClassificacaoNatureza('compra_material', 'servico')).toMatch(/costuma combinar/);
  });

  it('mantém label legado para slug gasto', () => {
    expect(mtdSlugParaLabel('gasto')).toBe('Gasto');
  });
});

describe('mtdPayloadEstaCompleto', () => {
  const payloadValido = {
    direcionamentoMtd: 'CP' as const,
    classificacaoGeralMtd: 'compra_material' as const,
    naturezaMtdRaiz: 'material' as const,
    naturezaMtdCaminho: ['material', 'material_consumo'],
  };

  it('aceita payload completo', () => {
    expect(mtdPayloadEstaCompleto(payloadValido)).toBe(true);
  });

  it('rejeita payload incompleto', () => {
    expect(mtdPayloadEstaCompleto({ ...payloadValido, direcionamentoMtd: undefined })).toBe(false);
  });
});

describe('mtdClassificacao helpers', () => {
  it('gastoElegivelMtd só empresarial', () => {
    expect(gastoElegivelMtd('Empresarial')).toBe(true);
    expect(gastoElegivelMtd('Pessoal')).toBe(false);
    expect(gastoElegivelMtd('Não Classificado')).toBe(false);
  });

  it('mapGastoMtdGrupoFromDb', () => {
    const grupo = mapGastoMtdGrupoFromDb({
      id: '1',
      data_compra: '2026-05-01',
      total: 100,
      tipo_gasto: 'Empresarial',
      mtd_status: MTD_STATUS_NAO_CLASSIFICADO,
      itens_gasto: [
        {
          id: 'i1',
          ordem: 1,
          descricao_produto_servico: 'Parafuso',
          quantidade_adquirida: 10,
          unidade_medida: 'un',
          valor_total: 50,
          mtd_status: MTD_STATUS_NAO_CLASSIFICADO,
        },
      ],
    });
    expect(grupo.total).toBe(10000);
    expect(grupo.itens).toHaveLength(1);
    expect(grupo.itens[0].descricao).toBe('Parafuso');
  });

  it('statusMtdExibicaoItem pendente', () => {
    expect(
      statusMtdExibicaoItem({
        mtdStatus: MTD_STATUS_NAO_CLASSIFICADO,
        direcionamentoMtd: null,
        classificacaoGeralMtd: null,
        naturezaMtdRaiz: null,
        naturezaMtdCaminho: null,
      })
    ).toBe('Não Classificado MTD');
  });

  it('mtdPayloadFromForm', () => {
    const p = mtdPayloadFromForm({
      direcionamentoMtd: 'DC',
      classificacaoGeralMtd: 'servico',
      naturezaMtdCaminho: ['servico', 'servicos_geracao_valor'],
    });
    expect(p?.naturezaMtdRaiz).toBe('servico');
  });

  it('validarClassificacaoMtdMassa', () => {
    const ok = validarClassificacaoMtdMassa({
      ids: ['a'],
      payload: {
        direcionamentoMtd: 'CP',
        classificacaoGeralMtd: 'compra_material',
        naturezaMtdRaiz: 'material',
        naturezaMtdCaminho: ['material', 'material_revenda'],
      },
    });
    expect(ok.ok).toBe(true);
  });

  it('rejeita classificação geral legada "gasto"', () => {
    const result = validarClassificacaoMtdMassa({
      ids: ['a'],
      payload: {
        direcionamentoMtd: 'CP',
        classificacaoGeralMtd: 'gasto' as 'compra_material',
        naturezaMtdRaiz: 'material',
        naturezaMtdCaminho: ['material', 'material_revenda'],
      },
    });
    expect(result.ok).toBe(false);
  });
});
