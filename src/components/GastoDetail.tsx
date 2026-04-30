import { ChevronLeft, Pencil, Share2, Image } from 'lucide-react';
import { formatCurrency, buildWhatsAppMessage, openWhatsApp } from '../utils';
import type { GastoRecord, PaymentData } from '../types';

interface GastoDetailProps {
  gasto: GastoRecord;
  onBack: () => void;
  onEdit: () => void;
}

export const GastoDetail: React.FC<GastoDetailProps> = ({
  gasto,
  onBack,
  onEdit,
}) => {
  const sortedItems = [...gasto.items].sort((a, b) => a.ordem - b.ordem);

  const paymentForWhatsApp: PaymentData = {
    fornecedor: gasto.fornecedor,
    formaPagamento: gasto.formaPagamento === 'À Vista' ? 'a_vista' : 'parcelado',
    meioPagamento: gasto.meioPagamento,
    instituicaoFinanceira: gasto.instituicaoFinanceira,
    observacoes: gasto.observacoes,
    comprovanteFile: null,
    comprovanteUrl: gasto.comprovanteUrl,
    parcelas: gasto.parcelas,
  };

  const whatsAppMessage = buildWhatsAppMessage(
    gasto.dataCompra,
    gasto.items,
    paymentForWhatsApp,
    gasto.total,
  );

  return (
    <div className="app-container" style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} type="button">
          <ChevronLeft size={20} />
        </button>
        <span className="detail-header__title">Gasto #{gasto.seq}</span>
        <button className="detail-header__edit" onClick={onEdit} type="button">
          <Pencil size={16} />
          <span>Editar</span>
        </button>
      </div>

      <div className="detail-content">
        {/* Fornecedor & date */}
        <div className="detail-info">
          <div className="detail-info__fornecedor">
            {gasto.fornecedor || 'Sem fornecedor'}
          </div>
          <div className="detail-info__date">{gasto.dataCompra}</div>
        </div>

        {/* Payment chips */}
        <div className="detail-chips">
          <span className="detail-chip">
            {gasto.formaPagamento === 'À Vista' ? 'À Vista' : `Parcelado em ${gasto.parcelas || 2}x`}
          </span>
          <span className="detail-chip">{gasto.meioPagamento}</span>
          <span className="detail-chip">{gasto.instituicaoFinanceira}</span>
        </div>

        {/* Items table */}
        <div className="detail-items-title">Itens</div>
        {sortedItems.map((item) => (
          <div key={item.id} className="detail-item">
            <div className="detail-item__top">
              <span className="detail-item__num">{item.ordem}</span>
              <span className="detail-item__desc">{item.descricao}</span>
            </div>
            <div className="detail-item__bottom">
              <span className="detail-item__qty">{item.quantidade} {item.unidade}</span>
              <span className="detail-item__value">{formatCurrency(item.valorCentavos)}</span>
            </div>
          </div>
        ))}

        {/* Total */}
        <div className="total-bar" style={{ borderRadius: 8, margin: '16px 0' }}>
          <span className="total-bar__label">Gasto total</span>
          <span className="total-bar__value">{formatCurrency(gasto.total)}</span>
        </div>

        {/* Observações */}
        {gasto.observacoes && (
          <div className="detail-obs">
            <span className="detail-obs__label">Observações</span>
            <span className="detail-obs__value">{gasto.observacoes}</span>
          </div>
        )}

        {/* Actions */}
        <button
          className="btn-whatsapp"
          onClick={() => openWhatsApp(whatsAppMessage)}
          type="button"
          style={{ marginTop: 16 }}
        >
          <Share2 size={16} />
          Compartilhar no WhatsApp
        </button>

        {gasto.comprovanteUrl && (
          <button
            className="btn-new-expense"
            onClick={() => window.open(gasto.comprovanteUrl, '_blank')}
            type="button"
            style={{ marginTop: 8 }}
          >
            <Image size={16} />
            Ver comprovante
          </button>
        )}
      </div>
    </div>
  );
};
