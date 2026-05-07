import { useState, useEffect } from 'react';
import { adminFetchUsers, adminFetchLinks } from '../../lib/supabase';
import { formatDateBR } from '../../utils';
import { User, Shield } from 'lucide-react';
import type { AdminUserRecord } from '../../types';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [usersData, linksData] = await Promise.all([
        adminFetchUsers(),
        adminFetchLinks()
      ]);
      setUsers(usersData);
      setLinks(linksData);
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-inactive)' }}>Carregando usuários...</p>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Usuários Registrados</h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          Lista de todos os usuários criados via Supabase Auth.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {users.map((user) => {
          const userLinks = links.filter((l) => l.user_id === user.id);
          return (
            <div key={user.id} style={{
              background: 'var(--card-bg)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 16
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <User size={18} color="var(--text-secondary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{user.email}</div>
                <div style={{ fontSize: 11, color: 'var(--text-inactive)', marginTop: 4 }}>
                  Registrado em {formatDateBR(new Date(user.createdAt))}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                {userLinks.length > 0 ? (
                  userLinks.map((link) => (
                    <div key={link.id} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', gap: 4
                    }}>
                      {link.role === 'owner' && <Shield size={10} color="var(--accent)" />}
                      {link.organizacoes?.nome}
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: 10, color: '#f87171' }}>Sem vínculos</span>
                )}
              </div>
            </div>
          );
        })}
        {users.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-inactive)', textAlign: 'center', padding: '24px 0' }}>
            Nenhum usuário encontrado.
          </p>
        )}
      </div>
    </div>
  );
};
