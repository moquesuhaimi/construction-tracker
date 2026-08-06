import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Calendar, DollarSign, Building, AlertCircle, Eye, ArrowLeft, Download, FileSpreadsheet, Users, X, Mail, Wallet, Landmark } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { useExpenses } from '../hooks/useExpenses';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { useCashAdvances } from '../hooks/useCashAdvances';
import { useProgressPayments } from '../hooks/useProgressPayments';
import { useAuth } from '../hooks/useAuth';
import { Project, Expense } from '../types';
import { PROJECT_STATUSES, EXPENSE_CATEGORIES } from '../utils/constants';
import * as XLSX from 'xlsx';

const TeamModal: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
  const { members, addMember, removeMember } = useProjectMembers(project.id);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await addMember(email);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-4 lg:p-6 max-w-md w-full border border-gray-700 my-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base lg:text-lg font-semibold text-white">Team - {project.name}</h3>
            <p className="text-xs text-gray-400">Anyone added here can sign in and add expenses to this project.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap disabled:opacity-50"
          >
            Add
          </button>
        </form>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="space-y-2">
          {members.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">No team members yet. Add one by email above.</p>
          )}
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2">
              <div>
                <p className="text-white text-sm">{member.name || member.email}</p>
                {member.name && <p className="text-xs text-gray-500">{member.email}</p>}
                <p className="text-xs text-gray-400">
                  {member.userId ? 'Active - has signed in' : 'Pending - waiting for them to sign up'}
                </p>
              </div>
              <button
                onClick={() => removeMember(member.id)}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CashFlowModal: React.FC<{ project: Project; expenses: Expense[]; onClose: () => void }> = ({
  project,
  expenses,
  onClose,
}) => {
  const { members } = useProjectMembers(project.id);
  const { advances, deleteAdvance } = useCashAdvances(project.id);

  const activeMembers = members.filter((m) => m.userId);

  const projectExpenses = expenses.filter((e) => e.projectId === project.id);

  const balances = activeMembers.map((member) => {
    const given = advances
      .filter((a) => a.recipientId === member.userId)
      .reduce((sum, a) => sum + a.amount, 0);
    const spent = projectExpenses
      .filter((e) => e.userId === member.userId)
      .reduce((sum, e) => sum + e.amount, 0);
    return { member, given, spent, balance: given - spent };
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-4 lg:p-6 max-w-2xl w-full border border-gray-700 my-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base lg:text-lg font-semibold text-white">Cash Flow - {project.name}</h3>
            <p className="text-xs text-gray-400">
              Petty cash given, spent, and outstanding per team member. To give cash, use "Give Petty Cash" on the Add Expense screen.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Balances */}
        <div className="space-y-2 mb-6">
          {activeMembers.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">
              No active team members yet. Add someone in "Manage Team" first, and wait for them to sign up.
            </p>
          )}
          {balances.map(({ member, given, spent, balance }) => (
            <div key={member.id} className="bg-gray-700 rounded-lg px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-medium">{member.name || member.email}</p>
                <span
                  className={`text-sm font-semibold ${
                    balance > 0 ? 'text-yellow-500' : balance < 0 ? 'text-red-500' : 'text-green-500'
                  }`}
                >
                  {balance > 0
                    ? `Holding $${balance.toLocaleString()}`
                    : balance < 0
                    ? `Owed $${Math.abs(balance).toLocaleString()}`
                    : 'Settled'}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-gray-400">
                <span>Given: ${given.toLocaleString()}</span>
                <span>Spent: ${spent.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        {/* History */}
        {advances.length > 0 && (
          <div className="border-t border-gray-700 pt-4">
            <p className="text-sm font-medium text-gray-300 mb-2">Advance History</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {advances.map((advance) => {
                const member = members.find((m) => m.userId === advance.recipientId);
                return (
                  <div key={advance.id} className="flex items-center justify-between text-sm bg-gray-700 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-white">
                        ${advance.amount.toLocaleString()} to {member?.name || member?.email || 'a team member'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(advance.date).toLocaleDateString()}
                        {advance.notes ? ` - ${advance.notes}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteAdvance(advance.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PaymentsModal: React.FC<{ project: Project; totalExpenses: number; onClose: () => void }> = ({
  project,
  totalExpenses,
  onClose,
}) => {
  const { payments, addPayment, deletePayment, totalReceived } = useProgressPayments(project.id);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cashPosition = totalReceived - totalExpenses;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    setError(null);
    setSubmitting(true);
    try {
      await addPayment({ amount: parseFloat(amount), date, description: description.trim() || undefined });
      setAmount('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-4 lg:p-6 max-w-2xl w-full border border-gray-700 my-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base lg:text-lg font-semibold text-white">Payments - {project.name}</h3>
            <p className="text-xs text-gray-400">
              Record what the client has actually paid so far, separate from the total contract value.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Cash position summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-700 rounded-lg px-3 py-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Received</p>
            <p className="text-white font-semibold text-sm lg:text-base">${totalReceived.toLocaleString()}</p>
          </div>
          <div className="bg-gray-700 rounded-lg px-3 py-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Spent</p>
            <p className="text-white font-semibold text-sm lg:text-base">${totalExpenses.toLocaleString()}</p>
          </div>
          <div className="bg-gray-700 rounded-lg px-3 py-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Cash Position</p>
            <p className={`font-semibold text-sm lg:text-base ${cashPosition < 0 ? 'text-red-500' : 'text-green-500'}`}>
              {cashPosition < 0 ? `-$${Math.abs(cashPosition).toLocaleString()}` : `$${cashPosition.toLocaleString()}`}
            </p>
          </div>
        </div>

        {cashPosition < 0 && (
          <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-lg p-3 mb-6 text-sm text-red-400">
            You've spent ${Math.abs(cashPosition).toLocaleString()} more than the client has paid so far. This
            project is currently being funded out of pocket until the next payment comes in.
          </div>
        )}

        {/* Add payment form */}
        <form onSubmit={handleAdd} className="space-y-3 border-t border-gray-700 pt-4 mb-6">
          <p className="text-sm font-medium text-gray-300">Record Payment Received</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              step="0.01"
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
              required
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
              required
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Deposit, Progress Claim 1 (optional)"
              className="sm:col-span-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
          >
            Record Payment
          </button>
        </form>

        {/* History */}
        <div className="space-y-2">
          {payments.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No payments recorded yet.</p>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between text-sm bg-gray-700 rounded-lg px-3 py-2">
                <div>
                  <p className="text-white">${payment.amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(payment.date).toLocaleDateString()}
                    {payment.description ? ` - ${payment.description}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => deletePayment(payment.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const Projects: React.FC = () => {
  const { user } = useAuth();
  const { projects, addProject, updateProject, deleteProject } = useProjects();
  const { expenses, deleteExpense } = useExpenses();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProjectExpenses, setViewingProjectExpenses] = useState<string | null>(null);
  const [managingTeamFor, setManagingTeamFor] = useState<Project | null>(null);
  const [managingCashFor, setManagingCashFor] = useState<Project | null>(null);
  const [managingPaymentsFor, setManagingPaymentsFor] = useState<Project | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const { totalReceived: viewingProjectReceived } = useProgressPayments(viewingProjectExpenses);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    totalBudget: '',
    startDate: '',
    endDate: '',
    status: 'active' as Project['status'],
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      totalBudget: '',
      startDate: '',
      endDate: '',
      status: 'active',
    });
    setShowAddForm(false);
    setEditingProject(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.totalBudget) {
      alert('Please fill in all required fields');
      return;
    }

    const projectData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      totalBudget: parseFloat(formData.totalBudget),
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      status: formData.status,
    };

    if (editingProject) {
      updateProject(editingProject.id, projectData);
    } else {
      addProject(projectData);
    }

    resetForm();
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description,
      totalBudget: project.totalBudget.toString(),
      startDate: project.startDate,
      endDate: project.endDate || '',
      status: project.status,
    });
    setShowAddForm(true);
  };

  const handleDelete = (project: Project) => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"?`)) {
      deleteProject(project.id);
    }
  };

  const handleDeleteExpense = (expense: any) => {
    if (window.confirm(`Are you sure you want to delete this expense: "${expense.description}"?`)) {
      deleteExpense(expense.id);
    }
  };

  const getProjectExpenses = (projectId: string) => {
    return expenses
      .filter(expense => expense.projectId === projectId)
      .reduce((total, expense) => total + expense.amount, 0);
  };

  const getStatusColor = (status: Project['status']) => {
    const statusConfig = PROJECT_STATUSES.find(s => s.id === status);
    return statusConfig?.color || 'bg-gray-500';
  };

  const getBudgetStatus = (budget: number, spent: number) => {
    const percentage = (spent / budget) * 100;
    if (percentage > 90) return 'text-red-500';
    if (percentage > 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getProjectExpenseDetails = (projectId: string) => {
    return expenses
      .filter(expense => expense.projectId === projectId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getCategoryName = (categoryId: string) => {
    return EXPENSE_CATEGORIES.find(cat => cat.id === categoryId)?.name || categoryId;
  };

  const exportToSpreadsheet = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    const projectExpenses = getProjectExpenseDetails(projectId);
    
    if (!project || projectExpenses.length === 0) {
      alert('No expenses to export for this project.');
      return;
    }

    // Prepare data for spreadsheet
    const worksheetData = [
      // Header row
      ['Project Name', 'Date', 'Category', 'Description', 'Amount', 'Receipt Number', 'Created Date'],
      // Data rows
      ...projectExpenses.map(expense => [
        project.name,
        new Date(expense.date).toLocaleDateString(),
        getCategoryName(expense.category),
        expense.description,
        expense.amount,
        expense.receipt || '',
        new Date(expense.createdAt).toLocaleDateString()
      ]),
      // Summary rows
      [],
      ['Summary'],
      ['Total Expenses', '', '', '', projectExpenses.reduce((sum, exp) => sum + exp.amount, 0)],
      ['Project Budget', '', '', '', project.totalBudget],
      ['Remaining Budget', '', '', '', project.totalBudget - projectExpenses.reduce((sum, exp) => sum + exp.amount, 0)],
      ['Budget Usage %', '', '', '', `${((projectExpenses.reduce((sum, exp) => sum + exp.amount, 0) / project.totalBudget) * 100).toFixed(2)}%`],
      [],
      ['Export Date', new Date().toLocaleDateString()],
      ['Total Records', projectExpenses.length]
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Style the header row
    const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      worksheet[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "FFD102" } }
      };
    }

    // Set column widths
    worksheet['!cols'] = [
      { width: 20 }, // Project Name
      { width: 12 }, // Date
      { width: 15 }, // Category
      { width: 30 }, // Description
      { width: 12 }, // Amount
      { width: 15 }, // Receipt Number
      { width: 15 }  // Created Date
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

    // Generate filename
    const sanitizedProjectName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${sanitizedProjectName}_expenses_${dateStr}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
  };

  const exportAllProjectsToSpreadsheet = () => {
    if (projects.length === 0) {
      alert('No projects to export.');
      return;
    }

    const workbook = XLSX.utils.book_new();

    // Create summary sheet
    const summaryData = [
      ['Project Summary Report'],
      ['Generated on', new Date().toLocaleDateString()],
      [],
      ['Project Name', 'Status', 'Total Budget', 'Total Spent', 'Remaining Budget', 'Budget Usage %', 'Start Date', 'End Date'],
      ...projects.map(project => {
        const totalSpent = getProjectExpenses(project.id);
        const remaining = project.totalBudget - totalSpent;
        const usagePercent = project.totalBudget > 0 ? (totalSpent / project.totalBudget) * 100 : 0;
        
        return [
          project.name,
          PROJECT_STATUSES.find(s => s.id === project.status)?.name || project.status,
          project.totalBudget,
          totalSpent,
          remaining,
          `${usagePercent.toFixed(2)}%`,
          project.startDate || '',
          project.endDate || ''
        ];
      })
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [
      { width: 25 }, { width: 12 }, { width: 15 }, { width: 15 }, 
      { width: 18 }, { width: 15 }, { width: 12 }, { width: 12 }
    ];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Project Summary');

    // Create detailed expenses sheet
    const allExpenses = expenses.map(expense => {
      const project = projects.find(p => p.id === expense.projectId);
      return {
        ...expense,
        projectName: project?.name || 'Unknown Project'
      };
    });

    if (allExpenses.length > 0) {
      const expensesData = [
        ['All Expenses - Detailed Report'],
        ['Generated on', new Date().toLocaleDateString()],
        [],
        ['Project Name', 'Date', 'Category', 'Description', 'Amount', 'Receipt Number', 'Created Date'],
        ...allExpenses.map(expense => [
          expense.projectName,
          new Date(expense.date).toLocaleDateString(),
          getCategoryName(expense.category),
          expense.description,
          expense.amount,
          expense.receipt || '',
          new Date(expense.createdAt).toLocaleDateString()
        ])
      ];

      const expensesSheet = XLSX.utils.aoa_to_sheet(expensesData);
      expensesSheet['!cols'] = [
        { width: 20 }, { width: 12 }, { width: 15 }, { width: 30 }, 
        { width: 12 }, { width: 15 }, { width: 15 }
      ];
      XLSX.utils.book_append_sheet(workbook, expensesSheet, 'All Expenses');
    }

    // Save file
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `construction_expenses_report_${dateStr}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // If viewing project expenses, show the detailed view
  if (viewingProjectExpenses) {
    const project = projects.find(p => p.id === viewingProjectExpenses);
    const projectExpenses = getProjectExpenseDetails(viewingProjectExpenses);
    const totalExpenses = getProjectExpenses(viewingProjectExpenses);

    if (!project) {
      setViewingProjectExpenses(null);
      return null;
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setViewingProjectExpenses(null)}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg lg:text-2xl font-bold text-white">{project.name} - Expenses</h1>
            <p className="text-sm lg:text-base text-gray-400">Detailed expense breakdown for this project</p>
          </div>
          <div className="hidden sm:block">
            <button
              onClick={() => exportToSpreadsheet(viewingProjectExpenses)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2 text-sm lg:text-base"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden lg:inline">Export to Excel</span>
              <span className="lg:hidden">Export</span>
            </button>
          </div>
        </div>

        {/* Project Summary */}
        <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Total Budget</p>
              <p className="text-xl lg:text-2xl font-bold text-white">${project.totalBudget.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Total Spent</p>
              <p className="text-xl lg:text-2xl font-bold text-white">${totalExpenses.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Remaining Budget</p>
              <p className={`text-xl lg:text-2xl font-bold ${getBudgetStatus(project.totalBudget, totalExpenses)}`}>
                ${(project.totalBudget - totalExpenses).toLocaleString()}
              </p>
            </div>
          </div>

          {project.ownerId === user?.id && (
            <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs lg:text-sm flex items-center gap-2">
                  <Landmark className="h-3.5 w-3.5" />
                  Cash Position (Received - Spent)
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Received: ${viewingProjectReceived.toLocaleString()}</p>
              </div>
              <p
                className={`text-lg lg:text-xl font-bold ${
                  viewingProjectReceived - totalExpenses < 0 ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {viewingProjectReceived - totalExpenses < 0
                  ? `-$${Math.abs(viewingProjectReceived - totalExpenses).toLocaleString()}`
                  : `$${(viewingProjectReceived - totalExpenses).toLocaleString()}`}
              </p>
            </div>
          )}

          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-300 text-xs lg:text-sm">Budget Usage</span>
              <span className="text-gray-300 text-xs lg:text-sm">
                {((totalExpenses / project.totalBudget) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div 
                className={`h-3 rounded-full ${
                  (totalExpenses / project.totalBudget) * 100 > 90 
                    ? 'bg-red-500' 
                    : (totalExpenses / project.totalBudget) * 100 > 70 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((totalExpenses / project.totalBudget) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Expenses List */}
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="p-4 lg:p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-base lg:text-lg font-semibold text-white">
                All Expenses ({projectExpenses.length})
              </h3>
              {projectExpenses.length > 0 && (
                <div className="sm:hidden">
                  <button
                    onClick={() => exportToSpreadsheet(viewingProjectExpenses)}
                    className="text-green-400 hover:text-green-300 transition-colors inline-flex items-center gap-2 text-xs"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {projectExpenses.length > 0 ? (
            <div className="divide-y divide-gray-700">
              {projectExpenses.map((expense) => (
                <div key={expense.id} className="p-4 lg:p-6 hover:bg-gray-750 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {expense.receiptImage && (
                      <button
                        type="button"
                        onClick={() => setViewingReceipt(expense.receiptImage!)}
                        className="flex-shrink-0"
                        title="View receipt"
                      >
                        <img
                          src={expense.receiptImage}
                          alt="Receipt"
                          className="w-14 h-14 lg:w-16 lg:h-16 object-cover rounded-lg border border-gray-600 hover:border-yellow-500 transition-colors"
                        />
                      </button>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs lg:text-sm font-medium bg-yellow-500 bg-opacity-20 text-yellow-500">
                          {getCategoryName(expense.category)}
                        </span>
                        <span className="text-gray-400 text-xs lg:text-sm">
                          {new Date(expense.date).toLocaleDateString()}
                        </span>
                        {expense.receipt && (
                          <span className="text-gray-400 text-xs lg:text-sm hidden sm:inline">
                            Receipt: {expense.receipt}
                          </span>
                        )}
                      </div>
                      <h4 className="text-white font-medium mb-1 text-sm lg:text-base">{expense.description}</h4>
                      <p className="text-gray-400 text-xs lg:text-sm">
                        Added by {expense.userName || 'a team member'} on {new Date(expense.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg lg:text-2xl font-bold text-white">${expense.amount.toLocaleString()}</p>
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => handleDeleteExpense(expense)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Delete expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-base lg:text-lg font-medium text-white mb-2">No expenses yet</h3>
              <p className="text-sm lg:text-base text-gray-400">Start adding expenses to track your project costs</p>
            </div>
          )}
        </div>

        {viewingReceipt && (
          <div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50"
            onClick={() => setViewingReceipt(null)}
          >
            <div className="relative max-w-2xl w-full">
              <button
                onClick={() => setViewingReceipt(null)}
                className="absolute -top-10 right-0 text-gray-300 hover:text-white transition-colors"
                title="Close"
              >
                <X className="h-8 w-8" />
              </button>
              <img
                src={viewingReceipt}
                alt="Receipt"
                className="w-full max-h-[85vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm lg:text-base text-gray-400">Manage your construction projects</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={exportAllProjectsToSpreadsheet}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center justify-center gap-2 text-sm lg:text-base"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export All</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center justify-center gap-2 text-sm lg:text-base"
          >
            <Plus className="h-4 w-4" />
            Add Project
          </button>
        </div>
      </div>

      {/* Add/Edit Project Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
          <h3 className="text-base lg:text-lg font-semibold text-white mb-4">
            {editingProject ? 'Edit Project' : 'Add New Project'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm lg:text-base"
                  placeholder="Enter project name"
                  required
                />
              </div>

              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
                  Total Budget *
                </label>
                <input
                  type="number"
                  value={formData.totalBudget}
                  onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
                  className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm lg:text-base"
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm lg:text-base"
                />
              </div>

              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm lg:text-base"
                />
              </div>

              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Project['status'] })}
                  className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm lg:text-base"
                >
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm lg:text-base"
                placeholder="Enter project description"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 lg:py-3 rounded-lg font-medium transition-colors text-sm lg:text-base"
              >
                {editingProject ? 'Update Project' : 'Add Project'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 lg:py-3 rounded-lg font-medium transition-colors text-sm lg:text-base"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const totalExpenses = getProjectExpenses(project.id);
          const budgetPercentage = (totalExpenses / project.totalBudget) * 100;
          
          return (
            <div key={project.id} className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700 hover:border-gray-600 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base lg:text-lg font-semibold text-white">{project.name}</h3>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs lg:text-sm font-medium text-white ${getStatusColor(project.status)}`}>
                    {PROJECT_STATUSES.find(s => s.id === project.status)?.name}
                  </span>
                </div>
                <div className="flex gap-2">
                  {project.ownerId === user?.id && (
                    <>
                      <button
                        onClick={() => setManagingTeamFor(project)}
                        className="text-gray-400 hover:text-yellow-500 transition-colors"
                        title="Manage Team"
                      >
                        <Users className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setManagingCashFor(project)}
                        className="text-gray-400 hover:text-yellow-500 transition-colors"
                        title="Cash Flow"
                      >
                        <Wallet className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setManagingPaymentsFor(project)}
                        className="text-gray-400 hover:text-yellow-500 transition-colors"
                        title="Payments"
                      >
                        <Landmark className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(project)}
                        className="text-gray-400 hover:text-yellow-500 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setViewingProjectExpenses(project.id)}
                    className="text-gray-400 hover:text-blue-500 transition-colors"
                    title="View Expenses"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {project.ownerId === user?.id && (
                    <button
                      onClick={() => handleDelete(project)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {project.description && (
                <p className="text-gray-400 text-xs lg:text-sm mb-4 line-clamp-2">{project.description}</p>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs lg:text-sm">
                      <span className="text-gray-300">Budget</span>
                      <span className={`font-medium ${getBudgetStatus(project.totalBudget, totalExpenses)} text-xs lg:text-sm`}>
                        ${totalExpenses.toLocaleString()} / ${project.totalBudget.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                      <div 
                        className={`h-2 rounded-full ${budgetPercentage > 90 ? 'bg-red-500' : budgetPercentage > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {project.startDate && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-300 text-xs lg:text-sm">
                      {new Date(project.startDate).toLocaleDateString()}
                      {project.endDate && ` - ${new Date(project.endDate).toLocaleDateString()}`}
                    </span>
                  </div>
                )}

                {budgetPercentage > 90 && (
                  <div className="flex items-center gap-2 text-red-500 text-xs lg:text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>Budget limit exceeded</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base lg:text-lg font-medium text-white mb-2">No projects yet</h3>
          <p className="text-sm lg:text-base text-gray-400 mb-4">Create your first construction project to get started</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 lg:py-3 rounded-lg font-medium transition-colors text-sm lg:text-base"
          >
            Add Your First Project
          </button>
        </div>
      )}

      {managingTeamFor && (
        <TeamModal project={managingTeamFor} onClose={() => setManagingTeamFor(null)} />
      )}

      {managingCashFor && (
        <CashFlowModal project={managingCashFor} expenses={expenses} onClose={() => setManagingCashFor(null)} />
      )}

      {managingPaymentsFor && (
        <PaymentsModal
          project={managingPaymentsFor}
          totalExpenses={getProjectExpenses(managingPaymentsFor.id)}
          onClose={() => setManagingPaymentsFor(null)}
        />
      )}
    </div>
  );
};