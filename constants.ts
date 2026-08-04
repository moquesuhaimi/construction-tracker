import { useCallback, useEffect, useState } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  profile_image: string | null;
};

const fromRow = (row: ProfileRow): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  company: row.company,
  role: row.role,
  profileImage: row.profile_image ?? undefined,
});

export const useUser = () => {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();

    if (error || !data) {
      console.error('Failed to load profile', error);
      setLoading(false);
      return;
    }

    setUser(fromRow(data as ProfileRow));
    setLoading(false);
  }, [authUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateUser = async (updates: Partial<User>) => {
    if (!authUser) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.company !== undefined && { company: updates.company }),
        ...(updates.role !== undefined && { role: updates.role }),
        ...(updates.profileImage !== undefined && { profile_image: updates.profileImage || null }),
      })
      .eq('id', authUser.id);

    if (error) throw error;
    await fetchProfile();
  };

  return {
    user,
    loading,
    updateUser,
  };
};
