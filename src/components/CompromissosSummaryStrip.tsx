import type { FC } from 'react';
import type { CompromissoPendentesUrgencySummary } from '../utils';
import { formatCompromissosPendentesUrgencySummary } from '../utils';

interface CompromissosSummaryStripProps {
  summary: CompromissoPendentesUrgencySummary;
  onOpenMeusGastosCompromissos: () => void;
}

export const CompromissosSummaryStrip: FC<CompromissosSummaryStripProps> = ({
  summary,
  onOpenMeusGastosCompromissos,
}) => {
  if (summary.total === 0) return null;

  const urgencyClass = summary.maxLevel ?? 'ordem';

  return (
    <button
      type="button"
      className={`compromissos-alert compromissos-alert--${urgencyClass}`}
      onClick={onOpenMeusGastosCompromissos}
    >
      <span className="compromissos-alert__marker" aria-hidden="true" />
      <span className="compromissos-alert__body">
        <span className="compromissos-alert__title">
          <span className="compromissos-alert__count">{summary.total}</span>
          {' '}
          compromisso{summary.total === 1 ? '' : 's'} pendente
          {summary.total === 1 ? '' : 's'}
        </span>
        <span className="compromissos-alert__row">
          <span className="compromissos-alert__summary">
            {formatCompromissosPendentesUrgencySummary(summary)}
          </span>
          <span className="compromissos-alert__link">Ver compromissos ›</span>
        </span>
      </span>
    </button>
  );
};
