import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
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

type MonthGroup = {
  key: string;
  year: number;
  month: number;
  label: string;
  gastos: GastoRecord[];
  total: number;
  count: number;
};

type YearGroup = {
  year: number;
  total: number;
  months: MonthGroup[];
};

function getDateTime(gasto: GastoRecord): number {
  const [d, m, y] = gasto.dataCompra.split('/').map(Number);
  const dateTime = new Date(y, (m || 1) - 1, d || 1).getTime();
  const createdAtTime = new Date(gasto.createdAt).getTime();

  return Number.isNaN(createdAtTime) ? dateTime : createdAtTime;
}

export const MeusGastos: React.FC<MeusGastosProps> = ({
  onSelectGasto,
  onNewGasto,
  refreshKey,
}) => {
  const [gastos, setGastos] = useState<GastoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

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

  // Group by year -> month
  const grouped = useMemo<YearGroup[]>(() => {
    const monthMap = new Map<string, MonthGroup>();

    filtered.forEach((gasto) => {
      const [, monthStr, yearStr] = gasto.dataCompra.split('/');
      const month = Number(monthStr);
      const year = Number(yearStr);
      const key = `${year}-${String(month).padStart(2, '0')}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          key,
          year,
          month,
          label: MONTH_NAMES[month - 1],
          gastos: [],
          total: 0,
          count: 0,
        });
      }

      const monthGroup = monthMap.get(key)!;
      monthGroup.gastos.push(gasto);
      monthGroup.total += gasto.total;
      monthGroup.count += 1;
    });

    const months = [...monthMap.values()]
      .map((monthGroup) => ({
        ...monthGroup,
        gastos: [...monthGroup.gastos].sort((a, b) => getDateTime(b) - getDateTime(a)),
      }))
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));

    const yearMap = new Map<number, MonthGroup[]>();
    months.forEach((monthGroup) => {
      if (!yearMap.has(monthGroup.year)) yearMap.set(monthGroup.year, []);
      yearMap.get(monthGroup.year)!.push(monthGroup);
    });

    return [...yearMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, monthsInYear]) => ({
        year,
        total: monthsInYear.reduce((sum, monthGroup) => sum + monthGroup.total, 0),
        months: monthsInYear,
      }));
  }, [filtered]);

  const monthKeysInOrder = useMemo(
    () => grouped.flatMap((yearGroup) => yearGroup.months.map((month) => month.key)),
    [grouped]
  );

  useEffect(() => {
    if (monthKeysInOrder.length === 0) {
      setExpandedMonths({});
      return;
    }

    if (search.trim()) {
      const nextExpanded = monthKeysInOrder.reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = true;
        return acc;
      }, {});
      setExpandedMonths(nextExpanded);
      return;
    }

    setExpandedMonths((prev) => {
      const nextExpanded: Record<string, boolean> = {};

      monthKeysInOrder.forEach((key, index) => {
        if (typeof prev[key] === 'boolean') {
          nextExpanded[key] = prev[key];
          return;
        }
        nextExpanded[key] = index === 0;
      });

      return nextExpanded;
    });
  }, [monthKeysInOrder, search]);

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  return (
    <div className="app-container meus-gastos-screen" style={{ paddingBottom: 70 }}>
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
        grouped.map((yearGroup) => (
          <div key={yearGroup.year}>
            <div className="meus-gastos-year">
              <span>{yearGroup.year}</span>
              <span className="meus-gastos-year__total">{formatCurrency(yearGroup.total)}</span>
            </div>
            {yearGroup.months.map((monthGroup) => {
              const isExpanded = !!expandedMonths[monthGroup.key];
              return (
                <div key={monthGroup.key} className="meus-gastos-month-card">
                  <button
                    className={`meus-gastos-month-header ${isExpanded ? 'meus-gastos-month-header--expanded' : ''}`}
                    onClick={() => toggleMonth(monthGroup.key)}
                    type="button"
                  >
                    <div className="meus-gastos-month-header__left">
                      <span className="meus-gastos-month-header__title">{monthGroup.label}</span>
                      <span className="meus-gastos-month-header__count">
                        {monthGroup.count} {monthGroup.count === 1 ? 'gasto' : 'gastos'}
                      </span>
                    </div>
                    <div className="meus-gastos-month-header__right">
                      {!isExpanded && (
                        <span className="meus-gastos-month-header__total">
                          {formatCurrency(monthGroup.total)}
                        </span>
                      )}
                      <span className={`meus-gastos-month-header__icon ${isExpanded ? 'is-expanded' : ''}`}>
                        <ChevronDown size={16} />
                      </span>
                    </div>
                  </button>

                  {isExpanded && monthGroup.gastos.map((gasto) => (
                    <button
                      key={gasto.id}
                      className="gasto-card"
                      onClick={() => onSelectGasto(gasto)}
                      type="button"
                    >
                      <div className="gasto-card__top">
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
              );
            })}
          </div>
        ))
      )}
    </div>
  );
};
