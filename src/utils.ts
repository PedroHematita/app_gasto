import type { GastoItem, PaymentData, CompromissoRecord, GastoPereneRecord, PeriodicidadePerene } from './types';

/** Mensagem única para fornecedor obrigatório (UI + camada de dados). */
export const FORNECEDOR_REQUIRED_MSG =
  'Informe o fornecedor ou local do serviço antes de salvar.';

export function requireFornecedorTrimmed(fornecedor: string): string {
  const t = fornecedor.trim();
  if (!t) throw new Error(FORNECEDOR_REQUIRED_MSG);
  return t;
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
  'Nubank', 'C6 Madrigal', 'Nubank PJ', '(não se aplica)',
];
