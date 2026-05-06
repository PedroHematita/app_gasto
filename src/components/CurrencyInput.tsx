import React, { useCallback } from 'react';
import { formatCurrency } from '../utils';

interface CurrencyInputProps {
  label: string;
  valueCents: number;
  onChange: (cents: number) => void;
  className?: string;
  bgVariant?: 'surface' | 'main' | 'edit';
  id?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  label,
  valueCents,
  onChange,
  className = '',
  bgVariant = 'main',
  id,
}) => {
  const bgClass = bgVariant === 'edit'
    ? 'floating-field--edit-bg'
    : bgVariant === 'main'
    ? 'floating-field--main-bg'
    : '';

  const displayValue = formatCurrency(valueCents);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.preventDefault();

      if (e.key === 'Backspace') {
        onChange(Math.floor(valueCents / 10));
        return;
      }

      if (e.key === 'Delete') {
        onChange(0);
        return;
      }

      const digit = parseInt(e.key);
      if (!isNaN(digit)) {
        const newValue = valueCents * 10 + digit;
        if (newValue <= 99999999) {
          onChange(newValue);
        }
      }
    },
    [valueCents, onChange]
  );

  return (
    <div className={`floating-field ${bgClass} ${className}`}>
      <input
        id={id}
        name={id}
        type="text"
        value={displayValue}
        onKeyDown={handleKeyDown}
        onChange={() => {}}
        className={`floating-field__input floating-field__input--currency ${displayValue ? 'has-value' : ''}`}
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        readOnly={false}
      />
      <label className="floating-field__label">{label}</label>
    </div>
  );
};
