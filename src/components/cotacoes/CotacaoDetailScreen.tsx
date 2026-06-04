import { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronLeft, Pencil, Plus, X } from 'lucide-react';
import {
  fetchCotacaoById,
  fetchPrecosByCotacaoId,
  deleteCotacaoPreco,
  statsPrecosUnitarios,
  valorUnitarioCentavos,
  compareDataBR,
} from '../../lib/cotacoesDb';
import type { CotacaoRecord, CotacaoPrecoRow } from '../../types';
import { formatCurrency } from '../../utils';
import { CotacaoLineChart, type CotacaoChartPoint } from './CotacaoLineChart';
import { CotacaoPrecosTable } from './CotacaoPrecosTable';
import { EditCotacaoSheet } from './EditCotacaoSheet';
import { AddPrecoSheet } from './AddPrecoSheet';
import { FloatingInput } from '../FloatingInput';

interface CotacaoDetailScreenProps {
  orgId: string;
  cotacaoId: string;
  refreshNonce: number;
  onBack: () => void;
  onChanged: () => void;
}

export function CotacaoDetailScreen({
  orgId,
  cotacaoId,
  refreshNonce,
  onBack,
  onChanged,
}: CotacaoDetailScreenProps) {
  const [cotacao, setCotacao] = useState<CotacaoRecord | null>(null);
  const [precos, setPrecos] = useState<CotacaoPrecoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterForn, setFilterForn] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showAddPreco, setShowAddPreco] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([fetchCotacaoById(cotacaoId), fetchPrecosByCotacaoId(cotacaoId)]);
      setCotacao(c);
      setPrecos(p);
    } finally {
      setLoading(false);
    }
  }, [cotacaoId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshNonce]);

  const filtered = useMemo(() => {
    const q = filterForn.trim().toLowerCase();
    if (!q) return precos;
    return precos.filter((r) => r.fornecedor.toLowerCase().includes(q));
  }, [precos, filterForn]);

  const stats = useMemo(() => {
    if (!cotacao || filtered.length === 0) {
      return { min: null as number | null, avg: null as number | null, diff: null as number | null };
    }
    const q = cotacao.quantidade;
    const units = filtered.map((r) => valorUnitarioCentavos(r.valorCentavos, q));
    const s = statsPrecosUnitarios(units);
    return { min: s.min, avg: s.avg, diff: s.diff };
  }, [cotacao, filtered]);

  const chartPoints = useMemo((): CotacaoChartPoint[] => {
    if (!cotacao) return [];
    const q = cotacao.quantidade;
    const sorted = [...filtered].sort((a, b) => compareDataBR(a.dataRegistroBR, b.dataRegistroBR));
    return sorted.map((r) => ({
      id: r.id,
      dataBR: r.dataRegistroBR,
      fornecedor: r.fornecedor,
      valorUnitarioCentavos: valorUnitarioCentavos(r.valorCentavos, q),
    }));
  }, [cotacao, filtered]);

  const tendenciaNode = useMemo(() => {
    if (chartPoints.length < 2) {
      return <span className="cotacao-detail__trend cotacao-detail__trend--neutral">—</span>;
    }
    const last = chartPoints[chartPoints.length - 1];
    const prev = chartPoints[chartPoints.length - 2];
    if (last.valorUnitarioCentavos > prev.valorUnitarioCentavos) {
      const pct = ((last.valorUnitarioCentavos - prev.valorUnitarioCentavos) / prev.valorUnitarioCentavos) * 100;
      return (
        <span className="cotacao-detail__trend cotacao-detail__trend--up">↑ +{pct.toFixed(0)}%</span>
      );
    }
    if (last.valorUnitarioCentavos < prev.valorUnitarioCentavos) {
      const pct = ((prev.valorUnitarioCentavos - last.valorUnitarioCentavos) / prev.valorUnitarioCentavos) * 100;
      return (
        <span className="cotacao-detail__trend cotacao-detail__trend--down">↓ -{pct.toFixed(0)}%</span>
      );
    }
    return <span className="cotacao-detail__trend cotacao-detail__trend--neutral">—</span>;
  }, [chartPoints]);

  const handleDeletePreco = async (id: string) => {
    const res = await deleteCotacaoPreco(id);
    if ('error' in res) {
      alert(res.error);
      return;
    }
    onChanged();
    void reload();
  };

  if (loading && !cotacao) {
    return (
      <div className="app-container cotacao-detail-screen cotacao-detail-screen--centered">
        <p className="meus-gastos-empty" role="status" aria-live="polite">
          Carregando…
        </p>
      </div>
    );
  }

  if (!cotacao) {
    return (
      <div className="app-container cotacao-detail-screen cotacao-detail-screen--not-found">
        <p className="meus-gastos-empty meus-gastos-empty--soft" role="status">
          Cotação não encontrada.
        </p>
        <button type="button" className="btn-save-main cotacao-detail-screen__back-btn" onClick={onBack}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="app-container cotacao-detail-screen detail-screen">
      <header className="detail-header">
        <button
          className="detail-header__back"
          onClick={onBack}
          type="button"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="detail-header__title">Cotação</span>
        <div className="detail-header__actions">
          <button
            type="button"
            className="detail-header__icon-btn button-finance"
            onClick={() => setShowEdit(true)}
            aria-label="Editar cotação"
          >
            <Pencil size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="detail-header__icon-btn button-finance button-finance--primary"
            onClick={() => setShowAddPreco(true)}
            aria-label="Adicionar preço"
          >
            <Plus size={18} aria-hidden />
          </button>
        </div>
      </header>

      <div className="detail-content cotacao-detail-content">
        <section className="detail-summary-card" aria-label="Resumo da cotação">
          <h2 className="detail-summary-card__title">{cotacao.descricao}</h2>
          <p className="detail-summary-card__meta">Unidade: {cotacao.unidadeMedida}</p>
          <div className="detail-summary-card__stats">
            <div className="detail-summary-card__stat-row">
              <span>Menor preço unitário</span>
              <span className="detail-summary-card__stat-value">
                {stats.min != null ? formatCurrency(stats.min) : '—'}
              </span>
            </div>
            <div className="detail-summary-card__stat-row">
              <span>Média</span>
              <span className="detail-summary-card__stat-value">
                {stats.avg != null ? formatCurrency(stats.avg) : '—'}
              </span>
            </div>
            <div className="detail-summary-card__stat-row">
              <span>Tendência</span>
              <span className="detail-summary-card__stat-value">{tendenciaNode}</span>
            </div>
          </div>
        </section>

        <section className="detail-section cotacao-detail__filter-wrap" aria-label="Filtro de preços">
          <div className="cotacao-detail__filter-row">
            <div className="cotacao-detail__filter-input">
              <FloatingInput
                id="filtro-fornecedor-cotacao"
                label="Filtrar por fornecedor"
                value={filterForn}
                onChange={setFilterForn}
                bgVariant="surface"
              />
            </div>
            {filterForn.trim() ? (
              <button
                type="button"
                onClick={() => setFilterForn('')}
                aria-label="Limpar filtro"
                className="cotacao-filter-clear"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        </section>

        <section className="detail-section cotacao-detail__chart-wrap" aria-label="Gráfico de preços">
          {chartPoints.length >= 2 ? (
            <CotacaoLineChart pointsChrono={chartPoints} />
          ) : (
            <div className="cotacao-chart-placeholder cotacao-detail__chart-empty">
              Adicione mais registros para ver a evolução do preço
            </div>
          )}
        </section>

        <section className="detail-section cotacao-detail__table-wrap" aria-label="Histórico de preços">
          <CotacaoPrecosTable
            rows={filtered}
            quantidadeCotacao={cotacao.quantidade}
            onDelete={(id) => void handleDeletePreco(id)}
          />
        </section>
      </div>

      {showEdit && (
        <EditCotacaoSheet
          orgId={orgId}
          cotacao={cotacao}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            onChanged();
            void reload();
          }}
        />
      )}

      {showAddPreco && (
        <AddPrecoSheet
          cotacaoId={cotacao.id}
          unidade={cotacao.unidadeMedida}
          onClose={() => setShowAddPreco(false)}
          onSaved={() => {
            onChanged();
            void reload();
          }}
        />
      )}
    </div>
  );
}
