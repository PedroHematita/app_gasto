import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { FloatingInput } from './FloatingInput';
import { FloatingSelect } from './FloatingSelect';
import { MEIOS_PAGAMENTO, INSTITUICOES, formatCurrency } from '../utils';
import { searchFornecedores } from '../lib/supabase';
import type { PaymentData } from '../types';

interface PaymentModalProps {
  payment: PaymentData;
  onChange: (data: Partial<PaymentData>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  isEditing?: boolean;
  totalCents: number;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  payment,
  onChange,
  onSave,
  onClose,
  saving,
  isEditing = false,
  totalCents,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [warningParcela, setWarningParcela] = useState<{ valorParcela: number } | null>(null);

  const handleAttemptSave = () => {
    // 1. Check max parcelas
    if (payment.formaPagamento === 'parcelado') {
      const p = payment.parcelas;
      if (p === undefined || p < 2 || p > 48) {
        alert('A quantidade de parcelas deve estar entre 2 e 48 para pagamento parcelado.');
        return;
      }
    }

    // 2. Check comprovante obrigatório
    if (totalCents > 50000 && !payment.comprovanteFile && !payment.comprovanteUrl) {
      alert('Para gastos acima de R$ 500,00, anexe o comprovante antes de salvar.');
      return;
    }

    // 3. Check low parcel value
    if (payment.formaPagamento === 'parcelado') {
      const p = payment.parcelas || 2;
      const valorParcela = totalCents / p;
      if (valorParcela < 1000) {
        setWarningParcela({ valorParcela });
        return;
      }
    }

    // All clear
    onSave();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onChange({ comprovanteFile: file });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__handle" />
        <div className="modal-sheet__title">Dados de pagamento</div>

        <FloatingInput
          id="input-fornecedor"
          label="Fornecedor / Local do serviço"
          value={payment.fornecedor}
          onChange={(v) => onChange({ fornecedor: v })}
          bgVariant="surface"
          autocompleteSearch={searchFornecedores}
        />

        <div className="payment-separator">— pagamento —</div>

        <div className="payment-tabs">
          <div className="payment-tabs__label">Forma de pagamento</div>
          <div className="payment-tabs__row">
            <button
              className={`payment-tab ${payment.formaPagamento === 'a_vista' ? 'payment-tab--active' : 'payment-tab--inactive'}`}
              onClick={() => onChange({ formaPagamento: 'a_vista', parcelas: 1 })}
              type="button"
            >
              À Vista
            </button>
            <button
              className={`payment-tab ${payment.formaPagamento === 'parcelado' ? 'payment-tab--active' : 'payment-tab--inactive'}`}
              onClick={() => onChange({ formaPagamento: 'parcelado', parcelas: payment.parcelas && payment.parcelas >= 2 ? payment.parcelas : 2 })}
              type="button"
            >
              Parcelado
            </button>
          </div>
        </div>

        {payment.formaPagamento === 'parcelado' && (
          <FloatingInput
            id="input-parcelas"
            label="Número de parcelas"
            value={payment.parcelas !== undefined ? String(payment.parcelas) : ''}
            onChange={(v) => {
              const numStr = v.replace(/\D/g, '');
              if (!numStr) {
                onChange({ parcelas: undefined });
                return;
              }
              let num = parseInt(numStr, 10);
              if (num > 48) num = 48;
              onChange({ parcelas: num });
            }}
            type="number"
            inputMode="numeric"
            bgVariant="surface"
          />
        )}

        <FloatingSelect
          id="select-meio"
          label="Meio de pagamento"
          value={payment.meioPagamento}
          onChange={(v) => onChange({ meioPagamento: v })}
          options={MEIOS_PAGAMENTO}
          bgVariant="surface"
        />

        <FloatingSelect
          id="select-instituicao"
          label="Instituição financeira"
          value={payment.instituicaoFinanceira}
          onChange={(v) => onChange({ instituicaoFinanceira: v })}
          options={INSTITUICOES}
          bgVariant="surface"
        />

        <FloatingInput
          id="input-observacoes"
          label="Observações"
          value={payment.observacoes}
          onChange={(v) => onChange({ observacoes: v })}
          bgVariant="surface"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <button
          className={`btn-attach ${payment.comprovanteFile ? 'btn-attach--has-file' : ''}`}
          onClick={handleFileSelect}
          type="button"
        >
          <Upload size={14} />
          {payment.comprovanteFile
            ? payment.comprovanteFile.name
            : 'Anexar comprovante'}
        </button>
        <div className="btn-attach__hint">
          {payment.comprovanteFile ? 'toque para substituir' : 'opcional'}
        </div>

        <button
          className="btn-save-modal"
          onClick={handleAttemptSave}
          disabled={saving}
          type="button"
        >
          {saving ? 'Salvando...' : isEditing ? 'Confirmar alterações' : 'Salvar gasto'}
        </button>
      </div>

      {/* Warning Modal for low parcel value */}
      {warningParcela && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div className="ph-title" style={{ color: '#ffcc00', marginBottom: 12 }}>Atenção</div>
            
            <div style={{ padding: '10px 20px 20px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              <p>O valor de cada parcela ficou muito baixo: {formatCurrency(warningParcela.valorParcela)}.</p>
              <p style={{ marginTop: 8 }}>Verifique se a quantidade de parcelas está correta antes de continuar.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }}>
              <button
                onClick={() => setWarningParcela(null)}
                type="button"
                style={{ width: '100%', padding: '14px', borderRadius: 8, background: '#333', color: '#fff', border: 'none', fontWeight: 500, cursor: 'pointer' }}
              >
                Corrigir parcelas
              </button>
              <button
                onClick={() => {
                  setWarningParcela(null);
                  onSave();
                }}
                type="button"
                style={{ width: '100%', padding: '14px', borderRadius: 8, background: 'transparent', color: 'var(--text-inactive)', border: '1px solid #333', fontWeight: 500, cursor: 'pointer' }}
              >
                Continuar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
