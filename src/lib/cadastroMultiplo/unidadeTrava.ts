import { normalizeDescricao } from '../../utils';
import type { GastoRascunhoLote } from './modelo';

export type FonteTravaUnidade = 'banco' | 'rascunho';

export interface ItemParaTrava {
  itemId: string;
  gastoId: string;
  descricao: string;
  unidade: string;
  /** Sequência estável de criação — define a referência, não a posição no array. */
  seqCriacao: number;
}

export interface EstadoTravaItem {
  travado: boolean;
  fonte: FonteTravaUnidade | null;
  /** Unidade que deve valer (aplicar se diferente da atual). */
  unidadeAlvo: string | null;
  /** Ainda aguardando consulta ao banco para esta descrição. */
  pendenteBanco: boolean;
  /** Consulta falhou (rede etc.): salvamento bloqueado até retry com sucesso. */
  falhaConsulta: boolean;
  dica: string | null;
}

/** Cache em memória: chave = `${orgId}|${descNormalizada}` → unidade do banco ou `null` se inexistente. */
const cacheUnidadePorOrgDesc = new Map<string, string | null>();
/** Descrições cuja última consulta falhou (não confundir com “não existe no banco”). */
const falhasConsultaPorOrgDesc = new Set<string>();

export function chaveCacheUnidade(orgId: string, descricaoNormalizada: string): string {
  return `${orgId}|${descricaoNormalizada}`;
}

export function lerCacheUnidade(orgId: string, descricaoNormalizada: string): string | null | undefined {
  const key = chaveCacheUnidade(orgId, descricaoNormalizada);
  if (falhasConsultaPorOrgDesc.has(key)) return undefined;
  if (!cacheUnidadePorOrgDesc.has(key)) return undefined;
  return cacheUnidadePorOrgDesc.get(key);
}

export function temFalhaConsultaUnidade(orgId: string, descricaoNormalizada: string): boolean {
  return falhasConsultaPorOrgDesc.has(chaveCacheUnidade(orgId, descricaoNormalizada));
}

export function gravarCacheUnidade(
  orgId: string,
  descricaoNormalizada: string,
  unidade: string | null
): void {
  const key = chaveCacheUnidade(orgId, descricaoNormalizada);
  falhasConsultaPorOrgDesc.delete(key);
  cacheUnidadePorOrgDesc.set(key, unidade);
}

export function gravarFalhaConsultaUnidade(orgId: string, descricaoNormalizada: string): void {
  const key = chaveCacheUnidade(orgId, descricaoNormalizada);
  cacheUnidadePorOrgDesc.delete(key);
  falhasConsultaPorOrgDesc.add(key);
}

export function limparFalhaConsultaUnidade(orgId: string, descricaoNormalizada: string): void {
  falhasConsultaPorOrgDesc.delete(chaveCacheUnidade(orgId, descricaoNormalizada));
}

/** Limpar após salvamento com sucesso (novas descrições passam a existir no banco). */
export function limparCacheUnidadeTrava(orgId?: string): void {
  if (!orgId) {
    cacheUnidadePorOrgDesc.clear();
    falhasConsultaPorOrgDesc.clear();
    return;
  }
  const prefix = `${orgId}|`;
  for (const key of [...cacheUnidadePorOrgDesc.keys()]) {
    if (key.startsWith(prefix)) cacheUnidadePorOrgDesc.delete(key);
  }
  for (const key of [...falhasConsultaPorOrgDesc]) {
    if (key.startsWith(prefix)) falhasConsultaPorOrgDesc.delete(key);
  }
}

/**
 * Ordem de criação: ordena por seqCriacao crescente.
 * Não usa posição no array nem agrupamento por dia.
 */
export function listarItensOrdemCriacao(gastos: GastoRascunhoLote[]): ItemParaTrava[] {
  const out: ItemParaTrava[] = [];
  for (const g of gastos) {
    for (const item of g.itens) {
      out.push({
        itemId: item.id,
        gastoId: g.id,
        descricao: item.descricao,
        unidade: item.unidade,
        seqCriacao: item.seqCriacao,
      });
    }
  }
  out.sort((a, b) => a.seqCriacao - b.seqCriacao || a.itemId.localeCompare(b.itemId));
  return out;
}

/**
 * Resolve travas.
 * `unidadeBancoPorNorm`: undefined = ainda não consultado ou falha; null = consultado e não existe; string = unidade do banco.
 * `normComFalha`: descrições cuja consulta falhou (rede).
 */
export function resolverTravasUnidade(
  itens: ItemParaTrava[],
  unidadeBancoPorNorm: ReadonlyMap<string, string | null | undefined>,
  normComFalha: ReadonlySet<string> = new Set()
): Map<string, EstadoTravaItem> {
  const resultado = new Map<string, EstadoTravaItem>();
  const primeiraPorNorm = new Map<string, ItemParaTrava>();

  // itens já devem vir ordenados por seqCriacao
  for (const item of itens) {
    const norm = normalizeDescricao(item.descricao);
    if (norm.length >= 2 && !primeiraPorNorm.has(norm)) {
      primeiraPorNorm.set(norm, item);
    }
  }

  for (const item of itens) {
    const norm = normalizeDescricao(item.descricao);
    if (norm.length < 2) {
      resultado.set(item.itemId, {
        travado: false,
        fonte: null,
        unidadeAlvo: null,
        pendenteBanco: false,
        falhaConsulta: false,
        dica: null,
      });
      continue;
    }

    if (normComFalha.has(norm)) {
      resultado.set(item.itemId, {
        travado: false,
        fonte: null,
        unidadeAlvo: null,
        pendenteBanco: true,
        falhaConsulta: true,
        dica: 'falha ao consultar — tentar de novo',
      });
      continue;
    }

    const doBanco = unidadeBancoPorNorm.get(norm);
    if (doBanco === undefined) {
      resultado.set(item.itemId, {
        travado: false,
        fonte: null,
        unidadeAlvo: null,
        pendenteBanco: true,
        falhaConsulta: false,
        dica: null,
      });
      continue;
    }

    if (typeof doBanco === 'string' && doBanco.length > 0) {
      resultado.set(item.itemId, {
        travado: true,
        fonte: 'banco',
        unidadeAlvo: doBanco,
        pendenteBanco: false,
        falhaConsulta: false,
        dica: null,
      });
      continue;
    }

    const primeira = primeiraPorNorm.get(norm)!;
    if (primeira.itemId === item.itemId) {
      resultado.set(item.itemId, {
        travado: false,
        fonte: null,
        unidadeAlvo: null,
        pendenteBanco: false,
        falhaConsulta: false,
        dica: null,
      });
    } else {
      resultado.set(item.itemId, {
        travado: true,
        fonte: 'rascunho',
        unidadeAlvo: primeira.unidade,
        pendenteBanco: false,
        falhaConsulta: false,
        dica: null,
      });
    }
  }

  return resultado;
}

/** Conflitos a marcar na validação (espelha o alert do individual). */
export function conflitosUnidadeLote(
  itens: ItemParaTrava[],
  unidadeBancoPorNorm: ReadonlyMap<string, string | null | undefined>,
  normComFalha: ReadonlySet<string> = new Set()
): Array<{ itemId: string; gastoId: string; mensagem: string }> {
  const travas = resolverTravasUnidade(itens, unidadeBancoPorNorm, normComFalha);
  const conflitos: Array<{ itemId: string; gastoId: string; mensagem: string }> = [];

  for (const item of itens) {
    const st = travas.get(item.itemId);
    if (!st || st.pendenteBanco || st.falhaConsulta || !st.unidadeAlvo) continue;
    if (item.unidade !== st.unidadeAlvo) {
      const mensagem =
        st.fonte === 'banco'
          ? `Esta descrição já está cadastrada com a unidade de medida "${st.unidadeAlvo}".`
          : `Esta descrição já está na lista atual com a unidade de medida "${st.unidadeAlvo}".`;
      conflitos.push({ itemId: item.itemId, gastoId: item.gastoId, mensagem });
    }
  }

  return conflitos;
}

export function descricoesNormQuePrecisamConsulta(
  itens: ItemParaTrava[],
  orgId: string
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of itens) {
    const norm = normalizeDescricao(item.descricao);
    if (norm.length < 2) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    if (temFalhaConsultaUnidade(orgId, norm)) continue;
    if (lerCacheUnidade(orgId, norm) === undefined) out.push(norm);
  }
  return out;
}

export function normasComFalhaConsulta(orgId: string, itens: ItemParaTrava[]): Set<string> {
  const out = new Set<string>();
  for (const item of itens) {
    const norm = normalizeDescricao(item.descricao);
    if (norm.length < 2) continue;
    if (temFalhaConsultaUnidade(orgId, norm)) out.add(norm);
  }
  return out;
}
