import { useState, useMemo } from 'react';
import { formatCurrency } from '../utils';
import type { PriceHistoryRecord } from '../lib/supabase';

interface PriceHistorySheetProps {
  descricao: string;
  records: PriceHistoryRecord[];
  onClose: () => void;
}

export const PriceHistorySheet: React.FC<PriceHistorySheetProps> = ({
  descricao,
  records,
  onClose,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Records are already sorted desc (newest first)
  // For chart we need chronological order (oldest first)
  const chronological = useMemo(() => [...records].reverse(), [records]);

  const latest = records[0];
  const previous = records[1];

  // Average of last 3
  const avg3 = useMemo(() => {
    const slice = records.slice(0, 3);
    if (slice.length === 0) return 0;
    return Math.round(slice.reduce((s, r) => s + r.valorCentavos, 0) / slice.length);
  }, [records]);

  // Variation
  const variation = useMemo(() => {
    if (!latest || !previous || previous.valorCentavos === 0) return null;
    return ((latest.valorCentavos - previous.valorCentavos) / previous.valorCentavos) * 100;
  }, [latest, previous]);

  // Chart dimensions
  const chartW = 340;
  const chartH = 140;
  const padX = 30;
  const padY = 20;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;

  const chartData = useMemo(() => {
    if (chronological.length < 2) return null;
    const values = chronological.map((r) => r.valorCentavos);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = chronological.map((r, i) => ({
      x: padX + (i / (chronological.length - 1)) * innerW,
      y: padY + innerH - ((r.valorCentavos - min) / range) * innerH,
      record: r,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

    return { points, linePath, min, max };
  }, [chronological, innerW, innerH, padX, padY]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet price-history-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-sheet__handle" />

        {/* Title */}
        <div className="ph-title">{descricao}</div>
        <div className="ph-subtitle">Histórico dos seus registros</div>

        {/* Stats bar */}
        <div className="ph-stats">
          <div className="ph-stat">
            <span className="ph-stat__label">Última vez</span>
            <span className="ph-stat__value">{formatCurrency(latest.valorCentavos)}</span>
          </div>
          <div className="ph-stat-sep" />
          <div className="ph-stat">
            <span className="ph-stat__label">Média recente</span>
            <span className="ph-stat__value">{formatCurrency(avg3)}</span>
          </div>
          {variation !== null && (
            <>
              <div className="ph-stat-sep" />
              <div className="ph-stat">
                <span className="ph-stat__label">Variação</span>
                <span className={`ph-stat__value ${variation > 0 ? 'ph-stat__value--up' : 'ph-stat__value--down'}`}>
                  {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* Chart */}
        {chartData && (
          <div className="ph-chart-container">
            <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
              {/* Grid lines */}
              <line x1={padX} y1={padY} x2={padX} y2={padY + innerH} stroke="#1a1a1a" strokeWidth="0.5" />
              <line x1={padX} y1={padY + innerH} x2={padX + innerW} y2={padY + innerH} stroke="#1a1a1a" strokeWidth="0.5" />

              {/* Line */}
              <path d={chartData.linePath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />

              {/* Points */}
              {chartData.points.map((p, i) => {
                const isLast = i === chartData.points.length - 1;
                const isHovered = hoveredIndex === i;
                return (
                  <g key={i}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isLast ? 5 : 3.5}
                      fill={isLast ? 'var(--accent)' : 'var(--bg-surface)'}
                      stroke="var(--accent)"
                      strokeWidth={isLast ? 2 : 1.5}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => setHoveredIndex(isHovered ? null : i)}
                    />
                    {isHovered && (
                      <g>
                        <rect
                          x={p.x - 40}
                          y={p.y - 32}
                          width={80}
                          height={22}
                          rx={4}
                          fill="var(--bg-surface)"
                          stroke="var(--border-medium)"
                          strokeWidth="0.5"
                        />
                        <text x={p.x} y={p.y - 18} textAnchor="middle" fill="var(--accent)" fontSize="9" fontFamily="Inter">
                          {p.record.data} • {formatCurrency(p.record.valorCentavos)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {/* Records table */}
        <div className="ph-table-title">Registros</div>
        <div className="ph-table">
          <div className="ph-table-header">
            <span>Data</span>
            <span>Fornecedor</span>
            <span style={{ textAlign: 'right' }}>Valor</span>
          </div>
          {records.map((r, i) => (
            <div key={i} className="ph-table-row">
              <span className="ph-table-row__date">{r.data}</span>
              <span className="ph-table-row__fornecedor">{r.fornecedor || '—'}</span>
              <span className="ph-table-row__value">{formatCurrency(r.valorCentavos)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
