import { useMemo, useState } from 'react';
import { formatCurrency } from '../../utils';

const PH_TOOLTIP_MIN_W = 120;
const PH_TOOLTIP_H = 34;
const PH_TOOLTIP_PAD_X = 8;
const PH_TOOLTIP_PAD_Y = 4;
const PH_TOOLTIP_FONT_SIZE = 9;
const PH_TOOLTIP_GAP = 8;
const PH_TOOLTIP_LINE_HEIGHT = 11;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export interface CotacaoChartPoint {
  id: string;
  dataBR: string;
  fornecedor: string;
  valorUnitarioCentavos: number;
}

interface CotacaoLineChartProps {
  pointsChrono: CotacaoChartPoint[];
}

export function CotacaoLineChart({ pointsChrono }: CotacaoLineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartW = 340;
  const chartH = 160;
  const padX = 28;
  const padY = 22;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;

  const chartData = useMemo(() => {
    const n = pointsChrono.length;
    if (n === 0) return null;

    const values = pointsChrono.map((p) => p.valorUnitarioCentavos);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const xAt = (i: number) =>
      n === 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW;

    const pts = pointsChrono.map((record, i) => ({
      x: xAt(i),
      y: padY + innerH - ((record.valorUnitarioCentavos - min) / range) * innerH,
      record,
      i,
    }));

    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const baseY = padY + innerH;
    let areaPath = '';
    if (n >= 2) {
      areaPath = `${linePath} L ${pts[pts.length - 1].x},${baseY} L ${pts[0].x},${baseY} Z`;
    } else if (n === 1) {
      const p0 = pts[0];
      areaPath = `M ${p0.x},${p0.y} L ${p0.x + 10},${baseY} L ${p0.x - 10},${baseY} Z`;
    }

    return { pts, linePath, areaPath, min, max };
  }, [pointsChrono, innerW, innerH, padX, padY]);

  if (!chartData) {
    return (
      <div className="ph-chart-container cotacao-chart-placeholder">
        <p className="cotacao-chart-placeholder__text">Adicione preços para ver o gráfico</p>
      </div>
    );
  }

  const lastIdx = chartData.pts.length - 1;

  return (
    <div className="ph-chart-container">
      <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
        <defs>
          <linearGradient id="cotacao-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={padX}
          y1={padY}
          x2={padX}
          y2={padY + innerH}
          stroke="#1a1a1a"
          strokeWidth="0.5"
        />
        <line
          x1={padX}
          y1={padY + innerH}
          x2={padX + innerW}
          y2={padY + innerH}
          stroke="#1a1a1a"
          strokeWidth="0.5"
        />

        {chartData.areaPath ? (
          <path d={chartData.areaPath} fill="url(#cotacao-area-fill)" stroke="none" />
        ) : null}

        {chartData.pts.length >= 2 && (
          <path
            d={chartData.linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}

        {chartData.pts.map((p, i) => {
          const isLast = i === lastIdx;
          const isHovered = hoveredIndex === i;
          const tipW = PH_TOOLTIP_MIN_W;
          const tipH = PH_TOOLTIP_H;
          const midX = padX + innerW / 2;
          let rx = p.x + PH_TOOLTIP_GAP;
          if (p.x >= midX) rx = p.x - PH_TOOLTIP_GAP - tipW;
          rx = clamp(rx, 0, chartW - tipW);
          let ry = p.y - PH_TOOLTIP_GAP - tipH;
          if (ry < 0) ry = p.y + PH_TOOLTIP_GAP;
          ry = clamp(ry, 0, chartH - tipH);

          return (
            <g key={p.record.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isLast ? 5.5 : 4}
                fill={isLast ? 'var(--accent)' : 'var(--bg-surface)'}
                stroke="var(--accent)"
                strokeWidth={isLast ? 2.5 : 1.5}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setHoveredIndex(isHovered ? null : i)}
              />
              {isHovered && (
                <g>
                  <rect
                    x={rx}
                    y={ry}
                    width={tipW}
                    height={tipH}
                    rx={6}
                    fill="#1e1a3a"
                    stroke="#3d2fa0"
                    strokeWidth="0.5"
                  />
                  <text x={rx + PH_TOOLTIP_PAD_X} y={ry + PH_TOOLTIP_PAD_Y + PH_TOOLTIP_FONT_SIZE} fill="#e0e0e0" fontSize={PH_TOOLTIP_FONT_SIZE} fontFamily="Inter">
                    {p.record.dataBR} · {p.record.fornecedor}
                  </text>
                  <text x={rx + PH_TOOLTIP_PAD_X} y={ry + PH_TOOLTIP_PAD_Y + PH_TOOLTIP_FONT_SIZE + PH_TOOLTIP_LINE_HEIGHT} fill="#e0e0e0" fontSize={PH_TOOLTIP_FONT_SIZE} fontFamily="Inter">
                    {formatCurrency(p.record.valorUnitarioCentavos)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
