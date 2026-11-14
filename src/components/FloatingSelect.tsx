import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCompactSelect } from '../hooks/useCompactSelect';
import {
  filtrarOpcoesSelect,
  selectDeveExibirPesquisa,
  toSelectOptionItems,
} from '../lib/selectOptions';
import { SelectOptionsSheet } from './SelectOptionsSheet';

interface FloatingSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  className?: string;
  bgVariant?: 'surface' | 'main' | 'edit';
  id?: string;
  disabled?: boolean;
}

export const FloatingSelect: React.FC<FloatingSelectProps> = ({
  label,
  value,
  onChange,
  options,
  className = '',
  bgVariant = 'main',
  id,
  disabled = false,
}) => {
  const compact = useCompactSelect();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const bgClass =
    bgVariant === 'edit'
      ? 'floating-field--edit-bg input-finance--edit-bg'
      : bgVariant === 'main'
        ? 'floating-field--main-bg input-finance--main-bg'
        : bgVariant === 'surface'
          ? 'floating-field--surface-bg input-finance--surface-bg'
          : '';

  const items = toSelectOptionItems(options);
  const filtered = filtrarOpcoesSelect(items, search);

  useEffect(() => {
    if (!open || compact) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, compact]);

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
    triggerRef.current?.focus();
  }, []);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setSearch('');
    if (!compact) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [disabled, compact]);

  const handleSelect = useCallback((opt: string) => {
    onChange(opt);
    close();
  }, [onChange, close]);

  const labelBg =
    bgVariant === 'edit' || bgVariant === 'surface'
      ? 'var(--bg-base)'
      : 'var(--bg-main)';

  return (
    <div className={`floating-field input-finance ${bgClass} ${className}`} ref={containerRef} style={{ position: 'relative' }}>
      {(!open || compact) && (
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className="floating-field__input has-value floating-field__select-trigger"
          onClick={() => (open ? close() : handleOpen())}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          style={{
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            userSelect: 'none',
            opacity: disabled ? 0.5 : 1,
            textAlign: 'left',
          }}
        >
          <span style={{ flex: 1 }}>{value}</span>
          <span
            className="floating-field__select-arrow"
            aria-hidden
            style={{
              position: 'static',
              transform: open ? 'rotate(180deg)' : 'none',
              opacity: disabled ? 0.3 : 1,
              pointerEvents: 'none',
            }}
          >
            <ChevronDown size={16} />
          </span>
        </button>
      )}

      {open && !compact && (
        <>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar..."
            className="floating-field__input has-value"
            style={{ caretColor: 'var(--text-primary)', paddingRight: 36 }}
            autoComplete="off"
          />
          <span
            className="floating-field__select-arrow"
            onClick={close}
            style={{
              transform: 'translateY(-50%) rotate(180deg)',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
          >
            <ChevronDown size={16} />
          </span>
        </>
      )}

      <label className="floating-field__label" style={{
        top: 0, transform: 'translateY(-50%)', fontSize: 10,
        color: disabled ? 'var(--text-inactive)' : 'var(--text-muted)',
        background: labelBg, padding: '0 5px',
        opacity: disabled ? 0.6 : 1,
      }}>
        {label}
      </label>

      {open && !compact && (
        <div className="input-finance__dropdown custom-dropdown" role="listbox">
          {filtered.length === 0 ? (
            <div className="input-finance__option--empty custom-dropdown__empty">Nenhuma opção encontrada</div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`input-finance__option custom-dropdown__item ${opt.value === value ? 'input-finance__option--active custom-dropdown__item--selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}

      {open && compact ? (
        <SelectOptionsSheet
          title={label}
          options={items}
          selectedValues={value ? [value] : []}
          searchable={selectDeveExibirPesquisa(options.length)}
          onChoose={handleSelect}
          onClose={close}
        />
      ) : null}
    </div>
  );
};
