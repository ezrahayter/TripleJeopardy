import { useCallback, useEffect, useState } from 'react';
import type { Campaign, Org } from '@shared/types';
import { supabase } from './supabase';

interface Workspace {
  loading: boolean;
  org: Org | null;
  campaigns: Campaign[];
  reload: () => Promise<void>;
  bootstrap: (orgName: string, campaignName: string) => Promise<void>;
}

export function useWorkspace(userId: string | undefined): Workspace {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<Org | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data: membership } = await supabase
      .from('memberships')
      .select('org:orgs(*)')
      .limit(1)
      .maybeSingle();

    const nextOrg = (membership?.org as unknown as Org | undefined) ?? null;
    setOrg(nextOrg);

    if (nextOrg) {
      const { data: rows } = await supabase
        .from('campaigns')
        .select('*')
        .eq('org_id', nextOrg.id)
        .order('created_at');
      setCampaigns((rows as unknown as Campaign[]) ?? []);
    } else {
      setCampaigns([]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const bootstrap = useCallback(
    async (orgName: string, campaignName: string) => {
      const { error } = await supabase.rpc('tj_bootstrap', {
        p_org_name: orgName,
        p_campaign_name: campaignName,
      });
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  return { loading, org, campaigns, reload, bootstrap };
}
