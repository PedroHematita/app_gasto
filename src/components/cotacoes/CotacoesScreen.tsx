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
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 16px 8px' }}>
            <span className="detail-items-title" style={{ marginBottom: 0 }}>Descrição</span>
            <span className="detail-items-title" style={{ marginBottom: 0 }}>Valor médio</span>
          </div>
          
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              className="gasto-card"
              onClick={() => onOpenDetail(c.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  paddingRight: 16,
                  fontSize: 'var(--font-primary)',
                  color: 'var(--text-secondary)',
                  fontWeight: 'var(--weight-medium)'
                }}>
                  {c.descricao}
                </span>
                <span style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 'var(--font-primary)',
                  fontWeight: 'var(--weight-medium)',
                  color: c.precoMedioCentavos != null ? 'var(--text-secondary)' : 'var(--text-inactive)',
                  whiteSpace: 'nowrap'
                }}>
                  {c.precoMedioCentavos != null
                    ? formatCurrency(c.precoMedioCentavos)
                    : '—'}
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
