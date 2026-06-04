import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { formatCurrency, compromissoDisplayTitle, daysOverdueFromPrevistaBR } from '../utils';
import { cancelCompromisso } from '../lib/supabase';
import type { CompromissoRecord, CompromissoParcela } from '../types';

interface CompromissoDetailProps {
  compromisso: CompromissoRecord;
  onBack: () => void;
  onRequestQuit: () => void;
  onRequestQuitParcela: (parcela: CompromissoParcela) => void;
  onCancelled: () => void;
}

export const CompromissoDetail: React.FC<CompromissoDetailProps> = ({
  compromisso,
  onBack,
  onRequestQuit,
  onRequestQuitParcela,
  onCancelled,
}) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const sortedItems = [...compromisso.items].sort((a, b) => a.ordem - b.ordem);
  const title = compromissoDisplayTitle(compromisso);
  const isVencido = compromisso.status === 'vencido';
  const dias = daysOverdueFromPrevistaBR(compromisso.dataPrevistaPagamento);

  const isParcelado = compromisso.tipo === 'parcelado';
  const parcelas = compromisso.parcelas || [];
  const showQuitarUnico =
    !isParcelado && (compromisso.status === 'pendente' || compromisso.status === 'vencido');

  const totalPago = parcelas
    .filter((p) => p.status === 'quitado')
    .reduce((s, p) => s + p.valorCentavos, 0);

  const totalPendente = parcelas
    .filter((p) => p.status === 'pendente' || p.status === 'vencido')
    .reduce((s, p) => s + p.valorCentavos, 0);

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await cancelCompromisso(compromisso.id);
      setShowCancelConfirm(false);
      onCancelled();
    } catch (e) {
      console.error(e);
      alert('Não foi possível cancelar. Tente novamente.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="app-container detail-screen">
      <header className="detail-header">
        <button
          className="detail-header__back"
          onClick={onBack}
          type="button"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="detail-header__title">Compromisso</span>
        <span className="detail-header__spacer" aria-hidden />
      </header>

      <div className="detail-content">
        <section className="detail-summary-card" aria-label="Resumo do compromisso">
          <h2 className="detail-summary-card__title">{title}</h2>
          <p className="detail-summary-card__meta">Compra em {compromisso.dataCompra}</p>
          {!isParcelado && (
            <div className="detail-info__prevista-line">
              <span className="detail-info__date detail-info__date--inline">
                Pagamento previsto: {compromisso.dataPrevistaPagamento}
              </span>
              <span
                className={`compromisso-badge compromisso-badge--${isVencido ? 'vencido' : 'pendente'}`}
              >
                {isVencido ? 'vencido' : 'pendente'}
              </span>
            </div>
          )}
          {!isParcelado && isVencido && dias > 0 && (
            <p className="compromisso-meta compromisso-meta--danger" style={{ marginTop: 8, marginBottom: 0 }}>
              vencido há {dias} dia{dias === 1 ? '' : 's'}
            </p>
          )}
          <div className="detail-summary-card__total-row">
            <span className="detail-summary-card__total-label">Total do compromisso</span>
            <span className="detail-summary-card__total-value">
              {formatCurrency(compromisso.total)}
            </span>
          </div>
          {showQuitarUnico && (
            <button
              className="btn-compromisso-quitar button-finance button-finance--primary detail-summary-card__cta"
              onClick={onRequestQuit}
              type="button"
            >
              Quitar compromisso
            </button>
          )}
        </section>

        <section className="detail-section" aria-labelledby="compromisso-detail-itens">
          <h3 id="compromisso-detail-itens" className="detail-section__title">
            Itens
          </h3>
          {sortedItems.map((item) => (
            <div key={item.id} className="detail-item">
              <div className="detail-item__top">
                <span className="detail-item__num">{item.ordem}</span>
                <span className="detail-item__desc">{item.descricao}</span>
              </div>
              <div className="detail-item__bottom">
                <span className="detail-item__qty">
                  {item.quantidade} {item.unidade}
                </span>
                <span className="detail-item__value">
                  {formatCurrency(item.valorCentavos)}
                </span>
              </div>
            </div>
          ))}
        </section>

        {isParcelado && (
          <section className="detail-section" aria-labelledby="compromisso-detail-parcelas">
            <h3 id="compromisso-detail-parcelas" className="detail-section__title">
              Parcelas
            </h3>
            <div className="card-finance card-finance--section compromisso-parcelas-card">
              {parcelas.map((p, idx) => {
                const isPendente = p.status === 'pendente' || p.status === 'vencido';
                return (
                  <div
                    key={p.id}
                    className={`card-finance__item compromisso-parcelas-card__item ${
                      idx === parcelas.length - 1 ? 'compromisso-parcelas-card__item--last' : ''
                    }`}
                  >
                    <div className="compromisso-parcelas-card__item-main">
                      <div className="compromisso-parcelas-card__item-title">
                        Parcela {p.numeroParcela}/{p.totalParcelas}
                      </div>
                      <div className="compromisso-parcelas-card__item-date">
                        Vence em: {p.dataVencimentoBR}
                      </div>
                    </div>

                    <div className="compromisso-parcelas-card__item-actions">
                      <div className="compromisso-parcelas-card__item-price-wrap">
                        <div className="compromisso-parcelas-card__item-price">
                          {formatCurrency(p.valorCentavos)}
                        </div>
                        <span
                          className={`compromisso-badge compromisso-badge--${p.status} compromisso-parcelas-card__item-badge`}
                        >
                          {p.status}
                        </span>
                      </div>

                      {isPendente && (
                        <button
                          type="button"
                          onClick={() => onRequestQuitParcela(p)}
                          className="compromisso-parcelas-card__quitar-btn button-finance button-finance--primary button-finance--compact"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="compromisso-parcelas-card__summary">
                <div className="compromisso-parcelas-card__summary-row">
                  <span>Total Pago:</span>
                  <span className="compromisso-parcelas-card__summary-value compromisso-parcelas-card__summary-value--success">
                    {formatCurrency(totalPago)}
                  </span>
                </div>
                <div className="compromisso-parcelas-card__summary-row">
                  <span>Total Pendente:</span>
                  <span className="compromisso-parcelas-card__summary-value compromisso-parcelas-card__summary-value--danger">
                    {formatCurrency(totalPendente)}
                  </span>
                </div>
                <div className="compromisso-parcelas-card__summary-row compromisso-parcelas-card__summary-row--total">
                  <span>Total do Compromisso:</span>
                  <span>{formatCurrency(compromisso.total)}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="compromisso-detail-actions">
          <button
            type="button"
            className="btn-compromisso-secondary button-finance button-finance--ghost"
            onClick={() => setShowCancelConfirm(true)}
          >
            Cancelar compromisso
          </button>
        </div>
      </div>

      {showCancelConfirm && (
        <div
          className="modal-overlay modal-finance modal-finance--z-high"
          onClick={() => !cancelling && setShowCancelConfirm(false)}
        >
          <div
            className="modal-sheet bottom-sheet-finance modal-finance__container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-sheet__handle modal-finance__handle" />
            <div className="modal-sheet__title modal-finance__title">Cancelar compromisso</div>
            <div className="compromisso-cancel-confirm__body modal-finance__body">
              <p>
                Esta ação não pode ser desfeita. O compromisso será removido da lista de pendentes.
              </p>
            </div>
            <div className="compromisso-cancel-confirm__actions modal-finance__actions modal-finance__footer">
              <button
                type="button"
                className="btn-compromisso-secondary button-finance button-finance--ghost"
                disabled={cancelling}
                onClick={() => setShowCancelConfirm(false)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn-compromisso-secondary button-finance button-finance--ghost"
                disabled={cancelling}
                onClick={handleConfirmCancel}
              >
                {cancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
