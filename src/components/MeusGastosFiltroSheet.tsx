import { useState } from 'react';
import { X } from 'lucide-react';
import {
  MEUS_GASTOS_FILTRO_VAZIO,
  TIPOS_MOVIMENTACAO_FILTRO,
  rotuloInstituicaoFiltro,
  type MeusGastosFiltroConferencia,
  type TipoMovimentacaoFiltro,
} from '../lib/meusGastosFiltroConferencia';

interface MeusGastosFiltroSheetProps {
  instituicoesDisponiveis: string[];
  filtroAplicado: MeusGastosFiltroConferencia;
  onClose: () => void;
  onApply: (filtro: MeusGastosFiltroConferencia) => void;
}

function toggleInList(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function MeusGastosFiltroSheet({
  instituicoesDisponiveis,
  filtroAplicado,
  onClose,
  onApply,
}: MeusGastosFiltroSheetProps) {
  const [draft, setDraft] = useState<MeusGastosFiltroConferencia>(() => ({
    instituicoes: [...filtroAplicado.instituicoes],
    tipo: filtroAplicado.tipo,
  }));

  return (
    <div className="modal-overlay modal-finance" onClick={onClose} role="presentation">
      <div
        className="modal-sheet classificar-filtro-sheet bottom-sheet-finance modal-finance__container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="meus-gastos-filtro-title"
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
          <h2 id="meus-gastos-filtro-title" className="classificar-filtro-sheet__title">
            Filtros
          </h2>
        </div>

        <div className="classificar-filtro-sheet__body modal-finance__body">
          <section className="classificar-filtro-pagamento-group">
            <h3 className="classificar-filtro-pagamento-group__title">Instituição financeira</h3>
            {instituicoesDisponiveis.length === 0 ? (
              <p className="classificar-filtro-pagamento-group__empty">
                Nenhuma instituição nos gastos carregados.
              </p>
            ) : (
              <ul className="classificar-filtro-fornecedor-list" role="listbox" aria-multiselectable>
                {instituicoesDisponiveis.map((chave) => {
                  const selected = draft.instituicoes.includes(chave);
                  return (
                    <li key={chave}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`classificar-filtro-fornecedor-list__item ${selected ? 'classificar-filtro-fornecedor-list__item--selected' : ''}`}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            instituicoes: toggleInList(prev.instituicoes, chave),
                          }))
                        }
                      >
                        <span
                          className={`classificar-filtro-fornecedor-list__check ${selected ? 'classificar-filtro-fornecedor-list__check--on' : ''}`}
                          aria-hidden
                        />
                        <span className="classificar-filtro-fornecedor-list__label">
                          {rotuloInstituicaoFiltro(chave)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="classificar-filtro-pagamento-group">
            <h3 className="classificar-filtro-pagamento-group__title">Tipo de movimentação</h3>
            <ul className="classificar-filtro-data-options" role="listbox" aria-label="Tipo de movimentação">
              {TIPOS_MOVIMENTACAO_FILTRO.map(({ id, rotulo }) => (
                <li key={id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={draft.tipo === id}
                    className={`classificar-filtro-data-options__item ${draft.tipo === id ? 'classificar-filtro-data-options__item--selected' : ''}`}
                    onClick={() => setDraft((prev) => ({ ...prev, tipo: id as TipoMovimentacaoFiltro }))}
                  >
                    {rotulo}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="classificar-filtro-sheet__footer modal-finance__footer modal-finance__actions">
          <button
            type="button"
            className="classificar-filtro-sheet__btn classificar-filtro-sheet__btn--secondary button-finance button-finance--ghost"
            onClick={() => onApply(MEUS_GASTOS_FILTRO_VAZIO)}
          >
            Limpar
          </button>
          <button
            type="button"
            className="classificar-filtro-sheet__btn classificar-filtro-sheet__btn--primary button-finance button-finance--primary"
            onClick={() => onApply(draft)}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
