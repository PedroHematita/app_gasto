import { useCallback, useRef } from 'react';
import { formatCurrency } from '../../utils';
import { scheduleScrollFieldIntoView } from '../../hooks/scrollFieldIntoView';

interface ValorCentavosFieldProps {
  label: string;
  valueCents: number | null;
  onChange: (cents: number | null) => void;
  id?: string;
  showError?: boolean;
  onEnter?: () => void;
  hideLabel?: boolean;
  className?: string;
}

/** Igual ao CurrencyInput, mas `null` = campo em branco (bloqueia na validação). */
export function ValorCentavosField({
  label,
  valueCents,
  onChange,
  id,
  showError = false,
  onEnter,
  hideLabel = false,
  className = '',
}: ValorCentavosFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayValue = valueCents === null ? '' : formatCurrency(valueCents);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEnter?.();
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        if (valueCents === null || valueCents === 0) {
          onChange(null);
          return;
        }
        const next = Math.floor(valueCents / 10);
        onChange(next === 0 ? null : next);
        return;
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        onChange(null);
        return;
      }

      const digit = parseInt(e.key, 10);
      if (!Number.isNaN(digit)) {
        e.preventDefault();
        const base = valueCents ?? 0;
        const newValue = base * 10 + digit;
        if (newValue <= 99999999) onChange(newValue);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    },
    [valueCents, onChange, onEnter]
  );

  return (
    <div
      ref={containerRef}
      className={`floating-field input-finance floating-field--main-bg input-finance--main-bg${hideLabel ? ' floating-field--nolabel' : ''}${showError ? ' floating-field--error' : ''}${className ? ` ${className}` : ''}`}
    >
      <input
        id={id}
        className={`floating-field__input${displayValue || hideLabel ? ' has-value' : ''}`}
        value={displayValue}
        onChange={() => undefined}
        onKeyDown={handleKeyDown}
        onFocus={() => scheduleScrollFieldIntoView(containerRef.current)}
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
      />
      {!hideLabel ? (
        <label htmlFor={id} className="floating-field__label">
          {label}
        </label>
      ) : null}
    </div>
  );
}
