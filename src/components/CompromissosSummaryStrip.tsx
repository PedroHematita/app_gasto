interface CompromissosSummaryStripProps {
  vencidos: number;
  pendentes: number;
  onOpenMeusGastosCompromissos: () => void;
}

export const CompromissosSummaryStrip: React.FC<CompromissosSummaryStripProps> = ({
  vencidos,
  pendentes,
  onOpenMeusGastosCompromissos,
}) => {
  if (vencidos === 0 && pendentes === 0) return null;

  return (
    <button
      type="button"
      className="compromissos-strip"
      onClick={onOpenMeusGastosCompromissos}
    >
      <span className="compromissos-strip__inner">
        {vencidos > 0 && (
          <span className="compromissos-strip__chip">
            <span className="compromissos-strip__dot compromissos-strip__dot--danger" />
            {vencidos} vencido{vencidos === 1 ? '' : 's'}
          </span>
        )}
        {vencidos > 0 && pendentes > 0 && <span className="compromissos-strip__sep">|</span>}
        {pendentes > 0 && (
          <span className="compromissos-strip__chip">
            <span className="compromissos-strip__dot compromissos-strip__dot--purple" />
            {pendentes} pendente{pendentes === 1 ? '' : 's'}
          </span>
        )}
        <span className="compromissos-strip__link">ver compromissos ›</span>
      </span>
    </button>
  );
};
