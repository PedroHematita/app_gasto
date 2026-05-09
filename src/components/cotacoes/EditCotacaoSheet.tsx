import { useState, useCallback } from 'react';
import { FloatingInput } from '../FloatingInput';
import { FloatingSelect } from '../FloatingSelect';
import { UNIDADES } from '../../utils';
import { searchDescricoesCotacao, updateCotacao } from '../../lib/cotacoesDb';
import type { CotacaoRecord } from '../../types';

interface EditCotacaoSheetProps {
  orgId: string;
  cotacao: CotacaoRecord;
  onClose: () => void;
  onSaved: () => void;
}

export function EditCotacaoSheet({ orgId, cotacao, onClose, onSaved }: EditCotacaoSheetProps) {
  const [descricao, setDescricao] = useState(cotacao.descricao);
  const [quantidade, setQuantidade] = useState(String(cotacao.quantidade));
  const [unidade, setUnidade] = useState(cotacao.unidadeMedida);
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
    const qtyStr = quantidade.replace(',', '.');
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0) {
      alert('Informe uma quantidade válida maior que zero.');
      return;
    }
    setSaving(true);
    try {
      const res = await updateCotacao(cotacao.id, orgId, d, qty, unidade);
      if ('error' in res) {
        alert(res.error);
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet price-history-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__handle" />
        <div className="ph-title">Editar cotação</div>
        <div style={{ padding: '8px 20px 20px' }}>
          <FloatingInput
            id="cotacao-edit-desc"
            label="Descrição do produto"
            value={descricao}
            onChange={setDescricao}
            bgVariant="surface"
            autocompleteSearch={searchAuto}
          />
          <div className="form-row">
            <FloatingInput
              id="cotacao-edit-qty"
              label="Quantidade"
              value={quantidade}
              onChange={setQuantidade}
              type="text"
              inputMode="decimal"
              bgVariant="surface"
            />
            <FloatingSelect
              id="cotacao-edit-un"
              label="Unidade de medida"
              value={unidade}
              onChange={setUnidade}
              options={UNIDADES}
              bgVariant="surface"
            />
          </div>
          <button
            type="button"
            className="btn-save-main"
            style={{ marginTop: 8 }}
            disabled={saving}
            onClick={() => void handleSalvar()}
          >
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
