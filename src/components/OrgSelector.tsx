import { Building2 } from 'lucide-react';
import type { OrgRecord } from '../types';

interface OrgSelectorProps {
  orgs: OrgRecord[];
  onSelect: (orgId: string) => void;
}

export const OrgSelector: React.FC<OrgSelectorProps> = ({ orgs, onSelect }) => {
  return (
    <div className="app-container" style={{ justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent-dark)', border: '1.5px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Building2 size={24} color="var(--accent)" />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          {orgs.length > 0 ? 'Selecione a empresa' : 'Nenhuma empresa encontrada'}
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
          {orgs.length > 0
            ? 'Você pertence a mais de uma empresa. Escolha o contexto de trabalho.'
            : 'Não foi possível carregar suas organizações. Verifique o console do navegador para detalhes.'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orgs.map((org) => (
          <button
            key={org.id}
            type="button"
            onClick={() => onSelect(org.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.background = 'var(--accent-dark)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--card-bg)';
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--accent-dark)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Building2 size={18} color="var(--accent)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 500,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {org.nome}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-inactive)', marginTop: 2 }}>
                {org.role === 'owner' ? 'Proprietário' : 'Membro'}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
