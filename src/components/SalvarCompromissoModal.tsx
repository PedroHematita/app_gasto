import { useState, useMemo, useCallback } from 'react';
import { FloatingInput } from './FloatingInput';
import { DatePickerSheet } from './DatePickerSheet';
import { searchFornecedores } from '../lib/supabase';
import type { SaveCompromissoParcela } from '../lib/supabase';
import {
  formatDateBR,
  parseDateBR,
  isPrevistaStrictlyAfterCompra,
  firstSelectableDayAfterCompraBR,
  FORNECEDOR_REQUIRED_MSG,
  formatCurrency,
} from '../utils';

type Modo = 'unico' | 'parcelado';

interface ParcelaState {
  valorCentavos: number;
  dataVencimento: string; // dd/mm/aaaa (digitável)
  showPicker: boolean;
}

interface SalvarCompromissoModalProps {
  orgId: string;
  dataCompraBR: string;
  totalCents: number; // total dos itens — usado para sugerir divisão automática
  onClose: () => void;
  onConfirm: (
    fornecedor: string,
    /** Modo único: data prevista. Modo parcelado: ignorado (usa parcelas). */
    dataPrevistaBR: string,
    parcelas?: SaveCompromissoParcela[]
  ) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function addMonthsBR(baseBR: string, months: number): string {
  const parsed = parseDateBR(baseBR);
  if (!parsed) return baseBR;
  const d = new Date(parsed);
  d.setMonth(d.getMonth() + months);
  return formatDateBR(d);
}

function defaultFirstDue(dataCompraBR: string): string {
  const fs = firstSelectableDayAfterCompraBR(dataCompraBR);
  if (fs) return formatDateBR(fs);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateBR(tomorrow);
}

function buildDefaultParcelas(n: number, totalCents: number, dataCompraBR: string): ParcelaState[] {
  const first = defaultFirstDue(dataCompraBR);
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => ({
    valorCentavos: i === n - 1 ? base + remainder : base,
    dataVencimento: addMonthsBR(first, i),
    showPicker: false,
  }));
}

// ── Component ───────────────────────────────────────────────────────────────

export const SalvarCompromissoModal: React.FC<SalvarCompromissoModalProps> = ({
  orgId,
  dataCompraBR,
  totalCents,
  onClose,
  onConfirm,
}) => {
  const [modo, setModo] = useState<Modo>('unico');

  // ── Modo único ────────────────────────────────────────────────────────────
  const [fornecedor, setFornecedor] = useState('');
  const [fornecedorError, setFornecedorError] = useState(false);
  const [dataPrevista, setDataPrevista] = useState('');
  const [showPickerUnico, setShowPickerUnico] = useState(false);

  // ── Modo parcelado ────────────────────────────────────────────────────────
  const [numParcelasStr, setNumParcelasStr] = useState('2');
  const [parcelas, setParcelas] = useState<ParcelaState[]>(() =>
    buildDefaultParcelas(2, totalCents, dataCompraBR)
  );

  // ── Handlers modo único ────────────────────────────────────────────────────
  const fallbackPickerDateBR = useMemo(() => {
    const fs = firstSelectableDayAfterCompraBR(dataCompraBR);
    if (fs) return formatDateBR(fs);
    return formatDateBR(new Date());
  }, [dataCompraBR]);

  const pickerSeedUnico = useMemo(() => {
    if (dataPrevista.length >= 10 && isPrevistaStrictlyAfterCompra(dataPrevista, dataCompraBR)) {
      return dataPrevista;
    }
    return fallbackPickerDateBR;
  }, [dataPrevista, dataCompraBR, fallbackPickerDateBR]);

  // ── Handlers modo único ───────────────────────────────────────────────────
  const handleNumParcelasChange = useCallback((val: string) => {
    setNumParcelasStr(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 2 && n <= 60) {
      setParcelas(buildDefaultParcelas(n, totalCents, dataCompraBR));
    }
  }, [totalCents, dataCompraBR]);

  const updateParcela = useCallback((index: number, patch: Partial<ParcelaState>) => {
    setParcelas((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }, []);

  const formatDateInput = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  };

  const handleValorKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
    valueCents: number
  ) => {
    e.preventDefault();

    if (e.key === 'Backspace') {
      updateParcela(index, { valorCentavos: Math.floor(valueCents / 10) });
      return;
    }

    if (e.key === 'Delete') {
      updateParcela(index, { valorCentavos: 0 });
      return;
    }

    const digit = parseInt(e.key);
    if (!isNaN(digit)) {
      const newValue = valueCents * 10 + digit;
      if (newValue <= 99999999) {
        updateParcela(index, { valorCentavos: newValue });
      }
    }
  };

  const focusEl = (id: string) =>
    setTimeout(() => document.getElementById(id)?.focus(), 10);

  // ── Validar e salvar ──────────────────────────────────────────────────────
  const handleSalvar = () => {
    if (!fornecedor.trim()) {
      setFornecedorError(true);
      alert(FORNECEDOR_REQUIRED_MSG);
      focusEl('input-fornecedor-compromisso');
      return;
    }
    setFornecedorError(false);

    if (modo === 'unico') {
      const trimmed = dataPrevista.trim();
      if (!trimmed || trimmed.length < 10) {
        alert('Informe a data prevista de pagamento para continuar.');
        focusEl('input-prevista-compromisso');
        return;
      }
      if (!parseDateBR(trimmed)) {
        alert('Data prevista inválida.');
        focusEl('input-prevista-compromisso');
        return;
      }
      if (!isPrevistaStrictlyAfterCompra(trimmed, dataCompraBR)) {
        alert('A data de vencimento deve ser posterior à data da compra.');
        focusEl('input-prevista-compromisso');
        return;
      }
      onConfirm(fornecedor.trim(), trimmed);
      return;
    }

    // Modo parcelado — validar parcelas
    const n = parseInt(numParcelasStr, 10);
    if (isNaN(n) || n < 2) {
      alert('Informe ao menos 2 parcelas.');
      focusEl('input-num-parcelas');
      return;
    }

    for (let i = 0; i < parcelas.length; i++) {
      const p = parcelas[i];
      const label = `Parcela ${i + 1}`;
      if (p.valorCentavos <= 0) {
        alert(`${label}: informe um valor maior que zero.`);
        return;
      }
      const trimmed = p.dataVencimento.trim();
      if (!trimmed || trimmed.length < 10 || !parseDateBR(trimmed)) {
        alert(`${label}: informe uma data de vencimento válida (dd/mm/aaaa).`);
        return;
      }
    }

    // Validar soma (tolerância ±5%)
    const somaParcelasCents = parcelas.reduce((s, p) => s + p.valorCentavos, 0);
    if (totalCents > 0) {
      const ratio = somaParcelasCents / totalCents;
      if (ratio < 0.95 || ratio > 1.05) {
        const ok = window.confirm(
          `A soma das parcelas (${(somaParcelasCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) difere do total dos itens (${(totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) em mais de 5%.\n\nDeseja salvar mesmo assim?`
        );
        if (!ok) return;
      }
    }

    const parcelasPayload: SaveCompromissoParcela[] = parcelas.map((p, i) => ({
      numeroParcela: i + 1,
      totalParcelas: parcelas.length,
      valorCentavos: p.valorCentavos,
      dataVencimentoBR: p.dataVencimento.trim(),
    }));

    onConfirm(fornecedor.trim(), parcelas[0].dataVencimento.trim(), parcelasPayload);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-sheet__handle" />
          <div className="modal-sheet__title">Salvar Compromisso</div>

          {/* Seletor de modo */}
          <div className="payment-tabs" style={{ marginBottom: 16 }}>
            <div className="payment-tabs__row">
              <button
                type="button"
                className={modo === 'unico' ? 'payment-tab payment-tab--active' : 'payment-tab payment-tab--inactive'}
                onClick={() => setModo('unico')}
              >
                Compromisso único
              </button>
              <button
                type="button"
                className={modo === 'parcelado' ? 'payment-tab payment-tab--active' : 'payment-tab payment-tab--inactive'}
                onClick={() => setModo('parcelado')}
              >
                Parcelas a pagar
              </button>
            </div>
          </div>

          {/* Campo fornecedor (compartilhado) */}
          <FloatingInput
            id="input-fornecedor-compromisso"
            label="Fornecedor / Local do serviço"
            value={fornecedor}
            onChange={(v) => {
              setFornecedor(v);
              setFornecedorError(false);
            }}
            bgVariant="surface"
            autoComplete="off"
            autocompleteSearch={(q) => searchFornecedores(orgId, q)}
            showError={fornecedorError}
          />

          {/* ── Modo único ── */}
          {modo === 'unico' && (
            <div className="date-header__row" style={{ padding: '0 4px 16px' }}>
              <FloatingInput
                id="input-prevista-compromisso"
                label="Data prevista de pagamento"
                value={dataPrevista}
                onChange={(value) => setDataPrevista(formatDateInput(value))}
                inputMode="numeric"
                autoComplete="off"
                bgVariant="surface"
              />
              <button
                className="date-header__calendar-btn"
                onClick={() => setShowPickerUnico(true)}
                type="button"
                aria-label="Abrir calendário"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>
            </div>
          )}

          {/* ── Modo parcelado ── */}
          {modo === 'parcelado' && (
            <div style={{ marginBottom: 8 }}>
              {/* Número de parcelas */}
              <FloatingInput
                id="input-num-parcelas"
                label="Número de parcelas"
                value={numParcelasStr}
                onChange={handleNumParcelasChange}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                bgVariant="surface"
              />

              {/* Tabela de parcelas */}
              <div
                style={{
                  background: '#151515',
                  borderRadius: 14,
                  padding: '12px 16px',
                  border: '1px solid #222',
                  marginTop: 12,
                }}
              >
                {/* Cabeçalho */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 110px',
                    fontSize: 11,
                    color: '#888',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    paddingBottom: 8,
                    borderBottom: '1px solid #222',
                    marginBottom: 6,
                  }}
                >
                  <div>Parcela</div>
                  <div style={{ textAlign: 'right', paddingRight: 12 }}>Valor</div>
                  <div style={{ paddingLeft: 12 }}>Vencimento</div>
                </div>

                {/* Linhas */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {parcelas.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '60px 1fr 110px',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: i === parcelas.length - 1 ? 'none' : '1px solid #222',
                      }}
                    >
                      {/* Parcela (ex: 1/2) */}
                      <div
                        style={{
                          fontSize: 14,
                          color: '#888',
                          fontWeight: 500,
                        }}
                      >
                        {i + 1}/{parcelas.length}
                      </div>

                      {/* Valor */}
                      <div style={{ paddingRight: 12 }}>
                        <input
                          id={`input-parcela-valor-${i}`}
                          type="text"
                          value={formatCurrency(p.valorCentavos)}
                          onKeyDown={(e) => handleValorKeyDown(e, i, p.valorCentavos)}
                          onChange={() => {}}
                          inputMode="numeric"
                          autoComplete="off"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 500,
                            width: '100%',
                            padding: '4px 0',
                            textAlign: 'right',
                          }}
                        />
                      </div>

                      {/* Vencimento */}
                      <div
                        style={{
                          paddingLeft: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 4,
                        }}
                      >
                        <input
                          id={`input-parcela-data-${i}`}
                          type="text"
                          value={p.dataVencimento}
                          onChange={(e) => updateParcela(i, { dataVencimento: formatDateInput(e.target.value) })}
                          inputMode="numeric"
                          autoComplete="off"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#fff',
                            fontSize: 14,
                            width: '75px',
                            padding: '4px 0',
                          }}
                        />
                        <button
                          onClick={() => updateParcela(i, { showPicker: true })}
                          type="button"
                          aria-label={`Abrir calendário da parcela ${i + 1}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#888',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            marginRight: -4,
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Soma vs total */}
              {totalCents > 0 && (() => {
                const soma = parcelas.reduce((s, p) => s + p.valorCentavos, 0);
                const diff = soma - totalCents;
                const color = Math.abs(diff) > totalCents * 0.05 ? '#e07070' : '#888';
                return (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      color,
                      textAlign: 'right',
                      paddingRight: 4,
                      fontWeight: 500,
                    }}
                  >
                    Total parcelas:{' '}
                    {(soma / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    {' '}/ itens:{' '}
                    {(totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Botões */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '12px',
                background: 'transparent',
                border: '1px solid var(--border-medium)',
                borderRadius: 8,
                color: 'var(--text-inactive)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button className="btn-save-modal" onClick={handleSalvar} type="button">
              {modo === 'unico' ? 'Salvar compromisso' : `Salvar ${parcelas.length} parcelas`}
            </button>
          </div>
        </div>
      </div>

      {/* Date picker — modo único */}
      {showPickerUnico && (
        <DatePickerSheet
          key={`prevista-picker-${dataCompraBR}-${pickerSeedUnico}`}
          selectedDate={pickerSeedUnico}
          allowFutureDates
          disableDatesOnOrBeforeCompraBR={dataCompraBR}
          onSelect={(d) => {
            setDataPrevista(d);
            setShowPickerUnico(false);
          }}
          onClose={() => setShowPickerUnico(false)}
        />
      )}

      {/* Date pickers — parcelas */}
      {parcelas.map((p, i) =>
        p.showPicker ? (
          <DatePickerSheet
            key={`parcela-picker-${i}`}
            selectedDate={p.dataVencimento || fallbackPickerDateBR}
            allowFutureDates
            onSelect={(d) => {
              updateParcela(i, { dataVencimento: d, showPicker: false });
            }}
            onClose={() => updateParcela(i, { showPicker: false })}
          />
        ) : null
      )}
    </>
  );
};
