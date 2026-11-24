import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CircleCheck, Loader2 } from 'lucide-react';
import type { DesvioPrecoItemLote } from '../../lib/cadastroMultiplo/precoHistoricoLote';
import type { PayloadSalvarGastosLote } from '../../lib/cadastroMultiplo/payload';
import {
  totalGastoCentavos,
  totalGeralCentavos,
  type GastoRascunhoLote,
} from '../../lib/cadastroMultiplo/modelo';
import { formatCurrency } from '../../utils';
import { contarDiasLote, gruposRevisaoPorDia, resumoItensGasto } from './revisaoLoteFormat';

export type FaseRevisaoLote = 'revisar' | 'salvando' | 'sucesso' | 'erro';

interface RevisarSalvarLoteModalProps {
  gastos: GastoRascunhoLote[];
  desvios: DesvioPrecoItemLote[];
  payload: PayloadSalvarGastosLote;
  fase: FaseRevisaoLote;
  onVoltar: () => void;
  onSalvar: () => void;
  onVerMeusGastos: () => void;
  onNovoLote: () => void;
}

const isDev = import.meta.env.DEV;

function PopoverDesvio({ desvios }: { desvios: DesvioPrecoItemLote[] }) {
  if (desvios.length === 0) return null;
  return (
    <div className="cad-multi-revisar__tip" role="tooltip">
      {desvios.map((d) => (
        <p key={`${d.gastoId}-${d.itemId}`}>
          <strong>{d.descricao}</strong>: {formatCurrency(d.desvio.valorUnitarioCentavos)} /{' '}
          {d.unidade} (média {formatCurrency(d.desvio.mediaPonderadaCentavos)})
        </p>
      ))}
    </div>
  );
}

export function RevisarSalvarLoteModal({
  gastos,
  desvios,
  payload,
  fase,
  onVoltar,
  onSalvar,
  onVerMeusGastos,
  onNovoLote,
}: RevisarSalvarLoteModalProps) {
  const titleId = useId();
  const [jsonAberto, setJsonAberto] = useState(false);
  const [tipGastoId, setTipGastoId] = useState<string | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const bloqueado = fase === 'salvando';
  const nGastos = gastos.length;
  const nDias = contarDiasLote(gastos);
  const totalLote = totalGeralCentavos(gastos);
  const grupos = useMemo(() => gruposRevisaoPorDia(gastos), [gastos]);
  const desviosPorGasto = useMemo(() => {
    const map = new Map<string, DesvioPrecoItemLote[]>();
    for (const d of desvios) {
      const lista = map.get(d.gastoId) ?? [];
      lista.push(d);
      map.set(d.gastoId, lista);
    }
    return map;
  }, [desvios]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (bloqueado) return;
      if (fase === 'sucesso') return;
      onVoltar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bloqueado, fase, onVoltar]);

  useEffect(() => {
    if (!tipGastoId) return;
    const onDoc = (e: MouseEvent) => {
      if (tipRef.current?.contains(e.target as Node)) return;
      setTipGastoId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [tipGastoId]);

  const fecharSeLivre = useCallback(() => {
    if (bloqueado || fase === 'sucesso') return;
    onVoltar();
  }, [bloqueado, fase, onVoltar]);

  const corpoSucesso = (
    <div className="cad-multi-revisar__resultado">
      <CircleCheck size={40} className="cad-multi-revisar__check" aria-hidden />
      <p className="cad-multi-revisar__resultado-titulo">
        {nGastos} {nGastos === 1 ? 'gasto salvo' : 'gastos salvos'}
      </p>
      <p className="cad-multi-revisar__resultado-total">{formatCurrency(totalLote)}</p>
      <div className="cad-multi-revisar__resultado-acoes">
        <button type="button" className="cad-multi-revisar__btn-sec" onClick={onVerMeusGastos}>
          Ver em Meus gastos
        </button>
        <button type="button" className="cad-multi-revisar__btn-pri" onClick={onNovoLote}>
          Novo lote
        </button>
      </div>
    </div>
  );

  const corpoRevisao = (
    <>
      <header className="cad-multi-revisar__header">
        <h2 id={titleId} className="cad-multi-revisar__titulo">
          Revisar e salvar
        </h2>
        <p className="cad-multi-revisar__subtitulo">
          {nGastos} {nGastos === 1 ? 'gasto' : 'gastos'} · {nDias}{' '}
          {nDias === 1 ? 'dia' : 'dias'} · confira antes de salvar
        </p>
      </header>

      <div className="cad-multi-revisar__total">
        <span>Total do lote</span>
        <strong>{formatCurrency(totalLote)}</strong>
      </div>

      <div className="cad-multi-revisar__lista">
        {grupos.map((grupo) => (
          <section key={grupo.dataCompraBR} className="cad-multi-revisar__dia">
            <div className="cad-multi-revisar__dia-head">
              <span>{grupo.labelDia}</span>
              <span>{formatCurrency(grupo.subtotalCentavos)}</span>
            </div>
            <ul className="cad-multi-revisar__gastos">
              {grupo.gastos.map((gasto) => {
                const avisosGasto = desviosPorGasto.get(gasto.id) ?? [];
                const temAviso = avisosGasto.length > 0;
                const resumoItens = resumoItensGasto(gasto);
                return (
                  <li key={gasto.id} className="cad-multi-revisar__gasto">
                    <div className="cad-multi-revisar__gasto-left">
                      <span className="cad-multi-revisar__fornecedor">
                        {gasto.fornecedor.trim() || '—'}
                      </span>
                      <span className="cad-multi-revisar__meta">
                        {resumoItens}
                        {resumoItens ? ' · ' : ''}
                        {gasto.pagamento.meioPagamento} · {gasto.pagamento.instituicaoFinanceira}
                      </span>
                    </div>
                    <div className="cad-multi-revisar__gasto-right">
                      {temAviso ? (
                        <span className="cad-multi-revisar__aviso-wrap" ref={tipGastoId === gasto.id ? tipRef : undefined}>
                          <button
                            type="button"
                            className="cad-multi-revisar__dot"
                            aria-label="Valor fora da média de preço"
                            onClick={() =>
                              setTipGastoId((id) => (id === gasto.id ? null : gasto.id))
                            }
                          />
                          {tipGastoId === gasto.id ? <PopoverDesvio desvios={avisosGasto} /> : null}
                        </span>
                      ) : null}
                      <span className="cad-multi-revisar__valor">
                        {formatCurrency(totalGastoCentavos(gasto))}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <footer className="cad-multi-revisar__footer">
        {desvios.length > 0 ? (
          <p className="cad-multi-revisar__aviso-lote">
            <span className="cad-multi-revisar__dot cad-multi-revisar__dot--inline" aria-hidden />
            {desvios.length} valor{desvios.length === 1 ? '' : 'es'} fora da média de preço. Você
            pode salvar mesmo assim.
          </p>
        ) : null}
        {fase === 'erro' ? (
          <p className="cad-multi-revisar__erro">Não foi possível salvar. Nada foi gravado.</p>
        ) : null}
        <div className="cad-multi-revisar__footer-row">
          {isDev ? (
            <button
              type="button"
              className="cad-multi-revisar__json-link"
              onClick={() => setJsonAberto((v) => !v)}
            >
              {jsonAberto ? 'Ocultar JSON' : 'Ver JSON'}
            </button>
          ) : (
            <span />
          )}
          <div className="cad-multi-revisar__acoes">
            <button
              type="button"
              className="cad-multi-revisar__btn-sec"
              disabled={bloqueado}
              onClick={onVoltar}
            >
              Voltar e editar
            </button>
            <button
              type="button"
              className="cad-multi-revisar__btn-pri"
              disabled={bloqueado}
              onClick={onSalvar}
            >
              {fase === 'salvando' ? (
                <>
                  <Loader2 size={16} className="cad-multi-revisar__spin" aria-hidden />
                  Salvando…
                </>
              ) : fase === 'erro' ? (
                'Tentar de novo'
              ) : (
                `Salvar ${nGastos} ${nGastos === 1 ? 'gasto' : 'gastos'}`
              )}
            </button>
          </div>
        </div>
        {isDev && jsonAberto ? (
          <pre className="cad-multi-revisar__json">{JSON.stringify(payload, null, 2)}</pre>
        ) : null}
      </footer>
    </>
  );

  return (
    <div
      className="cad-multi-revisar-overlay"
      onClick={fecharSeLivre}
      role="presentation"
    >
      <div
        className="cad-multi-revisar"
        role="dialog"
        aria-modal="true"
        aria-labelledby={fase === 'sucesso' ? undefined : titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {fase === 'sucesso' ? corpoSucesso : corpoRevisao}
      </div>
    </div>
  );
}
