import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  CLASSIFICAR_FILTRO_DATA_VAZIO,
  rotuloFiltroDataClassificacao,
} from '../../utils';
import type { ClassificarFiltroData, ClassificarFiltroDataPreset } from '../../types';

const PRESETS: { id: ClassificarFiltroDataPreset; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'esta_semana', label: 'Esta semana' },
  { id: 'este_mes', label: 'Este mês' },
  { id: 'mes_anterior', label: 'Mês anterior' },
  { id: 'ultimos_7', label: 'Últimos 7 dias' },
  { id: 'ultimos_30', label: 'Últimos 30 dias' },
];

interface ClassificarFiltroDataSheetProps {
  filtroAplicado: ClassificarFiltroData;
  onClose: () => void;
  onApply: (filtro: ClassificarFiltroData) => void;
}

export const ClassificarFiltroDataSheet: React.FC<ClassificarFiltroDataSheetProps> = ({
  filtroAplicado,
  onClose,
  onApply,
}) => {
  const [draft, setDraft] = useState<ClassificarFiltroData>(() => ({
    ...filtroAplicado,
  }));

  const selectPreset = (preset: ClassificarFiltroDataPreset) => {
    setDraft({
      preset,
      dataInicial: null,
      dataFinal: null,
    });
  };

  const handleLimpar = () => {
    onApply(CLASSIFICAR_FILTRO_DATA_VAZIO);
  };

  const handleAplicar = () => {
    onApply(draft);
  };

  const preview = rotuloFiltroDataClassificacao(draft);

  return (
    <div className="modal-overlay modal-finance" onClick={onClose} role="presentation">
      <div
        className="modal-sheet classificar-filtro-sheet bottom-sheet-finance modal-finance__container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="classificar-filtro-data-title"
      >
        <div className="modal-sheet__handle modal-finance__handle" />
        <div className="classificar-filtro-sheet__header">
          <button
            type="button"
            className="classificar-filtro-sheet__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
          <h2 id="classificar-filtro-data-title" className="classificar-filtro-sheet__title">
            Filtrar por data
          </h2>
        </div>

        <div className="classificar-filtro-sheet__body modal-finance__body">
          <ul className="classificar-filtro-data-options" role="listbox" aria-label="Período">
            {PRESETS.map(({ id, label }) => (
              <li key={id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={draft.preset === id}
                  className={`classificar-filtro-data-options__item ${draft.preset === id ? 'classificar-filtro-data-options__item--selected' : ''}`}
                  onClick={() => selectPreset(id)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
          {preview && (
            <p className="classificar-filtro-sheet__preview">
              Período: <strong>{preview}</strong>
            </p>
          )}
        </div>

        <div className="classificar-filtro-sheet__footer modal-finance__footer modal-finance__actions">
          <button
            type="button"
            className="classificar-filtro-sheet__btn classificar-filtro-sheet__btn--secondary button-finance button-finance--ghost"
            onClick={handleLimpar}
          >
            Limpar
          </button>
          <button
            type="button"
            className="classificar-filtro-sheet__btn classificar-filtro-sheet__btn--primary button-finance button-finance--primary"
            onClick={handleAplicar}
            disabled={!draft.preset}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
