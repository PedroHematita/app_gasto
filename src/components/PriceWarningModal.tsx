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
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 1000 }}>
      <div className="modal-sheet price-history-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__handle" />
        <div className="ph-title" style={{ color: '#ffcc00', marginBottom: 12 }}>Valor fora do padrão histórico</div>
        
        <div style={{ padding: '10px 20px 20px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          <p style={{ marginBottom: 16 }}>O valor informado está diferente do histórico para este item.</p>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-inactive)', fontSize: 11 }}>Média histórica:</span>
              <span style={{ color: 'var(--accent)', fontWeight: 500, fontSize: 13 }}>{formatCurrency(media)} / {unidade}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-inactive)', fontSize: 11 }}>Faixa esperada:</span>
              <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{formatCurrency(limiteInferior)} a {formatCurrency(limiteSuperior)}</span>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-inactive)', fontSize: 11 }}>Valor informado:</span>
              <span style={{ color: '#ffcc00', fontWeight: 600, fontSize: 13 }}>{formatCurrency(valorInformado)} / {unidade}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }}>
          <button
            onClick={onCancel}
            type="button"
            style={{ width: '100%', padding: '14px', borderRadius: 8, background: '#333', color: '#fff', border: 'none', fontWeight: 500, cursor: 'pointer' }}
          >
            Ajustar valor
          </button>
          <button
            onClick={onConfirm}
            type="button"
            style={{ width: '100%', padding: '14px', borderRadius: 8, background: 'transparent', color: 'var(--text-inactive)', border: '1px solid #333', fontWeight: 500, cursor: 'pointer' }}
          >
            Confirmar assim mesmo
          </button>
        </div>
      </div>
    </div>
  );
};
