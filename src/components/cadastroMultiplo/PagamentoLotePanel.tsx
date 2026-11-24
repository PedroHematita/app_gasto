import { FloatingSelect } from '../FloatingSelect';
import { FloatingInput } from '../FloatingInput';
import { INSTITUICOES, MEIOS_PAGAMENTO } from '../../utils';
import type { PagamentoRascunhoLote } from '../../lib/cadastroMultiplo/modelo';

interface PagamentoLotePanelProps {
  pagamento: PagamentoRascunhoLote;
  onChange: (patch: Partial<PagamentoRascunhoLote>) => void;
  onClose: () => void;
  narrow: boolean;
  parcelasError?: boolean;
}

export function PagamentoLotePanel({
  pagamento,
  onChange,
  onClose,
  narrow,
  parcelasError = false,
}: PagamentoLotePanelProps) {
  const parcelado = pagamento.formaPagamento === 'parcelado';

  const body = (
    <>
      <div className="cad-multi-pag__forma">
        <button
          type="button"
          className={`payment-tab ${!parcelado ? 'payment-tab--active' : 'payment-tab--inactive'}`}
          onClick={() => onChange({ formaPagamento: 'a_vista', parcelas: 2 })}
        >
          À Vista
        </button>
        <button
          type="button"
          className={`payment-tab ${parcelado ? 'payment-tab--active' : 'payment-tab--inactive'}`}
          onClick={() =>
            onChange({
              formaPagamento: 'parcelado',
              parcelas: pagamento.parcelas >= 2 ? pagamento.parcelas : 2,
            })
          }
        >
          Parcelado
        </button>
      </div>

      {parcelado && (
        <FloatingInput
          id="cad-multi-parcelas"
          label="Parcelas (2 a 48)"
          value={String(pagamento.parcelas || '')}
          inputMode="numeric"
          showError={parcelasError}
          onChange={(v) => {
            const digits = v.replace(/\D/g, '').slice(0, 2);
            onChange({ parcelas: digits ? Number(digits) : 0 });
          }}
        />
      )}

      <FloatingSelect
        id="cad-multi-meio"
        label="Meio de pagamento"
        value={pagamento.meioPagamento}
        onChange={(meioPagamento) => onChange({ meioPagamento })}
        options={MEIOS_PAGAMENTO}
      />

      <FloatingSelect
        id="cad-multi-inst"
        label="Instituição financeira"
        value={pagamento.instituicaoFinanceira}
        onChange={(instituicaoFinanceira) => onChange({ instituicaoFinanceira })}
        options={INSTITUICOES}
      />

      <FloatingInput
        id="cad-multi-obs"
        label="Observações"
        value={pagamento.observacoes}
        onChange={(observacoes) => onChange({ observacoes })}
        autoComplete="on"
        spellCheck
      />

      <button type="button" className="button-finance button-finance--primary cad-multi-pag__ok" onClick={onClose}>
        Concluir
      </button>
    </>
  );

  if (narrow) {
    return (
      <div className="modal-overlay cad-multi-pag-overlay" onClick={onClose}>
        <div
          className="modal-sheet payment-modal-sheet modal-sheet--form cad-multi-pag-sheet"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-sheet__handle" />
          <h2 className="cad-multi-pag__titulo">Pagamento</h2>
          <div className="cad-multi-pag__body">{body}</div>
        </div>
      </div>
    );
  }

  return (
    <aside className="cad-multi-pag cad-multi-pag--side" aria-label="Pagamento do gasto">
      <h2 className="cad-multi-pag__titulo">Pagamento</h2>
      <div className="cad-multi-pag__body">{body}</div>
    </aside>
  );
}

export function resumoPagamentoTexto(pagamento: PagamentoRascunhoLote): string {
  if (pagamento.formaPagamento === 'parcelado') {
    return `Parcelado ${pagamento.parcelas}x · ${pagamento.meioPagamento} · ${pagamento.instituicaoFinanceira}`;
  }
  return `À Vista · ${pagamento.meioPagamento} · ${pagamento.instituicaoFinanceira}`;
}
