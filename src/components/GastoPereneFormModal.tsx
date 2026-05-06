import { useMemo, useState } from 'react';
import { FloatingInput } from './FloatingInput';
import { FloatingSelect } from './FloatingSelect';
import { CurrencyInput } from './CurrencyInput';
import { DatePickerSheet } from './DatePickerSheet';
import { searchFornecedores, createGastoPerene } from '../lib/supabase';
import { formatDateBR, parseDateBR, FORNECEDOR_REQUIRED_MSG } from '../utils';
import type { PeriodicidadePerene } from '../types';

interface GastoPereneFormModalProps {
  onClose: () => void;
  onSaved: () => void;
}

const PERIOD_LABELS: Record<PeriodicidadePerene, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

const PERIOD_ORDER: PeriodicidadePerene[] = ['mensal', 'trimestral', 'semestral', 'anual'];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const GastoPereneFormModal: React.FC<GastoPereneFormModalProps> = ({ onClose, onSaved }) => {
  const [fornecedor, setFornecedor] = useState('');
  const [fornecedorError, setFornecedorError] = useState(false);
  const [valorCents, setValorCents] = useState(0);
  const [periodicidade, setPeriodicidade] = useState<PeriodicidadePerene>('mensal');
  const [diaStr, setDiaStr] = useState('');
  const [mesNome, setMesNome] = useState('Janeiro');
  const [dataInicio, setDataInicio] = useState(formatDateBR(new Date()));
  const [dataTermino, setDataTermino] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [pickerInicio, setPickerInicio] = useState(false);
  const [pickerTermino, setPickerTermino] = useState(false);
  const [saving, setSaving] = useState(false);

  const periodDisplay = useMemo(
    () => PERIOD_ORDER.map((p) => PERIOD_LABELS[p]),
    []
  );

  const periodicidadeDisplayValue = PERIOD_LABELS[periodicidade];

  const mesNumero = useMemo(() => MESES.indexOf(mesNome) + 1, [mesNome]);

  const handlePeriodicidadeSelect = (label: string) => {
    const entry = (Object.entries(PERIOD_LABELS) as [PeriodicidadePerene, string][]).find(([, v]) => v === label);
    if (entry) setPeriodicidade(entry[0]);
  };

  const validateAndSave = async () => {
    if (!fornecedor.trim()) {
      setFornecedorError(true);
      alert(FORNECEDOR_REQUIRED_MSG);
      return;
    }
    setFornecedorError(false);

    if (valorCents <= 0) {
      alert('Informe um valor previsto maior que zero.');
      return;
    }

    const dia = parseInt(diaStr.replace(/\D/g, ''), 10);
    if (!dia || dia < 1 || dia > 31) {
      alert('Informe o dia de vencimento entre 1 e 31.');
      return;
    }

    const ini = parseDateBR(dataInicio.trim());
    if (!ini) {
      alert('Informe a data de início.');
      return;
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (ini > today) {
      alert('A data de início não pode ser futura.');
      return;
    }

    let dataTerminoBR: string | null = null;
    if (dataTermino.trim().length >= 10) {
      const t = parseDateBR(dataTermino.trim());
      if (!t) {
        alert('Data de término inválida.');
        return;
      }
      dataTerminoBR = dataTermino.trim();
    }

    const mesVencimento = periodicidade === 'anual' ? mesNumero : null;
    if (periodicidade === 'anual' && (!mesVencimento || mesVencimento < 1)) {
      alert('Selecione o mês de vencimento.');
      return;
    }

    setSaving(true);
    try {
      await createGastoPerene({
        fornecedor: fornecedor.trim(),
        valorPrevistoCents: valorCents,
        periodicidade,
        diaVencimento: dia,
        mesVencimento,
        dataInicioBR: dataInicio.trim(),
        dataTerminoBR,
        observacoes: observacoes.trim(),
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Não foi possível salvar o gasto perene. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="modal-sheet__handle" />
          <div className="modal-sheet__title">Novo gasto perene</div>

          <FloatingInput
            id="input-gp-fornecedor"
            label="Fornecedor / Descrição"
            value={fornecedor}
            onChange={(v) => {
              setFornecedor(v);
              setFornecedorError(false);
            }}
            bgVariant="surface"
            autoComplete="off"
            autocompleteSearch={searchFornecedores}
            showError={fornecedorError}
          />

          <CurrencyInput
            id="input-gp-valor"
            label="Valor previsto"
            valueCents={valorCents}
            onChange={setValorCents}
            bgVariant="surface"
          />

          <FloatingSelect
            id="select-gp-periodicidade"
            label="Periodicidade"
            value={periodicidadeDisplayValue}
            onChange={handlePeriodicidadeSelect}
            options={periodDisplay}
            bgVariant="surface"
          />

          {periodicidade === 'anual' && (
            <FloatingSelect
              label="Mês de vencimento"
              value={mesNome}
              onChange={setMesNome}
              options={MESES}
              bgVariant="surface"
            />
          )}

          <FloatingInput
            id="input-gp-dia"
            label={periodicidade === 'anual' ? 'Dia de vencimento (no mês acima)' : 'Dia de vencimento'}
            value={diaStr}
            onChange={(v) => setDiaStr(v.replace(/\D/g, '').slice(0, 2))}
            inputMode="numeric"
            autoComplete="off"
            bgVariant="surface"
          />

          <div className="date-header__row" style={{ padding: '0 4px 0' }}>
            <FloatingInput
              id="input-gp-inicio"
              label="Data de início"
              value={dataInicio}
              onChange={(value) => {
                const digits = value.replace(/\D/g, '');
                let formatted = '';
                if (digits.length <= 2) formatted = digits;
                else if (digits.length <= 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                else formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
                if (digits.length === 8) {
                  const day = parseInt(digits.slice(0, 2), 10);
                  const month = parseInt(digits.slice(2, 4), 10);
                  const year = parseInt(digits.slice(4, 8), 10);
                  const typed = new Date(year, month - 1, day);
                  const today = new Date();
                  today.setHours(23, 59, 59, 999);
                  if (typed > today) return;
                }
                setDataInicio(formatted);
              }}
              inputMode="numeric"
              autoComplete="off"
              bgVariant="surface"
            />
            <button
              className="date-header__calendar-btn"
              onClick={() => setPickerInicio(true)}
              type="button"
              aria-label="Calendário data de início"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </div>

          <div className="date-header__row" style={{ padding: '0 4px 12px' }}>
            <FloatingInput
              id="input-gp-termino"
              label="Data de término (opcional)"
              value={dataTermino}
              onChange={(value) => {
                const digits = value.replace(/\D/g, '');
                let formatted = '';
                if (digits.length <= 2) formatted = digits;
                else if (digits.length <= 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                else formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
                setDataTermino(formatted);
              }}
              inputMode="numeric"
              autoComplete="off"
              bgVariant="surface"
            />
            <button
              className="date-header__calendar-btn"
              onClick={() => setPickerTermino(true)}
              type="button"
              aria-label="Calendário data de término"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </button>
          </div>

          <div className="floating-field" style={{ marginBottom: 16 }}>
            <textarea
              id="input-gp-obs"
              className="floating-field__input"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              autoComplete="off"
              style={{ resize: 'vertical', minHeight: 72 }}
            />
            <label className="floating-field__label" htmlFor="input-gp-obs" style={{
              top: 0, transform: 'translateY(-50%)', fontSize: 10,
              color: 'var(--accent)', background: 'var(--bg-surface)', padding: '0 5px',
            }}
            >
              Observações
            </label>
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
            <button
              className="btn-save-modal"
              onClick={validateAndSave}
              type="button"
              disabled={saving}
            >
              {saving ? 'Salvando…' : 'Salvar gasto perene'}
            </button>
          </div>
        </div>
      </div>

      {pickerInicio && (
        <DatePickerSheet
          selectedDate={dataInicio}
          onSelect={(d) => {
            setDataInicio(d);
            setPickerInicio(false);
          }}
          onClose={() => setPickerInicio(false)}
        />
      )}

      {pickerTermino && (
        <DatePickerSheet
          selectedDate={dataTermino.length >= 10 ? dataTermino : formatDateBR(new Date())}
          allowFutureDates
          onSelect={(d) => {
            setDataTermino(d);
            setPickerTermino(false);
          }}
          onClose={() => setPickerTermino(false)}
        />
      )}
    </>
  );
};
