import { useState, useMemo } from 'react';
import { formatCurrency } from '../utils';
import type { PriceHistoryRecord } from '../lib/supabase';

const PH_TOOLTIP_MIN_W = 80;
const PH_TOOLTIP_H = 16;
const PH_TOOLTIP_PAD_X = 8;
const PH_TOOLTIP_PAD_Y = 3;
const PH_TOOLTIP_FONT_SIZE = 9;
const PH_TOOLTIP_GAP = 8;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Rótulo do ponto: posição adaptativa dentro da área do gráfico (SVG). */
function getPricePointTooltipBox(
  px: number,
  py: number,
  tooltipW: number,
  tooltipH: number,
  chartW: number,
  chartH: number,
  padX: number,
  padY: number,
  innerW: number,
  innerH: number
): { rx: number; ry: number; textX: number; textY: number; textAnchor: 'start' } {
  const thirdY = padY + innerH / 3;
  const midX = padX + innerW / 2;
  const inTopThird = py <= thirdY;
  const inRightHalf = px >= midX;

  let rx: number;
  if (inRightHalf) {
    rx = px - PH_TOOLTIP_GAP - tooltipW;
  } else {
    rx = px + PH_TOOLTIP_GAP;
  }

  let ry: number;
  if (inTopThird) {
    ry = py + PH_TOOLTIP_GAP;
  } else {
    ry = py - PH_TOOLTIP_GAP - tooltipH;
  }

  rx = clamp(rx, 0, chartW - tooltipW);
  ry = clamp(ry, 0, chartH - tooltipH);

  const textX = rx + PH_TOOLTIP_PAD_X;
  const textY = ry + PH_TOOLTIP_PAD_Y + PH_TOOLTIP_FONT_SIZE;

  return { rx, ry, textX, textY, textAnchor: 'start' };
}

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

  // Average of last 3 (weighted)
  const avg3 = useMemo(() => {
    const slice = records.slice(0, 3);
    if (slice.length === 0) return 0;
    const totalCents = slice.reduce((s, r) => s + r.valorCentavos, 0);
    const totalQty = slice.reduce((s, r) => s + r.quantidade, 0);
    return totalQty > 0 ? Math.round(totalCents / totalQty) : 0;
  }, [records]);

  // Variation
  const variation = useMemo(() => {
    if (!latest || !previous || previous.valorUnitarioCentavos === 0) return null;
    return ((latest.valorUnitarioCentavos - previous.valorUnitarioCentavos) / previous.valorUnitarioCentavos) * 100;
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
    const values = chronological.map((r) => r.valorUnitarioCentavos);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = chronological.map((r, i) => ({
      x: padX + (i / (chronological.length - 1)) * innerW,
      y: padY + innerH - ((r.valorUnitarioCentavos - min) / range) * innerH,
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
        <div className="ph-subtitle">Histórico dos seus registros em {latest?.unidade || ''}</div>

        {/* Stats bar */}
        <div className="ph-stats">
          <div className="ph-stat">
            <span className="ph-stat__label">Última vez</span>
            <span className="ph-stat__value">{formatCurrency(latest.valorUnitarioCentavos)}</span>
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
                const label = `${p.record.data} • ${formatCurrency(p.record.valorUnitarioCentavos)}`;
                const tooltipW = Math.max(
                  PH_TOOLTIP_MIN_W,
                  Math.ceil(label.length * 5.2 + PH_TOOLTIP_PAD_X * 2)
                );
                const tip = getPricePointTooltipBox(
                  p.x,
                  p.y,
                  tooltipW,
                  PH_TOOLTIP_H,
                  chartW,
                  chartH,
                  padX,
                  padY,
                  innerW,
                  innerH
                );
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
                          x={tip.rx}
                          y={tip.ry}
                          width={tooltipW}
                          height={PH_TOOLTIP_H}
                          rx={6}
                          fill="#1e1a3a"
                          stroke="#3d2fa0"
                          strokeWidth="0.5"
                        />
                        <text
                          x={tip.textX}
                          y={tip.textY}
                          textAnchor={tip.textAnchor}
                          fill="#e0e0e0"
                          fontSize={PH_TOOLTIP_FONT_SIZE}
                          fontFamily="Inter"
                        >
                          {label}
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
              <span className="ph-table-row__value">{formatCurrency(r.valorUnitarioCentavos)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
