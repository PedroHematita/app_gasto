import React, { useState, useRef, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { formatCurrency } from '../utils';
import type { GastoItem } from '../types';

interface ItemsTableProps {
  items: GastoItem[];
  editingItemId: string | null;
  latestItemId: string | null;
  onEdit: (item: GastoItem) => void;
  onDelete: (id: string) => void;
}

export const ItemsTable: React.FC<ItemsTableProps> = ({
  items,
  editingItemId,
  latestItemId,
  onEdit,
  onDelete,
}) => {
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent, id: string) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (deltaX < -60 && deltaY < 40) {
        setSwipedId(id);
      } else if (deltaX > 60) {
        setSwipedId(null);
      }
    },
    []
  );

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirmId) {
      onDelete(deleteConfirmId);
      setDeleteConfirmId(null);
      setSwipedId(null);
    }
  }, [deleteConfirmId, onDelete]);

  if (items.length === 0) {
    return (
      <div className="items-table">
        <div className="items-table__empty">Nenhum item lançado</div>
      </div>
    );
  }

  // Display in descending order (latest first)
  const sorted = [...items].sort((a, b) => b.ordem - a.ordem);

  return (
    <div className="items-table">
      {sorted.map((item) => {
        const isLatest = item.id === latestItemId;
        const isEditing = item.id === editingItemId;
        const isSwiped = item.id === swipedId;

        return (
          <div
            key={item.id}
            className={`item-row ${isEditing ? 'item-row--editing' : ''}`}
          >
            <div className="item-row__swipe-wrapper">
              <div className="item-row__delete-bg">
                <button
                  onClick={() => handleDeleteClick(item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ff4444',
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    padding: '8px',
                  }}
                >
                  Excluir
                </button>
              </div>
              <div
                className={`item-row__content ${isSwiped ? 'item-row__content--swiped' : ''}`}
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => handleTouchEnd(e, item.id)}
              >
                <div className="item-row__top">
                  <span className="item-row__number">{item.ordem}</span>
                  <span className={`item-row__desc ${isLatest ? 'item-row__desc--new' : ''}`}>
                    {item.descricao}
                    {isLatest && <span className="item-row__badge">novo</span>}
                  </span>
                  <button
                    className="item-row__edit-btn"
                    onClick={() => onEdit(item)}
                    type="button"
                    aria-label={`Editar item ${item.ordem}`}
                  >
                    <Pencil size={13} />
                  </button>
                </div>
                <div className="item-row__bottom">
                  <span className="item-row__qty">
                    {item.quantidade} {item.unidade}
                  </span>
                  <span className="item-row__value">
                    {formatCurrency(item.valorCentavos)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {deleteConfirmId && (
        <div
          className="delete-confirm modal-finance modal-finance--centered modal-finance--z-dialog"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="delete-confirm__box modal-finance__dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="delete-confirm__text modal-finance__dialog-body">Excluir este item?</p>
            <div className="delete-confirm__actions modal-finance__dialog-actions">
              <button
                className="delete-confirm__btn delete-confirm__btn--cancel"
                onClick={() => { setDeleteConfirmId(null); setSwipedId(null); }}
              >
                Cancelar
              </button>
              <button
                className="delete-confirm__btn delete-confirm__btn--delete"
                onClick={confirmDelete}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
