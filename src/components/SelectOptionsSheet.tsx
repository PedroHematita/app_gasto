import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  filtrarOpcoesSelect,
  type SelectOptionItem,
} from '../lib/selectOptions';

interface SelectOptionsSheetProps {
  title: string;
  options: readonly SelectOptionItem[];
  selectedValues: readonly string[];
  onClose: () => void;
  multiple?: boolean;
  searchable?: boolean;
  onChoose: (value: string) => void;
  confirmLabel?: string;
}

export function SelectOptionsSheet({
  title,
  options,
  selectedValues,
  onClose,
  multiple = false,
  searchable = false,
  onChoose,
  confirmLabel = 'Pronto',
}: SelectOptionsSheetProps) {
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closedByPop = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const allowDismiss = useRef(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filtrarOpcoesSelect(options, query), [options, query]);
  const compactList = options.length <= 6 && !searchable;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      allowDismiss.current = true;
      if (searchable) searchRef.current?.focus();
      else {
        const selected = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
        (selected ?? listRef.current?.querySelector<HTMLElement>('[role="option"]'))?.focus();
      }
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey, true);

    history.pushState({ selectOptionsSheet: true }, '');
    const onPop = () => {
      closedByPop.current = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('popstate', onPop);
      if (!closedByPop.current && history.state?.selectOptionsSheet) {
        history.back();
      }
    };
  }, [searchable]);

  return createPortal(
    <div
      className="modal-overlay modal-finance select-options-sheet-overlay"
      onClick={() => {
        if (allowDismiss.current) onClose();
      }}
      role="presentation"
    >
      <div
        className={`modal-sheet bottom-sheet-finance modal-finance__container select-options-sheet ${compactList ? 'select-options-sheet--compact' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-sheet__handle modal-finance__handle" aria-hidden />
        <div className="select-options-sheet__header">
          <h2 id={titleId} className="modal-sheet__title select-options-sheet__title">
            {title}
          </h2>
          <button
            type="button"
            className="select-options-sheet__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {searchable ? (
          <div className="select-options-sheet__search">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar..."
              className="floating-field__input has-value"
              autoComplete="off"
              aria-label={`Filtrar ${title}`}
            />
          </div>
        ) : null}

        <div
          ref={listRef}
          className="select-options-sheet__list"
          role="listbox"
          aria-multiselectable={multiple || undefined}
          aria-label={title}
        >
          {filtered.length === 0 ? (
            <p className="select-options-sheet__empty">Nenhuma opção encontrada</p>
          ) : (
            filtered.map((opt) => {
              const selected = selectedValues.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`select-options-sheet__item ${selected ? 'select-options-sheet__item--selected' : ''}`}
                  onClick={() => onChoose(opt.value)}
                >
                  {multiple ? (
                    <span
                      className={`select-options-sheet__check ${selected ? 'select-options-sheet__check--on' : ''}`}
                      aria-hidden
                    />
                  ) : null}
                  <span>{opt.label}</span>
                </button>
              );
            })
          )}
        </div>

        {multiple ? (
          <div className="select-options-sheet__footer">
            <button
              type="button"
              className="btn-save-modal button-finance button-finance--primary"
              onClick={onClose}
            >
              {confirmLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
