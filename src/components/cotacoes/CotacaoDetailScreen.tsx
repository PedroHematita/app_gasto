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
import { CotacaoStatsBar } from './CotacaoStatsBar';
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
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <p style={{ color: 'var(--text-inactive)', fontSize: 13 }}>Carregando…</p>
      </div>
    );
  }

  if (!cotacao) {
    return (
      <div className="app-container" style={{ padding: 16 }}>
        <p style={{ color: 'var(--text-inactive)', fontSize: 13 }}>Cotação não encontrada.</p>
        <button type="button" className="btn-save-main" style={{ marginTop: 16 }} onClick={onBack}>
          Voltar
        </button>
      </div>
    );
  }

  const qtyLabel = Number.isInteger(cotacao.quantidade)
    ? String(cotacao.quantidade)
    : cotacao.quantidade.toLocaleString('pt-BR');

  return (
    <div className="app-container" style={{ paddingBottom: 24 }}>
      <div className="detail-header">
        <button className="detail-header__back" onClick={onBack} type="button">
          <ChevronLeft size={20} />
        </button>
        <span className="detail-header__title">Cotação</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="detail-header__edit" type="button" onClick={() => setShowEdit(true)}>
            <Pencil size={16} />
            <span>Editar</span>
          </button>
          <button
            type="button"
            className="detail-header__edit"
            onClick={() => setShowAddPreco(true)}
            aria-label="Adicionar preço"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="detail-content" style={{ paddingTop: 8 }}>
        <div className="cotacao-detail__product">
          <div className="cotacao-detail__product-title">{cotacao.descricao}</div>
          <div className="cotacao-detail__product-meta">
            {qtyLabel} {cotacao.unidadeMedida}
          </div>
        </div>

        <CotacaoStatsBar
          menorCentavos={stats.min}
          mediaCentavos={stats.avg}
          diferencaCentavos={stats.diff}
        />

        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1 }}>
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
                className="cotacao-filter-clear"
                onClick={() => setFilterForn('')}
                aria-label="Limpar filtro"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ padding: '8px 16px 0' }}>
          <CotacaoLineChart pointsChrono={chartPoints} />
        </div>

        <div style={{ padding: '0 16px' }}>
          <CotacaoPrecosTable
            rows={filtered}
            quantidadeCotacao={cotacao.quantidade}
            onDelete={(id) => void handleDeletePreco(id)}
          />
        </div>
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
