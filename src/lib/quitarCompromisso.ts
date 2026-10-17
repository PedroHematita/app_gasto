import { supabase } from './supabase';

type ItemBaixa = {
  ordem: number;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorCentavos: number;
};

export type QuitarCompromissoInput = {
  orgId: string;
  compromissoId: string;
  parcelaId: string | null;
  dataPagamentoBR: string;
  fornecedor: string;
  formaPagamento: string;
  meioPagamento: string;
  instituicaoFinanceira: string;
  observacoes: string;
  totalCents: number;
  parcelas?: number;
  items: ItemBaixa[];
};

function dataBRParaISO(dataBR: string): string {
  const [d, m, y] = dataBR.split('/');
  return `${y}-${m}-${d}`;
}

function mensagemErroQuitacao(error: { code?: string; message?: string }): string {
  const message = error.message ?? '';
  const funcaoAusente =
    error.code === 'PGRST202' ||
    message.includes('Could not find the function') ||
    message.includes('schema cache');
  if (funcaoAusente && message.includes('quitar_compromisso')) {
    return 'A quitação segura ainda não está disponível. A atualização do banco precisa ser aplicada antes de quitar.';
  }
  if (
    message.includes('já foi encerrado') ||
    message.includes('não pode ser quitad') ||
    message.includes('não encontrada') ||
    message.includes('não encontrado') ||
    message.includes('data do pagamento') ||
    message.includes('fornecedor') ||
    message.includes('valor realizado') ||
    message.includes('parcelas') ||
    message.includes('soma dos itens') ||
    message.includes('não autenticado') ||
    message.includes('Quite uma parcela')
  ) {
    return message;
  }
  return 'Erro ao quitar. Nada foi gravado. Tente novamente.';
}

/**
 * Uma única chamada ao banco cria o gasto, os itens e quita o compromisso ou a parcela.
 * Se a obrigação já estiver quitada, devolve o gasto existente.
 */
export async function quitarCompromisso(input: QuitarCompromissoInput): Promise<{ gastoId: string }> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { data, error } = await supabase.rpc('quitar_compromisso', {
    p_compromisso_id: input.compromissoId,
    p_parcela_id: input.parcelaId,
    p_data_pagamento: dataBRParaISO(input.dataPagamentoBR),
    p_fornecedor: input.fornecedor,
    p_forma_pagamento: input.formaPagamento,
    p_meio_pagamento: input.meioPagamento,
    p_instituicao_financeira: input.instituicaoFinanceira,
    p_observacoes: input.observacoes,
    p_total_centavos: input.totalCents,
    p_numero_parcelas: input.parcelas ?? null,
    p_itens: input.items.map((item) => ({
      ordem: item.ordem,
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: item.unidade,
      valor_centavos: item.valorCentavos,
    })),
  });

  if (error) throw new Error(mensagemErroQuitacao(error));
  if (!data) throw new Error('Erro ao quitar. Nada foi gravado. Tente novamente.');
  return { gastoId: data as string };
}
