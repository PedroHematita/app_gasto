import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { DatePickerSheet } from '../DatePickerSheet';
import { ScreenHeader, ScreenHeaderIconButton } from '../ScreenHeader';
import { PagamentoLotePanel } from './PagamentoLotePanel';
import { GastoBloco, gastoPareceIncompleto } from './GastoBloco';
import {
  RevisarSalvarLoteModal,
  type FaseRevisaoLote,
} from './RevisarSalvarLoteModal';
import {
  alterarDataGasto,
  classificarItemLinha,
  confirmarDataHerdada,
  criarGastoRascunho,
  criarItemRascunho,
  criarRascunhoVazio,
  duplicarGasto,
  formatarDataRascunhoVisivel,
  gruposPorDia,
  itemCampoDescricaoInvalido,
  itemCampoQuantidadeInvalido,
  itemCampoUnidadeInvalido,
  itemCampoValorInvalido,
  itemLinhaCompleta,
  itemLinhaVazia,
  lerRascunhoLocal,
  limparItemRascunho,
  limparRascunhoLocal,
  LINHAS_ITEM_INICIAIS,
  removerLinhasVaziasDosGastos,
  salvarRascunhoLocal,
  totalGeralCentavos,
  type GastoRascunhoLote,
  type ItemRascunhoLote,
  type PagamentoRascunhoLote,
  type RascunhoCadastroMultiplo,
} from '../../lib/cadastroMultiplo/modelo';
import {
  montarPayloadSalvarGastosLote,
  type PayloadSalvarGastosLote,
} from '../../lib/cadastroMultiplo/payload';
import {
  avisosDeDesviosPreco,
  buscarHistoricosDoLote,
  coletarDesviosPrecoLote,
  type DesvioPrecoItemLote,
} from '../../lib/cadastroMultiplo/precoHistoricoLote';
import { salvarLoteGastosRpc } from '../../lib/cadastroMultiplo/salvarLote';
import {
  validarLote,
  type ErroCampoLote,
  type ResultadoValidacaoLote,
} from '../../lib/cadastroMultiplo/validacao';
import { useUnidadeTravaLote } from '../../hooks/useUnidadeTravaLote';
import { limparCacheUnidadeTrava } from '../../lib/cadastroMultiplo/unidadeTrava';
import { formatCurrency } from '../../utils';

/** Há dados digitados (fornecedor ou qualquer linha não vazia). */
function gastoTemPreenchimento(gasto: GastoRascunhoLote): boolean {
  if (gasto.fornecedor.trim()) return true;
  return gasto.itens.some((item) => !itemLinhaVazia(item));
}

interface RevisaoLoteSessao {
  gastos: GastoRascunhoLote[];
  desvios: DesvioPrecoItemLote[];
  payload: PayloadSalvarGastosLote;
  fase: FaseRevisaoLote;
}

interface CadastroMultiploScreenProps {
  orgId: string;
  onBack: () => void;
  onVerMeusGastos?: () => void;
}

function idPrimeiroIncompleto(gastos: GastoRascunhoLote[]): string | null {
  return gastos.find(gastoPareceIncompleto)?.id ?? null;
}

function focarPrimeiroCampoVazio(gasto: GastoRascunhoLote): void {
  if (!gasto.fornecedor.trim()) {
    document.getElementById(`forn-${gasto.id}`)?.focus();
    return;
  }
  if (gasto.dataHerdadaPendente) {
    document.getElementById(`data-${gasto.id}`)?.focus();
    return;
  }
  for (const item of gasto.itens) {
    if (classificarItemLinha(item) === 'vazia') {
      document.getElementById(`desc-${item.id}`)?.focus();
      return;
    }
    if (itemCampoDescricaoInvalido(item)) {
      document.getElementById(`desc-${item.id}`)?.focus();
      return;
    }
    if (itemCampoQuantidadeInvalido(item)) {
      document.getElementById(`qtd-${item.id}`)?.focus();
      return;
    }
    if (itemCampoUnidadeInvalido(item)) {
      document.getElementById(`un-${item.id}`)?.focus();
      return;
    }
    if (itemCampoValorInvalido(item)) {
      document.getElementById(`val-${item.id}`)?.focus();
      return;
    }
  }
  document.getElementById(`forn-${gasto.id}`)?.focus();
}

function focarPrimeiroCampoIncompleto(gasto: GastoRascunhoLote, itemId: string): void {
  const item = gasto.itens.find((i) => i.id === itemId);
  if (!item) return;
  if (itemCampoDescricaoInvalido(item)) {
    document.getElementById(`desc-${item.id}`)?.focus();
    return;
  }
  if (itemCampoQuantidadeInvalido(item)) {
    document.getElementById(`qtd-${item.id}`)?.focus();
    return;
  }
  if (itemCampoUnidadeInvalido(item)) {
    document.getElementById(`un-${item.id}`)?.focus();
    return;
  }
  if (itemCampoValorInvalido(item)) {
    document.getElementById(`val-${item.id}`)?.focus();
  }
}

function elementoIdDoErro(erro: ErroCampoLote): string | null {
  switch (erro.campo) {
    case 'data':
      return `data-${erro.gastoId}`;
    case 'fornecedor':
      return `forn-${erro.gastoId}`;
    case 'pagamento':
    case 'parcelas':
      return `pag-${erro.gastoId}`;
    case 'descricao':
      return erro.itemId ? `desc-${erro.itemId}` : null;
    case 'quantidade':
      return erro.itemId ? `qtd-${erro.itemId}` : null;
    case 'unidade':
      return erro.itemId ? `un-${erro.itemId}` : null;
    case 'valor':
      return erro.itemId ? `val-${erro.itemId}` : null;
    case 'itens':
      return `cad-multi-gasto-${erro.gastoId}`;
    default:
      return null;
  }
}

function aposAbrirCard(gastoId: string, depois?: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById(`cad-multi-gasto-${gastoId}`)?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
      depois?.();
    });
  });
}

/** Painel lateral de pagamento só em telas largas (>=1100). */
function useIsNarrow(breakpoint = 1100) {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : true
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return narrow;
}

function rascunhoComDiaDoAberto(
  loaded: RascunhoCadastroMultiplo,
  abertoId: string | null
): RascunhoCadastroMultiplo {
  if (!abertoId) return loaded;
  const gastoAberto = loaded.gastos.find((g) => g.id === abertoId);
  if (!gastoAberto || !loaded.diasRecolhidos.includes(gastoAberto.dataCompraBR)) return loaded;
  return {
    ...loaded,
    diasRecolhidos: loaded.diasRecolhidos.filter((d) => d !== gastoAberto.dataCompraBR),
  };
}

export function CadastroMultiploScreen({
  orgId,
  onBack,
  onVerMeusGastos,
}: CadastroMultiploScreenProps) {
  const narrow = useIsNarrow();
  const [rascunho, setRascunho] = useState<RascunhoCadastroMultiplo>(() => {
    const loaded = lerRascunhoLocal(orgId) ?? criarRascunhoVazio(orgId);
    return rascunhoComDiaDoAberto(loaded, idPrimeiroIncompleto(loaded.gastos));
  });
  const [pagamentoGastoId, setPagamentoGastoId] = useState<string | null>(null);
  const [datePickerGastoId, setDatePickerGastoId] = useState<string | null>(null);
  const [validacao, setValidacao] = useState<ResultadoValidacaoLote | null>(null);
  const [preparandoRevisao, setPreparandoRevisao] = useState(false);
  const [revisao, setRevisao] = useState<RevisaoLoteSessao | null>(null);
  const [gastoAbertoId, setGastoAbertoId] = useState<string | null>(() => {
    const loaded = lerRascunhoLocal(orgId) ?? criarRascunhoVazio(orgId);
    return idPrimeiroIncompleto(loaded.gastos);
  });
  const [excluirGastoId, setExcluirGastoId] = useState<string | null>(null);
  const [excluirConfirmado, setExcluirConfirmado] = useState(false);

  useEffect(() => {
    limparCacheUnidadeTrava(orgId);
    const loaded = lerRascunhoLocal(orgId) ?? criarRascunhoVazio(orgId);
    const abertoId = idPrimeiroIncompleto(loaded.gastos);
    setRascunho(rascunhoComDiaDoAberto(loaded, abertoId));
    setPagamentoGastoId(null);
    setValidacao(null);
    setPreparandoRevisao(false);
    setRevisao(null);
    setGastoAbertoId(abertoId);
    setExcluirGastoId(null);
    setExcluirConfirmado(false);
  }, [orgId]);

  useEffect(() => {
    salvarRascunhoLocal(rascunho);
  }, [rascunho]);

  const {
    travasPorItemId,
    consultasPendentes,
    unidadeBancoPorNorm,
    normComFalhaConsulta,
    tentarDeNovoUnidade,
  } = useUnidadeTravaLote(orgId, rascunho.gastos);

  useEffect(() => {
    setRascunho((prev) => {
      let mudou = false;
      const gastos = prev.gastos.map((g) => {
        let itensMudaram = false;
        const itens = g.itens.map((item) => {
          const st = travasPorItemId.get(item.id);
          if (st?.unidadeAlvo && st.unidadeAlvo !== item.unidade) {
            itensMudaram = true;
            mudou = true;
            return { ...item, unidade: st.unidadeAlvo };
          }
          return item;
        });
        return itensMudaram ? { ...g, itens } : g;
      });
      return mudou ? { ...prev, gastos } : prev;
    });
  }, [travasPorItemId]);

  const updateGastos = useCallback((fn: (gastos: GastoRascunhoLote[]) => GastoRascunhoLote[]) => {
    setRascunho((prev) => ({ ...prev, gastos: fn(prev.gastos) }));
    setValidacao(null);
  }, []);

  const patchGasto = useCallback(
    (gastoId: string, patch: Partial<GastoRascunhoLote> | ((g: GastoRascunhoLote) => GastoRascunhoLote)) => {
      updateGastos((gastos) =>
        gastos.map((g) => {
          if (g.id !== gastoId) return g;
          return typeof patch === 'function' ? patch(g) : { ...g, ...patch };
        })
      );
    },
    [updateGastos]
  );

  const adicionarGasto = useCallback(() => {
    let novo: GastoRascunhoLote | null = null;
    setRascunho((prev) => {
      const ultimo = prev.gastos[prev.gastos.length - 1] ?? null;
      const seq = prev.proximaSeqItem ?? 1;
      novo = criarGastoRascunho({ herdarDe: ultimo, seqItem: seq });
      return {
        ...prev,
        gastos: [...prev.gastos, novo],
        proximaSeqItem: seq + LINHAS_ITEM_INICIAIS,
        diasRecolhidos: prev.diasRecolhidos.filter((d) => d !== novo!.dataCompraBR),
      };
    });
    if (novo) {
      setGastoAbertoId(novo.id);
      aposAbrirCard(novo.id, () => focarPrimeiroCampoVazio(novo!));
    }
    setValidacao(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        adicionarGasto();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adicionarGasto]);

  const adicionarItem = useCallback((gastoId: string) => {
    setRascunho((prev) => {
      const seq = prev.proximaSeqItem ?? 1;
      return {
        ...prev,
        proximaSeqItem: seq + 1,
        gastos: prev.gastos.map((g) =>
          g.id === gastoId
            ? { ...g, itens: [...g.itens, criarItemRascunho({ seqCriacao: seq })] }
            : g
        ),
      };
    });
    setValidacao(null);
  }, []);

  const patchItem = useCallback(
    (gastoId: string, itemId: string, patch: Partial<ItemRascunhoLote>) => {
      patchGasto(gastoId, (g) => ({
        ...g,
        itens: g.itens.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
      }));
    },
    [patchGasto]
  );

  const toggleDia = useCallback((dataCompraBR: string) => {
    setRascunho((prev) => {
      const recolhido = prev.diasRecolhidos.includes(dataCompraBR);
      return {
        ...prev,
        diasRecolhidos: recolhido
          ? prev.diasRecolhidos.filter((d) => d !== dataCompraBR)
          : [...prev.diasRecolhidos, dataCompraBR],
      };
    });
  }, []);

  const gastoPagamento = rascunho.gastos.find((g) => g.id === pagamentoGastoId) ?? null;
  const grupos = useMemo(() => gruposPorDia(rascunho.gastos), [rascunho.gastos]);
  const totalGeral = totalGeralCentavos(rascunho.gastos);

  const erroNo = useCallback(
    (gastoId: string, campo: string, itemId?: string) =>
      !!validacao?.erros.some(
        (e) => e.gastoId === gastoId && e.campo === campo && (!itemId || e.itemId === itemId)
      ),
    [validacao]
  );

  const gastoTemErro = useCallback(
    (gastoId: string) => !!validacao?.erros.some((e) => e.gastoId === gastoId),
    [validacao]
  );

  const toggleGastoAberto = useCallback(
    (gastoId: string) => {
      if (gastoAbertoId === gastoId) {
        setGastoAbertoId(null);
        return;
      }
      setGastoAbertoId(gastoId);
      aposAbrirCard(gastoId);
    },
    [gastoAbertoId]
  );

  const handleSalvarTudo = async () => {
    if (consultasPendentes || preparandoRevisao || revisao?.fase === 'salvando') return;
    const gastosParaSalvar = removerLinhasVaziasDosGastos(rascunho.gastos);
    const resultado = validarLote(
      gastosParaSalvar,
      new Date(),
      unidadeBancoPorNorm,
      normComFalhaConsulta
    );
    if (!resultado.ok) {
      setValidacao(resultado);
      const primeiro = resultado.erros[0];
      if (primeiro) {
        const gastoErr = rascunho.gastos.find((g) => g.id === primeiro.gastoId);
        if (gastoErr) {
          setRascunho((prev) =>
            prev.diasRecolhidos.includes(gastoErr.dataCompraBR)
              ? {
                  ...prev,
                  diasRecolhidos: prev.diasRecolhidos.filter((d) => d !== gastoErr.dataCompraBR),
                }
              : prev
          );
        }
        setGastoAbertoId(primeiro.gastoId);
        aposAbrirCard(primeiro.gastoId, () => {
          if (primeiro.itemId && gastoErr) {
            focarPrimeiroCampoIncompleto(gastoErr, primeiro.itemId);
            return;
          }
          if (primeiro.campo === 'itens' && gastoErr) {
            const vazia = gastoErr.itens.find(itemLinhaVazia);
            if (vazia) {
              document.getElementById(`desc-${vazia.id}`)?.focus();
              return;
            }
            focarPrimeiroCampoVazio(gastoErr);
            return;
          }
          const elId = elementoIdDoErro(primeiro);
          if (elId) document.getElementById(elId)?.focus();
        });
      }
      return;
    }

    setPreparandoRevisao(true);
    try {
      const historicos = await buscarHistoricosDoLote(orgId, gastosParaSalvar);
      const desvios = coletarDesviosPrecoLote(
        gastosParaSalvar,
        resultado.posicaoPorGastoId,
        historicos
      );
      const avisosPreco = avisosDeDesviosPreco(desvios);
      setValidacao({
        ...resultado,
        avisos: [...resultado.avisos, ...avisosPreco],
      });
      const { payload } = montarPayloadSalvarGastosLote(orgId, gastosParaSalvar);
      const gastosRevisao = gastosParaSalvar.map((g) => ({
        ...g,
        itens: g.itens.filter(itemLinhaCompleta),
      }));
      setRevisao({
        gastos: gastosRevisao,
        desvios,
        payload,
        fase: 'revisar',
      });
    } finally {
      setPreparandoRevisao(false);
    }
  };

  const fecharRevisao = useCallback(() => {
    setRevisao((prev) => (prev?.fase === 'salvando' ? prev : null));
  }, []);

  const confirmarSalvarLote = useCallback(async () => {
    // Ler payload fora do setState: o updater pode rodar depois do return
    // e a UI ficava presa em "Salvando…" sem chamar a RPC.
    if (!revisao || revisao.fase === 'salvando') return;
    const payload = revisao.payload;
    setRevisao({ ...revisao, fase: 'salvando' });
    try {
      await salvarLoteGastosRpc(payload);
      limparRascunhoLocal(orgId);
      setRevisao((prev) => (prev ? { ...prev, fase: 'sucesso' } : prev));
    } catch (err) {
      console.error('Falha ao salvar lote:', err);
      setRevisao((prev) => (prev ? { ...prev, fase: 'erro' } : prev));
    }
  }, [orgId, revisao]);

  const iniciarNovoLote = useCallback(() => {
    limparRascunhoLocal(orgId);
    const novo = criarRascunhoVazio(orgId);
    setRascunho(novo);
    setGastoAbertoId(novo.gastos[0]?.id ?? null);
    setValidacao(null);
    setPagamentoGastoId(null);
    setRevisao(null);
  }, [orgId]);
  const gastoExcluir = excluirGastoId
    ? rascunho.gastos.find((g) => g.id === excluirGastoId) ?? null
    : null;

  const confirmarExcluirGasto = useCallback(() => {
    if (!excluirGastoId || !excluirConfirmado) return;
    const id = excluirGastoId;
    setExcluirGastoId(null);
    setExcluirConfirmado(false);
    setGastoAbertoId((aberto) => (aberto === id ? null : aberto));
    if (pagamentoGastoId === id) setPagamentoGastoId(null);
    updateGastos((gs) => (gs.length <= 1 ? gs : gs.filter((x) => x.id !== id)));
  }, [excluirGastoId, excluirConfirmado, pagamentoGastoId, updateGastos]);

  const onPagamentoChange = (patch: Partial<PagamentoRascunhoLote>) => {
    if (!gastoPagamento) return;
    patchGasto(gastoPagamento.id, (g) => ({
      ...g,
      pagamento: { ...g.pagamento, ...patch },
    }));
  };

  return (
    <div className="cad-multi">
      <ScreenHeader
        title="Cadastro múltiplo"
        subtitle={`${formatarDataRascunhoVisivel(rascunho.atualizadoEmISO)} · rascunho local, não salvo`}
        action={
          <ScreenHeaderIconButton
            onClick={onBack}
            ariaLabel="Fechar"
            className="button-finance--ghost cad-multi__fechar"
          >
            <X size={20} />
          </ScreenHeaderIconButton>
        }
      />

      <div className="cad-multi__shell">
        <div className={`cad-multi__layout ${pagamentoGastoId && !narrow ? 'cad-multi__layout--com-painel' : ''}`}>
          <div className="cad-multi__main">
            {validacao && validacao.erros.length > 0 && (
              <div className="cad-multi__resumo cad-multi__resumo--erro">
                <p className="cad-multi__resumo-titulo">Não é possível salvar</p>
                {validacao.erros.map((e) => (
                  <p key={`${e.gastoId}-${e.itemId ?? ''}-${e.campo}-${e.mensagem}`}>
                    {e.posicaoGasto > 0 ? `Gasto ${e.posicaoGasto}: ${e.mensagem}` : e.mensagem}
                  </p>
                ))}
              </div>
            )}
            {validacao && validacao.avisos.length > 0 && (
              <div className="cad-multi__resumo cad-multi__resumo--aviso">
                <p className="cad-multi__resumo-titulo">
                  {validacao.ok ? 'Avisos — o lote pode ser salvo' : 'Avisos'}
                </p>
                {validacao.avisos.map((a) => (
                  <p key={`${a.tipo}-${a.gastoId}-${a.itemId ?? ''}-${a.mensagem}`}>
                    Gasto {a.posicaoGasto}: {a.mensagem}
                  </p>
                ))}
              </div>
            )}

            {grupos.map((grupo) => {
              const recolhido = rascunho.diasRecolhidos.includes(grupo.dataCompraBR);
              return (
                <section key={grupo.dataCompraBR} className="cad-multi-dia">
                  <button
                    type="button"
                    className="cad-multi-dia__header"
                    onClick={() => toggleDia(grupo.dataCompraBR)}
                  >
                    {recolhido ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span className="cad-multi-dia__data">{grupo.dataCompraBR}</span>
                    <span className="cad-multi-dia__subtotal">
                      {grupo.gastos.length} gasto{grupo.gastos.length === 1 ? '' : 's'} ·{' '}
                      {formatCurrency(grupo.subtotalCentavos)}
                    </span>
                  </button>
                  {!recolhido ? (
                    <div className="cad-multi-dia__lista">
                      {grupo.gastos.map((gasto) => (
                        <GastoBloco
                          key={gasto.id}
                          orgId={orgId}
                          gasto={gasto}
                          aberto={gastoAbertoId === gasto.id}
                          temErroValidacao={gastoTemErro(gasto.id)}
                          travasPorItemId={travasPorItemId}
                          erroNo={erroNo}
                          onToggle={() => toggleGastoAberto(gasto.id)}
                          onPatch={(p) => patchGasto(gasto.id, p)}
                          onPatchItem={(itemId, p) => patchItem(gasto.id, itemId, p)}
                          onAddItem={() => adicionarItem(gasto.id)}
                          onTentarDeNovoUnidade={tentarDeNovoUnidade}
                          onLimparOuRemoverItem={(itemId) =>
                            patchGasto(gasto.id, (g) => {
                              const item = g.itens.find((i) => i.id === itemId);
                              if (!item) return g;
                              if (!itemLinhaVazia(item)) {
                                return {
                                  ...g,
                                  itens: g.itens.map((i) =>
                                    i.id === itemId ? limparItemRascunho(i) : i
                                  ),
                                };
                              }
                              if (g.itens.length <= LINHAS_ITEM_INICIAIS) return g;
                              return {
                                ...g,
                                itens: g.itens.filter((i) => i.id !== itemId),
                              };
                            })
                          }
                          onOpenPagamento={() => setPagamentoGastoId(gasto.id)}
                          onOpenDate={() => setDatePickerGastoId(gasto.id)}
                          onConfirmData={() => patchGasto(gasto.id, confirmarDataHerdada(gasto))}
                          onDuplicar={() => {
                            let copia: GastoRascunhoLote | null = null;
                            setRascunho((prev) => {
                              const idx = prev.gastos.findIndex((x) => x.id === gasto.id);
                              if (idx < 0) return prev;
                              const dup = duplicarGasto(gasto, prev.proximaSeqItem ?? 1);
                              copia = dup.gasto;
                              const next = [...prev.gastos];
                              next.splice(idx + 1, 0, dup.gasto);
                              return {
                                ...prev,
                                gastos: next,
                                proximaSeqItem: dup.proximaSeqItem,
                                diasRecolhidos: prev.diasRecolhidos.filter(
                                  (d) => d !== dup.gasto.dataCompraBR
                                ),
                              };
                            });
                            if (copia) {
                              setGastoAbertoId(copia.id);
                              aposAbrirCard(copia.id, () => focarPrimeiroCampoVazio(copia!));
                            }
                            setValidacao(null);
                          }}
                          onExcluir={() => {
                            if (rascunho.gastos.length <= 1) return;
                            if (!gastoTemPreenchimento(gasto)) {
                              setGastoAbertoId((aberto) => (aberto === gasto.id ? null : aberto));
                              updateGastos((gs) => gs.filter((x) => x.id !== gasto.id));
                              return;
                            }
                            setExcluirConfirmado(false);
                            setExcluirGastoId(gasto.id);
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}

            <button type="button" className="cad-multi__add-gasto" onClick={adicionarGasto}>
              <Plus size={16} /> Adicionar gasto
            </button>
          </div>

          {gastoPagamento && !narrow && (
            <PagamentoLotePanel
              pagamento={gastoPagamento.pagamento}
              narrow={false}
              parcelasError={erroNo(gastoPagamento.id, 'parcelas')}
              onClose={() => setPagamentoGastoId(null)}
              onChange={onPagamentoChange}
            />
          )}
        </div>
      </div>

      <footer className="cad-multi__footer">
        <div className="cad-multi__footer-inner">
          <div className="cad-multi__footer-meta">
            <span>
              {rascunho.gastos.length} gasto{rascunho.gastos.length === 1 ? '' : 's'}
            </span>
            <strong>{formatCurrency(totalGeral)}</strong>
          </div>
          <button
            type="button"
            className="button-finance button-finance--primary"
            onClick={() => void handleSalvarTudo()}
            disabled={consultasPendentes || preparandoRevisao || revisao?.fase === 'salvando'}
            title={
              normComFalhaConsulta.size > 0
                ? 'Há falha ao consultar unidade — use “tentar de novo” na linha'
                : consultasPendentes
                  ? 'Consultando unidades cadastradas…'
                  : undefined
            }
          >
            {consultasPendentes
              ? normComFalhaConsulta.size > 0
                ? 'Consulta falhou'
                : 'Verificando…'
              : preparandoRevisao
                ? 'Conferindo…'
                : 'Salvar tudo'}
          </button>
        </div>
      </footer>

      {gastoPagamento && narrow && (
        <PagamentoLotePanel
          pagamento={gastoPagamento.pagamento}
          narrow
          parcelasError={erroNo(gastoPagamento.id, 'parcelas')}
          onClose={() => setPagamentoGastoId(null)}
          onChange={onPagamentoChange}
        />
      )}

      {datePickerGastoId && (
        <DatePickerSheet
          selectedDate={rascunho.gastos.find((g) => g.id === datePickerGastoId)?.dataCompraBR || ''}
          onSelect={(d) => {
            patchGasto(datePickerGastoId, (g) => alterarDataGasto(g, d));
            setDatePickerGastoId(null);
          }}
          onClose={() => setDatePickerGastoId(null)}
        />
      )}

      {gastoExcluir && (
        <div
          className="modal-overlay modal-finance modal-finance--z-high"
          onClick={() => {
            setExcluirGastoId(null);
            setExcluirConfirmado(false);
          }}
        >
          <div
            className="modal-sheet bottom-sheet-finance modal-finance__container cad-multi-excluir"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-sheet__handle modal-finance__handle" />
            <div className="modal-sheet__title modal-finance__title">Excluir gasto</div>
            <div className="compromisso-cancel-confirm__body modal-finance__body">
              <p>
                Este gasto tem dados preenchidos
                {gastoExcluir.fornecedor.trim()
                  ? ` (“${gastoExcluir.fornecedor.trim()}”)`
                  : ''}
                . A exclusão não pode ser desfeita.
              </p>
              <label className="cad-multi-excluir__check">
                <input
                  type="checkbox"
                  checked={excluirConfirmado}
                  onChange={(e) => setExcluirConfirmado(e.target.checked)}
                />
                <span>Sim, excluir este gasto</span>
              </label>
            </div>
            <div className="compromisso-cancel-confirm__actions modal-finance__actions modal-finance__footer">
              <button
                type="button"
                className="button-finance button-finance--ghost"
                onClick={() => {
                  setExcluirGastoId(null);
                  setExcluirConfirmado(false);
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                className="button-finance button-finance--ghost cad-multi-excluir__btn-danger"
                disabled={!excluirConfirmado}
                onClick={confirmarExcluirGasto}
              >
                Excluir gasto
              </button>
            </div>
          </div>
        </div>
      )}

      {revisao ? (
        <RevisarSalvarLoteModal
          gastos={revisao.gastos}
          desvios={revisao.desvios}
          payload={revisao.payload}
          fase={revisao.fase}
          onVoltar={fecharRevisao}
          onSalvar={() => void confirmarSalvarLote()}
          onVerMeusGastos={() => {
            setRevisao(null);
            onVerMeusGastos?.();
          }}
          onNovoLote={iniciarNovoLote}
        />
      ) : null}
    </div>
  );
}
