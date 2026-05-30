import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronUp, Plus, Search } from 'lucide-react';
import { ScreenHeader, ScreenHeaderIconButton } from './ScreenHeader';
import { LogoutButton } from './LogoutButton';
import { fetchGastos, fetchCompromissosAtivos, fetchGastosPerenesAtivos } from '../lib/supabase';
import {
  formatCurrency,
  formatDateBR,
  compromissoDisplayTitle,
  compromissoUrgencyBadgeFromDataBR,
  compareDateBR,
  labelPeriodicidade,
  gastoPereneToPeriodInput,
  isGastoPereneEligibleForForecast,
  startOfDayLocal,
} from '../utils';
import type { GastoRecord, CompromissoRecord, GastoPereneRecord } from '../types';
import { proximoVencimentoEmOuDepoisDeHoje, vencimentosPereneNaJanela } from '../lib/gastosPerenePeriods';
import {
  consolidarGastosFuturos,
  filterAnosFuturosPorBusca,
  type LinhaGastoFuturo,
} from '../lib/gastosFuturosConsolidacao';
import { meusGastosSectionCollapse } from '../meusGastosSectionCollapse';
import { meusGastosFuturosCollapse } from '../meusGastosFuturosCollapse';
import {
  meusGastosFuturosIncludeRealizados,
  setMeusGastosFuturosIncludeRealizados,
} from '../meusGastosFuturosIncludeRealizados';
import {
  meusGastosPereneForecastWindow,
  setMeusGastosPereneForecastWindowDays,
  type PereneForecastWindowDays,
} from '../meusGastosPereneForecastWindow';

interface MeusGastosProps {
  orgId: string;
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
  orgId,
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
  const [, setCollapseTick] = useState(0);
  const [forecastWindowTick, setForecastWindowTick] = useState(0);
  const [futurosUiTick, setFuturosUiTick] = useState(0);
  const [expandedFuturosMonths, setExpandedFuturosMonths] = useState<Record<string, boolean>>({});
  const compromissosSectionRef = useRef<HTMLDivElement>(null);

  const hasAutoCollapsedRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    hasAutoCollapsedRef.current = false;
    Promise.all([fetchGastos(orgId), fetchCompromissosAtivos(orgId), fetchGastosPerenesAtivos(orgId)])
      .then(([g, c, p]) => {
        setGastos(g);
        setCompromissosAtivos(c);
        setGastosPerenesAtivos(p);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refreshKey, orgId]);

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

  const buscaAtiva = !!search.trim();

  const displayPerenesExpanded =
    buscaAtiva && filteredGastosPerenes.length > 0
      ? true
      : meusGastosSectionCollapse.perenesExpanded;

  const displayCompromissosExpanded =
    buscaAtiva && filteredCompromissos.length > 0
      ? true
      : meusGastosSectionCollapse.compromissosExpanded;

  const togglePerenesHeader = () => {
    if (buscaAtiva && filteredGastosPerenes.length > 0) return;
    meusGastosSectionCollapse.perenesExpanded = !meusGastosSectionCollapse.perenesExpanded;
    setCollapseTick((t) => t + 1);
  };

  const toggleCompromissosHeader = () => {
    if (buscaAtiva && filteredCompromissos.length > 0) return;
    meusGastosSectionCollapse.compromissosExpanded = !meusGastosSectionCollapse.compromissosExpanded;
    setCollapseTick((t) => t + 1);
  };

  const forecastWindowDays = meusGastosPereneForecastWindow.windowDays;

  const selectForecastWindow = (d: PereneForecastWindowDays) => {
    setMeusGastosPereneForecastWindowDays(d);
    setForecastWindowTick((t) => t + 1);
  };

  const pereneForecast = useMemo(() => {
    const today = startOfDayLocal(new Date());
    const days = meusGastosPereneForecastWindow.windowDays;
    let sumCents = 0;
    const byId = new Map<
      string,
      { proximo: Date | null; vencimentosNaJanela: number; subtotalCents: number }
    >();

    for (const gp of gastosPerenesParaExibir) {
      if (!isGastoPereneEligibleForForecast(gp, today)) {
        byId.set(gp.id, { proximo: null, vencimentosNaJanela: 0, subtotalCents: 0 });
        continue;
      }
      const input = gastoPereneToPeriodInput(gp);
      if (!input) {
        byId.set(gp.id, { proximo: null, vencimentosNaJanela: 0, subtotalCents: 0 });
        continue;
      }
      const vencimentos = vencimentosPereneNaJanela(input, today, days);
      const k = vencimentos.length;
      const subtotalCents = gp.valorPrevistoCents * k;
      sumCents += subtotalCents;
      const proximo = proximoVencimentoEmOuDepoisDeHoje(input, today);
      byId.set(gp.id, { proximo, vencimentosNaJanela: k, subtotalCents });
    }

    return { sumCents, byId };
  }, [gastosPerenesParaExibir, forecastWindowTick, refreshKey]);

  const totalPagoSum = useMemo(() => {
    if (search.trim()) return filteredGastos.reduce((s, g) => s + g.total, 0);
    return gastos.reduce((s, g) => s + g.total, 0);
  }, [gastos, filteredGastos, search]);



  const countGastosExibicao = search.trim() ? filteredGastos.length : gastos.length;

  const includeRealizadosFuturos = meusGastosFuturosIncludeRealizados.include;

  const gastosFuturosAnosRaw = useMemo(
    () =>
      consolidarGastosFuturos({
        hoje: startOfDayLocal(new Date()),
        gastosPerenes: gastosPerenesAtivos,
        compromissos: compromissosAtivos,
        gastos,
        incluirRealizados: includeRealizadosFuturos,
      }),
    [gastosPerenesAtivos, compromissosAtivos, gastos, includeRealizadosFuturos, refreshKey, futurosUiTick]
  );

  const gastosFuturosAnos = useMemo(
    () => filterAnosFuturosPorBusca(gastosFuturosAnosRaw, search),
    [gastosFuturosAnosRaw, search]
  );

  const futurosMonthKeysInOrder = useMemo(
    () => gastosFuturosAnos.flatMap((y) => y.months.map((m) => m.key)),
    [gastosFuturosAnos]
  );

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

  const collapseAllMeusGastos = () => {
    meusGastosSectionCollapse.perenesExpanded = false;
    meusGastosSectionCollapse.compromissosExpanded = false;
    meusGastosFuturosCollapse.sectionExpanded = false;
    gastosFuturosAnos.forEach((yg) => {
      meusGastosFuturosCollapse.expandedYears[String(yg.year)] = false;
    });
    setExpandedMonths(
      monthKeysInOrder.reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = false;
        return acc;
      }, {})
    );
    setExpandedFuturosMonths(
      futurosMonthKeysInOrder.reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = false;
        return acc;
      }, {})
    );
    setCollapseTick((t) => t + 1);
    setFuturosUiTick((t) => t + 1);
  };

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

  // Auto-recolher tudo ao montar a tela (após dados carregarem)
  useEffect(() => {
    if (!loading && !hasAutoCollapsedRef.current) {
      hasAutoCollapsedRef.current = true;
      collapseAllMeusGastos();
    }
  }, [loading]);

  useEffect(() => {
    if (futurosMonthKeysInOrder.length === 0) {
      setExpandedFuturosMonths({});
      return;
    }

    if (search.trim()) {
      const nextExpanded = futurosMonthKeysInOrder.reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = true;
        return acc;
      }, {});
      setExpandedFuturosMonths(nextExpanded);
      return;
    }

    setExpandedFuturosMonths((prev) => {
      const next: Record<string, boolean> = {};
      futurosMonthKeysInOrder.forEach((key, index) => {
        if (typeof prev[key] === 'boolean') {
          next[key] = prev[key];
          return;
        }
        next[key] = index === 0;
      });
      return next;
    });
  }, [futurosMonthKeysInOrder, search, refreshKey]);

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  const toggleFuturosMonth = (monthKey: string) => {
    setExpandedFuturosMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  useEffect(() => {
    if (gastosFuturosAnos.length === 0) return;
    let changed = false;
    gastosFuturosAnos.forEach((yearGroup, index) => {
      const key = String(yearGroup.year);
      if (typeof meusGastosFuturosCollapse.expandedYears[key] !== 'boolean') {
        meusGastosFuturosCollapse.expandedYears[key] = index === 0;
        changed = true;
      }
    });
    if (changed) setFuturosUiTick((t) => t + 1);
  }, [gastosFuturosAnos]);

  const toggleFuturosYear = (year: number) => {
    const key = String(year);
    const current = meusGastosFuturosCollapse.expandedYears[key];
    meusGastosFuturosCollapse.expandedYears[key] = !current;
    setFuturosUiTick((t) => t + 1);
  };

  const toggleFuturosSection = () => {
    meusGastosFuturosCollapse.sectionExpanded = !meusGastosFuturosCollapse.sectionExpanded;
    setFuturosUiTick((t) => t + 1);
  };

  const selectFuturosSoloFuturos = () => {
    setMeusGastosFuturosIncludeRealizados(false);
    setFuturosUiTick((t) => t + 1);
  };

  const selectFuturosIncluirRealizados = () => {
    setMeusGastosFuturosIncludeRealizados(true);
    setFuturosUiTick((t) => t + 1);
  };

  const handleFuturosLinhaClick = (linha: LinhaGastoFuturo) => {
    if (linha.origem === 'perene' && linha.gastoPereneId) {
      const gp = gastosPerenesAtivos.find((g) => g.id === linha.gastoPereneId);
      if (gp) onSelectGastoPerene(gp);
      return;
    }
    if ((linha.origem === 'rascunho' || linha.origem === 'parcela') && linha.compromissoId) {
      const c = compromissosAtivos.find((x) => x.id === linha.compromissoId);
      if (c) onSelectCompromisso(c);
      return;
    }
    if ((linha.origem === 'parcelado' || linha.origem === 'realizado') && linha.gastoId) {
      const g = gastos.find((x) => x.id === linha.gastoId);
      if (g) onSelectGasto(g);
    }
  };

  const futurosSectionExpanded = meusGastosFuturosCollapse.sectionExpanded;

  const renderGastosFuturosSection = () => {
    const totalItens = gastosFuturosAnos.reduce(
      (s, a) => s + a.months.reduce((t, m) => t + m.itens.length, 0),
      0
    );
    const totalFuturosCents = gastosFuturosAnos.reduce((s, a) => s + a.totalCents, 0);
    const isExpanded = futurosSectionExpanded;

    return (
      <div className="meus-gastos-month-card meus-gastos-status-card card-finance card-finance--section">
        <button
          type="button"
          className={`meus-gastos-month-header ${isExpanded ? 'meus-gastos-month-header--expanded' : ''}`}
          onClick={toggleFuturosSection}
        >
          <div className="meus-gastos-month-header__left">
            <span className="meus-gastos-month-header__title">Gastos futuros</span>
            <span className="meus-gastos-month-header__count">
              {totalItens} {totalItens === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <div className="meus-gastos-month-header__right">
            {!isExpanded && totalItens > 0 && (
              <span className="meus-gastos-month-header__total">{formatCurrency(totalFuturosCents)}</span>
            )}
            <span className={`meus-gastos-month-header__icon ${isExpanded ? 'is-expanded' : ''}`}>
              <ChevronDown size={16} />
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="payment-tabs meus-gastos-futuros-toggle">
            <div className="payment-tabs__row">
              <button
                type="button"
                className={
                  !includeRealizadosFuturos
                    ? 'payment-tab payment-tab--active'
                    : 'payment-tab payment-tab--inactive'
                }
                onClick={selectFuturosSoloFuturos}
              >
                Só futuros
              </button>
              <button
                type="button"
                className={
                  includeRealizadosFuturos
                    ? 'payment-tab payment-tab--active'
                    : 'payment-tab payment-tab--inactive'
                }
                onClick={selectFuturosIncluirRealizados}
              >
                Incluir realizados
              </button>
            </div>
          </div>
        )}

        {isExpanded && totalItens === 0 && (
          <div className="meus-gastos-empty meus-gastos-empty--soft" role="status">
            <span className="meus-gastos-empty__title">Nenhum lançamento futuro</span>
            <span className="meus-gastos-empty__hint">
              Nada previsto nos próximos 12 meses com os filtros atuais.
            </span>
          </div>
        )}

        {isExpanded &&
          gastosFuturosAnos.map((yearGroup) => (
            <div key={yearGroup.year}>
              <div className="meus-gastos-year meus-gastos-futuros-year">
                <button
                  type="button"
                  className={`meus-gastos-month-header meus-gastos-futuros-year-header ${meusGastosFuturosCollapse.expandedYears[String(yearGroup.year)] ? 'meus-gastos-month-header--expanded' : ''}`}
                  onClick={() => toggleFuturosYear(yearGroup.year)}
                >
                  <div className="meus-gastos-month-header__left">
                    <span className="meus-gastos-month-header__title meus-gastos-futuros-year-header__title">
                      {yearGroup.year}
                    </span>
                  </div>
                  <div className="meus-gastos-month-header__right">
                    <span className="meus-gastos-year__total">{formatCurrency(yearGroup.totalCents)}</span>
                    <span
                      className={`meus-gastos-month-header__icon ${meusGastosFuturosCollapse.expandedYears[String(yearGroup.year)] ? 'is-expanded' : ''}`}
                    >
                      <ChevronDown size={16} />
                    </span>
                  </div>
                </button>
              </div>
              {meusGastosFuturosCollapse.expandedYears[String(yearGroup.year)] &&
                yearGroup.months.map((monthGroup, monthIndex) => {
                const mesExpanded = !!expandedFuturosMonths[monthGroup.key];
                return (
                  <div
                    key={monthGroup.key}
                    className={`meus-gastos-month-card card-finance card-finance--section meus-gastos-futuros-month ${monthIndex === 0 ? 'meus-gastos-futuros-month--year-first' : ''} ${mesExpanded ? 'meus-gastos-futuros-month--expanded' : 'meus-gastos-futuros-month--collapsed'}`}
                  >
                    <button
                      type="button"
                      className={`meus-gastos-month-header ${mesExpanded ? 'meus-gastos-month-header--expanded' : ''}`}
                      onClick={() => toggleFuturosMonth(monthGroup.key)}
                    >
                      <div className="meus-gastos-month-header__left">
                        <span className="meus-gastos-month-header__title">{monthGroup.label}</span>
                        <span className="meus-gastos-month-header__count">
                          {monthGroup.itens.length}{' '}
                          {monthGroup.itens.length === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                      <div className="meus-gastos-month-header__right">
                        {!mesExpanded && (
                          <span className="meus-gastos-month-header__total">
                            {formatCurrency(monthGroup.totalCents)}
                          </span>
                        )}
                        <span className={`meus-gastos-month-header__icon ${mesExpanded ? 'is-expanded' : ''}`}>
                          <ChevronDown size={16} />
                        </span>
                      </div>
                    </button>

                    {mesExpanded &&
                      monthGroup.itens.map((linha) => (
                        <button
                          key={linha.id}
                          type="button"
                          className="gasto-card gasto-card--futuro-linha card-finance__item card-finance--clickable card-finance--nested meus-gastos-futuros-item"
                          onClick={() => handleFuturosLinhaClick(linha)}
                        >
                          <div className="gasto-card__row">
                            <div className="gasto-card__meta">
                              <span className="gasto-card__fornecedor">{linha.titulo}</span>
                              <span className="gasto-card__date">{formatDateBR(linha.dataRef)}</span>
                            </div>
                            <div className="gasto-card__value-col">
                              <span className="gasto-card__total">{formatCurrency(linha.valorCents)}</span>
                              <span
                                className={`gasto-futuro-origem-badge gasto-futuro-origem-badge--${linha.origem}`}
                              >
                                {linha.origem}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          ))}
      </div>
    );
  };

  const renderGastosPerenesSection = () => {
    if (gastosPerenesParaExibir.length === 0) return null;

    const n = gastosPerenesParaExibir.length;
    const isExpanded = displayPerenesExpanded;
    const { sumCents, byId } = pereneForecast;

    return (
      <div className="meus-gastos-month-card meus-gastos-status-card card-finance card-finance--section">
        <button
          type="button"
          className={`meus-gastos-month-header ${isExpanded ? 'meus-gastos-month-header--expanded' : ''}`}
          onClick={togglePerenesHeader}
        >
          <div className="meus-gastos-month-header__left">
            <span className="meus-gastos-month-header__title">Gastos perenes</span>
            <span className="meus-gastos-month-header__count">
              {n} {n === 1 ? 'gasto perene' : 'gastos perenes'}
            </span>
          </div>
          <div className="meus-gastos-month-header__right">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 2,
              }}
            >
              <span className="meus-gastos-month-header__count">
                Próx. {forecastWindowDays} dias:
              </span>
              <span className="meus-gastos-month-header__total">
                {sumCents > 0 ? formatCurrency(sumCents) : 'nenhum vencimento'}
              </span>
            </div>
            <span className={`meus-gastos-month-header__icon ${isExpanded ? 'is-expanded' : ''}`}>
              <ChevronDown size={16} />
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="payment-tabs meus-gastos-perene-window-tabs">
            <div className="payment-tabs__row">
              {([30, 60, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={
                    forecastWindowDays === d ? 'payment-tab payment-tab--active' : 'payment-tab payment-tab--inactive'
                  }
                  onClick={() => selectForecastWindow(d)}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </div>
        )}

        {isExpanded &&
          gastosPerenesParaExibir.map((gp) => {
            const meta = byId.get(gp.id);
            const proximo = meta?.proximo ?? null;
            const k = meta?.vencimentosNaJanela ?? 0;
            const subtotalCents = meta?.subtotalCents ?? 0;
            const vLabel = k === 1 ? '1 vencimento' : `${k} vencimentos`;
            return (
              <button
                key={gp.id}
                type="button"
                className="gasto-card card-finance__item card-finance--clickable"
                onClick={() => onSelectGastoPerene(gp)}
              >
                <div className="gasto-card__top">
                  <span className="gasto-card__fornecedor">{gp.fornecedor}</span>
                  <span className="gasto-card__total">{formatCurrency(gp.valorPrevistoCents)}</span>
                </div>
                <div className="gasto-card__perene-line">
                  <span className="gasto-card__perene-line-text">
                    {labelPeriodicidade(gp.periodicidade)} · Próximo:{' '}
                    {proximo ? formatDateBR(proximo) : '—'}
                  </span>
                </div>
                <div className="gasto-card__perene-summary">
                  {vLabel} · Subtotal: {formatCurrency(subtotalCents)}
                </div>
              </button>
            );
          })}
      </div>
    );
  };

  const renderCompromissosSection = () => {
    if (compromissosParaExibir.length === 0) return null;

    // Separar compromissos únicos de parcelados
    const unicos = compromissosParaExibir.filter((c) => c.tipo !== 'parcelado');
    const parcelados = compromissosParaExibir.filter((c) => c.tipo === 'parcelado');

    // Gerar lista plana de parcelas pendentes a partir dos compromissos parcelados
    const parcelasFlat = parcelados.flatMap((c) =>
      (c.parcelas ?? [])
        .filter((p) => p.status === 'pendente' || p.status === 'vencido')
        .map((p) => ({ parcela: p, compromisso: c }))
    );

    const totalUnicosCents = unicos.reduce((s, c) => s + c.total, 0);
    const totalParcelasCents = parcelasFlat.reduce((s, { parcela }) => s + parcela.valorCentavos, 0);
    const totalComprometidoLocal = totalUnicosCents + totalParcelasCents;

    // Total de "itens" para o cabeçalho da seção
    const nTotal = unicos.length + parcelasFlat.length;
    const showSubtitles = unicos.length > 0 && parcelasFlat.length > 0;
    const isExpanded = displayCompromissosExpanded;

    return (
      <div className="meus-gastos-month-card meus-gastos-status-card card-finance card-finance--section" ref={compromissosSectionRef}>
        <button
          type="button"
          className={`meus-gastos-month-header ${isExpanded ? 'meus-gastos-month-header--expanded' : ''}`}
          onClick={toggleCompromissosHeader}
        >
          <div className="meus-gastos-month-header__left">
            <span className="meus-gastos-month-header__title">Compromissos pendentes</span>
            <span className="meus-gastos-month-header__count">
              {nTotal} {nTotal === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <div className="meus-gastos-month-header__right">
            {!isExpanded && (
              <span className="meus-gastos-month-header__total">
                {formatCurrency(totalComprometidoLocal)}
              </span>
            )}
            <span className={`meus-gastos-month-header__icon ${isExpanded ? 'is-expanded' : ''}`}>
              <ChevronDown size={16} />
            </span>
          </div>
        </button>

        {isExpanded && (
          <>
            {/* ── Subgrupo: Compromissos únicos ── */}
            {unicos.length > 0 && (
              <>
                {showSubtitles && (
                  <div className="meus-gastos-sub-title">Compromissos únicos</div>
                )}
                {unicos.map((c) => {
                  const urgency = compromissoUrgencyBadgeFromDataBR(c.dataPrevistaPagamento);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="gasto-card gasto-card--compromisso-pendente card-finance__item card-finance--clickable"
                      onClick={() => onSelectCompromisso(c)}
                    >
                      <div className="gasto-card__row">
                        <div className="gasto-card__meta">
                          <span className="gasto-card__fornecedor">{compromissoDisplayTitle(c)}</span>
                          <span className="gasto-card__date">{c.dataPrevistaPagamento}</span>
                        </div>
                        <div className="gasto-card__value-col">
                          <span className="gasto-card__total">{formatCurrency(c.total)}</span>
                          <span
                            className={`compromisso-urgency-badge compromisso-urgency-badge--${urgency.level}`}
                          >
                            {urgency.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}

            {/* ── Subgrupo: Parcelas a pagar ── */}
            {parcelasFlat.length > 0 && (
              <>
                {showSubtitles && (
                  <div className="meus-gastos-sub-title meus-gastos-sub-title--separator">
                    Parcelas a pagar
                  </div>
                )}
                {parcelasFlat.map(({ parcela, compromisso }) => {
                  const urgency = compromissoUrgencyBadgeFromDataBR(parcela.dataVencimentoBR, {
                    feminine: true,
                  });
                  // Título: primeiro item dos itens do compromisso (descricao) ou fornecedor
                  const descricao =
                    compromisso.items[0]?.descricao || compromisso.fornecedor || 'Parcela';
                  return (
                    <button
                      key={parcela.id}
                      type="button"
                      className="gasto-card gasto-card--compromisso-pendente card-finance__item card-finance--clickable"
                      onClick={() => onSelectCompromisso(compromisso)}
                    >
                      <div className="gasto-card__row">
                        <div className="gasto-card__meta">
                          <span className="gasto-card__fornecedor">{descricao}</span>
                          <div className="gasto-card__meta-sub">
                            <span className="gasto-card__date">{parcela.dataVencimentoBR}</span>
                            <span className="gasto-card__meio">
                              Parcela {parcela.numeroParcela}/{parcela.totalParcelas}
                            </span>
                          </div>
                        </div>
                        <div className="gasto-card__value-col">
                          <span className="gasto-card__total">
                            {formatCurrency(parcela.valorCentavos)}
                          </span>
                          <span
                            className={`compromisso-urgency-badge compromisso-urgency-badge--${urgency.level}`}
                          >
                            {urgency.label}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    );
  };

  const renderGastosGrouped = () => {
    if (filteredGastos.length === 0) {
      if (!search.trim()) return null;
      return (
        <div className="meus-gastos-empty meus-gastos-empty--soft" role="status">
          <span className="meus-gastos-empty__title">Nenhum gasto realizado nesta busca</span>
          <span className="meus-gastos-empty__hint">
            Tente outro termo em fornecedor ou item.
          </span>
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
            <div key={monthGroup.key} className="meus-gastos-month-card card-finance card-finance--section">
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
                  className="gasto-card card-finance__item card-finance--clickable"
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

  const nenhumResultadoBusca =
    buscaAtiva &&
    filteredGastos.length === 0 &&
    filteredCompromissos.length === 0 &&
    filteredGastosPerenes.length === 0 &&
    gastosFuturosAnos.length === 0;
  const listaGeralVazia =
    !buscaAtiva &&
    gastos.length === 0 &&
    compromissosAtivos.length === 0 &&
    gastosPerenesAtivos.length === 0;

  return (
    <div className="app-container meus-gastos-screen" style={{ paddingBottom: 70 }}>
      <ScreenHeader
        title="Meus Gastos"
        action={
          <ScreenHeaderIconButton onClick={onNewGasto} ariaLabel="Novo gasto">
            <Plus size={18} aria-hidden />
          </ScreenHeaderIconButton>
        }
      />

      <div className="meus-gastos-search input-finance input-finance--search">
        <Search size={14} className="meus-gastos-search__icon" aria-hidden />
        <input
          type="text"
          placeholder="Buscar por fornecedor ou item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="meus-gastos-search__input input-finance__field"
          autoComplete="off"
          aria-label="Buscar por fornecedor ou item"
        />
      </div>

      <div className="meus-gastos-perene-cta">
        <button type="button" className="meus-gastos-perene-cta__btn" onClick={onNovoGastoPerene}>
          Novo gasto perene
        </button>
      </div>

      {loading ? (
        <div className="meus-gastos-empty" role="status" aria-live="polite">
          Carregando...
        </div>
      ) : listaGeralVazia ? (
        <div className="meus-gastos-empty meus-gastos-empty--hero" role="status">
          <span className="meus-gastos-empty__title">Nenhum gasto registrado</span>
          <span className="meus-gastos-empty__hint">
            Toque em + para lançar um gasto ou use &quot;Novo gasto perene&quot; para despesas recorrentes.
          </span>
        </div>
      ) : buscaAtiva ? (
        <>
          {nenhumResultadoBusca ? (
            <div className="meus-gastos-empty meus-gastos-empty--hero" role="status">
              <span className="meus-gastos-empty__title">Nenhum resultado</span>
              <span className="meus-gastos-empty__hint">
                Nada encontrado em gastos, compromissos, perenes ou futuros para esta busca.
              </span>
            </div>
          ) : (
            <>
              {renderGastosPerenesSection()}
              {renderCompromissosSection()}
              {renderGastosFuturosSection()}

              <div className="meus-gastos-search-block">
                <h3 className="meus-gastos-search-block__title">Gastos realizados</h3>
                <div className="meus-gastos-summary meus-gastos-summary--stack">
                  <span className="meus-gastos-summary__count">
                    {filteredGastos.length}{' '}
                    {filteredGastos.length === 1 ? 'gasto' : 'gastos'}
                  </span>
                  <div className="meus-gastos-summary__paid-row">
                    <span className="meus-gastos-summary__paid-label">Total pago</span>
                    <div className="meus-gastos-summary__paid-center">
                      <button
                        type="button"
                        className="meus-gastos-summary__toggle-all-btn"
                        onClick={collapseAllMeusGastos}
                        aria-label="Recolher todas as seções"
                      >
                        Recolher <ChevronUp size={14} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
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
            <span className="meus-gastos-summary__count">
              {countGastosExibicao} {countGastosExibicao === 1 ? 'gasto' : 'gastos'}
            </span>
            <div className="meus-gastos-summary__paid-row">
              <span className="meus-gastos-summary__paid-label">Total pago</span>
              <div className="meus-gastos-summary__paid-center">
                <button
                  type="button"
                  className="meus-gastos-summary__toggle-all-btn"
                  onClick={collapseAllMeusGastos}
                  aria-label="Recolher todas as seções"
                >
                  Recolher <ChevronUp size={14} strokeWidth={2} aria-hidden />
                </button>
              </div>
              <span className="meus-gastos-summary__total">{formatCurrency(totalPagoSum)}</span>
            </div>
          </div>

          {renderGastosPerenesSection()}

          {renderCompromissosSection()}

          {renderGastosFuturosSection()}

          {gastos.length === 0 ? (
            <div className="meus-gastos-empty meus-gastos-empty--soft" role="status">
              <span className="meus-gastos-empty__title">Nenhum gasto realizado</span>
              <span className="meus-gastos-empty__hint">
                Gastos quitados aparecem aqui agrupados por mês.
              </span>
            </div>
          ) : (
            renderGastosGrouped()
          )}
        </>
      )}

      <div className="screen-logout-discrete">
        <LogoutButton
          className="logout-button--discrete"
          onLogoutComplete={() => window.location.reload()}
        />
      </div>
    </div>
  );
};
