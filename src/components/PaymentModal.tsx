import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { FloatingInput } from './FloatingInput';
import { FloatingSelect } from './FloatingSelect';
import { CurrencyInput } from './CurrencyInput';
import {
  MEIOS_PAGAMENTO,
  INSTITUICOES,
  formatCurrency,
  formatDiferencaValorCents,
  FORNECEDOR_REQUIRED_MSG,
} from '../utils';
import { searchFornecedores } from '../lib/supabase';
import type { PaymentData } from '../types';

interface PaymentModalProps {
  orgId: string;
  payment: PaymentData;
  onChange: (data: Partial<PaymentData>) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  isEditing?: boolean;
  totalCents: number;
  modalTitle?: string;
  /** Substitui o rótulo do botão principal quando não está em modo edição de gasto. */
  saveButtonLabel?: string;
  /** Quitação de compromisso: valor planejado (somente leitura). */
  valorPlanejadoCents?: number;
  /** Quitação: valor efetivamente pago (editável). */
  valorRealizadoCents?: number;
  onValorRealizadoChange?: (cents: number) => void;
  /** Oculta a escolha de forma de pagamento (À Vista/Parcelado) */
  hideFormaPagamento?: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  orgId,
  payment,
  onChange,
  onSave,
  onClose,
  saving,
  isEditing = false,
  totalCents,
  modalTitle = 'Dados de pagamento',
  saveButtonLabel,
  valorPlanejadoCents,
  valorRealizadoCents,
  onValorRealizadoChange,
  hideFormaPagamento = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [warningParcela, setWarningParcela] = useState<{ valorParcela: number } | null>(null);
  const [fornecedorError, setFornecedorError] = useState(false);

  const isQuitMode =
    valorPlanejadoCents !== undefined &&
    valorRealizadoCents !== undefined &&
    onValorRealizadoChange !== undefined;

  const diffCents = isQuitMode ? valorRealizadoCents - valorPlanejadoCents : 0;

  const handleAttemptSave = () => {
    if (isQuitMode && valorRealizadoCents <= 0) {
      alert('Informe o valor realizado maior que zero.');
      setTimeout(() => document.getElementById('input-valor-realizado')?.focus(), 10);
      return;
    }

    if (!payment.fornecedor.trim()) {
      setFornecedorError(true);
      alert(FORNECEDOR_REQUIRED_MSG);
      setTimeout(() => document.getElementById('input-fornecedor')?.focus(), 10);
      return;
    }
    setFornecedorError(false);

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

  const primaryLabel = saving
    ? 'Salvando...'
    : isEditing
      ? 'Confirmar alterações'
      : saveButtonLabel ?? 'Salvar gasto';

  return (
    <div className="modal-overlay modal-finance" onClick={onClose} role="presentation">
      <div
        className="modal-sheet payment-modal-sheet modal-sheet--form modal-finance__container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="payment-modal-title"
      >
        <header className="modal-form-shell__header">
          <div className="modal-sheet__handle modal-finance__handle" aria-hidden />
          <h2 id="payment-modal-title" className="modal-sheet__title">
            {modalTitle}
          </h2>
        </header>

        <div className="modal-form-shell__body">
        {isQuitMode && (
          <>
            <div className="quit-valores-block">
              <div className="quit-valores-row">
                <span className="quit-valores-row__label">Valor planejado</span>
                <span className="quit-valores-row__value quit-valores-row__value--readonly">
                  {formatCurrency(valorPlanejadoCents)}
                </span>
              </div>
              <CurrencyInput
                id="input-valor-realizado"
                label="Valor realizado"
                valueCents={valorRealizadoCents}
                onChange={onValorRealizadoChange}
                bgVariant="surface"
              />
              <div className="quit-valores-diff">
                {diffCents === 0 ? (
                  <span className="quit-valores-diff__text quit-valores-diff__text--equal">
                    Sem diferença em relação ao valor planejado.
                  </span>
                ) : (
                  <span
                    className={`quit-valores-diff__text ${
                      diffCents < 0 ? 'quit-valores-diff__text--neg' : 'quit-valores-diff__text--pos'
                    }`}
                  >
                    Diferença: {formatDiferencaValorCents(diffCents)}
                  </span>
                )}
              </div>
            </div>
            <div className="payment-separator">— pagamento —</div>
          </>
        )}

        <FloatingInput
          id="input-fornecedor"
          label="Fornecedor / Local do serviço"
          value={payment.fornecedor}
          onChange={(v) => {
            onChange({ fornecedor: v });
            setFornecedorError(false);
          }}
          bgVariant="surface"
          autoComplete="off"
          autocompleteSearch={(q) => searchFornecedores(orgId, q)}
          showError={fornecedorError}
        />

        {!isQuitMode && <div className="payment-separator">— pagamento —</div>}

        {!hideFormaPagamento && (
          <>
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
                autoComplete="off"
                bgVariant="surface"
              />
            )}
          </>
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
          autoComplete="off"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          autoComplete="off"
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
        </div>

        <footer className="modal-form-shell__footer">
          <button
            type="button"
            className="button-finance button-finance--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className="btn-save-modal button-finance button-finance--primary"
            onClick={handleAttemptSave}
            disabled={saving}
            type="button"
          >
            {primaryLabel}
          </button>
        </footer>
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

            <div className="payment-warning-actions">
              <button
                onClick={() => setWarningParcela(null)}
                type="button"
                className="payment-warning-actions__fix button-finance button-finance--primary"
              >
                Corrigir parcelas
              </button>
              <button
                onClick={() => {
                  setWarningParcela(null);
                  onSave();
                }}
                type="button"
                className="payment-warning-actions__continue button-finance button-finance--ghost"
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
