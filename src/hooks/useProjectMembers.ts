import { useCallback, useEffect, useState } from 'react';
import { ProjectMember } from '../types';
import { supabase } from '../lib/supabase';

type MemberRow = {
  id: string;
  project_id: string;
  email: string;
  user_id: string | null;
  added_at: string;
};

const fromRow = (row: MemberRow): ProjectMember => ({
  id: row.id,
  projectId: row.project_id,
  email: row.email,
  userId: row.user_id,
  addedAt: row.added_at,
});

export const useProjectMembers = (projectId: string | null) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!projectId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('added_at', { ascending: true });

    if (error || !data) {
      console.error('Failed to load team members', error);
      setMembers([]);
      setLoading(false);
      return;
    }

    setMembers((data as MemberRow[]).map(fromRow));
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const addMember = async (email: string) => {
    if (!projectId) throw new Error('No project selected.');

    const { error } = await supabase.from('project_members').insert({
      project_id: projectId,
      email: email.trim().toLowerCase(),
    });

    if (error) throw error;
    await fetchMembers();
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from('project_members').delete().eq('id', id);
    if (error) throw error;
    await fetchMembers();
  };

  return {
    members,
    loading,
    addMember,
    removeMember,
    refreshMembers: fetchMembers,
  };
};
