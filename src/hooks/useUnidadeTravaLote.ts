import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkUnidadeForDescricao } from '../lib/supabase';
import { normalizeDescricao } from '../utils';
import type { GastoRascunhoLote } from '../lib/cadastroMultiplo/modelo';
import {
  descricoesNormQuePrecisamConsulta,
  gravarCacheUnidade,
  gravarFalhaConsultaUnidade,
  lerCacheUnidade,
  limparFalhaConsultaUnidade,
  listarItensOrdemCriacao,
  normasComFalhaConsulta,
  resolverTravasUnidade,
  temFalhaConsultaUnidade,
  type EstadoTravaItem,
} from '../lib/cadastroMultiplo/unidadeTrava';

/**
 * Debounce ~300ms + cache por org/descrição.
 * Falha de rede: não grava como “inexistente”; marca falha e mantém salvamento bloqueado.
 */
export function useUnidadeTravaLote(
  orgId: string,
  gastos: GastoRascunhoLote[]
): {
  travasPorItemId: Map<string, EstadoTravaItem>;
  consultasPendentes: boolean;
  unidadeBancoPorNorm: Map<string, string | null | undefined>;
  normComFalhaConsulta: Set<string>;
  tentarDeNovoUnidade: (descricao: string) => void;
} {
  const [tick, setTick] = useState(0);
  const [pendentes, setPendentes] = useState(0);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const itens = useMemo(() => listarItensOrdemCriacao(gastos), [gastos]);

  const unidadeBancoPorNorm = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    for (const item of itens) {
      const norm = normalizeDescricao(item.descricao);
      if (norm.length < 2) continue;
      if (map.has(norm)) continue;
      if (temFalhaConsultaUnidade(orgId, norm)) {
        map.set(norm, undefined);
        continue;
      }
      map.set(norm, lerCacheUnidade(orgId, norm));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, orgId, tick]);

  const normComFalha = useMemo(() => normasComFalhaConsulta(orgId, itens), [itens, orgId, tick]);

  const travasPorItemId = useMemo(
    () => resolverTravasUnidade(itens, unidadeBancoPorNorm, normComFalha),
    [itens, unidadeBancoPorNorm, normComFalha]
  );

  const agendarConsulta = useCallback(
    (norm: string, descricaoAmostra: string, imediato = false) => {
      if (timers.current.has(norm)) {
        clearTimeout(timers.current.get(norm)!);
        timers.current.delete(norm);
      }
      setPendentes((n) => n + 1);
      const t = setTimeout(
        async () => {
          timers.current.delete(norm);
          try {
            const unidade = await checkUnidadeForDescricao(orgId, descricaoAmostra);
            gravarCacheUnidade(orgId, norm, unidade);
          } catch {
            gravarFalhaConsultaUnidade(orgId, norm);
          } finally {
            setPendentes((n) => Math.max(0, n - 1));
            setTick((x) => x + 1);
          }
        },
        imediato ? 0 : 300
      );
      timers.current.set(norm, t);
    },
    [orgId]
  );

  useEffect(() => {
    const precisas = descricoesNormQuePrecisamConsulta(itens, orgId);
    for (const norm of precisas) {
      if (timers.current.has(norm)) continue;
      const amostra = itens.find((i) => normalizeDescricao(i.descricao) === norm);
      if (!amostra) continue;
      agendarConsulta(norm, amostra.descricao);
    }
  }, [itens, orgId, agendarConsulta, tick]);

  const tentarDeNovoUnidade = useCallback(
    (descricao: string) => {
      const norm = normalizeDescricao(descricao);
      if (norm.length < 2) return;
      limparFalhaConsultaUnidade(orgId, norm);
      setTick((x) => x + 1);
      agendarConsulta(norm, descricao, true);
    },
    [orgId, agendarConsulta]
  );

  useEffect(() => {
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
    setPendentes(0);
    setTick((x) => x + 1);
  }, [orgId]);

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  const consultasPendentes =
    pendentes > 0 ||
    [...travasPorItemId.values()].some((s) => s.pendenteBanco || s.falhaConsulta);

  return {
    travasPorItemId,
    consultasPendentes,
    unidadeBancoPorNorm,
    normComFalhaConsulta: normComFalha,
    tentarDeNovoUnidade,
  };
}
