import React, { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, PiggyBank, Landmark, ArrowDownCircle, ArrowUpCircle, Hourglass, AlertTriangle } from 'lucide-react';
import { useExpenses } from '../hooks/useExpenses';
import { useProjects } from '../hooks/useProjects';
import { useUser } from '../hooks/useUser';
import { useAuth } from '../hooks/useAuth';
import { useProjectFinancials } from '../hooks/useProjectFinancials';
import { PeriodFilter } from '../types';
import { PERIOD_FILTERS, EXPENSE_CATEGORIES } from '../utils/constants';
import { formatDate } from '../utils/date';
import { formatRM } from '../utils/money';

export const Dashboard: React.FC = () => {
  const { expenses, getExpensesByPeriod, getTotalExpenses } = useExpenses();
  const { projects } = useProjects();
  const { user } = useUser();
  const { user: authUser, isAdmin } = useAuth();
  const { receivedByProject } = useProjectFinancials();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('month');

  // Cash figures only cover projects whose client payments this user may see
  // (owner or app admin) - otherwise "received" would read as 0 and the
  // numbers would look worse than they are.
  const cashProjects = projects
    .filter((p) => p.ownerId === authUser?.id || isAdmin)
    .map((p) => {
      const received = receivedByProject.get(p.id) ?? 0;
      return {
        ...p,
        received,
        cashPosition: received - p.totalExpenses,
        unpaid: Math.max(0, p.totalBudget - received),
      };
    });
  const showCash = cashProjects.length > 0;
  const totalReceived = cashProjects.reduce((sum, p) => sum + p.received, 0);
  const totalSpent = cashProjects.reduce((sum, p) => sum + p.totalExpenses, 0);
  const totalCashPosition = totalReceived - totalSpent;
  const totalUnpaid = cashProjects.reduce((sum, p) => sum + p.unpaid, 0);
  const selfFundedProjects = cashProjects
    .filter((p) => p.cashPosition < 0)
    .sort((a, b) => a.cashPosition - b.cashPosition);

  const periodLabel = PERIOD_FILTERS.find((f) => f.id === selectedPeriod)?.name ?? '';

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
    return categoryTotals.filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  };

  const getRecentExpenses = () => {
    return expenses
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  };

  const categoryExpenses = getCategoryExpenses();
  const periodTotal = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const recentExpenses = getRecentExpenses();
  const budgetUsage = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

  // Project Profit Summary - only completed projects, since profit is the
  // actual final number (budget minus actual spend), not a forecast.
  const completedProjects = projects
    .filter((p) => p.status === 'completed')
    .map((p) => ({
      ...p,
      profit: p.totalBudget - p.totalExpenses,
      marginPct: p.totalBudget > 0 ? ((p.totalBudget - p.totalExpenses) / p.totalBudget) * 100 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);
  const totalCompletedBudget = completedProjects.reduce((sum, p) => sum + p.totalBudget, 0);
  const totalProfit = completedProjects.reduce((sum, p) => sum + p.profit, 0);
  const overallMarginPct = totalCompletedBudget > 0 ? (totalProfit / totalCompletedBudget) * 100 : 0;

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

      {/* Cash flow - all projects */}
      {showCash && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              label: 'Cash Position',
              value: totalCashPosition < 0 ? `-${formatRM(Math.abs(totalCashPosition))}` : formatRM(totalCashPosition),
              hint: 'Received − Spent, all projects',
              Icon: Landmark,
              tone: totalCashPosition < 0 ? 'text-red-500' : 'text-green-500',
              valueTone: totalCashPosition < 0 ? 'text-red-500' : 'text-green-500',
              card: totalCashPosition < 0 ? 'bg-red-500 bg-opacity-10 border-red-500' : 'bg-gray-800 border-gray-700',
            },
            { label: 'Received', value: formatRM(totalReceived), hint: 'Paid by clients', Icon: ArrowDownCircle, tone: 'text-green-500', valueTone: 'text-white', card: 'bg-gray-800 border-gray-700' },
            { label: 'Spent', value: formatRM(totalSpent), hint: 'All expenses', Icon: ArrowUpCircle, tone: 'text-yellow-500', valueTone: 'text-white', card: 'bg-gray-800 border-gray-700' },
            { label: 'Owed by Clients', value: formatRM(totalUnpaid), hint: 'Contract value − received', Icon: Hourglass, tone: 'text-blue-500', valueTone: 'text-white', card: 'bg-gray-800 border-gray-700' },
          ].map(({ label, value, hint, Icon, tone, valueTone, card }) => (
            <div key={label} className={`rounded-lg p-4 lg:p-5 border min-w-0 ${card}`}>
              <p className="flex items-center gap-2 text-gray-400 text-xs lg:text-sm">
                <Icon className={`h-4 w-4 flex-shrink-0 ${tone}`} />
                {label}
              </p>
              <p className={`mt-2 text-lg lg:text-2xl font-bold whitespace-nowrap ${valueTone}`}>{value}</p>
              <p className="text-[11px] lg:text-xs text-gray-500 mt-1">{hint}</p>
            </div>
          ))}
        </div>
      )}

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:gap-4">
        <div className="bg-gray-800 rounded-lg px-4 py-3 border border-gray-700 flex items-center gap-3">
          <BarChart3 className="h-4 w-4 text-green-500 flex-shrink-0 hidden sm:block" />
          <div>
            <p className="text-gray-400 text-[11px] lg:text-xs">Active Projects</p>
            <p className="text-sm lg:text-lg font-semibold text-white">{activeProjects}</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border border-gray-700 flex items-center gap-3 col-span-2 sm:col-span-1 order-last sm:order-none">
          <TrendingUp className="h-4 w-4 text-blue-500 flex-shrink-0 hidden sm:block" />
          <div className="min-w-0">
            <p className="text-gray-400 text-[11px] lg:text-xs">Total Budget</p>
            <p className="text-sm lg:text-lg font-semibold text-white whitespace-nowrap">{formatRM(totalBudget)}</p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-3 border border-gray-700 flex items-center gap-3">
          {budgetUsage > 80 ? (
            <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0 hidden sm:block" />
          ) : (
            <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0 hidden sm:block" />
          )}
          <div>
            <p className="text-gray-400 text-[11px] lg:text-xs">Budget Usage</p>
            <p className={`text-sm lg:text-lg font-semibold ${budgetUsage > 80 ? 'text-red-500' : 'text-white'}`}>
              {budgetUsage.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Projects currently funded out of pocket */}
      {showCash && selfFundedProjects.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-red-500 border-opacity-60">
          <div className="flex items-center justify-between mb-1 gap-3">
            <h3 className="text-base lg:text-lg font-semibold text-white flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
              Self-Funded Projects
            </h3>
            <span className="text-sm lg:text-base font-bold text-red-500 whitespace-nowrap">
              -{formatRM(Math.abs(selfFundedProjects.reduce((sum, p) => sum + p.cashPosition, 0)))}
            </span>
          </div>
          <p className="text-xs lg:text-sm text-gray-400 mb-4">
            Spending is higher than what the client has paid. Chase payment on these first.
          </p>
          <div className="space-y-3">
            {selfFundedProjects.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm lg:text-base text-gray-200 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    Received {formatRM(p.received)} · Spent {formatRM(p.totalExpenses)}
                    {p.unpaid > 0 && <> · Unpaid {formatRM(p.unpaid)}</>}
                  </p>
                </div>
                <span className="text-sm lg:text-base font-semibold text-red-400 flex-shrink-0 whitespace-nowrap">
                  -{formatRM(Math.abs(p.cashPosition))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base lg:text-lg font-semibold text-white">Expenses by Category</h3>
              <p className="text-xs text-gray-500">{periodLabel}</p>
            </div>
            <span className="text-sm lg:text-base font-semibold text-yellow-500">{formatRM(periodTotal)}</span>
          </div>
          <div className="space-y-3">
            {categoryExpenses.length === 0 && (
              <p className="text-gray-400 text-center py-8 text-sm lg:text-base">No expenses in this period</p>
            )}
            {categoryExpenses.slice(0, 6).map((category) => (
              <div key={category.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm lg:text-base text-gray-300">{category.name}</span>
                </div>
                <span className="text-sm lg:text-base text-white font-medium">{formatRM(category.total)}</span>
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
                        {project?.name} • {formatDate(expense.date)}
                      </p>
                    </div>
                    <span className="text-sm lg:text-base text-white font-medium flex-shrink-0">{formatRM(expense.amount)}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-400 text-center py-8 text-sm lg:text-base">No expenses recorded yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Project Profit Summary - only shown once a project is marked Completed */}
      {completedProjects.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base lg:text-lg font-semibold text-white">Project Profit Summary</h3>
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-full flex-shrink-0 ${totalProfit >= 0 ? 'bg-green-500 bg-opacity-20' : 'bg-red-500 bg-opacity-20'}`}>
                <PiggyBank className={`h-4 w-4 ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <div className="text-right">
                <p className={`text-base lg:text-lg font-bold ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatRM(totalProfit)} <span className="text-xs lg:text-sm font-medium">({overallMarginPct.toFixed(1)}%)</span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {completedProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm lg:text-base text-gray-300">{project.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatRM(project.totalBudget)} budget − {formatRM(project.totalExpenses)} spent
                  </p>
                </div>
                <span className={`text-sm lg:text-base font-medium flex-shrink-0 ${project.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatRM(project.profit)} <span className="text-xs">({project.marginPct.toFixed(1)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};