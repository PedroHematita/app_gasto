import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  CLASSIFICACAO_GERAL_MTD_OPCOES,
  DIRECIONAMENTO_MTD_OPCOES,
  classificacaoGeralMtdLabel,
  mtdCaminhoExibicao,
  raizMtdSugeridaPorClassificacaoGeral,
} from '../../lib/mtdTaxonomia';
import { formatCurrency } from '../../utils';
import { mtdPayloadFromForm, validarClassificacaoMtdMassa } from '../../lib/mtdClassificacao';
import { MtdNaturezaPicker } from './MtdNaturezaPicker';

type WizardStep = 1 | 2 | 3 | 4;

interface ClassificarMtdSheetProps {
  selectedCount: number;
  totalCents: number;
  saving: boolean;
  initialDirecionamento?: string;
  initialClassificacaoGeral?: string;
  initialNaturezaCaminho?: string[];
  onClose: () => void;
  onApply: (payload: {
    direcionamentoMtd: string;
    classificacaoGeralMtd: string;
    naturezaMtdRaiz: string;
    naturezaMtdCaminho: string[];
  }) => void;
}

export const ClassificarMtdSheet: React.FC<ClassificarMtdSheetProps> = ({
  selectedCount,
  totalCents,
  saving,
  initialDirecionamento = '',
  initialClassificacaoGeral = '',
  initialNaturezaCaminho = [],
  onClose,
  onApply,
}) => {
  const isEdit = !!(initialDirecionamento && initialClassificacaoGeral && initialNaturezaCaminho.length);
  const [step, setStep] = useState<WizardStep>(isEdit ? 4 : 1);
  const [direcionamento, setDirecionamento] = useState(initialDirecionamento);
  const [classificacaoGeral, setClassificacaoGeral] = useState(initialClassificacaoGeral);
  const [naturezaCaminho, setNaturezaCaminho] = useState<string[]>(initialNaturezaCaminho);
  const [erro, setErro] = useState<string | null>(null);

  const payloadPreview = useMemo(
    () =>
      mtdPayloadFromForm({
        direcionamentoMtd: direcionamento,
        classificacaoGeralMtd: classificacaoGeral,
        naturezaMtdCaminho: naturezaCaminho,
      }),
    [direcionamento, classificacaoGeral, naturezaCaminho]
  );

  const podeConfirmar = useMemo(() => {
    const v = validarClassificacaoMtdMassa({
      ids: ['ok'],
      payload: payloadPreview ?? {},
    });
    return v.ok && !saving;
  }, [payloadPreview, saving]);

  const handleConfirm = () => {
    const v = validarClassificacaoMtdMassa({
      ids: ['ok'],
      payload: payloadPreview ?? {},
    });
    if (!v.ok) {
      setErro(v.mensagem);
      return;
    }
    setErro(null);
    onApply({
      direcionamentoMtd: v.payload.direcionamentoMtd,
      classificacaoGeralMtd: v.payload.classificacaoGeralMtd,
      naturezaMtdRaiz: v.payload.naturezaMtdRaiz,
      naturezaMtdCaminho: v.payload.naturezaMtdCaminho,
    });
  };

  const dirLabel = DIRECIONAMENTO_MTD_OPCOES.find((o) => o.slug === direcionamento)?.label ?? '—';
  const geralLabel = classificacaoGeral ? classificacaoGeralMtdLabel(classificacaoGeral) || '—' : '—';

  const handleClassificacaoGeral = (slug: string) => {
    setClassificacaoGeral(slug);
    const raizSugerida = raizMtdSugeridaPorClassificacaoGeral(slug);
    setNaturezaCaminho(raizSugerida ? [raizSugerida] : []);
    setErro(null);
  };

  return (
    <div
      className="modal-overlay modal-finance"
      role="presentation"
      onClick={() => !saving && onClose()}
    >
      <div
        className="modal-sheet classificar-filtro-sheet classificar-mtd-sheet bottom-sheet-finance modal-finance__container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="classificar-mtd-sheet-title"
        onClick={(e) => e.stopPropagation()}
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
          <h2 id="classificar-mtd-sheet-title" className="classificar-filtro-sheet__title">
            Classificar MTD
          </h2>
        </div>

        <div className="classificar-mtd-sheet__steps" aria-label="Progresso">
          {[1, 2, 3, 4].map((s) => (
            <span
              key={s}
              className={`classificar-mtd-sheet__step ${step >= s ? 'classificar-mtd-sheet__step--active' : ''}`}
            >
              {s}
            </span>
          ))}
        </div>

        <div className="classificar-filtro-sheet__body modal-finance__body classificar-mtd-sheet__body">
          {step === 1 && (
            <>
              <p className="classificar-mtd-sheet__intro">Direcionamento do gasto</p>
              <div className="classificar-mtd-sheet__opcoes">
                {DIRECIONAMENTO_MTD_OPCOES.map((o) => (
                  <button
                    key={o.slug}
                    type="button"
                    className={`classificar-mtd-sheet__opcao ${direcionamento === o.slug ? 'classificar-mtd-sheet__opcao--selected' : ''}`}
                    onClick={() => {
                      setDirecionamento(o.slug);
                      setErro(null);
                    }}
                  >
                    <span className="classificar-mtd-sheet__opcao-title">{o.label}</span>
                    <span className="classificar-mtd-sheet__opcao-desc">{o.descricao}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="classificar-mtd-sheet__intro">Classificação geral</p>
              <div className="classificar-mtd-sheet__chips">
                {CLASSIFICACAO_GERAL_MTD_OPCOES.map((o) => (
                  <button
                    key={o.slug}
                    type="button"
                    className={`classificar-mtd-sheet__chip ${classificacaoGeral === o.slug ? 'classificar-mtd-sheet__chip--selected' : ''}`}
                    onClick={() => handleClassificacaoGeral(o.slug)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="classificar-mtd-sheet__intro">Natureza MTD</p>
              <MtdNaturezaPicker
                classificacaoGeral={classificacaoGeral}
                caminho={naturezaCaminho}
                onSelect={setNaturezaCaminho}
              />
            </>
          )}

          {step === 4 && (
            <>
              <p className="classificar-mtd-sheet__intro">Confirmar classificação MTD</p>
              <div className="classificar-mtd-sheet__resumo">
                <p>
                  <strong>{selectedCount}</strong>{' '}
                  {selectedCount === 1 ? 'gasto' : 'gastos'} · Total{' '}
                  <strong>{formatCurrency(totalCents)}</strong>
                </p>
                <dl className="classificar-mtd-sheet__resumo-list">
                  <div>
                    <dt>Direcionamento</dt>
                    <dd>{dirLabel}</dd>
                  </div>
                  <div>
                    <dt>Classificação geral</dt>
                    <dd>{geralLabel}</dd>
                  </div>
                  <div>
                    <dt>Natureza MTD</dt>
                    <dd>{mtdCaminhoExibicao(naturezaCaminho) || '—'}</dd>
                  </div>
                </dl>
              </div>
            </>
          )}

          {erro && (
            <p className="classificar-classificacao-erro" role="alert">
              {erro}
            </p>
          )}
        </div>

        <div className="classificar-filtro-sheet__footer modal-finance__footer modal-finance__actions">
          {step > 1 && step < 4 && (
            <button
              type="button"
              className="classificar-filtro-sheet__btn--secondary button-finance button-finance--ghost"
              onClick={() => setStep((s) => (s - 1) as WizardStep)}
              disabled={saving}
            >
              Voltar
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              className="classificar-filtro-sheet__btn--primary button-finance button-finance--primary"
              disabled={
                saving ||
                (step === 1 && !direcionamento) ||
                (step === 2 && !classificacaoGeral) ||
                (step === 3 && !payloadPreview)
              }
              onClick={() => {
                if (step === 3 && !payloadPreview) {
                  setErro('Selecione um caminho completo na árvore MTD.');
                  return;
                }
                setErro(null);
                setStep((s) => (s + 1) as WizardStep);
              }}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              className="classificar-filtro-sheet__btn--primary button-finance button-finance--primary"
              disabled={!podeConfirmar}
              onClick={handleConfirm}
            >
              {saving ? 'Salvando…' : 'Aplicar MTD'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
