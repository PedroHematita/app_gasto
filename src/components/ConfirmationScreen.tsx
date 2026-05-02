import React from 'react';
import { Check, Plus, Share2 } from 'lucide-react';
import { formatCurrency, buildWhatsAppMessage, openWhatsApp } from '../utils';
import type { GastoItem, PaymentData } from '../types';

interface ConfirmationScreenProps {
  dataCompra: string;
  items: GastoItem[];
  payment: PaymentData;
  totalCents: number;
  onNewExpense: () => void;
}

export const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({
  dataCompra,
  items,
  payment,
  totalCents,
  onNewExpense,
}) => {
  const formaLabel = payment.formaPagamento === 'a_vista' ? 'À Vista' : `Parcelado em ${payment.parcelas || 2}x`;
  const whatsAppMessage = buildWhatsAppMessage(dataCompra, items, payment, totalCents);
  const sortedItems = [...items].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="app-container">
      <div className="confirmation__header">Gasto salvo</div>

      <div className="confirmation">
        {/* Success block */}
        <div className="confirmation__success">
          <div className="confirmation__icon">
            <Check size={24} />
          </div>
          <div className="confirmation__title">Gasto registrado com sucesso</div>
          <div className="confirmation__subtitle">
            {dataCompra}
            {payment.fornecedor && ` • ${payment.fornecedor}`}
          </div>
        </div>

        {/* Payment summary */}
        <div className="confirmation__summary">
          {payment.fornecedor && (
            <div className="confirmation__summary-row">
              <span className="confirmation__summary-label">Fornecedor</span>
              <span className="confirmation__summary-value">{payment.fornecedor}</span>
            </div>
          )}
          <div className="confirmation__summary-row">
            <span className="confirmation__summary-label">Forma</span>
            <span className="confirmation__summary-value">{formaLabel}</span>
          </div>
          <div className="confirmation__summary-row">
            <span className="confirmation__summary-label">Meio</span>
            <span className="confirmation__summary-value">{payment.meioPagamento}</span>
          </div>
          <div className="confirmation__summary-row">
            <span className="confirmation__summary-label">Instituição</span>
            <span className="confirmation__summary-value">{payment.instituicaoFinanceira}</span>
          </div>
          {payment.observacoes && (
            <div className="confirmation__summary-row">
              <span className="confirmation__summary-label">Observações</span>
              <span className="confirmation__summary-value">{payment.observacoes}</span>
            </div>
          )}
        </div>

        {/* Items list */}
        <div className="confirmation__items-title">Itens</div>
        {sortedItems.map((item) => (
          <div key={item.id} className="confirmation__item">
            <div className="confirmation__item-left">
              <div className="confirmation__item-desc">{item.descricao}</div>
              <div className="confirmation__item-meta">
                {item.quantidade} {item.unidade}
              </div>
            </div>
            <div className="confirmation__item-value">
              {formatCurrency(item.valorCentavos)}
            </div>
          </div>
        ))}

        {/* Total */}
        <div className="total-bar total-bar--panel">
          <span className="total-bar__label">Gasto total</span>
          <span className="total-bar__value">{formatCurrency(totalCents)}</span>
        </div>

        {/* WhatsApp preview */}
        <div className="whatsapp-preview">
          <div className="whatsapp-preview__label">Prévia da mensagem</div>
          <div className="whatsapp-preview__text">{whatsAppMessage}</div>
        </div>

        {/* WhatsApp button */}
        <button
          className="btn-whatsapp"
          onClick={() => openWhatsApp(whatsAppMessage)}
          type="button"
        >
          <Share2 size={16} />
          Compartilhar no WhatsApp
        </button>

        {/* New expense */}
        <button
          className="btn-new-expense"
          onClick={onNewExpense}
          type="button"
        >
          <Plus size={14} />
          Novo gasto
        </button>
      </div>
    </div>
  );
};
