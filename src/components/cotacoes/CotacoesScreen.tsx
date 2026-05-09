import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { fetchCotacoesList } from '../../lib/cotacoesDb';
import type { CotacaoListCard } from '../../types';
import { formatCurrency } from '../../utils';
import { NovaCotacaoSheet } from './NovaCotacaoSheet';

interface CotacoesScreenProps {
  orgId: string;
  refreshKey: number;
  onOpenDetail: (id: string) => void;
}

export function CotacoesScreen({ orgId, refreshKey, onOpenDetail }: CotacoesScreenProps) {
  const [list, setList] = useState<CotacaoListCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNova, setShowNova] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchCotacoesList(orgId, search)
      .then(setList)
      .finally(() => setLoading(false));
  }, [orgId, search, refreshKey]);

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  return (
    <div className="app-container" style={{ paddingBottom: 72 }}>
      <div className="meus-gastos-header">
        <h1 className="meus-gastos-header__title">Cotações</h1>
        <button
          type="button"
          className="cotacao-header__new-btn"
          onClick={() => setShowNova(true)}
        >
          <Plus size={18} />
          <span>Nova cotação</span>
        </button>
      </div>

      <div className="meus-gastos-search">
        <Search size={14} className="meus-gastos-search__icon" />
        <input
          className="meus-gastos-search__input"
          placeholder="Buscar produto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar produto"
        />
      </div>

      {loading ? (
        <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-inactive)', fontSize: 13 }}>
          Carregando…
        </p>
      ) : list.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-inactive)', fontSize: 13 }}>
          <p>Nenhuma cotação ainda.</p>
          <p style={{ marginTop: 8, fontSize: 12 }}>Toque em &quot;Nova cotação&quot; para começar.</p>
        </div>
      ) : (
        <div className="meus-gastos-month-card" style={{ marginTop: 0 }}>
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              className="gasto-card cotacao-card-btn"
              onClick={() => onOpenDetail(c.id)}
            >
              <div className="gasto-card__top">
                <span className="gasto-card__fornecedor" style={{ whiteSpace: 'normal' }}>
                  {c.descricao}
                </span>
              </div>
              <div className="cotacao-card__meta">
                {Number.isInteger(c.quantidade) ? c.quantidade : c.quantidade.toLocaleString('pt-BR')}{' '}
                {c.unidadeMedida}
              </div>
              <div className="gasto-card__bottom">
                <span className="gasto-card__date">
                  {c.menorPrecoUnitarioCentavos != null && c.fornecedorMenorPreco
                    ? `${formatCurrency(c.menorPrecoUnitarioCentavos)} · ${c.fornecedorMenorPreco}`
                    : 'Sem preços'}
                </span>
                <span className="gasto-card__meio">
                  {c.qtdRegistrosPreco} reg. · {fmtDate(c.ultimaAtualizacaoISO)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showNova && (
        <NovaCotacaoSheet
          orgId={orgId}
          onClose={() => setShowNova(false)}
          onSaved={(id) => {
            setShowNova(false);
            onOpenDetail(id);
          }}
        />
      )}
    </div>
  );
}
