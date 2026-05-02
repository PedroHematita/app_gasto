import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { fetchGastos, fetchCompromissosAtivos, fetchGastosPerenesAtivos } from '../lib/supabase';
import {
  formatCurrency,
  compromissoDisplayTitle,
  daysOverdueFromPrevistaBR,
  compareDateBR,
  labelPeriodicidade,
  formatVencimentoGastoPerene,
} from '../utils';
import type { GastoRecord, CompromissoRecord, GastoPereneRecord } from '../types';

interface MeusGastosProps {
  onSelectGasto: (gasto: GastoRecord) => void;
  onSelectCompromisso: (c: CompromissoRecord) => void;
  onSelectGastoPerene: (gp: GastoPereneRecord) => void;
  onNewGasto: () => void;
  onNovoGastoPerene: () => void;
  refreshKey: number;
  focusCompromissosNonce: number;
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

function matchesSearchCompromisso(c: CompromissoRecord, q: string): boolean {
  const nq = q.toLowerCase();
  if (c.fornecedor.toLowerCase().includes(nq)) return true;
  return c.items.some((item) => item.descricao.toLowerCase().includes(nq));
}

function matchesSearchGastoPerene(gp: GastoPereneRecord, q: string): boolean {
  return gp.fornecedor.toLowerCase().includes(q.toLowerCase());
}

function sortCompromissosSubset(list: CompromissoRecord[]): CompromissoRecord[] {
  const vencidos = list
    .filter((c) => c.status === 'vencido')
    .sort((a, b) => compareDateBR(a.dataPrevistaPagamento, b.dataPrevistaPagamento));
  const pendentes = list
    .filter((c) => c.status === 'pendente')
    .sort((a, b) => compareDateBR(a.dataPrevistaPagamento, b.dataPrevistaPagamento));
  return [...vencidos, ...pendentes];
}

export const MeusGastos: React.FC<MeusGastosProps> = ({
  onSelectGasto,
  onSelectCompromisso,
  onSelectGastoPerene,
  onNewGasto,
  onNovoGastoPerene,
  refreshKey,
  focusCompromissosNonce,
}) => {
  const [gastos, setGastos] = useState<GastoRecord[]>([]);
  const [compromissosAtivos, setCompromissosAtivos] = useState<CompromissoRecord[]>([]);
  const [gastosPerenesAtivos, setGastosPerenesAtivos] = useState<GastoPereneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const compromissosSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchGastos(), fetchCompromissosAtivos(), fetchGastosPerenesAtivos()])
      .then(([g, c, p]) => {
        setGastos(g);
        setCompromissosAtivos(c);
        setGastosPerenesAtivos(p);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  useEffect(() => {
    if (focusCompromissosNonce > 0 && compromissosSectionRef.current) {
      compromissosSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusCompromissosNonce]);

  const filteredGastos = useMemo(() => {
    if (!search.trim()) return gastos;
    const q = search.toLowerCase();
    return gastos.filter((g) => {
      if (g.fornecedor.toLowerCase().includes(q)) return true;
      return g.items.some((item) => item.descricao.toLowerCase().includes(q));
    });
  }, [gastos, search]);

  const filteredCompromissos = useMemo(() => {
    if (!search.trim()) return compromissosAtivos;
    const q = search.trim();
    return sortCompromissosSubset(
      compromissosAtivos.filter((c) => matchesSearchCompromisso(c, q))
    );
  }, [compromissosAtivos, search]);

  const filteredGastosPerenes = useMemo(() => {
    if (!search.trim()) return gastosPerenesAtivos;
    const q = search.trim();
    return gastosPerenesAtivos.filter((gp) => matchesSearchGastoPerene(gp, q));
  }, [gastosPerenesAtivos, search]);

  const compromissosParaExibir = search.trim() ? filteredCompromissos : compromissosAtivos;
  const gastosPerenesParaExibir = search.trim() ? filteredGastosPerenes : gastosPerenesAtivos;

  const totalPagoSum = useMemo(() => {
    if (search.trim()) return filteredGastos.reduce((s, g) => s + g.total, 0);
    return gastos.reduce((s, g) => s + g.total, 0);
  }, [gastos, filteredGastos, search]);

  const totalComprometido = useMemo(
    () => compromissosParaExibir.reduce((s, c) => s + c.total, 0),
    [compromissosParaExibir]
  );

  const countGastosExibicao = search.trim() ? filteredGastos.length : gastos.length;

  const grouped = useMemo<YearGroup[]>(() => {
    const monthMap = new Map<string, MonthGroup>();

    filteredGastos.forEach((gasto) => {
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
  }, [filteredGastos]);

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

  const renderGastosPerenesSection = () => {
    if (gastosPerenesParaExibir.length === 0) return null;

    return (
      <div className="gastos-perenes-section">
        <h2 className="compromissos-section__title">Gastos perenes</h2>
        {gastosPerenesParaExibir.map((gp) => (
          <button
            key={gp.id}
            type="button"
            className="gasto-perene-card"
            onClick={() => onSelectGastoPerene(gp)}
          >
            <div className="gasto-perene-card__top">
              <span className="gasto-perene-card__title">{gp.fornecedor}</span>
              <span className="gasto-perene-card__total">{formatCurrency(gp.valorPrevistoCents)}</span>
            </div>
            <div className="gasto-perene-card__bottom">
              <span>{labelPeriodicidade(gp.periodicidade)}</span>
              <span>{formatVencimentoGastoPerene(gp)}</span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderCompromissosSection = () => {
    if (compromissosParaExibir.length === 0) return null;

    return (
      <div className="compromissos-section" ref={compromissosSectionRef}>
        <div className="compromissos-section__header">
          <h2 className="compromissos-section__title">Compromissos pendentes</h2>
          <div className="compromissos-section__subtotal">
            <span className="compromissos-section__subtotal-label">Total comprometido</span>
            <span className="compromissos-section__subtotal-value">{formatCurrency(totalComprometido)}</span>
          </div>
        </div>
        {compromissosParaExibir.map((c) => {
          const diasVenc = daysOverdueFromPrevistaBR(c.dataPrevistaPagamento);
          return (
            <button
              key={c.id}
              type="button"
              className="compromisso-card"
              onClick={() => onSelectCompromisso(c)}
            >
              <div className="compromisso-card__top">
                <span className="compromisso-card__title">{compromissoDisplayTitle(c)}</span>
                <span className="compromisso-card__total">{formatCurrency(c.total)}</span>
              </div>
              <div className="compromisso-card__bottom">
                <span className="compromisso-card__date">{c.dataPrevistaPagamento}</span>
                {c.status === 'vencido' ? (
                  <span className="compromisso-card__status compromisso-card__status--danger">
                    vencido há {diasVenc} dia{diasVenc === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span className="compromisso-card__status compromisso-card__status--purple">
                    pendente
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderGastosGrouped = () => {
    if (filteredGastos.length === 0) {
      return (
        <div className="meus-gastos-empty">
          {search.trim() ? 'Nenhum gasto encontrado nesta busca' : ''}
        </div>
      );
    }

    return grouped.map((yearGroup) => (
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
    ));
  };

  const buscaAtiva = !!search.trim();
  const nenhumResultadoBusca =
    buscaAtiva &&
    filteredGastos.length === 0 &&
    filteredCompromissos.length === 0 &&
    filteredGastosPerenes.length === 0;
  const listaGeralVazia =
    !buscaAtiva &&
    gastos.length === 0 &&
    compromissosAtivos.length === 0 &&
    gastosPerenesAtivos.length === 0;

  return (
    <div className="app-container meus-gastos-screen" style={{ paddingBottom: 70 }}>
      <div className="meus-gastos-header">
        <h1 className="meus-gastos-header__title">Meus Gastos</h1>
        <button className="meus-gastos-header__new" onClick={onNewGasto} type="button">
          <Plus size={18} />
        </button>
      </div>

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

      <div className="meus-gastos-perene-cta">
        <button type="button" className="meus-gastos-perene-cta__btn" onClick={onNovoGastoPerene}>
          Novo gasto perene
        </button>
      </div>

      {loading ? (
        <div className="meus-gastos-empty">Carregando...</div>
      ) : listaGeralVazia ? (
        <div className="meus-gastos-empty">Nenhum gasto registrado</div>
      ) : buscaAtiva ? (
        <>
          {nenhumResultadoBusca ? (
            <div className="meus-gastos-empty">Nenhum resultado para esta busca</div>
          ) : (
            <>
              {filteredGastosPerenes.length > 0 && (
                <div className="meus-gastos-search-block">
                  <h3 className="meus-gastos-search-block__title">Gastos perenes</h3>
                  {filteredGastosPerenes.map((gp) => (
                    <button
                      key={gp.id}
                      type="button"
                      className="gasto-perene-card"
                      onClick={() => onSelectGastoPerene(gp)}
                    >
                      <div className="gasto-perene-card__top">
                        <span className="gasto-perene-card__title">{gp.fornecedor}</span>
                        <span className="gasto-perene-card__total">
                          {formatCurrency(gp.valorPrevistoCents)}
                        </span>
                      </div>
                      <div className="gasto-perene-card__bottom">
                        <span>{labelPeriodicidade(gp.periodicidade)}</span>
                        <span>{formatVencimentoGastoPerene(gp)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {filteredCompromissos.length > 0 && (
                <div className="meus-gastos-search-block meus-gastos-search-block--compromissos">
                  <h3 className="meus-gastos-search-block__title">Compromissos pendentes</h3>
                  <div className="meus-gastos-summary meus-gastos-summary--stack">
                    <span>
                      {filteredCompromissos.length}{' '}
                      {filteredCompromissos.length === 1 ? 'compromisso' : 'compromissos'}
                    </span>
                    <div className="meus-gastos-summary__paid-row">
                      <span className="meus-gastos-summary__paid-label">Total comprometido</span>
                      <span className="meus-gastos-summary__total compromissos-money">
                        {formatCurrency(
                          filteredCompromissos.reduce((s, c) => s + c.total, 0)
                        )}
                      </span>
                    </div>
                  </div>
                  {filteredCompromissos.map((c) => {
                    const diasVenc = daysOverdueFromPrevistaBR(c.dataPrevistaPagamento);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="compromisso-card"
                        onClick={() => onSelectCompromisso(c)}
                      >
                        <div className="compromisso-card__top">
                          <span className="compromisso-card__title">{compromissoDisplayTitle(c)}</span>
                          <span className="compromisso-card__total">{formatCurrency(c.total)}</span>
                        </div>
                        <div className="compromisso-card__bottom">
                          <span className="compromisso-card__date">{c.dataPrevistaPagamento}</span>
                          {c.status === 'vencido' ? (
                            <span className="compromisso-card__status compromisso-card__status--danger">
                              vencido há {diasVenc} dia{diasVenc === 1 ? '' : 's'}
                            </span>
                          ) : (
                            <span className="compromisso-card__status compromisso-card__status--purple">
                              pendente
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="meus-gastos-search-block">
                <h3 className="meus-gastos-search-block__title">Gastos realizados</h3>
                <div className="meus-gastos-summary meus-gastos-summary--stack">
                  <span>
                    {filteredGastos.length}{' '}
                    {filteredGastos.length === 1 ? 'gasto' : 'gastos'}
                  </span>
                  <div className="meus-gastos-summary__paid-row">
                    <span className="meus-gastos-summary__paid-label">Total pago</span>
                    <span className="meus-gastos-summary__total">
                      {formatCurrency(
                        filteredGastos.reduce((s, g) => s + g.total, 0)
                      )}
                    </span>
                  </div>
                </div>
                {renderGastosGrouped()}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="meus-gastos-summary meus-gastos-summary--stack">
            <span>
              {countGastosExibicao} {countGastosExibicao === 1 ? 'gasto' : 'gastos'}
            </span>
            <div className="meus-gastos-summary__paid-row">
              <span className="meus-gastos-summary__paid-label">Total pago</span>
              <span className="meus-gastos-summary__total">{formatCurrency(totalPagoSum)}</span>
            </div>
          </div>

          {renderGastosPerenesSection()}

          {renderCompromissosSection()}

          {gastos.length === 0 ? (
            <div className="meus-gastos-empty meus-gastos-empty--soft">
              Nenhum gasto quitado registrado ainda
            </div>
          ) : (
            renderGastosGrouped()
          )}
        </>
      )}
    </div>
  );
};
