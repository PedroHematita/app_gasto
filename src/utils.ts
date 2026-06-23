import { isDateInForecastWindow } from './lib/forecastWindow';
import { isFormaPagamentoParcelado } from './lib/gastosParceladosFuturos';
import type { PerenePeriodInput } from './lib/gastosPerenePeriods';
import {
  TIPO_GASTO_NAO_CLASSIFICADO,
  type GastoClassificacaoPayload,
  type GastoClassificacaoRow,
} from './types';
import type {
  ClassificarFiltroClassificacao,
  ClassificarFiltroData,
  ClassificarFiltroDataPreset,
  ClassificarFiltroFormaChave,
  ClassificarFiltroPagamento,
  ClassificarFiltrosState,
  ClassificarOrdenacaoState,
  GastoItem,
  PaymentData,
  CompromissoRecord,
  GastoPereneRecord,
  PeriodicidadePerene,
} from './types';

/** Mensagem única para fornecedor obrigatório (UI + camada de dados). */
export const FORNECEDOR_REQUIRED_MSG =
  'Informe o fornecedor ou local do serviço antes de salvar.';

export function requireFornecedorTrimmed(fornecedor: string): string {
  const t = fornecedor.trim();
  if (!t) throw new Error(FORNECEDOR_REQUIRED_MSG);
  return t;
}

/** Trim + lower + colapsar espaços — alinhado a `normalize_cotacao_descricao` no Postgres. */
export function normalizeDescricao(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function formatCurrency(cents: number): string {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Rótulo da diferença planejado → realizado (ex.: `-R$ 20,00`, `+R$ 30,00`). */
export function formatDiferencaValorCents(diffCents: number): string {
  if (diffCents > 0) return `+${formatCurrency(diffCents)}`;
  return formatCurrency(diffCents);
}

/** Observação automática quando valor realizado ≠ planejado; `null` se iguais. */
export function observacaoAutomaticaDiferencaValor(
  planejadoCents: number,
  realizadoCents: number
): string | null {
  if (planejadoCents === realizadoCents) return null;

  const planejado = formatCurrency(planejadoCents);
  const realizado = formatCurrency(realizadoCents);
  const diffStr = formatDiferencaValorCents(realizadoCents - planejadoCents);

  if (realizadoCents < planejadoCents) {
    return `Valor realizado menor que o planejado. Planejado: ${planejado}. Realizado: ${realizado}. Diferença: ${diffStr}.`;
  }
  return `Valor realizado maior que o planejado. Planejado: ${planejado}. Realizado: ${realizado}. Diferença: ${diffStr}.`;
}

/** Preserva observação do usuário e acrescenta linha automática de diferença, se houver. */
export function appendObservacaoDiferencaValor(
  observacoesUsuario: string,
  planejadoCents: number,
  realizadoCents: number
): string {
  const auto = observacaoAutomaticaDiferencaValor(planejadoCents, realizadoCents);
  const user = observacoesUsuario.trim();
  if (!auto) return user;
  return user ? `${user}\n\n${auto}` : auto;
}

/** Redistribui valores dos itens para somar `targetTotalCents` (1 item → valor integral). */
export function scaleItemsValorToTotal<
  T extends {
    ordem: number;
    descricao: string;
    quantidade: number;
    unidade: string;
    valorCentavos: number;
  },
>(items: T[], targetTotalCents: number): T[] {
  if (items.length === 0) return items;
  if (items.length === 1) {
    return [{ ...items[0], valorCentavos: targetTotalCents }];
  }

  const planned = items.reduce((s, i) => s + i.valorCentavos, 0);
  if (planned <= 0) {
    const copy = items.map((item) => ({ ...item, valorCentavos: 0 }));
    copy[0] = { ...copy[0], valorCentavos: targetTotalCents };
    return copy;
  }

  const scaled = items.map((item) => ({
    ...item,
    valorCentavos: Math.round((item.valorCentavos * targetTotalCents) / planned),
  }));
  const sum = scaled.reduce((s, i) => s + i.valorCentavos, 0);
  const drift = targetTotalCents - sum;
  if (drift !== 0) {
    const last = scaled.length - 1;
    scaled[last] = { ...scaled[last], valorCentavos: scaled[last].valorCentavos + drift };
  }
  return scaled;
}

export const FORNECEDOR_CLASSIFICAR_SEM = 'Sem fornecedor';

/** Fornecedor na listagem Classificar Gastos. */
export function fornecedorExibicaoClassificacao(fornecedor: string): string {
  return fornecedorChaveClassificacao(fornecedor);
}

/** Chave estável para filtro e exibição (vazio → Sem fornecedor). */
export function fornecedorChaveClassificacao(fornecedor: string): string {
  const t = fornecedor.trim();
  return t || FORNECEDOR_CLASSIFICAR_SEM;
}

/** Fornecedores únicos dos gastos carregados, ordenados pt-BR. */
export function listarFornecedoresClassificacao(
  gastos: Pick<GastoClassificacaoRow, 'fornecedor'>[]
): string[] {
  const set = new Set<string>();
  for (const g of gastos) {
    set.add(fornecedorChaveClassificacao(g.fornecedor));
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Busca parcial case-insensitive na lista de chaves. */
export function buscarFornecedoresClassificacao(
  fornecedores: string[],
  busca: string
): string[] {
  const q = busca.trim().toLowerCase();
  if (!q) return fornecedores;
  return fornecedores.filter((f) => f.toLowerCase().includes(q));
}

export function temFiltroFornecedorClassificacaoAtivo(fornecedores: string[]): boolean {
  return fornecedores.length > 0;
}

export function gastoPassaFiltroFornecedorClassificacao(
  gasto: Pick<GastoClassificacaoRow, 'fornecedor'>,
  fornecedoresSelecionados: string[]
): boolean {
  if (fornecedoresSelecionados.length === 0) return true;
  return fornecedoresSelecionados.includes(fornecedorChaveClassificacao(gasto.fornecedor));
}

export function rotuloFiltroFornecedorClassificacao(fornecedores: string[]): string | null {
  if (fornecedores.length === 0) return null;
  if (fornecedores.length === 1) return `Fornecedor: ${fornecedores[0]}`;
  return `Fornecedor: ${fornecedores.length} selecionados`;
}

export function filtrarGastosClassificacaoPorFornecedor(
  gastos: GastoClassificacaoRow[],
  fornecedoresSelecionados: string[]
): GastoClassificacaoRow[] {
  if (!temFiltroFornecedorClassificacaoAtivo(fornecedoresSelecionados)) return gastos;
  return gastos.filter((g) =>
    gastoPassaFiltroFornecedorClassificacao(g, fornecedoresSelecionados)
  );
}

export { TIPO_GASTO_NAO_CLASSIFICADO };

export function tipoGastoNormalizado(tipo: string): string {
  const t = tipo.trim();
  return t || TIPO_GASTO_NAO_CLASSIFICADO;
}

export function gastoEstaClassificado(
  gasto: Pick<GastoClassificacaoRow, 'tipoGasto'>
): boolean {
  return tipoGastoNormalizado(gasto.tipoGasto) !== TIPO_GASTO_NAO_CLASSIFICADO;
}

/** Status discreto na coluna Fornecedor. */
export function statusClassificacaoTabela(
  gasto: Pick<GastoClassificacaoRow, 'tipoGasto' | 'setor' | 'quemGastou'>
): string {
  if (!gastoEstaClassificado(gasto)) return 'Não classificado';
  const tipo = tipoGastoNormalizado(gasto.tipoGasto);
  const setor = gasto.setor?.trim();
  if (setor) return `${tipo} · ${setor}`;
  const quem = gasto.quemGastou?.trim();
  if (quem) return `${tipo} · ${quem}`;
  return tipo;
}

export type ClassificacaoGastoOpcao = 'Pessoal' | 'Empresa';

export const CLASSIFICACAO_GASTO_OPCOES: ClassificacaoGastoOpcao[] = ['Pessoal', 'Empresa'];

/** Mapeia escolha do modal para valores gravados em `gastos`. */
export function montarPayloadClassificacaoSimples(
  classificacao: ClassificacaoGastoOpcao
): GastoClassificacaoPayload {
  if (classificacao === 'Pessoal') {
    return { tipoGasto: 'Pessoal', quemGastou: 'Pedro', setor: null };
  }
  return { tipoGasto: 'Empresarial', quemGastou: 'Madrigal', setor: null };
}

export function idsVisiveisParaClassificacao(
  selectedIds: Iterable<string>,
  gastosVisiveis: Pick<GastoClassificacaoRow, 'id'>[]
): string[] {
  const visible = new Set(gastosVisiveis.map((g) => g.id));
  const ids: string[] = [];
  for (const id of selectedIds) {
    if (visible.has(id)) ids.push(id);
  }
  return ids;
}

export type ValidarClassificacaoMassaInput = {
  ids: string[];
  classificacao: ClassificacaoGastoOpcao | '';
  responsavelClassificacao: string | null;
};

export type ValidarClassificacaoMassaResult =
  | { ok: true; payload: GastoClassificacaoPayload }
  | { ok: false; mensagem: string };

export function validarClassificacaoMassa(
  input: ValidarClassificacaoMassaInput
): ValidarClassificacaoMassaResult {
  if (input.ids.length === 0) {
    return { ok: false, mensagem: 'Não é possível classificar sem seleção.' };
  }

  if (input.classificacao !== 'Pessoal' && input.classificacao !== 'Empresa') {
    return { ok: false, mensagem: 'Escolha uma classificação.' };
  }

  return { ok: true, payload: montarPayloadClassificacaoSimples(input.classificacao) };
}

export function validarClassificacaoMassaComAuth(
  input: ValidarClassificacaoMassaInput
): ValidarClassificacaoMassaResult {
  if (!input.responsavelClassificacao?.trim()) {
    return { ok: false, mensagem: 'Faça login para classificar gastos.' };
  }
  return validarClassificacaoMassa(input);
}

/** Segunda linha da listagem: forma · meio · instituição. */
export function linhaPagamentoClassificacao(
  gasto: Pick<
    GastoClassificacaoRow,
    'formaPagamento' | 'meioPagamento' | 'instituicaoFinanceira' | 'parcelas'
  >
): string {
  const meio = gasto.meioPagamento || '—';
  const inst = gasto.instituicaoFinanceira || '—';
  if (isFormaPagamentoParcelado(gasto.formaPagamento)) {
    const n = gasto.parcelas;
    if (typeof n === 'number' && n > 1) {
      return `Parcelado ${n}x · ${meio} · ${inst}`;
    }
    return `Parcelado · ${meio} · ${inst}`;
  }
  return `À Vista · ${meio} · ${inst}`;
}

/** Ordenação defensiva: data_compra ISO desc, created_at desc. */
export function compareGastoClassificacaoDesc(
  a: GastoClassificacaoRow,
  b: GastoClassificacaoRow
): number {
  const byDate = b.dataCompra.localeCompare(a.dataCompra);
  if (byDate !== 0) return byDate;
  return (b.createdAt || '').localeCompare(a.createdAt || '');
}

export function sortGastosClassificacaoDesc(
  gastos: GastoClassificacaoRow[]
): GastoClassificacaoRow[] {
  return [...gastos].sort(compareGastoClassificacaoDesc);
}

export const CLASSIFICAR_FILTRO_DATA_VAZIO: ClassificarFiltroData = {
  preset: null,
  dataInicial: null,
  dataFinal: null,
};

export const CLASSIFICAR_FILTRO_PAGAMENTO_VAZIO: ClassificarFiltroPagamento = {
  formas: [],
  meios: [],
  instituicoes: [],
};

export const CLASSIFICAR_FILTRO_CLASSIFICACAO_PADRAO = 'todos' as const;

export const CLASSIFICAR_FILTRO_CLASSIFICACAO_OPCOES: {
  id: ClassificarFiltroClassificacao;
  label: string;
}[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'nao_classificados', label: 'Não classificados' },
  { id: 'pessoal', label: 'Pessoal' },
  { id: 'empresa', label: 'Empresa' },
];

export const CLASSIFICAR_FILTROS_VAZIO: ClassificarFiltrosState = {
  data: CLASSIFICAR_FILTRO_DATA_VAZIO,
  fornecedores: [],
  pagamento: CLASSIFICAR_FILTRO_PAGAMENTO_VAZIO,
  classificacao: CLASSIFICAR_FILTRO_CLASSIFICACAO_PADRAO,
};

export const CLASSIFICAR_ORDENACAO_PADRAO: ClassificarOrdenacaoState = {
  modo: 'padrao',
  direcao: 'asc',
};

const ROTULO_PRESET_DATA_CLASSIFICAR: Record<ClassificarFiltroDataPreset, string> = {
  hoje: 'Hoje',
  esta_semana: 'Esta semana',
  este_mes: 'Este mês',
  mes_anterior: 'Mês anterior',
  ultimos_7: 'Últimos 7 dias',
  ultimos_30: 'Últimos 30 dias',
};

/** ISO yyyy-mm-dd a partir de data local (sem UTC shift). */
export function dataCompraISOLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inicioSemanaSegundaLocal(ref: Date): Date {
  const d = startOfDayLocal(ref);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function fimSemanaDomingoLocal(ref: Date): Date {
  const start = inicioSemanaSegundaLocal(ref);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function inicioMesLocal(year: number, monthIndex: number): Date {
  return startOfDayLocal(new Date(year, monthIndex, 1));
}

function fimMesLocal(year: number, monthIndex: number): Date {
  return startOfDayLocal(new Date(year, monthIndex + 1, 0));
}

/** Intervalo ISO inclusivo para o filtro de data (preset ou período personalizado futuro). */
export function intervaloFiltroDataClassificacao(
  filtro: ClassificarFiltroData,
  refDate: Date = new Date()
): { inicio: string; fim: string } | null {
  if (filtro.dataInicial && filtro.dataFinal) {
    const inicio =
      filtro.dataInicial <= filtro.dataFinal ? filtro.dataInicial : filtro.dataFinal;
    const fim =
      filtro.dataInicial <= filtro.dataFinal ? filtro.dataFinal : filtro.dataInicial;
    return { inicio, fim };
  }
  if (!filtro.preset) return null;

  const ref = startOfDayLocal(refDate);

  switch (filtro.preset) {
    case 'hoje':
      return { inicio: dataCompraISOLocal(ref), fim: dataCompraISOLocal(ref) };
    case 'esta_semana':
      return {
        inicio: dataCompraISOLocal(inicioSemanaSegundaLocal(ref)),
        fim: dataCompraISOLocal(fimSemanaDomingoLocal(ref)),
      };
    case 'este_mes':
      return {
        inicio: dataCompraISOLocal(inicioMesLocal(ref.getFullYear(), ref.getMonth())),
        fim: dataCompraISOLocal(fimMesLocal(ref.getFullYear(), ref.getMonth())),
      };
    case 'mes_anterior': {
      const m = ref.getMonth() - 1;
      const y = m < 0 ? ref.getFullYear() - 1 : ref.getFullYear();
      const monthIndex = m < 0 ? 11 : m;
      return {
        inicio: dataCompraISOLocal(inicioMesLocal(y, monthIndex)),
        fim: dataCompraISOLocal(fimMesLocal(y, monthIndex)),
      };
    }
    case 'ultimos_7': {
      const start = new Date(ref);
      start.setDate(start.getDate() - 6);
      return { inicio: dataCompraISOLocal(start), fim: dataCompraISOLocal(ref) };
    }
    case 'ultimos_30': {
      const start = new Date(ref);
      start.setDate(start.getDate() - 29);
      return { inicio: dataCompraISOLocal(start), fim: dataCompraISOLocal(ref) };
    }
    default:
      return null;
  }
}

export function temFiltroDataClassificacaoAtivo(filtro: ClassificarFiltroData): boolean {
  return filtro.preset !== null || !!(filtro.dataInicial && filtro.dataFinal);
}

export function temFiltroClassificacaoRapidaAtivo(
  classificacao: ClassificarFiltrosState['classificacao']
): boolean {
  return classificacao !== CLASSIFICAR_FILTRO_CLASSIFICACAO_PADRAO;
}

export function rotuloFiltroClassificacaoRapida(
  classificacao: ClassificarFiltrosState['classificacao']
): string | null {
  const opcao = CLASSIFICAR_FILTRO_CLASSIFICACAO_OPCOES.find((o) => o.id === classificacao);
  if (!opcao || classificacao === CLASSIFICAR_FILTRO_CLASSIFICACAO_PADRAO) return null;
  return opcao.label;
}

export function gastoPassaFiltroClassificacaoRapida(
  gasto: Pick<GastoClassificacaoRow, 'tipoGasto' | 'quemGastou'>,
  filtro: ClassificarFiltrosState['classificacao']
): boolean {
  if (filtro === 'todos') return true;
  if (filtro === 'nao_classificados') return !gastoEstaClassificado(gasto);
  if (filtro === 'pessoal') {
    if (tipoGastoNormalizado(gasto.tipoGasto) !== 'Pessoal') return false;
    const quem = gasto.quemGastou?.trim();
    if (quem) return quem === 'Pedro';
    return true;
  }
  if (filtro === 'empresa') {
    if (tipoGastoNormalizado(gasto.tipoGasto) !== 'Empresarial') return false;
    const quem = gasto.quemGastou?.trim();
    if (quem) return quem === 'Madrigal';
    return true;
  }
  return true;
}

export function filtrarGastosClassificacaoPorClassificacao(
  gastos: GastoClassificacaoRow[],
  classificacao: ClassificarFiltrosState['classificacao']
): GastoClassificacaoRow[] {
  if (!temFiltroClassificacaoRapidaAtivo(classificacao)) return gastos;
  return gastos.filter((g) => gastoPassaFiltroClassificacaoRapida(g, classificacao));
}

export function temFiltrosClassificacaoAtivos(filtros: ClassificarFiltrosState): boolean {
  return (
    temFiltroDataClassificacaoAtivo(filtros.data) ||
    temFiltroFornecedorClassificacaoAtivo(filtros.fornecedores) ||
    temFiltroPagamentoClassificacaoAtivo(filtros.pagamento) ||
    temFiltroClassificacaoRapidaAtivo(filtros.classificacao)
  );
}

export function gastoPassaFiltroDataClassificacao(
  gasto: Pick<GastoClassificacaoRow, 'dataCompra'>,
  filtro: ClassificarFiltroData,
  refDate?: Date
): boolean {
  const intervalo = intervaloFiltroDataClassificacao(filtro, refDate);
  if (!intervalo) return true;
  return (
    gasto.dataCompra >= intervalo.inicio && gasto.dataCompra <= intervalo.fim
  );
}

export function rotuloFiltroDataClassificacao(filtro: ClassificarFiltroData): string | null {
  if (!temFiltroDataClassificacaoAtivo(filtro)) return null;
  if (filtro.preset) return ROTULO_PRESET_DATA_CLASSIFICAR[filtro.preset];
  if (filtro.dataInicial && filtro.dataFinal) {
    return `${dataCompraTabelaClassificacao(filtro.dataInicial)} – ${dataCompraTabelaClassificacao(filtro.dataFinal)}`;
  }
  return null;
}

export function filtrarGastosClassificacaoPorData(
  gastos: GastoClassificacaoRow[],
  filtro: ClassificarFiltroData,
  refDate?: Date
): GastoClassificacaoRow[] {
  if (!temFiltroDataClassificacaoAtivo(filtro)) return gastos;
  return gastos.filter((g) => gastoPassaFiltroDataClassificacao(g, filtro, refDate));
}

export function sortGastosClassificacaoValor(
  gastos: GastoClassificacaoRow[],
  direcao: 'asc' | 'desc'
): GastoClassificacaoRow[] {
  return [...gastos].sort((a, b) => {
    const diff = direcao === 'asc' ? a.total - b.total : b.total - a.total;
    if (diff !== 0) return diff;
    return compareGastoClassificacaoDesc(a, b);
  });
}

export function proximaOrdenacaoValorClassificacao(
  atual: ClassificarOrdenacaoState
): ClassificarOrdenacaoState {
  if (atual.modo !== 'valor') return { modo: 'valor', direcao: 'asc' };
  if (atual.direcao === 'asc') return { modo: 'valor', direcao: 'desc' };
  return CLASSIFICAR_ORDENACAO_PADRAO;
}

/** Pipeline em memória: data → fornecedor → pagamento → ordenação (padrão ou valor). */
export function aplicarFiltrosEOrdenacaoClassificacao(
  gastos: GastoClassificacaoRow[],
  filtros: ClassificarFiltrosState,
  ordenacao: ClassificarOrdenacaoState,
  refDate?: Date
): GastoClassificacaoRow[] {
  let rows = filtrarGastosClassificacaoPorData(gastos, filtros.data, refDate);
  rows = filtrarGastosClassificacaoPorFornecedor(rows, filtros.fornecedores);
  rows = filtrarGastosClassificacaoPorPagamento(rows, filtros.pagamento);
  rows = filtrarGastosClassificacaoPorClassificacao(rows, filtros.classificacao);
  if (ordenacao.modo === 'valor') {
    rows = sortGastosClassificacaoValor(rows, ordenacao.direcao);
  } else {
    rows = sortGastosClassificacaoDesc(rows);
  }
  return rows;
}

/** Data completa para tabela Classificar: dd/mm/aaaa (ordenação continua na ISO). */
export function dataCompraTabelaClassificacao(dataCompraISO: string): string {
  const [y, m, d] = dataCompraISO.split('-');
  if (!y || !m || !d) return dataCompraISO;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

/** Mapeia linha Supabase → `GastoClassificacaoRow` (testável sem client). */
export function mapGastoClassificacaoRowFromDb(row: {
  id: string;
  data_compra: string;
  created_at?: string | null;
  fornecedor?: string | null;
  forma_pagamento?: string | null;
  meio_pagamento?: string | null;
  instituicao_financeira?: string | null;
  numero_parcelas?: number | null;
  total?: number | null;
  quem_gastou?: string | null;
  tipo_gasto?: string | null;
  setor?: string | null;
  data_classificacao?: string | null;
  responsavel_classificacao?: string | null;
}): GastoClassificacaoRow {
  const iso = String(row.data_compra);
  return {
    id: row.id,
    dataCompra: iso,
    dataCompraBR: dataCompraTabelaClassificacao(iso),
    createdAt: row.created_at ?? undefined,
    fornecedor: row.fornecedor || '',
    formaPagamento: row.forma_pagamento || '',
    meioPagamento: row.meio_pagamento || '',
    instituicaoFinanceira: row.instituicao_financeira || '',
    parcelas: row.numero_parcelas ?? undefined,
    total: Math.round((row.total || 0) * 100),
    quemGastou: row.quem_gastou ?? null,
    tipoGasto: row.tipo_gasto ?? TIPO_GASTO_NAO_CLASSIFICADO,
    setor: row.setor ?? null,
    dataClassificacao: row.data_classificacao ?? null,
    responsavelClassificacao: row.responsavel_classificacao ?? null,
  };
}

/** Coluna Forma na tabela Classificar. */
export function formaPagamentoTabelaClassificacao(
  gasto: Pick<GastoClassificacaoRow, 'formaPagamento' | 'parcelas'>
): string {
  if (isFormaPagamentoParcelado(gasto.formaPagamento)) {
    const n = gasto.parcelas;
    if (typeof n === 'number' && n > 1) return `Parc. ${n}x`;
    return 'Parcelado';
  }
  return 'À Vista';
}

const MEIO_PAGAMENTO_TABELA: Record<string, string> = {
  'Cartão de Crédito': 'Crédito',
  'Cartão de Débito': 'Débito',
  'Transferência Bancária': 'Transf.',
  'Boleto Parcelado': 'Bol. Parc.',
  PIX: 'PIX',
  Dinheiro: 'Dinheiro',
  Boleto: 'Boleto',
  Financiamento: 'Financ.',
};

export const FORMAS_FILTRO_CLASSIFICAR: { chave: ClassificarFiltroFormaChave; rotulo: string }[] = [
  { chave: 'a_vista', rotulo: 'À Vista' },
  { chave: 'parcelado', rotulo: 'Parcelado' },
];

/** Meios do filtro: rótulo amigável → valor canônico em `meioPagamento`. */
export const MEIOS_FILTRO_CLASSIFICAR: { rotulo: string; canonico: string }[] = [
  { rotulo: 'PIX', canonico: 'PIX' },
  { rotulo: 'Crédito', canonico: 'Cartão de Crédito' },
  { rotulo: 'Débito', canonico: 'Cartão de Débito' },
  { rotulo: 'Boleto', canonico: 'Boleto' },
  { rotulo: 'Boleto Parcelado', canonico: 'Boleto Parcelado' },
  { rotulo: 'Dinheiro', canonico: 'Dinheiro' },
  { rotulo: 'Transferência', canonico: 'Transferência Bancária' },
  { rotulo: 'Financiamento', canonico: 'Financiamento' },
];

export function formaPagamentoChaveClassificacao(
  formaPagamento: string
): ClassificarFiltroFormaChave {
  return isFormaPagamentoParcelado(formaPagamento) ? 'parcelado' : 'a_vista';
}

export function rotuloMeioPagamentoFiltroClassificacao(canonico: string): string {
  const found = MEIOS_FILTRO_CLASSIFICAR.find((m) => m.canonico === canonico);
  return found?.rotulo ?? canonico;
}

export function listarMeiosPagamentoClassificacao(
  gastos: Pick<GastoClassificacaoRow, 'meioPagamento'>[]
): { rotulo: string; canonico: string }[] {
  const present = new Set<string>();
  for (const g of gastos) {
    const t = g.meioPagamento.trim();
    if (t) present.add(t);
  }
  return MEIOS_FILTRO_CLASSIFICAR.filter((m) => present.has(m.canonico));
}

export function listarInstituicoesClassificacao(
  gastos: Pick<GastoClassificacaoRow, 'instituicaoFinanceira'>[]
): string[] {
  const set = new Set<string>();
  for (const g of gastos) {
    const t = g.instituicaoFinanceira.trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function temFiltroPagamentoClassificacaoAtivo(filtro: ClassificarFiltroPagamento): boolean {
  return (
    filtro.formas.length > 0 || filtro.meios.length > 0 || filtro.instituicoes.length > 0
  );
}

export function gastoPassaFiltroPagamentoClassificacao(
  gasto: Pick<
    GastoClassificacaoRow,
    'formaPagamento' | 'meioPagamento' | 'instituicaoFinanceira'
  >,
  filtro: ClassificarFiltroPagamento
): boolean {
  if (filtro.formas.length > 0) {
    const chave = formaPagamentoChaveClassificacao(gasto.formaPagamento);
    if (!filtro.formas.includes(chave)) return false;
  }
  if (filtro.meios.length > 0) {
    const meio = gasto.meioPagamento.trim();
    if (!filtro.meios.includes(meio)) return false;
  }
  if (filtro.instituicoes.length > 0) {
    const inst = gasto.instituicaoFinanceira.trim();
    if (!filtro.instituicoes.includes(inst)) return false;
  }
  return true;
}

export function rotuloFiltroPagamentoClassificacao(
  filtro: ClassificarFiltroPagamento
): string | null {
  if (!temFiltroPagamentoClassificacaoAtivo(filtro)) return null;

  const total =
    filtro.formas.length + filtro.meios.length + filtro.instituicoes.length;
  if (total === 1) {
    if (filtro.formas.length === 1) {
      const f = FORMAS_FILTRO_CLASSIFICAR.find((x) => x.chave === filtro.formas[0]);
      return `Pagamento: ${f?.rotulo ?? filtro.formas[0]}`;
    }
    if (filtro.meios.length === 1) {
      return `Pagamento: ${rotuloMeioPagamentoFiltroClassificacao(filtro.meios[0])}`;
    }
    return `Pagamento: ${filtro.instituicoes[0]}`;
  }
  return `Pagamento: ${total} critérios`;
}

export function filtrarGastosClassificacaoPorPagamento(
  gastos: GastoClassificacaoRow[],
  filtro: ClassificarFiltroPagamento
): GastoClassificacaoRow[] {
  if (!temFiltroPagamentoClassificacaoAtivo(filtro)) return gastos;
  return gastos.filter((g) => gastoPassaFiltroPagamentoClassificacao(g, filtro));
}

/** Coluna Meio na tabela Classificar (abreviação visual). */
export function meioPagamentoTabelaClassificacao(meioPagamento: string): string {
  const t = meioPagamento.trim();
  if (!t) return '—';
  return MEIO_PAGAMENTO_TABELA[t] ?? t;
}

/** Coluna Valor na tabela Classificar (moeda BRL com R$). */
export function valorTabelaClassificacao(totalCents: number): string {
  return formatCurrency(totalCents);
}

/** Badge secundário: Forma · Instituição (ex.: À Vista · Nubank). */
export function badgePagamentoClassificacao(
  gasto: Pick<GastoClassificacaoRow, 'formaPagamento' | 'parcelas' | 'instituicaoFinanceira'>
): string {
  const forma = formaPagamentoTabelaClassificacao(gasto);
  const inst = gasto.instituicaoFinanceira?.trim() || '—';
  return `${forma} · ${inst}`;
}

export function formatCurrencyRaw(cents: number): string {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function parseDateBR(str: string): Date | null {
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

export function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Data prevista deve ser um dia de calendário estritamente depois da data da compra. */
export function isPrevistaStrictlyAfterCompra(previstaBR: string, compraBR: string): boolean {
  const p = parseDateBR(previstaBR);
  const c = parseDateBR(compraBR);
  if (!p || !c) return false;
  return startOfDayLocal(p).getTime() > startOfDayLocal(c).getTime();
}

/** Primeiro dia permitido para vencimento = dia seguinte à data da compra. */
export function firstSelectableDayAfterCompraBR(compraBR: string): Date | null {
  const c = parseDateBR(compraBR);
  if (!c) return null;
  const d = startOfDayLocal(c);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Dias completos entre data prevista (BR) e hoje; 0 se prevista é hoje ou futuro. */
export function daysOverdueFromPrevistaBR(previstaBR: string): number {
  const prev = parseDateBR(previstaBR);
  if (!prev) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  prev.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - prev.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

export type CompromissoUrgencyLevel = 'vencido' | 'breve' | 'ordem';

export type CompromissoUrgencyBadge = {
  level: CompromissoUrgencyLevel;
  label: string;
};

/** Dias até o vencimento (negativo = já passou). */
export function daysUntilDueFromDataBR(dataBR: string): number | null {
  const due = parseDateBR(dataBR);
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / 86400000);
}

/** Badge visual derivado apenas da data de vencimento (sem alterar status de negócio). */
export function compromissoUrgencyBadgeFromDataBR(
  dataBR: string,
  options?: { feminine?: boolean },
): CompromissoUrgencyBadge {
  const days = daysUntilDueFromDataBR(dataBR);
  const feminine = options?.feminine ?? false;

  if (days === null) {
    return { level: 'ordem', label: '—' };
  }

  if (days < 0) {
    const n = Math.abs(days);
    const prefix = feminine ? 'Vencida há' : 'Vencido há';
    return {
      level: 'vencido',
      label: `${prefix} ${n} dia${n === 1 ? '' : 's'}`,
    };
  }

  if (days === 0) {
    return { level: 'breve', label: 'Vence hoje' };
  }

  const label = `Vence em ${days} dia${days === 1 ? '' : 's'}`;
  if (days <= 7) {
    return { level: 'breve', label };
  }

  return { level: 'ordem', label };
}

export type CompromissoPendentesUrgencySummary = {
  total: number;
  vencidos: number;
  breve: number;
  maxLevel: CompromissoUrgencyLevel | null;
};

function urgencyLevelFromDataBR(dataBR: string): CompromissoUrgencyLevel {
  return compromissoUrgencyBadgeFromDataBR(dataBR).level;
}

/** Contagem de urgência por data de vencimento (mesma regra dos badges). */
export function summarizeCompromissosPendentesUrgency(
  compromissos: CompromissoRecord[],
): CompromissoPendentesUrgencySummary {
  let total = 0;
  let vencidos = 0;
  let breve = 0;
  let maxLevel: CompromissoUrgencyLevel | null = null;

  const consider = (dataBR: string) => {
    total += 1;
    const level = urgencyLevelFromDataBR(dataBR);
    if (level === 'vencido') vencidos += 1;
    else if (level === 'breve') breve += 1;

    if (level === 'vencido') maxLevel = 'vencido';
    else if (level === 'breve' && maxLevel !== 'vencido') maxLevel = 'breve';
    else if (level === 'ordem' && maxLevel === null) maxLevel = 'ordem';
  };

  for (const c of compromissos) {
    if (c.status !== 'pendente' && c.status !== 'vencido') continue;

    if (c.tipo === 'parcelado') {
      for (const p of c.parcelas ?? []) {
        if (p.status !== 'pendente' && p.status !== 'vencido') continue;
        consider(p.dataVencimentoBR);
      }
    } else {
      consider(c.dataPrevistaPagamento);
    }
  }

  return { total, vencidos, breve, maxLevel: total > 0 ? maxLevel : null };
}

export function formatCompromissosPendentesUrgencySummary(
  summary: CompromissoPendentesUrgencySummary,
): string {
  const { vencidos, breve } = summary;
  if (vencidos > 0) {
    const parts = [`${vencidos} vencido${vencidos === 1 ? '' : 's'}`];
    if (breve > 0) parts.push(`${breve} vencem em breve`);
    return parts.join(' · ');
  }
  if (breve > 0) {
    return `${breve} vence${breve === 1 ? '' : 'm'} nos próximos 7 dias`;
  }
  return 'Nenhum vencimento urgente';
}

export function compareDateBR(a: string, b: string): number {
  const da = parseDateBR(a);
  const db = parseDateBR(b);
  if (!da || !db) return 0;
  return da.getTime() - db.getTime();
}

export function compromissoDisplayTitle(c: CompromissoRecord): string {
  const f = c.fornecedor.trim();
  if (f) return f;
  const first = c.items[0]?.descricao?.trim();
  if (first) return first;
  return 'Compromisso';
}

const MESES_NOME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function labelPeriodicidade(p: PeriodicidadePerene): string {
  const m: Record<PeriodicidadePerene, string> = {
    mensal: 'Mensal',
    trimestral: 'Trimestral',
    semestral: 'Semestral',
    anual: 'Anual',
  };
  return m[p];
}

/** Texto do vencimento para lista e detalhe do gasto perene. */
export function formatVencimentoGastoPerene(gp: GastoPereneRecord): string {
  if (gp.periodicidade === 'anual' && gp.mesVencimento) {
    const mes = MESES_NOME[gp.mesVencimento - 1] || '';
    return `Dia ${gp.diaVencimento} de ${mes}`;
  }
  return `Dia ${gp.diaVencimento}`;
}

export function labelStatusCompromisso(status: CompromissoRecord['status']): string {
  const m: Record<CompromissoRecord['status'], string> = {
    pendente: 'pendente',
    vencido: 'vencido',
    quitado: 'quitado',
    cancelado: 'cancelado',
  };
  return m[status];
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function buildWhatsAppMessage(
  dataCompra: string,
  items: GastoItem[],
  payment: PaymentData,
  totalCents: number
): string {
  const lines: string[] = [];

  lines.push(`GASTO — ${dataCompra}`);

  if (payment.fornecedor.trim()) {
    lines.push(`Fornecedor: ${payment.fornecedor.trim()}`);
  }

  const forma = payment.formaPagamento === 'a_vista' ? 'À Vista' : `Parcelado ${payment.parcelas || 2}x`;
  lines.push(`Pagamento: ${forma} | ${payment.meioPagamento} | ${payment.instituicaoFinanceira}`);

  const obs = payment.observacoes.trim() || '—';
  lines.push(`Obs: ${obs}`);

  lines.push('');
  lines.push('N;Descrição;Qtd;Unidade;Valor');

  // Items in ascending order for the message
  const sorted = [...items].sort((a, b) => a.ordem - b.ordem);
  sorted.forEach((item) => {
    const valor = formatCurrencyRaw(item.valorCentavos);
    const qty = Number.isInteger(item.quantidade)
      ? item.quantidade.toString()
      : item.quantidade.toLocaleString('pt-BR');
    lines.push(`${item.ordem};${item.descricao};${qty};${item.unidade};${valor}`);
  });

  lines.push('');
  lines.push(`Total: ${formatCurrency(totalCents)}`);

  return lines.join('\n');
}

export function openWhatsApp(message: string): void {
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

export function gastoPereneToPeriodInput(gp: GastoPereneRecord): PerenePeriodInput | null {
  const dataInicio = parseDateBR(gp.dataInicio);
  if (!dataInicio) return null;
  const dataTermino = gp.dataTermino ? parseDateBR(gp.dataTermino) : null;
  return {
    periodicidade: gp.periodicidade,
    diaVencimento: gp.diaVencimento,
    mesVencimento: gp.mesVencimento,
    dataInicio,
    dataTermino,
  };
}

export function isGastoPereneEligibleForForecast(gp: GastoPereneRecord, refToday: Date): boolean {
  if (gp.status === 'encerrado') return false;
  const t = gp.dataTermino ? parseDateBR(gp.dataTermino) : null;
  if (!t) return true;
  return startOfDayLocal(t).getTime() >= startOfDayLocal(refToday).getTime();
}

/**
 * Janela de N dias incluindo hoje: [hoje, hoje + (N − 1)] (comparação só por data local).
 * Lógica compartilhada com `lib/forecastWindow.ts`.
 */
export function isDateWithinForecastWindow(
  due: Date,
  windowStart: Date,
  windowDays: number
): boolean {
  return isDateInForecastWindow(due, windowStart, windowDays);
}

export const UNIDADES = [
  'Unidade', 'Caixa', 'Pacote', 'Bisnaga', 'Pote', 'Frasco', 'Tubo', 'Lata',
  'Ampola', 'Cartucho', 'Blister', 'Sachê', 'Envelope', 'Rolo', 'Fardo', 'Saco',
  'Balde', 'Barril', 'Bombona', 'Garrafa', 'Vidro', 'Kit', 'Par', 'Dúzia',
  'Centena', 'Milhar', 'Bandeja', 'Pente', 'Barra', 'Quilograma', 'Grama',
  'Miligrama', 'Litro', 'Mililitro', 'Metro Cúbico', 'Galão', 'Diária', 'Noite',
  'Hora', 'Refeição', 'Pessoa', 'Serviço', 'Tablete', 'Sacola',
  'Embalado a Vacuo', 'Metro', 'Splay',
];

export const MEIOS_PAGAMENTO = [
  'Dinheiro', 'PIX', 'Transferência Bancária', 'Boleto',
  'Cartão de Débito', 'Boleto Parcelado', 'Cartão de Crédito', 'Financiamento',
];

export const INSTITUICOES = [
  'Nubank', 'C6 Madrigal', 'Nubank PJ', 'Mercado Pago', '(não se aplica)',
];
