import {
  MTD_STATUS_CLASSIFICADO,
  MTD_STATUS_NAO_CLASSIFICADO,
  MTD_STATUS_PARCIALMENTE_CLASSIFICADO,
  TIPO_GASTO_EMPRESARIAL,
  classificacaoGeralMtdLabel,
  direcionamentoMtdLabel,
  mtdCaminhoExibicao,
  mtdPayloadEstaCompleto,
  type GastoMtdPayload,
} from './mtdTaxonomia';
import {
  aplicarFiltrosEOrdenacaoClassificacao,
  dataCompraTabelaClassificacao,
  sortGastosClassificacaoDesc,
  tipoGastoNormalizado,
} from '../utils';
import type {
  ClassificarFiltrosState,
  ClassificarMtdFiltrosState,
  ClassificarMtdFiltroStatus,
  ClassificarOrdenacaoState,
  GastoMtdGrupo,
  ItemMtdInfo,
  ItemMtdRow,
} from '../types';

export type { ClassificarMtdFiltroStatus, ClassificarMtdFiltrosState };

export const CLASSIFICAR_MTD_FILTRO_STATUS_OPCOES: {
  id: ClassificarMtdFiltroStatus;
  label: string;
}[] = [
  { id: 'pendente', label: 'Sem MTD' },
  { id: 'classificado', label: 'Classificados' },
  { id: 'todos', label: 'Todos' },
];

export const CLASSIFICAR_MTD_FILTROS_VAZIO: ClassificarMtdFiltrosState = {
  statusMtd: 'pendente',
  data: { preset: null, dataInicial: null, dataFinal: null },
  fornecedores: [],
  pagamento: { formas: [], meios: [], instituicoes: [] },
};

export function gastoElegivelMtd(tipoGasto: string | null | undefined): boolean {
  return tipoGastoNormalizado(tipoGasto ?? '') === TIPO_GASTO_EMPRESARIAL;
}

export type ItemMtdCampos = Pick<
  ItemMtdRow,
  | 'mtdStatus'
  | 'direcionamentoMtd'
  | 'classificacaoGeralMtd'
  | 'naturezaMtdRaiz'
  | 'naturezaMtdCaminho'
>;

export function itemMtdEstaClassificado(row: ItemMtdCampos): boolean {
  if (row.mtdStatus === MTD_STATUS_CLASSIFICADO) return true;
  return mtdPayloadEstaCompleto({
    direcionamentoMtd: row.direcionamentoMtd as GastoMtdPayload['direcionamentoMtd'],
    classificacaoGeralMtd: row.classificacaoGeralMtd as GastoMtdPayload['classificacaoGeralMtd'],
    naturezaMtdRaiz: row.naturezaMtdRaiz as GastoMtdPayload['naturezaMtdRaiz'],
    naturezaMtdCaminho: row.naturezaMtdCaminho ?? undefined,
  });
}

/** Calcula mtd_status consolidado do gasto a partir dos itens. */
export function computarMtdStatusGasto(
  itens: Pick<ItemMtdRow, 'mtdStatus' | 'direcionamentoMtd' | 'classificacaoGeralMtd' | 'naturezaMtdRaiz' | 'naturezaMtdCaminho'>[]
): typeof MTD_STATUS_NAO_CLASSIFICADO | typeof MTD_STATUS_PARCIALMENTE_CLASSIFICADO | typeof MTD_STATUS_CLASSIFICADO {
  if (itens.length === 0) return MTD_STATUS_NAO_CLASSIFICADO;
  const classificados = itens.filter((i) => itemMtdEstaClassificado(i)).length;
  if (classificados === 0) return MTD_STATUS_NAO_CLASSIFICADO;
  if (classificados === itens.length) return MTD_STATUS_CLASSIFICADO;
  return MTD_STATUS_PARCIALMENTE_CLASSIFICADO;
}

export const consolidarStatusMtdDoGasto = computarMtdStatusGasto;

export function gastoMtdEstaTotalmenteClassificado(grupo: Pick<GastoMtdGrupo, 'mtdStatus' | 'itens'>): boolean {
  return grupo.mtdStatus === MTD_STATUS_CLASSIFICADO || computarMtdStatusGasto(grupo.itens) === MTD_STATUS_CLASSIFICADO;
}

export function gastoTemItensPendentesMtd(grupo: Pick<GastoMtdGrupo, 'itens'>): boolean {
  return grupo.itens.some((i) => !itemMtdEstaClassificado(i));
}

export function contagemMtdItens(itens: ItemMtdCampos[]): { classificados: number; total: number } {
  const total = itens.length;
  const classificados = itens.filter((i) => itemMtdEstaClassificado(i)).length;
  return { classificados, total };
}

export function statusMtdExibicaoItem(row: ItemMtdCampos): string {
  if (!itemMtdEstaClassificado(row)) return 'Não Classificado MTD';
  const dir = direcionamentoMtdLabel(row.direcionamentoMtd);
  const geral = classificacaoGeralMtdLabel(row.classificacaoGeralMtd);
  const natureza = mtdCaminhoExibicao(row.naturezaMtdCaminho);
  return [dir, geral, natureza].filter(Boolean).join(' · ');
}

/** Badge compacto no cabeçalho do gasto: MTD 1/2 */
export function badgeMtdGrupo(itens: ItemMtdCampos[]): string {
  const { classificados, total } = contagemMtdItens(itens);
  return `MTD ${classificados}/${total}`;
}

/** Texto curto na linha do item (lista). */
export function statusMtdLinhaItem(row: ItemMtdCampos): string {
  if (!itemMtdEstaClassificado(row)) return 'Pendente MTD';
  return statusMtdExibicaoItem(row);
}

export function statusMtdResumoGasto(grupo: Pick<GastoMtdGrupo, 'itens' | 'mtdStatus'>): string {
  return badgeMtdGrupo(grupo.itens);
}

export function mapItemMtdInfoFromDb(row: {
  direcionamento_mtd?: string | null;
  classificacao_geral_mtd?: string | null;
  natureza_mtd_raiz?: string | null;
  natureza_mtd_caminho?: string[] | null;
  mtd_status?: string | null;
  mtd_classificado_em?: string | null;
  mtd_classificado_por?: string | null;
}): ItemMtdInfo {
  return {
    direcionamentoMtd: row.direcionamento_mtd ?? null,
    classificacaoGeralMtd: row.classificacao_geral_mtd ?? null,
    naturezaMtdRaiz: row.natureza_mtd_raiz ?? null,
    naturezaMtdCaminho: row.natureza_mtd_caminho ?? null,
    mtdStatus: row.mtd_status ?? MTD_STATUS_NAO_CLASSIFICADO,
    mtdClassificadoEm: row.mtd_classificado_em ?? null,
    mtdClassificadoPor: row.mtd_classificado_por ?? null,
  };
}

export function mapItemMtdRowFromDb(
  item: {
    id: string;
    ordem: number;
    descricao_produto_servico: string;
    quantidade_adquirida: number;
    unidade_medida: string;
    valor_total: number;
    direcionamento_mtd?: string | null;
    classificacao_geral_mtd?: string | null;
    natureza_mtd_raiz?: string | null;
    natureza_mtd_caminho?: string[] | null;
    mtd_status?: string | null;
    mtd_classificado_em?: string | null;
    mtd_classificado_por?: string | null;
  },
  gastoId: string
): ItemMtdRow {
  const mtd = mapItemMtdInfoFromDb(item);
  return {
    id: item.id,
    gastoId,
    ordem: item.ordem,
    descricao: item.descricao_produto_servico,
    quantidade: item.quantidade_adquirida,
    unidade: item.unidade_medida,
    valorCentavos: Math.round((item.valor_total ?? 0) * 100),
    ...mtd,
  };
}

export function mapGastoMtdGrupoFromDb(row: {
  id: string;
  data_compra: string;
  created_at?: string;
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
  mtd_status?: string | null;
  itens_gasto?: Array<Parameters<typeof mapItemMtdRowFromDb>[0]>;
}): GastoMtdGrupo {
  const itens = (row.itens_gasto ?? [])
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((item) => mapItemMtdRowFromDb(item, row.id));

  const mtdStatus = row.mtd_status ?? computarMtdStatusGasto(itens);

  return {
    id: row.id,
    dataCompra: row.data_compra,
    dataCompraBR: dataCompraTabelaClassificacao(row.data_compra),
    createdAt: row.created_at,
    fornecedor: row.fornecedor ?? '',
    formaPagamento: row.forma_pagamento ?? '',
    meioPagamento: row.meio_pagamento ?? '',
    instituicaoFinanceira: row.instituicao_financeira ?? '',
    parcelas: row.numero_parcelas ?? undefined,
    total: Math.round((row.total ?? 0) * 100),
    quemGastou: row.quem_gastou ?? null,
    tipoGasto: row.tipo_gasto ?? 'Não Classificado',
    setor: row.setor ?? null,
    dataClassificacao: row.data_classificacao ?? null,
    responsavelClassificacao: row.responsavel_classificacao ?? null,
    mtdStatus,
    itens,
  };
}

export function filtrarGruposEmpresariais(grupos: GastoMtdGrupo[]): GastoMtdGrupo[] {
  return grupos.filter((g) => gastoElegivelMtd(g.tipoGasto));
}

export function filtrarGruposPorStatusMtd(
  grupos: GastoMtdGrupo[],
  status: ClassificarMtdFiltroStatus
): GastoMtdGrupo[] {
  if (status === 'todos') return grupos;
  if (status === 'pendente') {
    return grupos.filter((g) => gastoTemItensPendentesMtd(g));
  }
  return grupos.filter((g) => gastoMtdEstaTotalmenteClassificado(g));
}

export function aplicarFiltrosClassificarMtd(
  grupos: GastoMtdGrupo[],
  filtros: ClassificarMtdFiltrosState,
  ordenacao: ClassificarOrdenacaoState
): GastoMtdGrupo[] {
  const empresariais = filtrarGruposEmpresariais(grupos);
  const porStatus = filtrarGruposPorStatusMtd(empresariais, filtros.statusMtd);
  const classificarFiltros: ClassificarFiltrosState = {
    data: filtros.data,
    fornecedores: filtros.fornecedores,
    pagamento: filtros.pagamento,
    classificacao: 'empresa',
  };
  return sortGastosMtdGruposDesc(
    aplicarFiltrosEOrdenacaoClassificacao(
      porStatus,
      classificarFiltros,
      ordenacao
    ) as GastoMtdGrupo[]
  );
}

export function sortGastosMtdGruposDesc(grupos: GastoMtdGrupo[]): GastoMtdGrupo[] {
  return sortGastosClassificacaoDesc(grupos) as GastoMtdGrupo[];
}

export function itensPendentesNoGrupo(grupo: GastoMtdGrupo): ItemMtdRow[] {
  return grupo.itens.filter((i) => !itemMtdEstaClassificado(i));
}

export function idsItensVisiveisParaClassificacao(
  selectedIds: Iterable<string>,
  gruposVisiveis: GastoMtdGrupo[]
): string[] {
  const visible = new Set(gruposVisiveis.flatMap((g) => g.itens.map((i) => i.id)));
  const ids: string[] = [];
  for (const id of selectedIds) {
    if (visible.has(id)) ids.push(id);
  }
  return ids;
}

export function pruneSelecaoItensParaGruposVisiveis(
  selectedIds: Set<string>,
  gruposVisiveis: GastoMtdGrupo[]
): Set<string> {
  const visible = new Set(gruposVisiveis.flatMap((g) => g.itens.map((i) => i.id)));
  const next = new Set<string>();
  for (const id of selectedIds) {
    if (visible.has(id)) next.add(id);
  }
  return next;
}

export function mtdPayloadFromForm(input: {
  direcionamentoMtd: string;
  classificacaoGeralMtd: string;
  naturezaMtdCaminho: string[];
}): GastoMtdPayload | null {
  const payload = {
    direcionamentoMtd: input.direcionamentoMtd,
    classificacaoGeralMtd: input.classificacaoGeralMtd,
    naturezaMtdRaiz: input.naturezaMtdCaminho[0],
    naturezaMtdCaminho: input.naturezaMtdCaminho,
  } as Partial<GastoMtdPayload>;
  if (!mtdPayloadEstaCompleto(payload)) return null;
  return payload;
}

export function validarClassificacaoMtdMassa(input: {
  ids: string[];
  payload: Partial<GastoMtdPayload>;
}): { ok: true; payload: GastoMtdPayload } | { ok: false; mensagem: string } {
  if (input.ids.length === 0) {
    return { ok: false, mensagem: 'Selecione ao menos um item.' };
  }
  if (!mtdPayloadEstaCompleto(input.payload)) {
    return { ok: false, mensagem: 'Preencha Direcionamento, Classificação geral e Natureza MTD.' };
  }
  return { ok: true, payload: input.payload };
}

export {
  TIPO_GASTO_EMPRESARIAL,
  MTD_STATUS_NAO_CLASSIFICADO,
  MTD_STATUS_PARCIALMENTE_CLASSIFICADO,
  MTD_STATUS_CLASSIFICADO,
};
