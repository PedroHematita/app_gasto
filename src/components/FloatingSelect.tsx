import { ChevronDown } from 'lucide-react';
import { toSelectOptionItems } from '../lib/selectOptions';

interface FloatingSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  className?: string;
  bgVariant?: 'surface' | 'main' | 'edit';
  id?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  showError?: boolean;
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
  hideLabel = false,
  showError = false,
}) => {
  const bgClass =
    bgVariant === 'edit'
      ? 'floating-field--edit-bg input-finance--edit-bg'
      : bgVariant === 'main'
        ? 'floating-field--main-bg input-finance--main-bg'
        : bgVariant === 'surface'
          ? 'floating-field--surface-bg input-finance--surface-bg'
          : '';

  const items = toSelectOptionItems(options);
  const temValorAtual = items.some((opt) => opt.value === value);
  const labelBg =
    bgVariant === 'edit' || bgVariant === 'surface'
      ? 'var(--bg-base)'
      : 'var(--bg-main)';

  return (
    <div
      className={`floating-field input-finance ${bgClass} ${className}${hideLabel ? ' floating-field--nolabel' : ''}${showError ? ' floating-field--error' : ''}${!value ? ' floating-field--empty' : ''}`}
    >
      <select
        id={id}
        className={`floating-field__select${value || hideLabel ? ' has-value' : ''}`}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        {!temValorAtual ? (
          <option value={value}>{value || label}</option>
        ) : null}
        {items.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="floating-field__select-arrow" aria-hidden>
        <ChevronDown size={16} />
      </span>
      {!hideLabel ? (
        <label
          htmlFor={id}
          className="floating-field__label"
          style={{
            top: 0,
            transform: 'translateY(-50%)',
            fontSize: 10,
            color: disabled ? 'var(--text-inactive)' : 'var(--text-muted)',
            background: labelBg,
            padding: '0 5px',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {label}
        </label>
      ) : null}
    </div>
  );
};
