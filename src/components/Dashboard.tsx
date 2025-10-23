import React, { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { useExpenses } from '../hooks/useExpenses';
import { useProjects } from '../hooks/useProjects';
import { useUser } from '../hooks/useUser';
import { PeriodFilter } from '../types';
import { PERIOD_FILTERS, EXPENSE_CATEGORIES } from '../utils/constants';

export const Dashboard: React.FC = () => {
  const { expenses, getExpensesByPeriod, getTotalExpenses } = useExpenses();
  const { projects } = useProjects();
  const { user } = useUser();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('month');

  const periodExpenses = getExpensesByPeriod(selectedPeriod);
  const totalExpenses = getTotalExpenses();
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const totalBudget = projects.reduce((sum, p) => sum + p.totalBudget, 0);

  const getCategoryExpenses = () => {
    const categoryTotals = EXPENSE_CATEGORIES.map(category => {
      const total = periodExpenses
        .filter(expense => expense.category === category.id)
        .reduce((sum, expense) => sum + expense.amount, 0);
      return { ...category, total };
    });
    return categoryTotals.sort((a, b) => b.total - a.total);
  };

  const getRecentExpenses = () => {
    return expenses
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  };

  const categoryExpenses = getCategoryExpenses();
  const recentExpenses = getRecentExpenses();
  const budgetUsage = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 lg:gap-6 mb-6">
        {/* User Info Section */}
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full overflow-hidden bg-yellow-500 flex items-center justify-center flex-shrink-0">
            {user?.profileImage ? (
              <img
                src={user.profileImage}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-black font-bold text-sm lg:text-lg">
                  {user?.name?.charAt(0) || 'U'}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex flex-col gap-1">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-white">
                  Welcome back, {user?.name || 'User'}!
                </h1>
                <p className="text-sm lg:text-base text-gray-400">
                  {user?.role && user?.company 
                    ? `${user.role} at ${user.company}` 
                    : 'Overview of your construction expenses'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Period Filter */}
        <div>
          <div className="flex gap-2 flex-wrap justify-start xl:justify-end mb-4 xl:mb-0">
            {PERIOD_FILTERS.map((period) => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriod(period.id as PeriodFilter)}
                className={`px-3 lg:px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${
                  selectedPeriod === period.id
                    ? 'bg-yellow-500 text-black'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {period.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Total Expenses</p>
              <p className="text-xl lg:text-2xl font-bold text-white">${totalExpenses.toLocaleString()}</p>
            </div>
            <div className="bg-yellow-500 bg-opacity-20 p-2 lg:p-3 rounded-full flex-shrink-0">
              <DollarSign className="h-5 w-5 lg:h-6 lg:w-6 text-yellow-500" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Active Projects</p>
              <p className="text-xl lg:text-2xl font-bold text-white">{activeProjects}</p>
            </div>
            <div className="bg-green-500 bg-opacity-20 p-2 lg:p-3 rounded-full flex-shrink-0">
              <BarChart3 className="h-5 w-5 lg:h-6 lg:w-6 text-green-500" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Total Budget</p>
              <p className="text-xl lg:text-2xl font-bold text-white">${totalBudget.toLocaleString()}</p>
            </div>
            <div className="bg-blue-500 bg-opacity-20 p-2 lg:p-3 rounded-full flex-shrink-0">
              <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6 text-blue-500" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Budget Usage</p>
              <p className="text-xl lg:text-2xl font-bold text-white">{budgetUsage.toFixed(1)}%</p>
            </div>
            <div className={`p-2 lg:p-3 rounded-full flex-shrink-0 ${budgetUsage > 80 ? 'bg-red-500 bg-opacity-20' : 'bg-green-500 bg-opacity-20'}`}>
              {budgetUsage > 80 ? 
                <TrendingDown className={`h-5 w-5 lg:h-6 lg:w-6 ${budgetUsage > 80 ? 'text-red-500' : 'text-green-500'}`} /> :
                <TrendingUp className={`h-5 w-5 lg:h-6 lg:w-6 ${budgetUsage > 80 ? 'text-red-500' : 'text-green-500'}`} />
              }
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
          <h3 className="text-base lg:text-lg font-semibold text-white mb-4">Expenses by Category</h3>
          <div className="space-y-3">
            {categoryExpenses.slice(0, 6).map((category) => (
              <div key={category.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm lg:text-base text-gray-300">{category.name}</span>
                </div>
                <span className="text-sm lg:text-base text-white font-medium">${category.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
          <h3 className="text-base lg:text-lg font-semibold text-white mb-4">Recent Expenses</h3>
          <div className="space-y-3">
            {recentExpenses.length > 0 ? (
              recentExpenses.map((expense) => {
                const project = projects.find(p => p.id === expense.projectId);
                return (
                  <div key={expense.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm lg:text-base text-gray-300 line-clamp-2">{expense.description}</p>
                      <p className="text-sm text-gray-400">
                        {project?.name} • {new Date(expense.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-sm lg:text-base text-white font-medium flex-shrink-0">${expense.amount.toLocaleString()}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-400 text-center py-8 text-sm lg:text-base">No expenses recorded yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};