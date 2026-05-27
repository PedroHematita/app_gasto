import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { buscarFornecedoresClassificacao } from '../../utils';

interface ClassificarFiltroFornecedorSheetProps {
  fornecedoresDisponiveis: string[];
  filtroAplicado: string[];
  onClose: () => void;
  onApply: (fornecedores: string[]) => void;
}

export const ClassificarFiltroFornecedorSheet: React.FC<ClassificarFiltroFornecedorSheetProps> = ({
  fornecedoresDisponiveis,
  filtroAplicado,
  onClose,
  onApply,
}) => {
  const [busca, setBusca] = useState('');
  const [draft, setDraft] = useState<string[]>(() => [...filtroAplicado]);

  const listaFiltrada = useMemo(
    () => buscarFornecedoresClassificacao(fornecedoresDisponiveis, busca),
    [fornecedoresDisponiveis, busca]
  );

  const toggleFornecedor = (chave: string) => {
    setDraft((prev) =>
      prev.includes(chave) ? prev.filter((f) => f !== chave) : [...prev, chave]
    );
  };

  const handleLimpar = () => {
    onApply([]);
  };

  const handleAplicar = () => {
    onApply(draft);
  };

  return (
    <div className="modal-overlay modal-finance" onClick={onClose} role="presentation">
      <div
        className="modal-sheet classificar-filtro-sheet bottom-sheet-finance modal-finance__container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="classificar-filtro-fornecedor-title"
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
          <h2
            id="classificar-filtro-fornecedor-title"
            className="classificar-filtro-sheet__title"
          >
            Filtrar por fornecedor
          </h2>
        </div>

        <div className="classificar-filtro-sheet__body modal-finance__body">
          <input
            type="search"
            className="classificar-filtro-fornecedor-search input-finance__field"
            placeholder="Buscar fornecedor"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar fornecedor"
            autoComplete="off"
          />

          {fornecedoresDisponiveis.length === 0 ? (
            <p className="classificar-filtro-sheet__preview">Nenhum fornecedor nos gastos carregados.</p>
          ) : listaFiltrada.length === 0 ? (
            <p className="classificar-filtro-sheet__preview">Nenhum fornecedor encontrado na busca.</p>
          ) : (
            <ul
              className="classificar-filtro-fornecedor-list"
              role="listbox"
              aria-label="Fornecedores"
              aria-multiselectable
            >
              {listaFiltrada.map((chave) => {
                const selected = draft.includes(chave);
                return (
                  <li key={chave}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`classificar-filtro-fornecedor-list__item ${selected ? 'classificar-filtro-fornecedor-list__item--selected' : ''}`}
                      onClick={() => toggleFornecedor(chave)}
                    >
                      <span
                        className={`classificar-filtro-fornecedor-list__check ${selected ? 'classificar-filtro-fornecedor-list__check--on' : ''}`}
                        aria-hidden
                      />
                      <span className="classificar-filtro-fornecedor-list__label">{chave}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
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
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
