import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { fetchCotacoesList } from '../../lib/cotacoesDb';
import type { CotacaoListCard } from '../../types';
import { formatCurrency } from '../../utils';
import { NovaCotacaoSheet } from './NovaCotacaoSheet';
import { ScreenHeader, ScreenHeaderIconButton } from '../ScreenHeader';

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
    <div className="app-container cotacoes-screen" style={{ paddingBottom: 72 }}>
      <ScreenHeader
        title="Cotações"
        action={
          <ScreenHeaderIconButton onClick={() => setShowNova(true)} ariaLabel="Nova cotação">
            <Plus size={18} aria-hidden />
          </ScreenHeaderIconButton>
        }
      />

      <div className="meus-gastos-search input-finance input-finance--search">
        <Search size={14} className="meus-gastos-search__icon" aria-hidden />
        <input
          type="text"
          className="meus-gastos-search__input input-finance__field"
          placeholder="Buscar produto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar produto"
          autoComplete="off"
        />
      </div>

      {loading ? (
        <div className="meus-gastos-empty" role="status" aria-live="polite">
          Carregando…
        </div>
      ) : list.length === 0 ? (
        <div className="meus-gastos-empty meus-gastos-empty--hero" role="status">
          <span className="meus-gastos-empty__title">Nenhuma cotação ainda.</span>
          <span className="meus-gastos-empty__hint">
            Toque em &quot;Nova cotação&quot; para começar.
          </span>
        </div>
      ) : (
        <div className="meus-gastos-month-card card-finance card-finance--section cotacoes-list">
          <div className="cotacoes-list__head">
            <span className="detail-items-title cotacoes-list__head-label">Descrição</span>
            <span className="detail-items-title cotacoes-list__head-label">Valor médio</span>
          </div>

          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              className="gasto-card card-finance__item card-finance--clickable cotacoes-list__row"
              onClick={() => onOpenDetail(c.id)}
            >
              <div className="cotacoes-list__row-line">
                <span className="cotacoes-list__desc">{c.descricao}</span>
                <span
                  className={`cotacoes-list__valor ${c.precoMedioCentavos == null ? 'cotacoes-list__valor--empty' : ''}`}
                >
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
