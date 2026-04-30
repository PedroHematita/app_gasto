import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { FloatingInput } from './FloatingInput';
import { FloatingSelect } from './FloatingSelect';
import { MEIOS_PAGAMENTO, INSTITUICOES } from '../utils';
import { searchFornecedores } from '../lib/supabase';
import type { PaymentData } from '../types';

interface PaymentModalProps {
  payment: PaymentData;
  onChange: (data: Partial<PaymentData>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  isEditing?: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  payment,
  onChange,
  onSave,
  onClose,
  saving,
  isEditing = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
              onClick={() => onChange({ formaPagamento: 'a_vista' })}
              type="button"
            >
              À Vista
            </button>
            <button
              className={`payment-tab ${payment.formaPagamento === 'parcelado' ? 'payment-tab--active' : 'payment-tab--inactive'}`}
              onClick={() => onChange({ formaPagamento: 'parcelado' })}
              type="button"
            >
              Parcelado
            </button>
          </div>
        </div>

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
          onClick={onSave}
          disabled={saving}
          type="button"
        >
          {saving ? 'Salvando...' : isEditing ? 'Confirmar alterações' : 'Salvar gasto'}
        </button>
      </div>
    </div>
  );
};
