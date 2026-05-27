import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  CLASSIFICACAO_GASTO_OPCOES,
  formatCurrency,
  montarPayloadClassificacaoSimples,
  validarClassificacaoMassa,
} from '../../utils';
import type { ClassificacaoGastoOpcao } from '../../utils';

interface ClassificarSelecionadosSheetProps {
  selectedCount: number;
  totalCents: number;
  saving: boolean;
  onClose: () => void;
  onApply: (classificacao: ClassificacaoGastoOpcao) => void;
}

export const ClassificarSelecionadosSheet: React.FC<ClassificarSelecionadosSheetProps> = ({
  selectedCount,
  totalCents,
  saving,
  onClose,
  onApply,
}) => {
  const [classificacao, setClassificacao] = useState<ClassificacaoGastoOpcao | ''>('');
  const [erro, setErro] = useState<string | null>(null);

  const podeAplicar = useMemo(() => {
    if (selectedCount === 0 || saving) return false;
    return validarClassificacaoMassa({
      ids: ['ok'],
      classificacao,
      responsavelClassificacao: 'local',
    }).ok;
  }, [selectedCount, saving, classificacao]);

  const handleAplicar = () => {
    const v = validarClassificacaoMassa({
      ids: ['ok'],
      classificacao,
      responsavelClassificacao: 'local',
    });
    if (!v.ok) {
      setErro(v.mensagem);
      return;
    }
    setErro(null);
    onApply(classificacao as ClassificacaoGastoOpcao);
  };

  return (
    <div className="modal-overlay modal-finance" onClick={saving ? undefined : onClose} role="presentation">
      <div
        className="modal-sheet classificar-filtro-sheet bottom-sheet-finance modal-finance__container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="classificar-selecionados-title"
      >
        <div className="modal-sheet__handle modal-finance__handle" />
        <div className="classificar-filtro-sheet__header">
          <button
            type="button"
            className="classificar-filtro-sheet__close"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
          <h2 id="classificar-selecionados-title" className="classificar-filtro-sheet__title">
            Classificar selecionados
          </h2>
          <p className="classificar-selecionados-sheet__subtitle">
            {selectedCount} {selectedCount === 1 ? 'gasto selecionado' : 'gastos selecionados'} · Total{' '}
            {formatCurrency(totalCents)}
          </p>
        </div>

        <div className="classificar-filtro-sheet__body modal-finance__body">
          <section className="classificar-filtro-pagamento-group">
            <h3 className="classificar-filtro-pagamento-group__title">Tipo de classificação</h3>
            <ul
              className="classificar-filtro-fornecedor-list"
              role="listbox"
              aria-label="Tipo de classificação"
            >
              {CLASSIFICACAO_GASTO_OPCOES.map((opt) => {
                const selected = classificacao === opt;
                const preview = montarPayloadClassificacaoSimples(opt);
                const hint = `${preview.tipoGasto} · ${preview.quemGastou}`;
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={saving}
                      className={`classificar-filtro-fornecedor-list__item ${selected ? 'classificar-filtro-fornecedor-list__item--selected' : ''}`}
                      onClick={() => {
                        setClassificacao(opt);
                        setErro(null);
                      }}
                    >
                      <span
                        className={`classificar-filtro-fornecedor-list__check ${selected ? 'classificar-filtro-fornecedor-list__check--on' : ''}`}
                        aria-hidden
                      />
                      <span className="classificar-filtro-fornecedor-list__label">
                        {opt}
                        <span className="classificar-selecionados-sheet__opcao-hint"> ({hint})</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {erro ? <p className="classificar-classificacao-erro">{erro}</p> : null}
        </div>

        <div className="classificar-filtro-sheet__footer modal-finance__footer modal-finance__actions">
          <button
            type="button"
            className="classificar-filtro-sheet__btn classificar-filtro-sheet__btn--secondary button-finance button-finance--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="classificar-filtro-sheet__btn classificar-filtro-sheet__btn--primary button-finance button-finance--primary"
            onClick={handleAplicar}
            disabled={!podeAplicar}
          >
            {saving ? 'Aplicando…' : 'Aplicar classificação'}
          </button>
        </div>
      </div>
    </div>
  );
};
