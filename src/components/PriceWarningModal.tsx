import React from 'react';
import { formatCurrency } from '../utils';

interface PriceWarningModalProps {
  media: number;
  unidade: string;
  limiteInferior: number;
  limiteSuperior: number;
  valorInformado: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PriceWarningModal: React.FC<PriceWarningModalProps> = ({
  media,
  unidade,
  limiteInferior,
  limiteSuperior,
  valorInformado,
  onConfirm,
  onCancel,
}) => {
  return (
    <div
      className="modal-overlay modal-finance modal-finance--z-elevated"
      onClick={onCancel}
    >
      <div
        className="modal-sheet price-history-sheet bottom-sheet-finance modal-finance__container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-sheet__handle modal-finance__handle" />
        <div className="ph-title ph-title--warning modal-finance__title--warning">
          Valor fora do padrão histórico
        </div>

        <div className="modal-finance__body">
          <p className="modal-finance__lead">
            O valor informado está diferente do histórico para este item.
          </p>

          <div className="modal-finance__detail-panel">
            <div className="modal-finance__detail-row">
              <span className="modal-finance__detail-label">Média histórica:</span>
              <span className="modal-finance__detail-value modal-finance__detail-value--accent">
                {formatCurrency(media)} / {unidade}
              </span>
            </div>
            <div className="modal-finance__detail-row">
              <span className="modal-finance__detail-label">Faixa esperada:</span>
              <span className="modal-finance__detail-value">
                {formatCurrency(limiteInferior)} a {formatCurrency(limiteSuperior)}
              </span>
            </div>
            <div className="modal-finance__detail-divider" />
            <div className="modal-finance__detail-row">
              <span className="modal-finance__detail-label">Valor informado:</span>
              <span className="modal-finance__detail-value modal-finance__detail-value--warning">
                {formatCurrency(valorInformado)} / {unidade}
              </span>
            </div>
          </div>
        </div>

        <div className="payment-warning-actions modal-finance__actions modal-finance__footer">
          <button
            onClick={onCancel}
            type="button"
            className="payment-warning-actions__fix button-finance button-finance--primary"
          >
            Ajustar valor
          </button>
          <button
            onClick={onConfirm}
            type="button"
            className="payment-warning-actions__continue button-finance button-finance--ghost"
          >
            Confirmar assim mesmo
          </button>
        </div>
      </div>
    </div>
  );
};
