import { useCallback, useEffect, useState } from 'react';
import { ProgressPayment } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

type PaymentRow = {
  id: string;
  project_id: string;
  amount: number;
  date: string;
  description: string | null;
  created_by: string;
  created_at: string;
};

const fromRow = (row: PaymentRow): ProgressPayment => ({
  id: row.id,
  projectId: row.project_id,
  amount: Number(row.amount),
  date: row.date,
  description: row.description ?? undefined,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

export const useProgressPayments = (projectId: string | null) => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<ProgressPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    if (!projectId) {
      setPayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('progress_payments')
      .select('*')
      .eq('project_id', projectId)
      .order('date', { ascending: false });

    if (error || !data) {
      // Not an error worth alarming over - non-owners simply can't see this (RLS)
      setPayments([]);
      setLoading(false);
      return;
    }

    setPayments((data as PaymentRow[]).map(fromRow));
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const addPayment = async (input: { amount: number; date: string; description?: string }) => {
    if (!projectId) throw new Error('No project selected.');
    if (!user) throw new Error('You must be signed in.');

    const { error } = await supabase.from('progress_payments').insert({
      project_id: projectId,
      amount: input.amount,
      date: input.date,
      description: input.description || null,
      created_by: user.id,
    });

    if (error) throw error;
    await fetchPayments();
  };

  const deletePayment = async (id: string) => {
    const { error } = await supabase.from('progress_payments').delete().eq('id', id);
    if (error) throw error;
    await fetchPayments();
  };

  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);

  return {
    payments,
    loading,
    addPayment,
    deletePayment,
    totalReceived,
    refreshPayments: fetchPayments,
  };
};
