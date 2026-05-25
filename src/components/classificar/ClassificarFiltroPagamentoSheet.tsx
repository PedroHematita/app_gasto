import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  CLASSIFICAR_FILTRO_PAGAMENTO_VAZIO,
  FORMAS_FILTRO_CLASSIFICAR,
} from '../../utils';
import type { ClassificarFiltroFormaChave, ClassificarFiltroPagamento } from '../../types';

interface ClassificarFiltroPagamentoSheetProps {
  meiosDisponiveis: { rotulo: string; canonico: string }[];
  instituicoesDisponiveis: string[];
  filtroAplicado: ClassificarFiltroPagamento;
  onClose: () => void;
  onApply: (filtro: ClassificarFiltroPagamento) => void;
}

function toggleInList<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function FiltroCheckboxList({
  items,
  selected,
  onToggle,
  getKey,
  getLabel,
}: {
  items: { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string) => void;
  getKey: (item: { key: string; label: string }) => string;
  getLabel: (item: { key: string; label: string }) => string;
}) {
  if (items.length === 0) {
    return <p className="classificar-filtro-pagamento-group__empty">Nenhuma opção nos gastos carregados.</p>;
  }
  return (
    <ul className="classificar-filtro-fornecedor-list" role="listbox" aria-multiselectable>
      {items.map((item) => {
        const key = getKey(item);
        const isSelected = selected.includes(key);
        return (
          <li key={key}>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`classificar-filtro-fornecedor-list__item ${isSelected ? 'classificar-filtro-fornecedor-list__item--selected' : ''}`}
              onClick={() => onToggle(key)}
            >
              <span
                className={`classificar-filtro-fornecedor-list__check ${isSelected ? 'classificar-filtro-fornecedor-list__check--on' : ''}`}
                aria-hidden
              />
              <span className="classificar-filtro-fornecedor-list__label">{getLabel(item)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const ClassificarFiltroPagamentoSheet: React.FC<ClassificarFiltroPagamentoSheetProps> = ({
  meiosDisponiveis,
  instituicoesDisponiveis,
  filtroAplicado,
  onClose,
  onApply,
}) => {
  const [draft, setDraft] = useState<ClassificarFiltroPagamento>(() => ({
    formas: [...filtroAplicado.formas],
    meios: [...filtroAplicado.meios],
    instituicoes: [...filtroAplicado.instituicoes],
  }));

  const toggleForma = (chave: ClassificarFiltroFormaChave) => {
    setDraft((prev) => ({
      ...prev,
      formas: toggleInList(prev.formas, chave),
    }));
  };

  const toggleMeio = (canonico: string) => {
    setDraft((prev) => ({
      ...prev,
      meios: toggleInList(prev.meios, canonico),
    }));
  };

  const toggleInstituicao = (inst: string) => {
    setDraft((prev) => ({
      ...prev,
      instituicoes: toggleInList(prev.instituicoes, inst),
    }));
  };

  const handleLimpar = () => {
    onApply(CLASSIFICAR_FILTRO_PAGAMENTO_VAZIO);
  };

  const handleAplicar = () => {
    onApply(draft);
  };

  const formaItems = FORMAS_FILTRO_CLASSIFICAR.map((f) => ({
    key: f.chave,
    label: f.rotulo,
  }));

  const meioItems = meiosDisponiveis.map((m) => ({
    key: m.canonico,
    label: m.rotulo,
  }));

  const instItems = instituicoesDisponiveis.map((inst) => ({
    key: inst,
    label: inst,
  }));

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-sheet classificar-filtro-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="classificar-filtro-pagamento-title"
      >
        <div className="modal-sheet__handle" />
        <div className="classificar-filtro-sheet__header">
          <button
            type="button"
            className="classificar-filtro-sheet__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
          <h2 id="classificar-filtro-pagamento-title" className="classificar-filtro-sheet__title">
            Filtrar pagamento
          </h2>
        </div>

        <div className="classificar-filtro-sheet__body">
          <section className="classificar-filtro-pagamento-group">
            <h3 className="classificar-filtro-pagamento-group__title">Forma de pagamento</h3>
            <FiltroCheckboxList
              items={formaItems}
              selected={draft.formas}
              onToggle={(key) => toggleForma(key as ClassificarFiltroFormaChave)}
              getKey={(i) => i.key}
              getLabel={(i) => i.label}
            />
          </section>

          <section className="classificar-filtro-pagamento-group">
            <h3 className="classificar-filtro-pagamento-group__title">Meio de pagamento</h3>
            <FiltroCheckboxList
              items={meioItems}
              selected={draft.meios}
              onToggle={toggleMeio}
              getKey={(i) => i.key}
              getLabel={(i) => i.label}
            />
          </section>

          <section className="classificar-filtro-pagamento-group">
            <h3 className="classificar-filtro-pagamento-group__title">Instituição financeira</h3>
            <FiltroCheckboxList
              items={instItems}
              selected={draft.instituicoes}
              onToggle={toggleInstituicao}
              getKey={(i) => i.key}
              getLabel={(i) => i.label}
            />
          </section>
        </div>

        <div className="classificar-filtro-sheet__footer">
          <button
            type="button"
            className="classificar-filtro-sheet__btn classificar-filtro-sheet__btn--secondary"
            onClick={handleLimpar}
          >
            Limpar
          </button>
          <button
            type="button"
            className="classificar-filtro-sheet__btn classificar-filtro-sheet__btn--primary"
            onClick={handleAplicar}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
