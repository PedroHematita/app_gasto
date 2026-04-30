export interface GastoItem {
  id: string;
  ordem: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorCentavos: number; // stored as integer cents
}

export interface PaymentData {
  fornecedor: string;
  formaPagamento: 'a_vista' | 'parcelado';
  meioPagamento: string;
  instituicaoFinanceira: string;
  observacoes: string;
  comprovanteFile: File | null;
  comprovanteUrl: string;
}

export interface Gasto {
  dataCompra: string; // dd/mm/aaaa
  items: GastoItem[];
  payment: PaymentData;
  total: number; // cents
}

// Record from Supabase
export interface GastoRecord {
  id: string;
  seq: number; // sequential number for display
  dataCompra: string; // dd/mm/aaaa
  fornecedor: string;
  formaPagamento: string;
  meioPagamento: string;
  instituicaoFinanceira: string;
  observacoes: string;
  total: number; // cents
  comprovanteUrl: string;
  createdAt: string;
  items: GastoItem[];
}

export type Screen = 'main' | 'confirmation' | 'meus_gastos' | 'gasto_detail' | 'gasto_edit';
