import { useState, useEffect, useMemo } from 'react';
import { Plus, Search } from 'lucide-react';
import { fetchGastos } from '../lib/supabase';
import { formatCurrency } from '../utils';
import type { GastoRecord } from '../types';

interface MeusGastosProps {
  onSelectGasto: (gasto: GastoRecord) => void;
  onNewGasto: () => void;
  refreshKey: number;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MeusGastos: React.FC<MeusGastosProps> = ({
  onSelectGasto,
  onNewGasto,
  refreshKey,
}) => {
  const [gastos, setGastos] = useState<GastoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchGastos().then((data) => {
      setGastos(data);
      setLoading(false);
    });
  }, [refreshKey]);

  // Filter by search (fornecedor OR item descriptions)
  const filtered = useMemo(() => {
    if (!search.trim()) return gastos;
    const q = search.toLowerCase();
    return gastos.filter((g) => {
      if (g.fornecedor.toLowerCase().includes(q)) return true;
      return g.items.some((item) => item.descricao.toLowerCase().includes(q));
    });
  }, [gastos, search]);

  // Summary
  const totalSum = useMemo(() => filtered.reduce((s, g) => s + g.total, 0), [filtered]);
  const count = filtered.length;

  // Group by month
  const grouped = useMemo(() => {
    const groups: { key: string; label: string; gastos: GastoRecord[] }[] = [];
    const map = new Map<string, GastoRecord[]>();

    filtered.forEach((g) => {
      const [, m, y] = g.dataCompra.split('/');
      const key = `${y}-${m}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });

    map.forEach((list, key) => {
      const [y, m] = key.split('-');
      groups.push({
        key,
        label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`,
        gastos: list,
      });
    });

    // Sort by key descending (newest month first)
    groups.sort((a, b) => b.key.localeCompare(a.key));
    return groups;
  }, [filtered]);

  return (
    <div className="app-container" style={{ paddingBottom: 70 }}>
      {/* Header */}
      <div className="meus-gastos-header">
        <h1 className="meus-gastos-header__title">Meus Gastos</h1>
        <button className="meus-gastos-header__new" onClick={onNewGasto} type="button">
          <Plus size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="meus-gastos-search">
        <Search size={14} className="meus-gastos-search__icon" />
        <input
          type="text"
          placeholder="Buscar por fornecedor ou item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="meus-gastos-search__input"
        />
      </div>

      {/* Summary */}
      <div className="meus-gastos-summary">
        <span>{count} {count === 1 ? 'gasto' : 'gastos'}</span>
        <span className="meus-gastos-summary__total">{formatCurrency(totalSum)}</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="meus-gastos-empty">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="meus-gastos-empty">
          {search ? 'Nenhum gasto encontrado' : 'Nenhum gasto registrado'}
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.key}>
            <div className="meus-gastos-month">{group.label}</div>
            {group.gastos.map((gasto) => (
              <button
                key={gasto.id}
                className="gasto-card"
                onClick={() => onSelectGasto(gasto)}
                type="button"
              >
                <div className="gasto-card__top">
                  <span className="gasto-card__seq">#{gasto.seq}</span>
                  <span className="gasto-card__fornecedor">
                    {gasto.fornecedor || 'Sem fornecedor'}
                  </span>
                  <span className="gasto-card__total">{formatCurrency(gasto.total)}</span>
                </div>
                <div className="gasto-card__bottom">
                  <span className="gasto-card__date">{gasto.dataCompra}</span>
                  <span className="gasto-card__meio">{gasto.meioPagamento}</span>
                </div>
              </button>
            ))}
          </div>
        ))
      )}
    </div>
  );
};
