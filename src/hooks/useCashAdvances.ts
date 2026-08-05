import { useCallback, useEffect, useState } from 'react';
import { CashAdvance } from '../types';
import { supabase } from '../lib/supabase';

type CashAdvanceRow = {
  id: string;
  project_id: string;
  recipient_id: string;
  given_by: string;
  amount: number;
  date: string;
  notes: string | null;
  created_at: string;
  profiles?: { name: string } | { name: string }[] | null;
};

const fromRow = (row: CashAdvanceRow): CashAdvance => {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    projectId: row.project_id,
    recipientId: row.recipient_id,
    recipientName: profile?.name,
    givenBy: row.given_by,
    amount: Number(row.amount),
    date: row.date,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
};

export const useCashAdvances = (projectId: string | null) => {
  const [advances, setAdvances] = useState<CashAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdvances = useCallback(async () => {
    if (!projectId) {
      setAdvances([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('cash_advances')
      .select('*, profiles:recipient_id ( name )')
      .eq('project_id', projectId)
      .order('date', { ascending: false });

    if (error || !data) {
      console.error('Failed to load cash advances', error);
      setAdvances([]);
      setLoading(false);
      return;
    }

    setAdvances((data as CashAdvanceRow[]).map(fromRow));
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchAdvances();
  }, [fetchAdvances]);

  const addAdvance = async (input: { recipientId: string; amount: number; date: string; notes?: string }) => {
    if (!projectId) throw new Error('No project selected.');

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be signed in.');

    const { error } = await supabase.from('cash_advances').insert({
      project_id: projectId,
      recipient_id: input.recipientId,
      given_by: user.id,
      amount: input.amount,
      date: input.date,
      notes: input.notes || null,
    });

    if (error) throw error;
    await fetchAdvances();
  };

  const deleteAdvance = async (id: string) => {
    const { error } = await supabase.from('cash_advances').delete().eq('id', id);
    if (error) throw error;
    await fetchAdvances();
  };

  return {
    advances,
    loading,
    addAdvance,
    deleteAdvance,
    refreshAdvances: fetchAdvances,
  };
};
