import { useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import { formatCurrency } from '../utils';
import { fetchPriceHistory } from '../lib/supabase';
import { PriceHistorySheet } from './PriceHistorySheet';
import type { PriceHistoryRecord } from '../lib/supabase';
import { avaliarDesvioComHistorico } from '../lib/desvioPreco';

interface PriceHintBarProps {
  orgId: string;
  descricao: string;
  unidade: string;
  /** Quando informados, destaca se o unitário foge ±10% da média histórica completa. */
  valorTotalCentavos?: number | null;
  quantidade?: number | null;
  /**
   * `bar` — cadastro individual (última/média).
   * `icon` — lote: só ícone “i” na linha do item (abre histórico).
   */
  variant?: 'bar' | 'icon';
  /** @deprecated use variant="icon" */
  compact?: boolean;
}

export const PriceHintBar: React.FC<PriceHintBarProps> = ({
  orgId,
  descricao,
  unidade,
  valorTotalCentavos,
  quantidade,
  variant,
  compact = false,
}) => {
  const mode = variant ?? (compact ? 'icon' : 'bar');
  const [records, setRecords] = useState<PriceHistoryRecord[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQuery = useRef('');

  useEffect(() => {
    const trimmed = descricao.trim();

    if (trimmed.length < 2) {
      setRecords([]);
      lastQuery.current = '';
      return;
    }

    const queryKey = `${trimmed}|${unidade}`;
    if (queryKey === lastQuery.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      lastQuery.current = queryKey;
      const data = await fetchPriceHistory(orgId, trimmed, unidade);
      setRecords(data);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [orgId, descricao, unidade]);

  if (records.length === 0) return null;

  const desvio =
    valorTotalCentavos != null &&
    valorTotalCentavos > 0 &&
    quantidade != null &&
    quantidade > 0
      ? avaliarDesvioComHistorico(valorTotalCentavos, quantidade, records)
      : null;
  const temComparacao = desvio != null;
  const fora = !!desvio?.foraDaFaixa;

  const sheet = showSheet ? (
    <PriceHistorySheet
      descricao={descricao.trim()}
      records={records}
      onClose={() => setShowSheet(false)}
    />
  ) : null;

  if (mode === 'icon') {
    const titulo = fora
      ? `Fora da média — informado ${formatCurrency(desvio!.valorUnitarioCentavos)} / ${unidade}. Confira a unidade. Toque para ver o histórico.`
      : temComparacao
        ? `Na média (±10%). Toque para ver o histórico.`
        : `Histórico de preços`;

    return (
      <>
        <button
          type="button"
          className={`price-hint-icon${fora ? ' price-hint-icon--warn' : ''}`}
          aria-label={titulo}
          title={titulo}
          onClick={() => setShowSheet(true)}
        >
          <Info size={14} strokeWidth={2.25} />
        </button>
        {sheet}
      </>
    );
  }

  const latest = records[0];
  const avg3Slice = records.slice(0, 3);
  const totalCents = avg3Slice.reduce((s, r) => s + r.valorCentavos, 0);
  const totalQty = avg3Slice.reduce((s, r) => s + r.quantidade, 0);
  const avg3 = totalQty > 0 ? Math.round(totalCents / totalQty) : 0;

  return (
    <>
      <div
        className={[
          'price-hint-bar',
          temComparacao ? (fora ? 'price-hint-bar--warn' : 'price-hint-bar--ok') : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {temComparacao ? (
          <span
            className={`price-hint-bar__badge ${fora ? 'price-hint-bar__badge--warn' : 'price-hint-bar__badge--ok'}`}
            title={
              fora
                ? `Informado ${formatCurrency(desvio.valorUnitarioCentavos)} / ${unidade} · esperado ${formatCurrency(desvio.limiteInferiorCentavos)} a ${formatCurrency(desvio.limiteSuperiorCentavos)}`
                : `Dentro da faixa (±10% da média ${formatCurrency(desvio.mediaPonderadaCentavos)} / ${unidade})`
            }
          >
            {fora ? 'Fora da média' : 'Na média'}
          </span>
        ) : null}
        <span className="price-hint-bar__item">
          <span className="price-hint-bar__label">Última</span>
          <span className="price-hint-bar__value">
            {formatCurrency(latest.valorUnitarioCentavos)} / {unidade}
          </span>
        </span>
        <span className="price-hint-bar__sep">|</span>
        <span className="price-hint-bar__item">
          <span className="price-hint-bar__label">Média</span>
          <span className="price-hint-bar__value">
            {formatCurrency(avg3)} / {unidade}
          </span>
        </span>
        {fora ? (
          <span className="price-hint-bar__warn-text">confira a unidade</span>
        ) : null}
        <button
          className="price-hint-bar__link"
          onClick={() => setShowSheet(true)}
          type="button"
        >
          histórico ›
        </button>
      </div>
      {sheet}
    </>
  );
};
