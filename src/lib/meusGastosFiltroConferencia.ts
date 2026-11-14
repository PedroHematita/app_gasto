import type { GastoRecord } from '../types';

export const INSTITUICAO_FILTRO_VAZIA = '__sem_instituicao__';

export type TipoMovimentacaoFiltro = 'todas' | 'conta' | 'credito' | 'outros';

export type MeusGastosFiltroConferencia = {
  instituicoes: string[];
  tipo: TipoMovimentacaoFiltro;
};

export const MEUS_GASTOS_FILTRO_VAZIO: MeusGastosFiltroConferencia = {
  instituicoes: [],
  tipo: 'todas',
};

export const TIPOS_MOVIMENTACAO_FILTRO: { id: TipoMovimentacaoFiltro; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'conta', rotulo: 'Movimentações da conta' },
  { id: 'credito', rotulo: 'Cartão de crédito' },
  { id: 'outros', rotulo: 'Outros meios' },
];

const MEIOS_CONTA = new Set([
  'PIX',
  'Transferência Bancária',
  'Boleto',
  'Cartão de Débito',
]);

const MEIO_CREDITO = 'Cartão de Crédito';

export function chaveInstituicaoFiltro(instituicao: string): string {
  const t = instituicao.trim();
  return t === '' ? INSTITUICAO_FILTRO_VAZIA : t;
}

export function rotuloInstituicaoFiltro(chave: string): string {
  return chave === INSTITUICAO_FILTRO_VAZIA ? 'Sem instituição' : chave;
}

export function tipoMovimentacaoDoMeio(meioPagamento: string): 'conta' | 'credito' | 'outros' {
  const meio = meioPagamento.trim();
  if (meio === MEIO_CREDITO) return 'credito';
  if (MEIOS_CONTA.has(meio)) return 'conta';
  return 'outros';
}

export function listarInstituicoesConferencia(
  gastos: Pick<GastoRecord, 'instituicaoFinanceira'>[],
): string[] {
  const set = new Set<string>();
  for (const g of gastos) {
    set.add(chaveInstituicaoFiltro(g.instituicaoFinanceira));
  }
  return [...set].sort((a, b) => {
    if (a === INSTITUICAO_FILTRO_VAZIA) return 1;
    if (b === INSTITUICAO_FILTRO_VAZIA) return -1;
    return rotuloInstituicaoFiltro(a).localeCompare(rotuloInstituicaoFiltro(b), 'pt-BR');
  });
}

export function temFiltroConferenciaAtivo(filtro: MeusGastosFiltroConferencia): boolean {
  return filtro.instituicoes.length > 0 || filtro.tipo !== 'todas';
}

export function gastoPassaFiltroConferencia(
  gasto: Pick<GastoRecord, 'instituicaoFinanceira' | 'meioPagamento'>,
  filtro: MeusGastosFiltroConferencia,
): boolean {
  if (filtro.instituicoes.length > 0) {
    if (!filtro.instituicoes.includes(chaveInstituicaoFiltro(gasto.instituicaoFinanceira))) {
      return false;
    }
  }
  if (filtro.tipo !== 'todas' && tipoMovimentacaoDoMeio(gasto.meioPagamento) !== filtro.tipo) {
    return false;
  }
  return true;
}

export function filtrarGastosConferencia<
  T extends Pick<GastoRecord, 'instituicaoFinanceira' | 'meioPagamento'>,
>(gastos: T[], filtro: MeusGastosFiltroConferencia): T[] {
  if (!temFiltroConferenciaAtivo(filtro)) return gastos;
  return gastos.filter((g) => gastoPassaFiltroConferencia(g, filtro));
}

const ROTULO_TIPO_RESUMO: Record<Exclude<TipoMovimentacaoFiltro, 'todas'>, string> = {
  conta: 'Conta',
  credito: 'Cartão de crédito',
  outros: 'Outros meios',
};

export function rotuloFiltroConferencia(filtro: MeusGastosFiltroConferencia): string | null {
  if (!temFiltroConferenciaAtivo(filtro)) return null;
  const partes: string[] = [];
  if (filtro.instituicoes.length === 1) {
    partes.push(rotuloInstituicaoFiltro(filtro.instituicoes[0]));
  } else if (filtro.instituicoes.length > 1) {
    partes.push(`${filtro.instituicoes.length} instituições`);
  }
  if (filtro.tipo !== 'todas') partes.push(ROTULO_TIPO_RESUMO[filtro.tipo]);
  return partes.join(' · ');
}
