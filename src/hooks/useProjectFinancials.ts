import { useCallback, useEffect, useState } from 'react';
import { Subcontractor } from '../types';
import { supabase } from '../lib/supabase';

// Lightweight, all-projects fetch used to power the Project Health badge on
// every card in the dashboard grid. Mirrors the pattern useProjects already
// uses for expenses: one query across every project the user can see (RLS
// handles access control), grouped client-side by project_id. Cheap - just a
// couple of small SUM-able tables, no different from what the dashboard
// already loads for the Budget bar.

type PaymentRow = { project_id: string; amount: number };
type SubcontractorRow = {
  id: string;
  project_id: string;
  name: string;
  trade: string;
  contract_value: number;
  created_at: string;
};

const fromSubRow = (row: SubcontractorRow): Subcontractor => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  trade: row.trade,
  contractValue: Number(row.contract_value),
  createdAt: row.created_at,
});

export const useProjectFinancials = () => {
  const [receivedByProject, setReceivedByProject] = useState<Map<string, number>>(new Map());
  const [subcontractorsByProject, setSubcontractorsByProject] = useState<Map<string, Subcontractor[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const [{ data: paymentRows }, { data: subRows }] = await Promise.all([
      supabase.from('progress_payments').select('project_id, amount'),
      supabase.from('subcontractors').select('*'),
    ]);

    const received = new Map<string, number>();
    (paymentRows as PaymentRow[] | null ?? []).forEach((row) => {
      received.set(row.project_id, (received.get(row.project_id) ?? 0) + Number(row.amount));
    });
    setReceivedByProject(received);

    const subs = new Map<string, Subcontractor[]>();
    (subRows as SubcontractorRow[] | null ?? []).forEach((row) => {
      const sub = fromSubRow(row);
      const list = subs.get(sub.projectId) ?? [];
      list.push(sub);
      subs.set(sub.projectId, list);
    });
    setSubcontractorsByProject(subs);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    receivedByProject,
    subcontractorsByProject,
    loading,
    refreshFinancials: fetchAll,
  };
};
