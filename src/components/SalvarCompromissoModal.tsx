import { useState, useMemo } from 'react';
import { FloatingInput } from './FloatingInput';
import { DatePickerSheet } from './DatePickerSheet';
import { searchFornecedores } from '../lib/supabase';
import {
  formatDateBR,
  parseDateBR,
  isPrevistaStrictlyAfterCompra,
  firstSelectableDayAfterCompraBR,
  FORNECEDOR_REQUIRED_MSG,
} from '../utils';

interface SalvarCompromissoModalProps {
  orgId: string;
  dataCompraBR: string;
  onClose: () => void;
  onConfirm: (fornecedor: string, dataPrevistaPagamentoBR: string) => void;
}

export const SalvarCompromissoModal: React.FC<SalvarCompromissoModalProps> = ({
  orgId,
  dataCompraBR,
  onClose,
  onConfirm,
}) => {
  const [fornecedor, setFornecedor] = useState('');
  const [fornecedorError, setFornecedorError] = useState(false);
  const [dataPrevista, setDataPrevista] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const fallbackPickerDateBR = useMemo(() => {
    const fs = firstSelectableDayAfterCompraBR(dataCompraBR);
    if (fs) return formatDateBR(fs);
    return formatDateBR(new Date());
  }, [dataCompraBR]);

  const pickerSeed = useMemo(() => {
    if (dataPrevista.length >= 10 && isPrevistaStrictlyAfterCompra(dataPrevista, dataCompraBR)) {
      return dataPrevista;
    }
    return fallbackPickerDateBR;
  }, [dataPrevista, dataCompraBR, fallbackPickerDateBR]);

  const focusFornecedorInput = () => {
    setTimeout(() => document.getElementById('input-fornecedor-compromisso')?.focus(), 10);
  };

  const focusPrevistaInput = () => {
    setTimeout(() => document.getElementById('input-prevista-compromisso')?.focus(), 10);
  };

  const handleSalvar = () => {
    if (!fornecedor.trim()) {
      setFornecedorError(true);
      alert(FORNECEDOR_REQUIRED_MSG);
      focusFornecedorInput();
      return;
    }
    setFornecedorError(false);

    const trimmed = dataPrevista.trim();
    if (!trimmed || trimmed.length < 10) {
      alert('Informe a data prevista de pagamento para continuar.');
      focusPrevistaInput();
      return;
    }
    const parsed = parseDateBR(trimmed);
    if (!parsed) {
      alert('Informe a data prevista de pagamento para continuar.');
      focusPrevistaInput();
      return;
    }
    if (!isPrevistaStrictlyAfterCompra(trimmed, dataCompraBR)) {
      alert('A data de vencimento deve ser posterior à data da compra.');
      focusPrevistaInput();
      return;
    }
    onConfirm(fornecedor.trim(), trimmed);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-sheet__handle" />
          <div className="modal-sheet__title">Salvar como compromisso</div>

          <FloatingInput
            id="input-fornecedor-compromisso"
            label="Fornecedor / Local do serviço"
            value={fornecedor}
            onChange={(v) => {
              setFornecedor(v);
              setFornecedorError(false);
            }}
            bgVariant="surface"
            autoComplete="off"
            autocompleteSearch={(q) => searchFornecedores(orgId, q)}
            showError={fornecedorError}
          />

          <div className="date-header__row" style={{ padding: '0 4px 16px' }}>
            <FloatingInput
              id="input-prevista-compromisso"
              label="Data prevista de pagamento"
              value={dataPrevista}
              onChange={(value) => {
                const digits = value.replace(/\D/g, '');
                let formatted = '';
                if (digits.length <= 2) {
                  formatted = digits;
                } else if (digits.length <= 4) {
                  formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                } else {
                  formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
                }
                setDataPrevista(formatted);
              }}
              inputMode="numeric"
              autoComplete="off"
              bgVariant="surface"
            />
            <button
              className="date-header__calendar-btn"
              onClick={() => setShowPicker(true)}
              type="button"
              aria-label="Abrir calendário"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 0 8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                border: '1px solid var(--border-medium)',
                borderRadius: 8,
                color: 'var(--text-inactive)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button className="btn-save-modal" onClick={handleSalvar} type="button">
              Salvar compromisso
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <DatePickerSheet
          key={`prevista-picker-${dataCompraBR}-${pickerSeed}`}
          selectedDate={pickerSeed}
          allowFutureDates
          disableDatesOnOrBeforeCompraBR={dataCompraBR}
          onSelect={(d) => {
            setDataPrevista(d);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
};
