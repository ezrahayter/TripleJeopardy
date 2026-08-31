import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Campaign, Org } from '@shared/types';
import { supabase } from './supabase';

const STORAGE_KEY = 'tj.currentOrg';

function storedOrgId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface WorkspaceState {
  loading: boolean;
  orgs: Org[];
  org: Org | null;
  campaigns: Campaign[];
  selectWorkspace: (id: string) => void;
  createWorkspace: (name: string, firstCampaign: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useWorkspace(userId: string | undefined): WorkspaceState {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(storedOrgId);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const loadOrgs = useCallback(async (): Promise<Org[]> => {
    if (!userId) return [];
    const { data } = await supabase
      .from('memberships')
      .select('org:orgs(*)')
      .order('created_at');
    const list = ((data ?? []) as unknown as Array<{ org: Org | null }>)
      .map((r) => r.org)
      .filter((o): o is Org => Boolean(o));
    setOrgs(list);
    return list;
  }, [userId]);

  const org = useMemo(() => {
    if (orgs.length === 0) return null;
    const chosen = currentId && orgs.find((o) => o.id === currentId);
    return chosen || orgs[0] || null;
  }, [orgs, currentId]);

  const loadCampaigns = useCallback(async (orgId: string) => {
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at');
    setCampaigns((data as unknown as Campaign[]) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadOrgs();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOrgs]);

  useEffect(() => {
    if (org) void loadCampaigns(org.id);
    else setCampaigns([]);
  }, [org, loadCampaigns]);

  const selectWorkspace = useCallback((id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* private mode - selection just won't persist */
    }
    setCurrentId(id);
  }, []);

  const createWorkspace = useCallback(
    async (name: string, firstCampaign: string) => {
      const { data, error } = await supabase.rpc('tj_bootstrap', {
        p_org_name: name,
        p_campaign_name: firstCampaign,
      });
      if (error) throw error;
      await loadOrgs();
      selectWorkspace(data as string);
    },
    [loadOrgs, selectWorkspace],
  );

  const renameWorkspace = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from('orgs').update({ name: name.trim() }).eq('id', id);
    if (error) throw error;
    await loadOrgs();
  }, [loadOrgs]);

  const deleteWorkspace = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('orgs').delete().eq('id', id);
      if (error) throw error;
      try {
        if (localStorage.getItem(STORAGE_KEY) === id) localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const remaining = await loadOrgs();
      setCurrentId(remaining[0]?.id ?? null);
    },
    [loadOrgs],
  );

  const reload = useCallback(async () => {
    await loadOrgs();
    if (org) await loadCampaigns(org.id);
  }, [loadOrgs, loadCampaigns, org]);

  return {
    loading,
    orgs,
    org,
    campaigns,
    selectWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    reload,
  };
}
