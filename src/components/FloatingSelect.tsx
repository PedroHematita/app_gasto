import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const bgClass = bgVariant === 'edit'
    ? 'floating-field--edit-bg'
    : bgVariant === 'main'
    ? 'floating-field--main-bg'
    : '';

  // Filtered options based on search
  const filtered = search.trim()
    ? options.filter((opt) =>
        opt.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [disabled]);

  const handleSelect = useCallback((opt: string) => {
    onChange(opt);
    setOpen(false);
    setSearch('');
  }, [onChange]);

  const labelBg = bgVariant === 'edit' ? 'var(--bg-edit)' : bgVariant === 'surface' ? 'var(--bg-surface)' : 'var(--bg-main)';

  return (
    <div className={`floating-field ${bgClass} ${className}`} ref={containerRef} style={{ position: 'relative' }}>
      {/* Display value (when closed) */}
      {!open && (
        <div
          id={id}
          className="floating-field__input has-value"
          onClick={handleOpen}
          style={{ 
            cursor: disabled ? 'not-allowed' : 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            userSelect: 'none',
            opacity: disabled ? 0.5 : 1
          }}
        >
          <span style={{ flex: 1 }}>{value}</span>
        </div>
      )}

      {/* Search input (when open) */}
      {open && (
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar..."
          className="floating-field__input has-value"
          style={{ caretColor: 'var(--accent)' }}
          autoComplete="off"
        />
      )}

      <span
        className="floating-field__select-arrow"
        onClick={() => {
          if (disabled) return;
          if (open) { setOpen(false); setSearch(''); } else { handleOpen(); }
        }}
        style={{
          transition: 'transform 0.2s',
          transform: open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          pointerEvents: 'auto',
          opacity: disabled ? 0.3 : 1
        }}
      >
        <ChevronDown size={16} />
      </span>

      <label className="floating-field__label" style={{
        top: 0, transform: 'translateY(-50%)', fontSize: 10,
        color: disabled ? 'var(--text-inactive)' : open ? 'var(--accent)' : 'var(--accent)',
        background: labelBg, padding: '0 5px',
        opacity: disabled ? 0.6 : 1
      }}>
        {label}
      </label>

      {open && (
        <div className="custom-dropdown">
          {filtered.length === 0 ? (
            <div className="custom-dropdown__empty">Nenhuma opção encontrada</div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt}
                className={`custom-dropdown__item ${opt === value ? 'custom-dropdown__item--selected' : ''}`}
                onClick={() => handleSelect(opt)}
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
