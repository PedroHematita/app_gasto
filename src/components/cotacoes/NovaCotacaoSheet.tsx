import { useState, useCallback } from 'react';
import { UNIDADES } from '../../utils';
import { FloatingInput } from '../FloatingInput';
import { FloatingSelect } from '../FloatingSelect';
import { searchDescricoesCotacao, createCotacao } from '../../lib/cotacoesDb';

interface NovaCotacaoSheetProps {
  orgId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export function NovaCotacaoSheet({ orgId, onClose, onSaved }: NovaCotacaoSheetProps) {
  const [descricao, setDescricao] = useState('');
  const [unidade, setUnidade] = useState('Unidade');
  const [saving, setSaving] = useState(false);

  const searchAuto = useCallback(
    (q: string) => searchDescricoesCotacao(orgId, q),
    [orgId]
  );

  const handleSalvar = async () => {
    const d = descricao.trim();
    if (d.length < 3) {
      alert('Use ao menos 3 caracteres na descrição do produto.');
      return;
    }
    setSaving(true);
    try {
      const res = await createCotacao(orgId, d, 1, unidade);
      if ('error' in res) {
        alert(res.error);
        return;
      }
      onSaved(res.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay modal-finance" onClick={onClose} role="presentation">
      <div
        className="modal-sheet payment-modal-sheet modal-sheet--form modal-finance__container price-history-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="cotacao-nova-title"
      >
        <header className="modal-form-shell__header">
          <div className="modal-sheet__handle modal-finance__handle" aria-hidden />
          <h2 id="cotacao-nova-title" className="ph-title">
            Nova cotação
          </h2>
        </header>

        <div className="modal-form-shell__body">
          <FloatingInput
            id="cotacao-nova-desc"
            label="Descrição do produto"
            value={descricao}
            onChange={setDescricao}
            bgVariant="surface"
            autocompleteSearch={searchAuto}
          />
          <div className="form-row">
            <FloatingSelect
              id="cotacao-nova-un"
              label="Unidade de medida"
              value={unidade}
              onChange={setUnidade}
              options={UNIDADES}
              bgVariant="surface"
            />
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
            onClick={() => void handleSalvar()}
          >
            {saving ? 'Salvando…' : 'Salvar cotação'}
          </button>
        </footer>
      </div>
    </div>
  );
}
