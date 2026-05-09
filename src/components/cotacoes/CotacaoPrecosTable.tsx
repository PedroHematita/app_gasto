import { useMemo, useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency } from '../../utils';
import { valorUnitarioCentavos, compareDataBR } from '../../lib/cotacoesDb';
import type { CotacaoPrecoRow } from '../../types';

type SortKey = 'data' | 'fornecedor' | 'valor';

interface CotacaoPrecosTableProps {
  rows: CotacaoPrecoRow[];
  quantidadeCotacao: number;
  onDelete: (id: string) => void;
}

function unitCents(row: CotacaoPrecoRow, qCot: number): number {
  return valorUnitarioCentavos(row.valorCentavos, qCot);
}

export function CotacaoPrecosTable({ rows, quantidadeCotacao, onDelete }: CotacaoPrecosTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('data');
  const [sortAsc, setSortAsc] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const swipeRef = useRef<{ id: string | null; startX: number }>({ id: null, startX: 0 });

  const menorUnit = useMemo(() => {
    if (rows.length === 0) return null;
    const units = rows.map((r) => unitCents(r, quantidadeCotacao));
    return Math.min(...units);
  }, [rows, quantidadeCotacao]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    const dir = sortAsc ? 1 : -1;
    copy.sort((a, b) => {
      if (sortKey === 'data') return compareDataBR(a.dataRegistroBR, b.dataRegistroBR) * dir;
      if (sortKey === 'fornecedor') return a.fornecedor.localeCompare(b.fornecedor, 'pt-BR') * dir;
      return (a.valorCentavos - b.valorCentavos) * dir;
    });
    return copy;
  }, [rows, sortKey, sortAsc]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc((v) => !v);
    else {
      setSortKey(k);
      setSortAsc(k === 'fornecedor');
    }
  };

  const Arrow = ({ active, up }: { active: boolean; up: boolean }) =>
    active ? <ChevronDown size={12} style={{ transform: up ? 'rotate(180deg)' : 'none', display: 'inline' }} /> : null;

  return (
    <div className="cotacao-table-wrap">
      <div className="ph-table-title">Registros</div>
      <div className="cotacao-table">
        <div className="cotacao-table__head">
          <button type="button" className="cotacao-table__th" onClick={() => toggleSort('data')}>
            Data <Arrow active={sortKey === 'data'} up={sortAsc} />
          </button>
          <button type="button" className="cotacao-table__th" onClick={() => toggleSort('fornecedor')}>
            Fornecedor <Arrow active={sortKey === 'fornecedor'} up={sortAsc} />
          </button>
          <button type="button" className="cotacao-table__th cotacao-table__th--right" onClick={() => toggleSort('valor')}>
            Valor <Arrow active={sortKey === 'valor'} up={sortAsc} />
          </button>
        </div>
        {sorted.map((r) => {
          const u = unitCents(r, quantidadeCotacao);
          const isMin = menorUnit != null && u === menorUnit;
          const open = swipeOpenId === r.id;
          return (
            <div key={r.id} className="cotacao-table__swipe-outer">
              <div
                className="cotacao-table__swipe-delete"
                role="presentation"
              >
                <button type="button" className="cotacao-table__delete-btn" onClick={() => setConfirmId(r.id)}>
                  Excluir
                </button>
              </div>
              <div
                className="cotacao-table__row-wrap"
                style={{ transform: open ? 'translateX(-72px)' : 'translateX(0)' }}
                onTouchStart={(e) => {
                  swipeRef.current = { id: r.id, startX: e.touches[0].clientX };
                }}
                onTouchEnd={(e) => {
                  const x = e.changedTouches[0].clientX;
                  const d = x - swipeRef.current.startX;
                  if (swipeRef.current.id !== r.id) return;
                  if (d < -40) setSwipeOpenId(r.id);
                  else if (d > 40) setSwipeOpenId(null);
                }}
              >
                <div className="ph-table-row cotacao-table__row">
                  <span className="ph-table-row__date">{r.dataRegistroBR}</span>
                  <span className="ph-table-row__fornecedor">
                    {isMin && <span title="Menor preço unitário">★ </span>}
                    {r.fornecedor || '—'}
                  </span>
                  <span className="ph-table-row__value">{formatCurrency(r.valorCentavos)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {confirmId && (
        <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={() => setConfirmId(null)}>
          <div className="modal-sheet price-history-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: 20, fontSize: 13, color: 'var(--text-primary)' }}>Excluir este registro de preço?</div>
            <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="btn-save-main"
                onClick={() => {
                  onDelete(confirmId);
                  setConfirmId(null);
                  setSwipeOpenId(null);
                }}
              >
                Excluir
              </button>
              <button
                type="button"
                style={{
                  padding: 12,
                  background: 'transparent',
                  border: '1px solid #333',
                  color: 'var(--text-inactive)',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
                onClick={() => setConfirmId(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
