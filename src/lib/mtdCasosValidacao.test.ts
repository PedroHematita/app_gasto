/**
 * Casos de validação manual aprovados — verifica que a taxonomia suporta os caminhos esperados.
 */
import { describe, it, expect } from 'vitest';
import {
  caminhoNaturezaMtdValido,
  mtdCaminhoExibicao,
  mtdPayloadEstaCompleto,
  type ClassificacaoGeralMtd,
  type DirecionamentoMtd,
} from './mtdTaxonomia';

function caso(
  nome: string,
  direcionamento: DirecionamentoMtd,
  classificacaoGeral: ClassificacaoGeralMtd,
  naturezaCaminho: string[],
  labelNatureza: string
) {
  it(nome, () => {
    expect(caminhoNaturezaMtdValido(naturezaCaminho)).toBe(true);
    expect(mtdCaminhoExibicao(naturezaCaminho)).toBe(labelNatureza);
    expect(
      mtdPayloadEstaCompleto({
        direcionamentoMtd: direcionamento,
        classificacaoGeralMtd: classificacaoGeral,
        naturezaMtdRaiz: naturezaCaminho[0] as 'material' | 'servico',
        naturezaMtdCaminho: naturezaCaminho,
      })
    ).toBe(true);
  });
}

describe('Casos de validação MTD (manual)', () => {
  caso(
    'Carne → CP → Compra de Material → Material de Consumo',
    'CP',
    'compra_material',
    ['material', 'material_consumo'],
    'Material → Material de Consumo'
  );

  caso(
    'Coca-Cola → DC → Compra de Material → Material de Revenda',
    'DC',
    'compra_material',
    ['material', 'material_revenda'],
    'Material → Material de Revenda'
  );

  caso(
    'Chopeira → CP → Compra de Material → CAPEX → Equipamento',
    'CP',
    'compra_material',
    ['material', 'material_permanente', 'ativo_capital_capex', 'equipamento'],
    'Material → Material Permanente → Ativo de Capital (CAPEX) → Equipamento'
  );

  caso(
    'Manutenção elétrica → CP → Serviço → Serviços Básicos à Produção',
    'CP',
    'servico',
    ['servico', 'servicos_basicos_producao'],
    'Serviço → Serviços Básicos à Produção'
  );

  caso(
    'Contabilidade geral → DS → Serviço → Serviços Regulatórios Indispensáveis',
    'DS',
    'servico',
    ['servico', 'servicos_regulatorios_indispensaveis'],
    'Serviço → Serviços Regulatórios Indispensáveis'
  );
});
