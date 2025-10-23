import { useState, useEffect } from 'react';
import { Expense, PeriodFilter } from '../types';
import { storageUtils } from '../utils/storage';

export const useExpenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedExpenses = storageUtils.getExpenses();
    setExpenses(savedExpenses);
    setLoading(false);
  }, []);

  const addExpense = (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExpense: Expense = {
      ...expense,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    
    const updatedExpenses = [...expenses, newExpense];
    setExpenses(updatedExpenses);
    storageUtils.saveExpenses(updatedExpenses);
    return newExpense;
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    const updatedExpenses = expenses.map(expense =>
      expense.id === id ? { ...expense, ...updates } : expense
    );
    setExpenses(updatedExpenses);
    storageUtils.saveExpenses(updatedExpenses);
    return updatedExpenses.find(expense => expense.id === id);
  };

  const deleteExpense = (id: string) => {
    const updatedExpenses = expenses.filter(expense => expense.id !== id);
    setExpenses(updatedExpenses);
    storageUtils.saveExpenses(updatedExpenses);
  };

  const getExpensesByProject = (projectId: string) => {
    return expenses.filter(expense => expense.projectId === projectId);
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

    return expenses.filter(expense => new Date(expense.date) >= startOfPeriod);
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
  };
};