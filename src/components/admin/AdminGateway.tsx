import { ShieldAlert, User } from 'lucide-react';
import { LogoutButton } from '../LogoutButton';


interface AdminGatewayProps {
  onSelect: (choice: 'admin' | 'user') => void;
}

export const AdminGateway: React.FC<AdminGatewayProps> = ({ onSelect }) => {
  return (
    <div className="app-container" style={{ justifyContent: 'center', padding: '0 24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 24, right: 24 }}>
        <LogoutButton onLogoutComplete={() => window.location.reload()} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent-dark)', border: '1.5px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <ShieldAlert size={24} color="var(--accent)" />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Acesso Privilegiado
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
          Sua conta possui permissões de Super Admin. Como deseja prosseguir?
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={() => onSelect('admin')}
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
            <ShieldAlert size={18} color="var(--accent)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Acessar como Admin
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-inactive)', marginTop: 2 }}>
              Gerenciar organizações, usuários e vínculos do sistema.
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelect('user')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 10,
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: '#333',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <User size={18} color="var(--text-secondary)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              Acessar como Usuário
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-inactive)', marginTop: 2 }}>
              Acesso normal para lançar e gerenciar gastos.
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
