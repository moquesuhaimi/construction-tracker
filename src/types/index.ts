export interface Project {
  id: string;
  name: string;
  description: string;
  totalBudget: number;
  totalExpenses: number;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'on-hold';
  createdAt: string;
}

export interface Expense {
  id: string;
  projectId: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  receipt?: string;
  receiptImage?: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  avatar?: string;
  profileImage?: string;
}

export type TabType = 'dashboard' | 'projects' | 'add-expense' | 'settings';

export type PeriodFilter = 'week' | 'month' | 'year';