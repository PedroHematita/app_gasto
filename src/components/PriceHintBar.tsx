import { useState, useEffect, useRef } from 'react';
import { formatCurrency } from '../utils';
import { fetchPriceHistory } from '../lib/supabase';
import { PriceHistorySheet } from './PriceHistorySheet';
import type { PriceHistoryRecord } from '../lib/supabase';

interface PriceHintBarProps {
  descricao: string;
}

export const PriceHintBar: React.FC<PriceHintBarProps> = ({ descricao }) => {
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

    // Avoid re-fetching same query
    if (trimmed === lastQuery.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      lastQuery.current = trimmed;
      const data = await fetchPriceHistory(trimmed);
      setRecords(data);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [descricao]);

  if (records.length === 0) return null;

  const latest = records[0];
  const avg3Slice = records.slice(0, 3);
  const avg3 = Math.round(avg3Slice.reduce((s, r) => s + r.valorCentavos, 0) / avg3Slice.length);

  return (
    <>
      <div className="price-hint-bar">
        <span className="price-hint-bar__item">
          <span className="price-hint-bar__label">Última</span>
          <span className="price-hint-bar__value">{formatCurrency(latest.valorCentavos)}</span>
        </span>
        <span className="price-hint-bar__sep">|</span>
        <span className="price-hint-bar__item">
          <span className="price-hint-bar__label">Média</span>
          <span className="price-hint-bar__value">{formatCurrency(avg3)}</span>
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
