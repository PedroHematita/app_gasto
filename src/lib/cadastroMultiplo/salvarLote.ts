import { supabase } from '../supabase';
import type { PayloadSalvarGastosLote } from './payload';

/** Persiste o lote via RPC `salvar_lote_gastos` (transação no banco). */
export async function salvarLoteGastosRpc(
  payload: PayloadSalvarGastosLote
): Promise<string[]> {
  if (!supabase) {
    throw new Error('Supabase não configurado.');
  }

  const { data, error } = await supabase.rpc('salvar_lote_gastos', {
    p_org_id: payload.p_org_id,
    p_gastos: payload.p_gastos,
  });

  if (error) throw error;
  return (data as string[] | null) ?? [];
}
