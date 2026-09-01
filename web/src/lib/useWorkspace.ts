import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApprovalMode, Campaign, Org } from '@shared/types';
import { supabase } from './supabase';

export interface Member {
  user_id: string;
  email: string;
  role: string;
  joined_at: string;
}
export interface Invite {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

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
  addCampaign: (name: string) => Promise<void>;
  renameCampaign: (id: string, name: string) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  updateCampaignApproval: (
    id: string,
    v: {
      approval_mode: ApprovalMode;
      approver_name: string | null;
      approver_email: string | null;
      waived_networks: string[];
      disclaimer: string | null;
    },
  ) => Promise<void>;
  listTeam: (orgId: string) => Promise<{ members: Member[]; invites: Invite[] }>;
  inviteMember: (orgId: string, email: string, role: string) => Promise<void>;
  removeMember: (orgId: string, userId: string) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useWorkspace(userId: string | undefined): WorkspaceState {
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(storedOrgId);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const loadOrgs = useCallback(async (): Promise<Org[]> => {
    if (!userId) return [];
    // claim any workspace invites addressed to this email before listing
    await supabase.rpc('tj_accept_invites');
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

  const addCampaign = useCallback(
    async (name: string) => {
      if (!org) throw new Error('no workspace selected');
      const { error } = await supabase
        .from('campaigns')
        .insert({ org_id: org.id, name: name.trim() });
      if (error) throw error;
      await loadCampaigns(org.id);
    },
    [org, loadCampaigns],
  );

  const renameCampaign = useCallback(
    async (id: string, name: string) => {
      const { error } = await supabase.from('campaigns').update({ name: name.trim() }).eq('id', id);
      if (error) throw error;
      if (org) await loadCampaigns(org.id);
    },
    [org, loadCampaigns],
  );

  const deleteCampaign = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;
      if (org) await loadCampaigns(org.id);
    },
    [org, loadCampaigns],
  );

  const updateCampaignApproval = useCallback<WorkspaceState['updateCampaignApproval']>(
    async (id, v) => {
      const { error } = await supabase
        .from('campaigns')
        .update({
          approval_mode: v.approval_mode,
          approver_name: v.approver_name?.trim() || null,
          approver_email: v.approver_email?.trim() || null,
          waived_networks: v.waived_networks,
          disclaimer: v.disclaimer?.trim() || null,
        })
        .eq('id', id);
      if (error) throw error;
      if (org) await loadCampaigns(org.id);
    },
    [org, loadCampaigns],
  );

  const listTeam = useCallback(async (orgId: string) => {
    const [{ data: members, error: mErr }, { data: invites, error: iErr }] = await Promise.all([
      supabase.rpc('tj_list_members', { p_org: orgId }),
      supabase
        .from('workspace_invites')
        .select('id, email, role, created_at')
        .eq('org_id', orgId)
        .is('accepted_at', null)
        .order('created_at'),
    ]);
    if (mErr) throw mErr;
    if (iErr) throw iErr;
    return {
      members: (members as Member[]) ?? [],
      invites: (invites as Invite[]) ?? [],
    };
  }, []);

  const inviteMember = useCallback(async (orgId: string, email: string, role: string) => {
    const { error } = await supabase.rpc('tj_invite_member', {
      p_org: orgId,
      p_email: email.trim(),
      p_role: role,
    });
    if (error) throw error;
    await loadOrgs();
  }, [loadOrgs]);

  const removeMember = useCallback(async (orgId: string, userId: string) => {
    const { error } = await supabase.rpc('tj_remove_member', { p_org: orgId, p_user: userId });
    if (error) throw error;
  }, []);

  const cancelInvite = useCallback(async (inviteId: string) => {
    const { error } = await supabase.from('workspace_invites').delete().eq('id', inviteId);
    if (error) throw error;
  }, []);

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
    addCampaign,
    renameCampaign,
    deleteCampaign,
    updateCampaignApproval,
    listTeam,
    inviteMember,
    removeMember,
    cancelInvite,
    reload,
  };
}
