import { useCallback, useEffect, useState } from 'react';
import { Expense, PeriodFilter } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

type ExpenseRow = {
  id: string;
  project_id: string;
  user_id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  receipt: string | null;
  receipt_image?: string | null;
  has_receipt_image: boolean;
  created_at: string;
  profiles?: { name: string } | { name: string }[] | null;
};

// Every expense row EXCEPT receipt_image - that column can be several MB of
// base64 text per row, so it's never included when fetching the whole list.
// It's fetched on-demand (see fetchReceiptImage) only when someone opens it.
const LIST_COLUMNS = 'id, project_id, user_id, category, description, amount, date, receipt, has_receipt_image, created_at';

const fromRow = (row: ExpenseRow): Expense => {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    userName: profile?.name,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    date: row.date,
    receipt: row.receipt ?? undefined,
    receiptImage: row.receipt_image ?? undefined,
    hasReceiptImage: row.has_receipt_image,
    createdAt: row.created_at,
  };
};

export const useExpenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    if (!user) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('expenses')
      .select(`${LIST_COLUMNS}, profiles ( name )`)
      .order('date', { ascending: false });

    if (error || !data) {
      console.error('Failed to load expenses', error);
      setExpenses([]);
      setLoading(false);
      return;
    }

    setExpenses((data as ExpenseRow[]).map(fromRow));
    setLoading(false);
  }, [user]);

  // Fetch the full receipt image for a single expense, on demand (e.g. when
  // the user opens the lightbox). Not included in the list query above
  // because it can be several MB of base64 text per row.
  const fetchReceiptImage = useCallback(async (id: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('expenses')
      .select('receipt_image')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Failed to load receipt image', error);
      return null;
    }

    return (data as { receipt_image: string | null }).receipt_image ?? null;
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt' | 'userId' | 'userName'>) => {
    if (!user) throw new Error('You must be signed in.');

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        project_id: expense.projectId,
        user_id: user.id,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        date: expense.date,
        receipt: expense.receipt || null,
        receipt_image: expense.receiptImage || null,
      })
      .select('*, profiles ( name )')
      .single();

    if (error || !data) throw error ?? new Error('Failed to add expense');

    await fetchExpenses();
    return fromRow(data as ExpenseRow);
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    const { error } = await supabase
      .from('expenses')
      .update({
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.amount !== undefined && { amount: updates.amount }),
        ...(updates.date !== undefined && { date: updates.date }),
        ...(updates.receipt !== undefined && { receipt: updates.receipt || null }),
        ...(updates.receiptImage !== undefined && { receipt_image: updates.receiptImage || null }),
      })
      .eq('id', id);

    if (error) throw error;
    await fetchExpenses();
    return expenses.find((expense) => expense.id === id);
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    await fetchExpenses();
  };

  const getExpensesByProject = (projectId: string) => {
    return expenses.filter((expense) => expense.projectId === projectId);
  };

  const getExpensesByPeriod = (period: PeriodFilter) => {
    const now = new Date();
    const startOfPeriod = new Date();

    switch (period) {
      case 'week':
        startOfPeriod.setDate(now.getDate() - 7);
        break;
      case 'month':
        startOfPeriod.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startOfPeriod.setFullYear(now.getFullYear() - 1);
        break;
    }

    return expenses.filter((expense) => new Date(expense.date) >= startOfPeriod);
  };

  const getTotalExpenses = () => {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
  };

  return {
    expenses,
    loading,
    addExpense,
    updateExpense,
    deleteExpense,
    getExpensesByProject,
    getExpensesByPeriod,
    getTotalExpenses,
    fetchReceiptImage,
    refreshExpenses: fetchExpenses,
  };
};
