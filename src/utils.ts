import type { GastoItem, PaymentData } from './types';

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
  lines.push(`*Pagamento:* ${forma} | ${payment.meioPagamento} | ${payment.instituicaoFinanceira}`);

  const obs = payment.observacoes.trim() || '—';
  lines.push(`Obs: ${obs}`);

  lines.push('');
  lines.push('#;Descrição;Qtd;Unidade;Valor');

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
