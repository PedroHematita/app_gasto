import { useState, useEffect } from 'react';
import { adminSearchUserByEmail, adminFetchOrgs, adminLinkUserToOrg, adminFetchLinks, adminUnlinkUser } from '../../lib/supabase';
import { FloatingInput } from '../FloatingInput';
import { Trash2, Search, Link as LinkIcon } from 'lucide-react';

export const AdminLinks: React.FC = () => {
  const [links, setLinks] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [email, setEmail] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [role, setRole] = useState<'owner' | 'member'>('member');
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [linksData, orgsData] = await Promise.all([
      adminFetchLinks(),
      adminFetchOrgs()
    ]);
    setLinks(linksData);
    setOrgs(orgsData);
    if (orgsData.length > 0) setSelectedOrgId(orgsData[0].id);
    setLoading(false);
  };

  const handleLink = async () => {
    if (!email.trim() || !selectedOrgId) return;
    setErrorMsg('');
    setSearching(true);
    
    // Find user
    const user = await adminSearchUserByEmail(email.trim());
    setSearching(false);

    if (!user) {
      setErrorMsg('Usuário não encontrado com este email.');
      return;
    }

    // Check if link already exists
    const exists = links.some(l => l.user_id === user.id && l.org_id === selectedOrgId);
    if (exists) {
      setErrorMsg('Usuário já está vinculado a esta organização.');
      return;
    }

    setLinking(true);
    const success = await adminLinkUserToOrg(user.id, selectedOrgId, role);
    if (success) {
      setEmail('');
      setRole('member');
      await loadData();
    } else {
      setErrorMsg('Erro ao vincular. Verifique as permissões ou se o vínculo já existe.');
    }
    setLinking(false);
  };

  const handleUnlink = async (linkId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este vínculo? O usuário perderá o acesso à organização.')) return;
    const success = await adminUnlinkUser(linkId);
    if (success) {
      await loadData();
    } else {
      alert('Erro ao remover vínculo.');
    }
  };

  if (loading) return <p style={{ fontSize: 13, color: 'var(--text-inactive)' }}>Carregando dados...</p>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Vínculos (Membros)</h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          Adicione usuários a organizações para liberar seu acesso.
        </p>
      </div>

      {/* Formulário */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, marginBottom: 32
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 2 }}>
            <FloatingInput
              id="search-email"
              label="Email do Usuário"
              value={email}
              onChange={(v) => { setEmail(v); setErrorMsg(''); }}
              type="email"
            />
          </div>
          <div style={{ flex: 2, position: 'relative' }}>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px 12px 6px',
                color: 'var(--text-primary)',
                fontSize: 14,
                appearance: 'none',
                outline: 'none',
                height: 52
              }}
            >
              {orgs.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
            <label style={{
              position: 'absolute', top: 6, left: 12,
              fontSize: 10, color: 'var(--text-inactive)', pointerEvents: 'none'
            }}>Organização</label>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px 12px 6px',
                color: 'var(--text-primary)',
                fontSize: 14,
                appearance: 'none',
                outline: 'none',
                height: 52
              }}
            >
              <option value="member">Membro</option>
              <option value="owner">Owner</option>
            </select>
            <label style={{
              position: 'absolute', top: 6, left: 12,
              fontSize: 10, color: 'var(--text-inactive)', pointerEvents: 'none'
            }}>Role</label>
          </div>
        </div>
        
        {errorMsg && (
          <div style={{ fontSize: 12, color: '#f87171', marginTop: 12 }}>{errorMsg}</div>
        )}

        <button
          onClick={handleLink}
          disabled={!email.trim() || !selectedOrgId || searching || linking}
          style={{
            background: 'var(--accent)', color: '#fff', border: 'none',
            padding: '12px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: (!email.trim() || !selectedOrgId || searching || linking) ? 'not-allowed' : 'pointer',
            opacity: (!email.trim() || !selectedOrgId || searching || linking) ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 16
          }}
        >
          {searching ? <Search size={16} /> : <LinkIcon size={16} />}
          {searching ? 'Buscando...' : linking ? 'Vinculando...' : 'Vincular Usuário'}
        </button>
      </div>

      {/* Lista de vínculos */}
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Vínculos Ativos</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {links.map(link => (
          <div key={link.id} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {link.organizacoes?.nome}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                Usuário ID: <span style={{ fontFamily: 'monospace' }}>{link.user_id.split('-')[0]}...</span> • Role: <span style={{ color: link.role === 'owner' ? 'var(--accent)' : 'inherit' }}>{link.role}</span>
              </div>
            </div>
            <button
              onClick={() => handleUnlink(link.id)}
              style={{
                background: 'rgba(248, 113, 113, 0.1)', border: 'none',
                width: 32, height: 32, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#f87171'
              }}
              title="Remover vínculo"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {links.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-inactive)', textAlign: 'center', padding: '24px 0' }}>
            Nenhum vínculo existente.
          </p>
        )}
      </div>
    </div>
  );
};
