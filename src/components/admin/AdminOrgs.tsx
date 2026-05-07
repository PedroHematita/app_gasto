import { useState, useEffect } from 'react';
import { adminFetchOrgs, adminCreateOrg } from '../../lib/supabase';
import { FloatingInput } from '../FloatingInput';
import { formatDateBR } from '../../utils';
import { Building2, Plus, X } from 'lucide-react';

export const AdminOrgs: React.FC = () => {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadOrgs();
  }, []);

  const loadOrgs = async () => {
    setLoading(true);
    const data = await adminFetchOrgs();
    setOrgs(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newOrgName.trim()) return;
    setCreating(true);
    const org = await adminCreateOrg(newOrgName.trim());
    if (org) {
      setNewOrgName('');
      setShowModal(false);
      await loadOrgs();
    }
    setCreating(false);
  };

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-inactive)' }}>Carregando organizações...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Organizações</h2>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
          }}
        >
          <Plus size={14} /> Nova Organização
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {orgs.map((org) => (
          <div key={org.id} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 16
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-dark)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Building2 size={18} color="var(--accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{org.nome}</div>
              <div style={{ fontSize: 11, color: 'var(--text-inactive)', marginTop: 4 }}>
                Criada em {formatDateBR(new Date(org.createdAt))} • {org.memberCount} membro(s)
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-inactive)', fontFamily: 'monospace' }}>
              {org.id.split('-')[0]}...
            </div>
          </div>
        ))}
        {orgs.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-inactive)', textAlign: 'center', padding: '24px 0' }}>
            Nenhuma organização encontrada.
          </p>
        )}
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 24
        }}>
          <div style={{
            background: 'var(--bg-color)', border: '1px solid var(--border)',
            borderRadius: 20, width: '100%', maxWidth: 400, overflow: 'hidden'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Nova Organização</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <FloatingInput
                id="org-name"
                label="Nome da Empresa"
                value={newOrgName}
                onChange={setNewOrgName}
              />
              <button
                onClick={handleCreate}
                disabled={!newOrgName.trim() || creating}
                style={{
                  width: '100%', background: 'var(--accent)', color: '#fff', border: 'none',
                  padding: '16px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                  marginTop: 24, cursor: newOrgName.trim() && !creating ? 'pointer' : 'not-allowed',
                  opacity: newOrgName.trim() && !creating ? 1 : 0.5
                }}
              >
                {creating ? 'Criando...' : 'Criar Organização'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
