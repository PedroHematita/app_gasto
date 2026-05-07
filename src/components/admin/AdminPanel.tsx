import { useState } from 'react';
import { LogOut, Building2, Users, Link as LinkIcon } from 'lucide-react';
import { AdminOrgs } from './AdminOrgs';
import { AdminUsers } from './AdminUsers';
import { AdminLinks } from './AdminLinks';

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'orgs' | 'users' | 'links'>('orgs');

  return (
    <div className="app-container" style={{ padding: 0 }}>
      {/* Header */}
      <header className="header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <div className="header__content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>
              Painel Super Admin
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              Gerenciamento central do sistema
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <LogOut size={16} color="var(--text-primary)" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', gap: 24 }}>
        <button
          onClick={() => setActiveTab('orgs')}
          style={{
            background: 'none', border: 'none',
            padding: '16px 0',
            fontSize: 13, fontWeight: 500,
            color: activeTab === 'orgs' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'orgs' ? '2px solid var(--accent)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
          }}
        >
          <Building2 size={16} /> Organizações
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            background: 'none', border: 'none',
            padding: '16px 0',
            fontSize: 13, fontWeight: 500,
            color: activeTab === 'users' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'users' ? '2px solid var(--accent)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
          }}
        >
          <Users size={16} /> Usuários
        </button>
        <button
          onClick={() => setActiveTab('links')}
          style={{
            background: 'none', border: 'none',
            padding: '16px 0',
            fontSize: 13, fontWeight: 500,
            color: activeTab === 'links' ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'links' ? '2px solid var(--accent)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
          }}
        >
          <LinkIcon size={16} /> Vínculos
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
        {activeTab === 'orgs' && <AdminOrgs />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'links' && <AdminLinks />}
      </div>
    </div>
  );
};
