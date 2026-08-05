import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface CashAdvanceNotification {
  id: string;
  amount: number;
  date: string;
  notes: string | null;
  projectName: string;
}

type Row = {
  id: string;
  amount: number;
  date: string;
  notes: string | null;
  projects?: { name: string } | { name: string }[] | null;
};

export const useCashAdvanceNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CashAdvanceNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUnread = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Advances given to me
    const { data: advances, error } = await supabase
      .from('cash_advances')
      .select('id, amount, date, notes, projects ( name )')
      .eq('recipient_id', user.id)
      .order('date', { ascending: false });

    if (error || !advances) {
      console.error('Failed to load cash advance notifications', error);
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Which of those have already been marked read
    const { data: reads } = await supabase
      .from('cash_advance_reads')
      .select('advance_id')
      .in(
        'advance_id',
        (advances as Row[]).map((a) => a.id)
      );

    const readIds = new Set((reads ?? []).map((r: { advance_id: string }) => r.advance_id));

    const unread = (advances as Row[])
      .filter((a) => !readIds.has(a.id))
      .map((a) => {
        const project = Array.isArray(a.projects) ? a.projects[0] : a.projects;
        return {
          id: a.id,
          amount: Number(a.amount),
          date: a.date,
          notes: a.notes,
          projectName: project?.name ?? 'a project',
        };
      });

    setNotifications(unread);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  const markAsRead = async (advanceId: string) => {
    const { error } = await supabase.from('cash_advance_reads').insert({ advance_id: advanceId });
    if (error) {
      console.error('Failed to mark advance as read', error);
      return;
    }
    setNotifications((prev) => prev.filter((n) => n.id !== advanceId));
  };

  return { notifications, loading, markAsRead, refresh: fetchUnread };
};
