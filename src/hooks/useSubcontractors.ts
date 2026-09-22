import { useCallback, useEffect, useState } from 'react';
import { Subcontractor } from '../types';
import { supabase } from '../lib/supabase';

type SubcontractorRow = {
  id: string;
  project_id: string;
  name: string;
  trade: string;
  contract_value: number;
  created_at: string;
};

const fromRow = (row: SubcontractorRow): Subcontractor => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  trade: row.trade,
  contractValue: Number(row.contract_value),
  createdAt: row.created_at,
});

export const useSubcontractors = (projectId: string | null) => {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubcontractors = useCallback(async () => {
    if (!projectId) {
      setSubcontractors([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.error('Failed to load subcontractors', error);
      setSubcontractors([]);
      setLoading(false);
      return;
    }

    setSubcontractors((data as SubcontractorRow[]).map(fromRow));
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchSubcontractors();
  }, [fetchSubcontractors]);

  const addSubcontractor = async (input: { name: string; trade: string; contractValue: number }) => {
    if (!projectId) throw new Error('No project selected.');

    const { data, error } = await supabase
      .from('subcontractors')
      .insert({
        project_id: projectId,
        name: input.name.trim(),
        trade: input.trade,
        contract_value: input.contractValue,
      })
      .select('*')
      .single();

    if (error || !data) throw error ?? new Error('Failed to add subcontractor');

    await fetchSubcontractors();
    return fromRow(data as SubcontractorRow);
  };

  const updateSubcontractor = async (
    id: string,
    updates: { name?: string; trade?: string; contractValue?: number }
  ) => {
    const { error } = await supabase
      .from('subcontractors')
      .update({
        ...(updates.name !== undefined && { name: updates.name.trim() }),
        ...(updates.trade !== undefined && { trade: updates.trade }),
        ...(updates.contractValue !== undefined && { contract_value: updates.contractValue }),
      })
      .eq('id', id);

    if (error) throw error;
    await fetchSubcontractors();
  };

  const deleteSubcontractor = async (id: string) => {
    const { error } = await supabase.from('subcontractors').delete().eq('id', id);
    if (error) throw error;
    await fetchSubcontractors();
  };

  return {
    subcontractors,
    loading,
    addSubcontractor,
    updateSubcontractor,
    deleteSubcontractor,
    refreshSubcontractors: fetchSubcontractors,
  };
};
