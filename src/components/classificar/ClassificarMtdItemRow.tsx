import React, { useCallback } from 'react';
import { formatCurrency } from '../../utils';
import type { ItemMtdRow } from '../../types';
import { useClassificarRowPress } from './useClassificarRowPress';

interface ClassificarMtdItemRowProps {
  item: ItemMtdRow;
  selected: boolean;
  selectionMode: boolean;
  mtdLabel: string;
  mtdTitle?: string;
  pendente: boolean;
  onToggleSelect: (id: string) => void;
  onSelectByLongPress: (id: string) => void;
}

export const ClassificarMtdItemRow: React.FC<ClassificarMtdItemRowProps> = ({
  item,
  selected,
  selectionMode,
  mtdLabel,
  mtdTitle,
  pendente,
  onToggleSelect,
  onSelectByLongPress,
}) => {
  const onLongPress = useCallback(() => {
    onSelectByLongPress(item.id);
  }, [item.id, onSelectByLongPress]);

  const onShortPress = useCallback(() => {
    onToggleSelect(item.id);
  }, [item.id, onToggleSelect]);

  const pressHandlers = useClassificarRowPress({ onLongPress, onShortPress });

  return (
    <div
      className={`classificar-mtd-item ${selected ? 'classificar-mtd-item--selected' : ''} ${selectionMode ? 'classificar-mtd-item--selection-mode' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${item.descricao}, ${mtdLabel}`}
      {...pressHandlers}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'manipulation' }}
    >
      <span
        className={`classificar-mtd-item__check ${selected ? 'classificar-mtd-item__check--on' : ''}`}
        aria-hidden
      />
      <div className="classificar-mtd-item__content">
        <div className="classificar-mtd-item__row-title">
          <span className="classificar-mtd-item__desc">{item.descricao}</span>
          <span className="classificar-mtd-item__valor">{formatCurrency(item.valorCentavos)}</span>
        </div>
        <p className="classificar-mtd-item__meta">
          <span className="classificar-mtd-item__qty">
            {item.quantidade} {item.unidade}
          </span>
          <span aria-hidden> · </span>
          <span
            className={`classificar-mtd-item__mtd ${pendente ? 'classificar-mtd-item__mtd--pendente' : ''}`}
            title={mtdTitle ?? mtdLabel}
          >
            {mtdLabel}
          </span>
        </p>
      </div>
    </div>
  );
};
