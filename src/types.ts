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
  parcelas?: number;
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
  parcelas?: number;
  createdAt: string;
  items: GastoItem[];
}

export type CompromissoStatus = 'pendente' | 'vencido' | 'quitado' | 'cancelado';

export interface CompromissoRecord {
  id: string;
  dataCompra: string; // dd/mm/aaaa — fato gerador
  dataPrevistaPagamento: string; // dd/mm/aaaa
  fornecedor: string;
  status: CompromissoStatus;
  total: number; // cents
  createdAt: string;
  gastoId: string | null;
  gastoPereneId: string | null;
  competenciaChave: string | null;
  items: GastoItem[];
}

export type PeriodicidadePerene = 'mensal' | 'trimestral' | 'semestral' | 'anual';
export type StatusGastoPerene = 'ativo' | 'encerrado';

export interface GastoPereneRecord {
  id: string;
  fornecedor: string;
  valorPrevistoCents: number;
  periodicidade: PeriodicidadePerene;
  diaVencimento: number;
  mesVencimento: number | null;
  dataInicio: string; // dd/mm/aaaa
  dataTermino: string | null; // dd/mm/aaaa
  observacoes: string;
  status: StatusGastoPerene;
  createdAt: string;
}

export type Screen =
  | 'main'
  | 'confirmation'
  | 'meus_gastos'
  | 'gasto_detail'
  | 'gasto_edit'
  | 'compromisso_detail'
  | 'gasto_perene_detail';
