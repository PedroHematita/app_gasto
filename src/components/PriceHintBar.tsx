import { useState, useEffect, useRef } from 'react';
import { formatCurrency } from '../utils';
import { fetchPriceHistory } from '../lib/supabase';
import { PriceHistorySheet } from './PriceHistorySheet';
import type { PriceHistoryRecord } from '../lib/supabase';

interface PriceHintBarProps {
  descricao: string;
  unidade: string;
}

export const PriceHintBar: React.FC<PriceHintBarProps> = ({ descricao, unidade }) => {
  const [records, setRecords] = useState<PriceHistoryRecord[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQuery = useRef('');

  useEffect(() => {
    const trimmed = descricao.trim();

    if (trimmed.length < 2) {
      setRecords([]);
      return;
    }

    // Avoid re-fetching same query combination
    const queryKey = `${trimmed}|${unidade}`;
    if (queryKey === lastQuery.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      lastQuery.current = queryKey;
      const data = await fetchPriceHistory(trimmed, unidade);
      setRecords(data);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [descricao, unidade]);

  if (records.length === 0) return null;

  const latest = records[0];
  const avg3Slice = records.slice(0, 3);
  
  // Média ponderada = soma(valor_total) / soma(quantidade)
  const totalCents = avg3Slice.reduce((s, r) => s + r.valorCentavos, 0);
  const totalQty = avg3Slice.reduce((s, r) => s + r.quantidade, 0);
  const avg3 = totalQty > 0 ? Math.round(totalCents / totalQty) : 0;

  return (
    <>
      <div className="price-hint-bar">
        <span className="price-hint-bar__item">
          <span className="price-hint-bar__label">Última</span>
          <span className="price-hint-bar__value">{formatCurrency(latest.valorUnitarioCentavos)} / {unidade}</span>
        </span>
        <span className="price-hint-bar__sep">|</span>
        <span className="price-hint-bar__item">
          <span className="price-hint-bar__label">Média</span>
          <span className="price-hint-bar__value">{formatCurrency(avg3)} / {unidade}</span>
        </span>
        <button
          className="price-hint-bar__link"
          onClick={() => setShowSheet(true)}
          type="button"
        >
          histórico ›
        </button>
      </div>

      {showSheet && (
        <PriceHistorySheet
          descricao={descricao.trim()}
          records={records}
          onClose={() => setShowSheet(false)}
        />
      )}
    </>
  );
};
