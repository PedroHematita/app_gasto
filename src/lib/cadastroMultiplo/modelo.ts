import { formatDateBR, generateId } from '../../utils';

export type FormaPagamentoLote = 'a_vista' | 'parcelado';

export interface PagamentoRascunhoLote {
  formaPagamento: FormaPagamentoLote;
  meioPagamento: string;
  instituicaoFinanceira: string;
  /** Só relevante se Parcelado; 2–48. */
  parcelas: number;
  observacoes: string;
}

export interface ItemRascunhoLote {
  id: string;
  /** Sequência estável de criação no rascunho (não posição no array / dia). */
  seqCriacao: number;
  descricao: string;
  /** Texto do campo; aceita vírgula decimal. */
  quantidade: string;
  unidade: string;
  /** `null` = em branco (bloqueia); `≤0` também bloqueia. */
  valorCentavos: number | null;
}

export interface GastoRascunhoLote {
  id: string;
  dataCompraBR: string;
  /** Data veio do gasto anterior e ainda não foi confirmada/alterada. */
  dataHerdadaPendente: boolean;
  fornecedor: string;
  pagamento: PagamentoRascunhoLote;
  itens: ItemRascunhoLote[];
}

export interface RascunhoCadastroMultiplo {
  orgId: string;
  /** ISO da última persistência local. */
  atualizadoEmISO: string;
  gastos: GastoRascunhoLote[];
  /** Datas dd/mm/aaaa com grupo recolhido. */
  diasRecolhidos: string[];
  /** Próximo seqCriacao a alocar para um item novo. */
  proximaSeqItem: number;
}

export const STORAGE_KEY_PREFIX = 'cadastro_multiplo_rascunho:';

/** Só para testes isolados quando seqCriacao não é passado. */
let autoSeqCriacaoTeste = 1;

export function resetAutoSeqCriacaoForTests(valor = 1): void {
  autoSeqCriacaoTeste = valor;
}

export function storageKeyCadastroMultiplo(orgId: string): string {
  return `${STORAGE_KEY_PREFIX}${orgId}`;
}

/** Linhas vazias iniciais por gasto (UI / rascunho). */
export const LINHAS_ITEM_INICIAIS = 3;

export type ClassificacaoItemLinha = 'vazia' | 'completa' | 'incompleta';

export function pagamentoPadraoIndividual(): PagamentoRascunhoLote {
  return {
    formaPagamento: 'a_vista',
    meioPagamento: 'PIX',
    instituicaoFinanceira: 'Nubank',
    parcelas: 2,
    observacoes: '',
  };
}

export function parseQuantidadeItem(texto: string): number | null {
  const t = texto.trim().replace(/\s+/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function itemLinhaVazia(item: ItemRascunhoLote): boolean {
  return (
    !item.descricao.trim() &&
    !item.quantidade.trim() &&
    !item.unidade.trim() &&
    item.valorCentavos == null
  );
}

export function itemLinhaCompleta(item: ItemRascunhoLote): boolean {
  const desc = item.descricao.trim().replace(/\s+/g, ' ');
  if (desc.length < 3) return false;
  const qtd = parseQuantidadeItem(item.quantidade);
  if (qtd == null || qtd <= 0) return false;
  if (!item.unidade.trim()) return false;
  if (item.valorCentavos == null || item.valorCentavos <= 0) return false;
  return true;
}

export function classificarItemLinha(item: ItemRascunhoLote): ClassificacaoItemLinha {
  if (itemLinhaVazia(item)) return 'vazia';
  if (itemLinhaCompleta(item)) return 'completa';
  return 'incompleta';
}

export function itemCampoDescricaoInvalido(item: ItemRascunhoLote): boolean {
  return item.descricao.trim().replace(/\s+/g, ' ').length < 3;
}

export function itemCampoQuantidadeInvalido(item: ItemRascunhoLote): boolean {
  const qtd = parseQuantidadeItem(item.quantidade);
  return qtd == null || qtd <= 0;
}

export function itemCampoUnidadeInvalido(item: ItemRascunhoLote): boolean {
  return !item.unidade.trim();
}

export function itemCampoValorInvalido(item: ItemRascunhoLote): boolean {
  return item.valorCentavos == null || item.valorCentavos <= 0;
}

export function limparItemRascunho(item: ItemRascunhoLote): ItemRascunhoLote {
  return {
    ...item,
    descricao: '',
    quantidade: '',
    unidade: '',
    valorCentavos: null,
  };
}

export function removerLinhasVaziasDosGastos(gastos: GastoRascunhoLote[]): GastoRascunhoLote[] {
  return gastos.map((g) => ({
    ...g,
    itens: g.itens.filter((item) => !itemLinhaVazia(item)),
  }));
}

export function criarItemRascunho(overrides: Partial<ItemRascunhoLote> = {}): ItemRascunhoLote {
  const seqCriacao = overrides.seqCriacao ?? autoSeqCriacaoTeste++;
  return {
    id: generateId(),
    descricao: '',
    quantidade: '',
    unidade: '',
    valorCentavos: null,
    ...overrides,
    seqCriacao,
  };
}

function criarItensIniciais(seqItem?: number): ItemRascunhoLote[] {
  const itens: ItemRascunhoLote[] = [];
  for (let i = 0; i < LINHAS_ITEM_INICIAIS; i++) {
    itens.push(
      seqItem != null
        ? criarItemRascunho({ seqCriacao: seqItem + i })
        : criarItemRascunho()
    );
  }
  return itens;
}

export function criarGastoRascunho(args?: {
  herdarDe?: GastoRascunhoLote | null;
  hoje?: Date;
  seqItem?: number;
}): GastoRascunhoLote {
  const hoje = args?.hoje ?? new Date();
  const anterior = args?.herdarDe ?? null;
  const itens = criarItensIniciais(args?.seqItem);
  if (!anterior) {
    return {
      id: generateId(),
      dataCompraBR: formatDateBR(hoje),
      dataHerdadaPendente: false,
      fornecedor: '',
      pagamento: pagamentoPadraoIndividual(),
      itens,
    };
  }
  return {
    id: generateId(),
    dataCompraBR: anterior.dataCompraBR,
    dataHerdadaPendente: true,
    fornecedor: '',
    pagamento: {
      ...pagamentoPadraoIndividual(),
      meioPagamento: anterior.pagamento.meioPagamento,
      instituicaoFinanceira: anterior.pagamento.instituicaoFinanceira,
    },
    itens,
  };
}

export function criarRascunhoVazio(orgId: string, hoje: Date = new Date()): RascunhoCadastroMultiplo {
  const gasto = criarGastoRascunho({ hoje, seqItem: 1 });
  return {
    orgId,
    atualizadoEmISO: hoje.toISOString(),
    gastos: [gasto],
    diasRecolhidos: [],
    proximaSeqItem: 1 + LINHAS_ITEM_INICIAIS,
  };
}

/** Garante seqCriacao / proximaSeqItem em rascunhos antigos do localStorage. */
export function normalizarRascunho(rascunho: RascunhoCadastroMultiplo): RascunhoCadastroMultiplo {
  let seq = 1;
  const gastos = rascunho.gastos.map((g) => ({
    ...g,
    itens: g.itens.map((item) => {
      if (typeof item.seqCriacao === 'number' && Number.isFinite(item.seqCriacao)) {
        seq = Math.max(seq, item.seqCriacao + 1);
        return item;
      }
      const seqCriacao = seq++;
      return { ...item, seqCriacao };
    }),
  }));
  const proximaSeqItem = Math.max(rascunho.proximaSeqItem ?? 1, seq);
  return { ...rascunho, gastos, proximaSeqItem };
}

export function totalItemCentavos(item: ItemRascunhoLote): number {
  return item.valorCentavos ?? 0;
}

export function contarItensCompletos(gasto: GastoRascunhoLote): number {
  return gasto.itens.reduce((n, i) => n + (itemLinhaCompleta(i) ? 1 : 0), 0);
}

export function totalGastoCentavos(gasto: GastoRascunhoLote): number {
  return gasto.itens.reduce(
    (s, i) => (itemLinhaCompleta(i) ? s + totalItemCentavos(i) : s),
    0
  );
}

export function totalGeralCentavos(gastos: GastoRascunhoLote[]): number {
  return gastos.reduce((s, g) => s + totalGastoCentavos(g), 0);
}

/** Ordem de tela: dias (primeira ocorrência) na sequência em que os gastos aparecem. */
export function ordenarGastosNaTela(gastos: GastoRascunhoLote[]): GastoRascunhoLote[] {
  const ordemDias: string[] = [];
  for (const g of gastos) {
    if (!ordemDias.includes(g.dataCompraBR)) ordemDias.push(g.dataCompraBR);
  }
  const porDia = new Map<string, GastoRascunhoLote[]>();
  for (const g of gastos) {
    const lista = porDia.get(g.dataCompraBR) ?? [];
    lista.push(g);
    porDia.set(g.dataCompraBR, lista);
  }
  const out: GastoRascunhoLote[] = [];
  for (const dia of ordemDias) {
    out.push(...(porDia.get(dia) ?? []));
  }
  return out;
}

export function gruposPorDia(gastos: GastoRascunhoLote[]): Array<{
  dataCompraBR: string;
  gastos: GastoRascunhoLote[];
  subtotalCentavos: number;
}> {
  const ordenados = ordenarGastosNaTela(gastos);
  const grupos: Array<{ dataCompraBR: string; gastos: GastoRascunhoLote[]; subtotalCentavos: number }> = [];
  for (const g of ordenados) {
    const last = grupos[grupos.length - 1];
    if (last && last.dataCompraBR === g.dataCompraBR) {
      last.gastos.push(g);
      last.subtotalCentavos += totalGastoCentavos(g);
    } else {
      grupos.push({
        dataCompraBR: g.dataCompraBR,
        gastos: [g],
        subtotalCentavos: totalGastoCentavos(g),
      });
    }
  }
  return grupos;
}

export function duplicarGasto(
  gasto: GastoRascunhoLote,
  proximaSeqItem: number
): { gasto: GastoRascunhoLote; proximaSeqItem: number } {
  let seq = proximaSeqItem;
  const itens: ItemRascunhoLote[] = gasto.itens
    .filter((item) => !itemLinhaVazia(item))
    .map((item) => {
      const seqCriacao = seq++;
      return {
        ...item,
        id: generateId(),
        seqCriacao,
      };
    });
  while (itens.length < LINHAS_ITEM_INICIAIS) {
    itens.push(criarItemRascunho({ seqCriacao: seq++ }));
  }
  return {
    gasto: {
      id: generateId(),
      dataCompraBR: gasto.dataCompraBR,
      dataHerdadaPendente: gasto.dataHerdadaPendente,
      fornecedor: gasto.fornecedor,
      pagamento: { ...gasto.pagamento },
      itens,
    },
    proximaSeqItem: seq,
  };
}

export function confirmarDataHerdada(gasto: GastoRascunhoLote): GastoRascunhoLote {
  return { ...gasto, dataHerdadaPendente: false };
}

export function alterarDataGasto(gasto: GastoRascunhoLote, dataCompraBR: string): GastoRascunhoLote {
  return {
    ...gasto,
    dataCompraBR,
    dataHerdadaPendente: false,
  };
}

export function lerRascunhoLocal(orgId: string): RascunhoCadastroMultiplo | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKeyCadastroMultiplo(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RascunhoCadastroMultiplo;
    if (!parsed || parsed.orgId !== orgId || !Array.isArray(parsed.gastos)) return null;
    return normalizarRascunho(parsed);
  } catch {
    return null;
  }
}

export function salvarRascunhoLocal(rascunho: RascunhoCadastroMultiplo, agora: Date = new Date()): void {
  if (typeof localStorage === 'undefined') return;
  const payload: RascunhoCadastroMultiplo = {
    ...normalizarRascunho(rascunho),
    atualizadoEmISO: agora.toISOString(),
  };
  localStorage.setItem(storageKeyCadastroMultiplo(rascunho.orgId), JSON.stringify(payload));
}

export function limparRascunhoLocal(orgId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(storageKeyCadastroMultiplo(orgId));
}

export function formatarDataRascunhoVisivel(atualizadoEmISO: string): string {
  const d = new Date(atualizadoEmISO);
  if (Number.isNaN(d.getTime())) return atualizadoEmISO;
  return formatDateBR(d);
}
