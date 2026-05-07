import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { OrgRecord } from '../types';
import { supabase } from '../lib/supabase';

interface OrgContextValue {
  /** Currently active organization (null if not selected yet) */
  currentOrg: OrgRecord | null;
  /** All organizations the user belongs to */
  orgs: OrgRecord[];
  /** Switch active organization */
  switchOrg: (orgId: string) => void;
  /** Whether orgs are still loading */
  loading: boolean;
  /** Whether the user is a super admin */
  isSuperAdmin: boolean;
  /** Reload orgs list from server */
  reload: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue>({
  currentOrg: null,
  orgs: [],
  switchOrg: () => {},
  loading: true,
  isSuperAdmin: false,
  reload: async () => {},
});

export function useOrg() {
  return useContext(OrgContext);
}

const LS_KEY = 'app_gasto_last_org_id';

function getLastOrgId(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

function setLastOrgId(id: string) {
  try {
    localStorage.setItem(LS_KEY, id);
  } catch {
    /* ignore */
  }
}

async function fetchUserOrgs(): Promise<OrgRecord[]> {
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // First try: join query
  const { data, error } = await supabase
    .from('organizacao_membros')
    .select(`
      org_id,
      role,
      created_at,
      organizacoes ( id, nome, created_at )
    `)
    .eq('user_id', user.id);

  if (error) {
    console.error('[OrgContext] fetchUserOrgs error:', error);
  }

  if (data && data.length > 0) {
    try {
      return data.map((row: any) => ({
        id: row.organizacoes?.id || row.org_id,
        nome: row.organizacoes?.nome || 'Organização Desconhecida',
        role: row.role as 'owner' | 'member',
        createdAt: row.organizacoes?.created_at || row.created_at,
      }));
    } catch (e) {
      console.error('[OrgContext] Error mapping data:', e);
    }
  }

  // Fallback: query memberships without join, then fetch orgs separately
  const { data: memberships, error: memErr } = await supabase
    .from('organizacao_membros')
    .select('org_id, role, created_at')
    .eq('user_id', user.id);

  if (memErr) {
    console.error('[OrgContext] fetchUserOrgs memberships fallback error:', memErr);
    return [];
  }

  if (!memberships || memberships.length === 0) return [];

  const orgIds = memberships.map((m: any) => m.org_id as string);
  const { data: orgRows, error: orgErr } = await supabase
    .from('organizacoes')
    .select('id, nome, created_at')
    .in('id', orgIds);

  if (orgErr) {
    console.error('[OrgContext] fetchUserOrgs orgs fallback error:', orgErr);
    return [];
  }

  if (!orgRows) return [];

  return memberships.map((m: any) => {
    const org = orgRows.find((o: any) => o.id === m.org_id);
    return {
      id: m.org_id as string,
      nome: org?.nome || 'Organização Desconhecida',
      role: m.role as 'owner' | 'member',
      createdAt: org?.created_at || m.created_at,
    };
  });
}

async function createOrgWithOwner(nome: string): Promise<string | null> {
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: org, error: orgError } = await supabase
    .from('organizacoes')
    .insert({ nome })
    .select('id')
    .single();

  if (orgError || !org) {
    console.error('[OrgContext] Error creating org:', orgError);
    return null;
  }

  const { error: memberError } = await supabase
    .from('organizacao_membros')
    .insert({ org_id: org.id, user_id: user.id, role: 'owner' });

  if (memberError) {
    console.error('[OrgContext] Error creating membership:', memberError);
    return null;
  }

  return org.id as string;
}

interface OrgProviderProps {
  authenticated: boolean;
  children: React.ReactNode;
}

export const OrgProvider: React.FC<OrgProviderProps> = ({ authenticated, children }) => {
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [currentOrg, setCurrentOrg] = useState<OrgRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const loadOrgs = useCallback(async () => {
    if (!authenticated) {
      setOrgs([]);
      setCurrentOrg(null);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Check super admin status
      const { data: { user } } = await supabase!.auth.getUser();
      if (user) {
        const { data: adminData } = await supabase!
          .from('system_admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        setIsSuperAdmin(!!adminData);
      }

      let userOrgs = await fetchUserOrgs();

      // If user has no orgs (new user post-migration), create a default one
      if (userOrgs.length === 0) {
        console.log('[OrgContext] No orgs found, attempting to create default...');
        const newId = await createOrgWithOwner('Minha Empresa');
        if (newId) {
          userOrgs = await fetchUserOrgs();
        } else {
          console.error('[OrgContext] Failed to create default org');
        }
      }

      setOrgs(userOrgs);

      // Auto-select: last used > single org > null
      const lastId = getLastOrgId();
      const lastOrg = lastId ? userOrgs.find((o) => o.id === lastId) : null;

      if (lastOrg) {
        setCurrentOrg(lastOrg);
      } else if (userOrgs.length === 1) {
        setCurrentOrg(userOrgs[0]);
        setLastOrgId(userOrgs[0].id);
      } else {
        setCurrentOrg(null);
      }
    } catch (e) {
      console.error('[OrgContext] Unhandled error in loadOrgs:', e);
      setOrgs([]);
      setCurrentOrg(null);
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const switchOrg = useCallback(
    (orgId: string) => {
      const org = orgs.find((o) => o.id === orgId);
      if (org) {
        setCurrentOrg(org);
        setLastOrgId(org.id);
      }
    },
    [orgs]
  );

  useEffect(() => {
    console.log('[OrgContext] state changed -> orgId:', currentOrg?.id, '| loading:', loading, '| orgs count:', orgs.length);
  }, [currentOrg, loading, orgs]);

  return (
    <OrgContext.Provider value={{ currentOrg, orgs, switchOrg, loading, isSuperAdmin, reload: loadOrgs }}>
      {children}
    </OrgContext.Provider>
  );
};
