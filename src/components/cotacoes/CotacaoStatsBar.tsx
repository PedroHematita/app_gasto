import { formatCurrency } from '../../utils';

interface CotacaoStatsBarProps {
  menorCentavos: number | null;
  mediaCentavos: number | null;
  diferencaCentavos: number | null;
}

export function CotacaoStatsBar({ menorCentavos, mediaCentavos, diferencaCentavos }: CotacaoStatsBarProps) {
  return (
    <div className="cotacao-stats">
      <div className="cotacao-stats__cell">
        <span className="cotacao-stats__label">Menor preço</span>
        <span className="cotacao-stats__value">
          {menorCentavos != null ? formatCurrency(menorCentavos) : '—'}
        </span>
      </div>
      <div className="cotacao-stats__sep" />
      <div className="cotacao-stats__cell">
        <span className="cotacao-stats__label">Média</span>
        <span className="cotacao-stats__value">
          {mediaCentavos != null ? formatCurrency(mediaCentavos) : '—'}
        </span>
      </div>
      <div className="cotacao-stats__sep" />
      <div className="cotacao-stats__cell">
        <span className="cotacao-stats__label">Diferença</span>
        <span className="cotacao-stats__value">
          {diferencaCentavos != null ? formatCurrency(diferencaCentavos) : '—'}
        </span>
      </div>
    </div>
  );
}
