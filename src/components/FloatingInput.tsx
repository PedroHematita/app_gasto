import { useRef, useEffect, useState, useCallback } from 'react';

export type AutocompleteResult = string | { label: string; payload?: any };

interface FloatingInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
  bgVariant?: 'surface' | 'main' | 'edit';
  inputClassName?: string;
  readOnly?: boolean;
  onClick?: () => void;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel';
  id?: string;
  autocompleteSearch?: (query: string) => Promise<AutocompleteResult[]>;
  onSelectSuggestion?: (value: string, payload?: any) => void;
  /** Borda/estado de erro até o usuário corrigir. */
  showError?: boolean;
  /** Preenchimento automático do navegador (padrão "off"; use "on" em texto livre quando fizer sentido). */
  autoComplete?: string;
  autoCorrect?: 'on' | 'off';
  spellCheck?: boolean;
  /** Nome do campo no DOM (usa `id` quando omitido). */
  name?: string;
}

export const FloatingInput: React.FC<FloatingInputProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  className = '',
  bgVariant = 'main',
  inputClassName = '',
  readOnly = false,
  onClick,
  inputMode,
  id,
  autocompleteSearch,
  onSelectSuggestion,
  showError = false,
  autoComplete = 'off',
  autoCorrect = 'off',
  spellCheck = false,
  name,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const bgClass = bgVariant === 'edit'
    ? 'floating-field--edit-bg'
    : bgVariant === 'main'
    ? 'floating-field--main-bg'
    : '';

  // Debounced search
  const handleChange = useCallback(
    (val: string) => {
      onChange(val);

      if (!autocompleteSearch) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (val.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const results = await autocompleteSearch(val);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      }, 300);
    },
    [onChange, autocompleteSearch]
  );

  // Select suggestion
  const handleSelect = useCallback(
    (s: AutocompleteResult) => {
      const val = typeof s === 'string' ? s : s.label;
      const payload = typeof s === 'string' ? undefined : s.payload;
      
      onChange(val);
      if (onSelectSuggestion) onSelectSuggestion(val, payload);
      
      setSuggestions([]);
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    [onChange, onSelectSuggestion]
  );

  // Close on outside click
  useEffect(() => {
    if (!showSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSuggestions]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      className={`floating-field ${bgClass} ${className}${showError ? ' floating-field--error' : ''}`}
      ref={containerRef}
      style={{ position: 'relative' }}
    >
      <input
        ref={inputRef}
        id={id}
        name={name ?? id}
        type={type}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className={`floating-field__input ${value ? 'has-value' : ''}${showError ? ' floating-field__input--error' : ''} ${inputClassName}`}
        readOnly={readOnly}
        onClick={onClick}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        onFocus={() => {
          if (suggestions.length > 0) setShowSuggestions(true);
        }}
      />
      <label className="floating-field__label">{label}</label>

      {showSuggestions && suggestions.length > 0 && (
        <div className="custom-dropdown">
          {suggestions.map((s, i) => {
            const label = typeof s === 'string' ? s : s.label;
            return (
              <div
                key={`${label}-${i}`}
                className="custom-dropdown__item"
                onClick={() => handleSelect(s)}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
