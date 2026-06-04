import { useState, useCallback, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { FloatingInput } from '../FloatingInput';
import { CurrencyInput } from '../CurrencyInput';
import { DatePickerSheet } from '../DatePickerSheet';
import {
  insertCotacaoPreco,
  existePrecoMesmoFornecedorEData,
  fetchFornecedoresDaCotacao,
  MSG_DUPLICATA_PRECO,
} from '../../lib/cotacoesDb';
import { formatDateBR, parseDateBR } from '../../utils';

interface AddPrecoSheetProps {
  cotacaoId: string;
  unidade: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AddPrecoSheet({ cotacaoId, unidade, onClose, onSaved }: AddPrecoSheetProps) {
  const [fornecedor, setFornecedor] = useState('');
  const [valorCentavos, setValorCentavos] = useState(0);
  const [dataBR, setDataBR] = useState(formatDateBR(new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDupModal, setShowDupModal] = useState(false);

  const [listaFornecedores, setListaFornecedores] = useState<string[]>([]);

  useEffect(() => {
    void fetchFornecedoresDaCotacao(cotacaoId).then(setListaFornecedores);
  }, [cotacaoId]);

  const fornecedorSuggestions = useCallback(
    async (q: string) => {
      const n = q.trim().toLowerCase();
      const base = listaFornecedores.length ? listaFornecedores : await fetchFornecedoresDaCotacao(cotacaoId);
      if (!n) return base.slice(0, 8).map((s) => ({ label: s }));
      return base.filter((s) => s.toLowerCase().includes(n)).slice(0, 8).map((s) => ({ label: s }));
    },
    [cotacaoId, listaFornecedores]
  );

  const dataNaoFutura = useCallback((br: string) => {
    const parsed = parseDateBR(br);
    if (!parsed) return false;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return parsed.getTime() <= today.getTime();
  }, []);

  const handleDataChange = useCallback(
    (value: string) => {
      const digits = value.replace(/\D/g, '');
      let formatted = '';
      if (digits.length <= 2) {
        formatted = digits;
      } else if (digits.length <= 4) {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
      } else {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
      }
      if (digits.length === 8) {
        const day = parseInt(digits.slice(0, 2), 10);
        const month = parseInt(digits.slice(2, 4), 10);
        const year = parseInt(digits.slice(4, 8), 10);
        const typed = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (typed > today) return;
      }
      setDataBR(formatted);
    },
    []
  );

  const trySubmit = async (forceDuplicate: boolean) => {
    const f = fornecedor.trim();
    if (!f) {
      alert('Informe o fornecedor antes de salvar.');
      return;
    }
    if (!valorCentavos || valorCentavos <= 0) {
      alert('Informe um valor válido antes de salvar.');
      return;
    }
    if (!dataBR || dataBR.length < 10 || !parseDateBR(dataBR)) {
      alert('Informe a data completa (dd/mm/aaaa).');
      return;
    }
    if (!dataNaoFutura(dataBR)) {
      alert('A data não pode ser futura.');
      return;
    }

    if (!forceDuplicate) {
      const dup = await existePrecoMesmoFornecedorEData(cotacaoId, f, dataBR);
      if (dup) {
        setShowDupModal(true);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await insertCotacaoPreco(cotacaoId, f, valorCentavos, dataBR);
      if ('error' in res) {
        alert(res.error);
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
      setShowDupModal(false);
    }
  };

  return (
    <>
      <div className="modal-overlay modal-finance" onClick={onClose} role="presentation">
        <div
          className="modal-sheet payment-modal-sheet modal-sheet--form modal-finance__container price-history-sheet"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="cotacao-preco-title"
        >
          <header className="modal-form-shell__header">
            <div className="modal-sheet__handle modal-finance__handle" aria-hidden />
            <h2 id="cotacao-preco-title" className="ph-title">
              Novo preço
            </h2>
          </header>

          <div className="modal-form-shell__body">
            <FloatingInput
              id="cotacao-preco-forn"
              label="Fornecedor"
              value={fornecedor}
              onChange={setFornecedor}
              bgVariant="surface"
              autocompleteSearch={fornecedorSuggestions}
            />
            <CurrencyInput
              id="cotacao-preco-valor"
              label={`Valor por ${unidade}`}
              valueCents={valorCentavos}
              onChange={setValorCentavos}
              bgVariant="surface"
            />
            <div className="date-header__row" style={{ marginBottom: 0 }}>
              <FloatingInput
                id="cotacao-preco-data"
                label="Data do registro"
                value={dataBR}
                onChange={handleDataChange}
                inputMode="numeric"
                bgVariant="surface"
              />
              <button
                type="button"
                className="date-header__calendar-btn"
                onClick={() => setShowPicker(true)}
                aria-label="Abrir calendário"
              >
                <Calendar size={18} />
              </button>
            </div>
          </div>

          <footer className="modal-form-shell__footer modal-form-shell__footer--row">
            <button
              type="button"
              className="button-finance button-finance--ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-save-modal button-finance button-finance--primary"
              disabled={saving}
              onClick={() => void trySubmit(false)}
            >
              {saving ? 'Salvando…' : 'Salvar preço'}
            </button>
          </footer>
        </div>
      </div>

      {showPicker && (
        <DatePickerSheet
          selectedDate={dataBR}
          onSelect={(d) => {
            setDataBR(d);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showDupModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => setShowDupModal(false)}>
          <div className="modal-sheet price-history-sheet" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-sheet__handle" />
            <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>
              {MSG_DUPLICATA_PRECO}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }}>
              <button
                type="button"
                className="btn-save-main"
                onClick={() => void trySubmit(true)}
              >
                Adicionar mesmo assim
              </button>
              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 8,
                  background: 'transparent',
                  color: 'var(--text-inactive)',
                  border: '1px solid #333',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
                onClick={() => setShowDupModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
