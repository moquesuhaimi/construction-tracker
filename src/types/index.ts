export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  totalBudget: number;
  totalExpenses: number;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'on-hold';
  createdAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  email: string;
  userId: string | null;
  name?: string;
  canViewCashPosition: boolean;
  addedAt: string;
}

export interface CashAdvance {
  id: string;
  projectId: string;
  recipientId: string;
  recipientName?: string;
  givenBy: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface ProgressPayment {
  id: string;
  projectId: string;
  amount: number;
  date: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  projectId: string;
  userId: string;
  userName?: string;
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
