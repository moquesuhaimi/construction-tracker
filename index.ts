import { useCallback, useEffect, useState } from 'react';
import { Project } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  total_budget: number;
  start_date: string | null;
  end_date: string | null;
  status: Project['status'];
  created_at: string;
};

const fromRow = (row: ProjectRow, totalExpenses: number): Project => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  description: row.description,
  totalBudget: Number(row.total_budget),
  totalExpenses,
  startDate: row.start_date ?? '',
  endDate: row.end_date ?? undefined,
  status: row.status,
  createdAt: row.created_at,
});

export const useProjects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: projectRows, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !projectRows) {
      console.error('Failed to load projects', error);
      setProjects([]);
      setLoading(false);
      return;
    }

    const { data: expenseRows } = await supabase.from('expenses').select('project_id, amount');
    const totalsByProject = new Map<string, number>();
    (expenseRows ?? []).forEach((row: { project_id: string; amount: number }) => {
      totalsByProject.set(row.project_id, (totalsByProject.get(row.project_id) ?? 0) + Number(row.amount));
    });

    setProjects((projectRows as ProjectRow[]).map((row) => fromRow(row, totalsByProject.get(row.id) ?? 0)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const addProject = async (project: Omit<Project, 'id' | 'createdAt' | 'totalExpenses' | 'ownerId'>) => {
    if (!user) throw new Error('You must be signed in.');

    const { data, error } = await supabase
      .from('projects')
      .insert({
        owner_id: user.id,
        name: project.name,
        description: project.description,
        total_budget: project.totalBudget,
        start_date: project.startDate || null,
        end_date: project.endDate || null,
        status: project.status,
      })
      .select()
      .single();

    if (error || !data) throw error ?? new Error('Failed to create project');

    await fetchProjects();
    return fromRow(data as ProjectRow, 0);
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const { error } = await supabase
      .from('projects')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.totalBudget !== undefined && { total_budget: updates.totalBudget }),
        ...(updates.startDate !== undefined && { start_date: updates.startDate || null }),
        ...(updates.endDate !== undefined && { end_date: updates.endDate || null }),
        ...(updates.status !== undefined && { status: updates.status }),
      })
      .eq('id', id);

    if (error) throw error;
    await fetchProjects();
  };

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    await fetchProjects();
  };

  return {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    refreshProjects: fetchProjects,
  };
};
