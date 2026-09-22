import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Calendar, DollarSign, Building, AlertCircle, Eye, ArrowLeft, Download, FileSpreadsheet, Users, X, Mail, Wallet, Landmark, BarChart3, ChevronDown, ChevronUp, HardHat } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { useExpenses } from '../hooks/useExpenses';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { useCashAdvances } from '../hooks/useCashAdvances';
import { useProgressPayments } from '../hooks/useProgressPayments';
import { useSubcontractors } from '../hooks/useSubcontractors';
import { useProjectProgress } from '../hooks/useProjectProgress';
import { useProjectFinancials } from '../hooks/useProjectFinancials';
import { useAuth } from '../hooks/useAuth';
import { Project, Expense } from '../types';
import { PROJECT_STATUSES, EXPENSE_CATEGORIES, SUBCONTRACTOR_TRADES } from '../utils/constants';
import {
  calculateProjectHealth,
  RAG_LABEL,
  RAG_DOT_COLOR,
  RAG_BADGE_CLASSES,
  ProjectHealthResult,
  ParamHealth,
} from '../utils/projectHealth';
import * as XLSX from 'xlsx';

const TeamModal: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
  const { members, addMember, removeMember, setCashPositionAccess } = useProjectMembers(project.id);
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
            <div key={member.id} className="bg-gray-700 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
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
              {member.userId && (
                <label className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={member.canViewCashPosition}
                    onChange={(e) => setCashPositionAccess(member.id, e.target.checked)}
                    className="rounded border-gray-500 bg-gray-600 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-xs text-gray-300">Can view Cash Position (client payments received)</span>
                </label>
              )}
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

const SubcontractorRow: React.FC<{
  project: Project;
  expenses: Expense[];
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<Expense | undefined>;
}> = ({ project, expenses, updateExpense }) => {
  const { subcontractors, addSubcontractor, updateSubcontractor } = useSubcontractors(project.id);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTrade, setNewTrade] = useState(SUBCONTRACTOR_TRADES[0]);
  const [newContractValue, setNewContractValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkingSubId, setLinkingSubId] = useState<string | null>(null);
  const [checkedExpenseIds, setCheckedExpenseIds] = useState<Set<string>>(new Set());
  const [linking, setLinking] = useState(false);

  // Editing an existing subcontractor's details (e.g. contract value change
  // from a variation order)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTrade, setEditTrade] = useState(SUBCONTRACTOR_TRADES[0]);
  const [editContractValue, setEditContractValue] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const projectExpenses = expenses.filter((e) => e.projectId === project.id);
  const unlinkedExpenses = projectExpenses.filter((e) => e.category === 'subcontractor' && !e.subcontractorId);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newContractValue) return;
    setError(null);
    setSubmitting(true);
    try {
      await addSubcontractor({ name: newName.trim(), trade: newTrade, contractValue: parseFloat(newContractValue) });
      setNewName('');
      setNewTrade(SUBCONTRACTOR_TRADES[0]);
      setNewContractValue('');
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add subcontractor.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleChecked = (id: string) => {
    setCheckedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLinkSelected = async (subId: string) => {
    setLinking(true);
    try {
      for (const id of checkedExpenseIds) {
        await updateExpense(id, { subcontractorId: subId });
      }
      setCheckedExpenseIds(new Set());
      setLinkingSubId(null);
    } finally {
      setLinking(false);
    }
  };

  const startEdit = (sub: { id: string; name: string; trade: string; contractValue: number }) => {
    setEditingId(sub.id);
    setEditName(sub.name);
    setEditTrade(sub.trade);
    setEditContractValue(sub.contractValue.toString());
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName.trim() || !editContractValue) return;

    setEditError(null);
    setEditSubmitting(true);
    try {
      await updateSubcontractor(editingId, {
        name: editName.trim(),
        trade: editTrade,
        contractValue: parseFloat(editContractValue),
      });
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not update subcontractor.');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="border-t border-gray-700 pt-3 mt-1">
      <div className="space-y-2">
        {subcontractors.length === 0 && (
          <p className="text-xs text-gray-500">No subcontractors added yet for this project.</p>
        )}
        {subcontractors.map((sub) => {
          const paid = projectExpenses
            .filter((e) => e.subcontractorId === sub.id)
            .reduce((sum, e) => sum + e.amount, 0);
          const remaining = sub.contractValue - paid;
          const isExpanded = expandedId === sub.id;
          const isLinking = linkingSubId === sub.id;

          const payments = projectExpenses
            .filter((e) => e.subcontractorId === sub.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const isEditing = editingId === sub.id;

          return (
            <div key={sub.id} className="bg-gray-700 rounded-lg px-3 py-2.5">
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Subcontractor Name"
                    className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    required
                  />
                  <div className="flex gap-2">
                    <select
                      value={editTrade}
                      onChange={(e) => setEditTrade(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      {SUBCONTRACTOR_TRADES.map((trade) => (
                        <option key={trade} value={trade}>
                          {trade}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={editContractValue}
                      onChange={(e) => setEditContractValue(e.target.value)}
                      placeholder="Subcontract Amount"
                      step="0.01"
                      className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      required
                    />
                  </div>
                  {editError && <p className="text-red-500 text-xs">{editError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={editSubmitting}
                      className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black px-3 py-1.5 rounded text-xs font-medium transition-colors"
                    >
                      {editSubmitting ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded text-xs text-gray-300 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="w-full flex items-center justify-between text-left">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                      className="flex-1 text-left"
                    >
                      <p className="text-white text-sm font-medium">
                        {sub.name} <span className="text-gray-400 font-normal">({sub.trade})</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Subcontract Amount: ${sub.contractValue.toLocaleString()} · Paid: $
                        {paid.toLocaleString()} · Balance: ${remaining.toLocaleString()}
                      </p>
                    </button>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => startEdit(sub)}
                        className="text-gray-400 hover:text-yellow-500 transition-colors"
                        title="Edit subcontractor"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setExpandedId(isExpanded ? null : sub.id)}>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <div className="w-full bg-gray-600 rounded-full h-2 mb-3">
                        <div
                          className={`h-2 rounded-full ${remaining < 0 ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min((paid / (sub.contractValue || 1)) * 100, 100)}%` }}
                        />
                      </div>

                      {/* Payment history */}
                      {payments.length > 0 ? (
                        <div className="space-y-1 mb-3">
                          <p className="text-xs text-gray-400 font-medium">Payment History</p>
                          {payments.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between text-xs bg-gray-800 rounded px-2 py-1.5"
                            >
                              <div>
                                <span className="text-white">{p.description}</span>
                                <span className="text-gray-500"> · {new Date(p.date).toLocaleDateString()}</span>
                              </div>
                              <span className="text-gray-300">${p.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 mb-3">No payments linked to this subcontractor yet.</p>
                      )}

                      {unlinkedExpenses.length > 0 && !isLinking && (
                        <button
                          type="button"
                          onClick={() => {
                            setLinkingSubId(sub.id);
                            setCheckedExpenseIds(new Set());
                          }}
                          className="text-xs text-yellow-500 hover:text-yellow-400 transition-colors"
                        >
                          Link existing expenses ({unlinkedExpenses.length} unlinked)...
                        </button>
                      )}

                      {isLinking && (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-400">
                            Tick the expenses that belong to "{sub.name}", then click Link:
                          </p>
                          {unlinkedExpenses.map((exp) => (
                            <label key={exp.id} className="flex items-start gap-2 text-xs bg-gray-800 rounded px-2 py-1.5">
                              <input
                                type="checkbox"
                                checked={checkedExpenseIds.has(exp.id)}
                                onChange={() => toggleChecked(exp.id)}
                                className="mt-0.5 rounded border-gray-500 bg-gray-600 text-yellow-500 focus:ring-yellow-500"
                              />
                              <span className="flex-1">
                                <span className="text-white">{exp.description}</span>
                                <span className="text-gray-400"> - ${exp.amount.toLocaleString()} - {new Date(exp.date).toLocaleDateString()}</span>
                              </span>
                            </label>
                          ))}
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              disabled={checkedExpenseIds.size === 0 || linking}
                              onClick={() => handleLinkSelected(sub.id)}
                              className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black px-3 py-1.5 rounded text-xs font-medium transition-colors"
                            >
                              {linking ? 'Linking...' : `Link ${checkedExpenseIds.size || ''}`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setLinkingSubId(null)}
                              className="px-3 py-1.5 rounded text-xs text-gray-300 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {showAddForm ? (
        <form onSubmit={handleAdd} className="mt-3 space-y-2 bg-gray-700 rounded-lg p-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Subcontractor Name"
            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
            required
          />
          <div className="flex gap-2">
            <select
              value={newTrade}
              onChange={(e) => setNewTrade(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              {SUBCONTRACTOR_TRADES.map((trade) => (
                <option key={trade} value={trade}>
                  {trade}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={newContractValue}
              onChange={(e) => setNewContractValue(e.target.value)}
              placeholder="Subcontract Amount"
              step="0.01"
              className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black px-3 py-1.5 rounded text-xs font-medium transition-colors"
            >
              {submitting ? 'Adding...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded text-xs text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="mt-3 text-xs text-yellow-500 hover:text-yellow-400 transition-colors inline-flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add New Subcontractor
        </button>
      )}
    </div>
  );
};

const SummaryModal: React.FC<{
  project: Project;
  expenses: Expense[];
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<Expense | undefined>;
  onClose: () => void;
}> = ({ project, expenses, updateExpense, onClose }) => {
  const [subcontractorExpanded, setSubcontractorExpanded] = useState(false);

  const projectExpenses = expenses.filter((e) => e.projectId === project.id);
  const totalSpent = projectExpenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals = EXPENSE_CATEGORIES.map((cat) => ({
    ...cat,
    total: projectExpenses.filter((e) => e.category === cat.id).reduce((sum, e) => sum + e.amount, 0),
  })).filter((cat) => cat.total > 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-4 lg:p-6 max-w-2xl w-full border border-gray-700 my-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base lg:text-lg font-semibold text-white">Summary - {project.name}</h3>
            <p className="text-xs text-gray-400">Total expenses by category, and subcontractor contract tracking.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-2">
          {categoryTotals.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">No expenses recorded for this project yet.</p>
          )}
          {categoryTotals.map((cat) => (
            <div key={cat.id}>
              <div
                className={`bg-gray-700 rounded-lg px-3 py-2.5 flex items-center justify-between ${
                  cat.id === 'subcontractor' ? 'cursor-pointer hover:bg-gray-600' : ''
                }`}
                onClick={cat.id === 'subcontractor' ? () => setSubcontractorExpanded((v) => !v) : undefined}
              >
                <div className="flex items-center gap-2">
                  {cat.id === 'subcontractor' && <HardHat className="h-4 w-4 text-gray-400" />}
                  <span className="text-white text-sm font-medium">{cat.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-semibold">${cat.total.toLocaleString()}</span>
                  {cat.id === 'subcontractor' &&
                    (subcontractorExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ))}
                </div>
              </div>

              {cat.id === 'subcontractor' && subcontractorExpanded && (
                <SubcontractorRow project={project} expenses={expenses} updateExpense={updateExpense} />
              )}
            </div>
          ))}

          {/* If there are subcontractor expenses but the category row was filtered out (shouldn't
              normally happen since total > 0 implies a row exists), or the category simply has no
              spend yet but the owner wants to set up a subcontractor ahead of time. */}
          {categoryTotals.every((c) => c.id !== 'subcontractor') && (
            <div>
              <button
                type="button"
                onClick={() => setSubcontractorExpanded((v) => !v)}
                className="w-full bg-gray-700 rounded-lg px-3 py-2.5 flex items-center justify-between hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <HardHat className="h-4 w-4 text-gray-400" />
                  <span className="text-white text-sm font-medium">Subcontractor</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">$0</span>
                  {subcontractorExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </button>
              {subcontractorExpanded && (
                <SubcontractorRow project={project} expenses={expenses} updateExpense={updateExpense} />
              )}
            </div>
          )}

          {categoryTotals.length > 0 && (
            <div className="border-t border-gray-700 mt-3 pt-3 flex items-center justify-between">
              <span className="text-gray-300 text-sm font-medium">Total Spent</span>
              <span className="text-white text-base font-bold">${totalSpent.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProjectHealthModal: React.FC<{
  project: Project;
  health: ProjectHealthResult;
  onClose: () => void;
}> = ({ project, health, onClose }) => {
  const rows: { key: string; label: string; param: ParamHealth }[] = [
    { key: 'schedule', label: 'Schedule', param: health.schedule },
    { key: 'cost', label: 'Cost', param: health.cost },
    { key: 'cashflow', label: 'Cashflow', param: health.cashflow },
    { key: 'profitability', label: 'Profitability', param: health.profitability },
    { key: 'commitments', label: 'Commitments', param: health.commitments },
    { key: 'riskIssues', label: 'Risk / issues', param: health.riskIssues },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-4 lg:p-6 max-w-md w-full border border-gray-700 my-8">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs uppercase tracking-wide text-gray-400">Project health</p>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: RAG_DOT_COLOR[health.overall] }}
          />
          <h3 className="text-lg font-semibold text-white">{project.name} &middot; {RAG_LABEL[health.overall]}</h3>
        </div>

        <div className="divide-y divide-gray-700">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between py-2 gap-3">
              <span className="text-sm text-gray-300">{row.label}</span>
              {row.param.status === 'insufficient_data' ? (
                <span className="text-xs text-gray-500 text-right">{RAG_LABEL.insufficient_data}</span>
              ) : (
                <span className="flex items-center gap-2 text-xs text-right" style={{ color: RAG_DOT_COLOR[row.param.status] }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: RAG_DOT_COLOR[row.param.status] }} />
                  <span>{row.param.label} &middot; {row.param.detail}</span>
                </span>
              )}
            </div>
          ))}
        </div>

        {rows.some((row) => row.param.action) && (
          <div className="mt-4 pt-3 border-t border-gray-700">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Actions to take</p>
            <div className="space-y-2">
              {rows
                .filter((row) => row.param.action)
                .map((row) => (
                  <div key={row.key} className="bg-gray-700 bg-opacity-50 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
                    <AlertCircle
                      className="h-4 w-4 flex-shrink-0 mt-0.5"
                      style={{ color: RAG_DOT_COLOR[row.param.status] }}
                    />
                    <p className="text-xs text-gray-300 leading-relaxed">{row.param.action}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
          <span className="text-xs text-gray-400">Health score</span>
          <span className="text-sm font-semibold text-white">{health.score === null ? '—' : `${health.score} / 100`}</span>
        </div>

        <p className="text-xs text-gray-400 mt-3 leading-relaxed">{health.explanation}</p>
      </div>
    </div>
  );
};

const ADD_NEW_SUBCONTRACTOR = '__add_new__';

const EditExpenseModal: React.FC<{
  project: Project;
  expense: Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<Expense | undefined>;
  onClose: () => void;
}> = ({ project, expense, updateExpense, onClose }) => {
  const { subcontractors, addSubcontractor } = useSubcontractors(project.id);
  const [category, setCategory] = useState(expense.category);
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(expense.amount.toString());
  const [date, setDate] = useState(expense.date);
  const [receipt, setReceipt] = useState(expense.receipt || '');
  const [subcontractorId, setSubcontractorId] = useState(expense.subcontractorId || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubTrade, setNewSubTrade] = useState(SUBCONTRACTOR_TRADES[0]);
  const [newSubContractValue, setNewSubContractValue] = useState('');
  const [subSubmitting, setSubSubmitting] = useState(false);

  const handleSubcontractorSelect = (value: string) => {
    if (value === ADD_NEW_SUBCONTRACTOR) {
      setNewSubName('');
      setNewSubTrade(SUBCONTRACTOR_TRADES[0]);
      setNewSubContractValue('');
      setShowAddSub(true);
      return;
    }
    setSubcontractorId(value);
  };

  const handleAddSub = async () => {
    if (!newSubName.trim() || !newSubContractValue) return;
    setSubSubmitting(true);
    setError(null);
    try {
      const created = await addSubcontractor({
        name: newSubName.trim(),
        trade: newSubTrade,
        contractValue: parseFloat(newSubContractValue),
      });
      setSubcontractorId(created.id);
      setShowAddSub(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add subcontractor.');
    } finally {
      setSubSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount || !date || !category) {
      setError('Please fill in all required fields.');
      return;
    }
    if (category === 'subcontractor' && !subcontractorId) {
      setError('Please select which subcontractor this payment is for.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await updateExpense(expense.id, {
        category,
        description: description.trim(),
        amount: parseFloat(amount),
        date,
        receipt: receipt.trim() || undefined,
        subcontractorId: category === 'subcontractor' ? subcontractorId : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-4 lg:p-6 max-w-lg w-full border border-gray-700 my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base lg:text-lg font-semibold text-white">Edit Expense</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">Category *</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (e.target.value !== 'subcontractor') setSubcontractorId('');
              }}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {category === 'subcontractor' && (
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">Subcontractor *</label>
              <select
                value={subcontractorId}
                onChange={(e) => handleSubcontractorSelect(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              >
                <option value="">Select subcontractor</option>
                {subcontractors.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.trade})
                  </option>
                ))}
                <option value={ADD_NEW_SUBCONTRACTOR}>+ Add New Subcontractor</option>
              </select>
            </div>
          )}

          {showAddSub && (
            <div className="bg-gray-700 rounded-lg p-3 space-y-2">
              <input
                type="text"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="Subcontractor Name"
                className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <div className="flex gap-2">
                <select
                  value={newSubTrade}
                  onChange={(e) => setNewSubTrade(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                >
                  {SUBCONTRACTOR_TRADES.map((trade) => (
                    <option key={trade} value={trade}>
                      {trade}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={newSubContractValue}
                  onChange={(e) => setNewSubContractValue(e.target.value)}
                  placeholder="Subcontract Amount"
                  step="0.01"
                  className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddSub}
                  disabled={subSubmitting}
                  className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black px-3 py-1.5 rounded text-xs font-medium transition-colors"
                >
                  {subSubmitting ? 'Adding...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSub(false)}
                  className="px-3 py-1.5 rounded text-xs text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">Amount *</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">Receipt Number (Optional)</label>
            <input
              type="text"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black px-4 py-2.5 rounded-lg font-medium transition-colors text-sm"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-gray-300 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const Projects: React.FC = () => {
  const { user, isAdmin } = useAuth();
  // App admin (the app's maintainer) gets owner-level access on every
  // project, not just ones they personally created.
  const isOwnerOf = (project: Project) => project.ownerId === user?.id || isAdmin;
  const { getProgressForProject } = useProjectProgress();
  const { projects, addProject, updateProject, deleteProject } = useProjects();
  const { expenses, deleteExpense, fetchReceiptImage, updateExpense } = useExpenses();
  const { receivedByProject, subcontractorsByProject } = useProjectFinancials();
  const [viewingHealthFor, setViewingHealthFor] = useState<Project | null>(null);

  // Project Health is always calculated, never manually set - see
  // src/utils/projectHealth.ts for the full ruleset per parameter.
  const getProjectHealth = (project: Project): ProjectHealthResult => {
    const totalSpent = getProjectExpenses(project.id);
    const subs = subcontractorsByProject.get(project.id) ?? [];
    const subFinancials = subs.map((sub) => ({
      contractValue: sub.contractValue,
      paid: expenses
        .filter((e) => e.subcontractorId === sub.id)
        .reduce((sum, e) => sum + e.amount, 0),
    }));

    return calculateProjectHealth({
      budget: project.totalBudget,
      totalSpent,
      startDate: project.startDate,
      endDate: project.endDate,
      siteProgressPct: getProgressForProject(project.name),
      received: receivedByProject.get(project.id) ?? 0,
      subcontractors: subFinancials,
    });
  };
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProjectExpenses, setViewingProjectExpenses] = useState<string | null>(null);
  const [managingTeamFor, setManagingTeamFor] = useState<Project | null>(null);
  const [managingCashFor, setManagingCashFor] = useState<Project | null>(null);
  const [managingPaymentsFor, setManagingPaymentsFor] = useState<Project | null>(null);
  const [viewingSummaryFor, setViewingSummaryFor] = useState<Project | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const { totalReceived: viewingProjectReceived } = useProgressPayments(viewingProjectExpenses);
  const { members: viewingProjectMembers } = useProjectMembers(viewingProjectExpenses);
  const { advances: viewingProjectAdvances } = useCashAdvances(viewingProjectExpenses);
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
    const filteredExpenses =
      categoryFilter === 'all' ? projectExpenses : projectExpenses.filter((e) => e.category === categoryFilter);
    const usedCategories = EXPENSE_CATEGORIES.filter((cat) =>
      projectExpenses.some((e) => e.category === cat.id)
    );

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
              <p className="text-gray-400 text-xs lg:text-sm">Project Value</p>
              <p className="text-xl lg:text-2xl font-bold text-white">${project.totalBudget.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Total Spent</p>
              <p className="text-xl lg:text-2xl font-bold text-white">${totalExpenses.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs lg:text-sm">Profit Projection</p>
              <p className={`text-xl lg:text-2xl font-bold ${getBudgetStatus(project.totalBudget, totalExpenses)}`}>
                ${(project.totalBudget - totalExpenses).toLocaleString()}
              </p>
            </div>
          </div>

          {(isOwnerOf(project) ||
            viewingProjectMembers.some((m) => m.userId === user?.id && m.canViewCashPosition)) && (
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

          {!isOwnerOf(project) && (() => {
            const myGiven = viewingProjectAdvances
              .filter((a) => a.recipientId === user?.id)
              .reduce((sum, a) => sum + a.amount, 0);
            const mySpent = projectExpenses
              .filter((e) => e.userId === user?.id)
              .reduce((sum, e) => sum + e.amount, 0);
            const myBalance = myGiven - mySpent;

            if (myGiven === 0 && mySpent === 0) return null;

            return (
              <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs lg:text-sm flex items-center gap-2">
                    <Wallet className="h-3.5 w-3.5" />
                    My Petty Cash Balance
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Given: ${myGiven.toLocaleString()} · Spent: ${mySpent.toLocaleString()}
                  </p>
                </div>
                <p
                  className={`text-lg lg:text-xl font-bold ${
                    myBalance > 0 ? 'text-yellow-500' : myBalance < 0 ? 'text-red-500' : 'text-green-500'
                  }`}
                >
                  {myBalance > 0
                    ? `Holding $${myBalance.toLocaleString()}`
                    : myBalance < 0
                    ? `Owed $${Math.abs(myBalance).toLocaleString()}`
                    : 'Settled'}
                </p>
              </div>
            );
          })()}

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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base lg:text-lg font-semibold text-white">
                All Expenses ({filteredExpenses.length}{categoryFilter !== 'all' ? ` of ${projectExpenses.length}` : ''})
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
            {projectExpenses.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-64 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="all">All Categories</option>
                {usedCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {filteredExpenses.length > 0 ? (
            <div className="divide-y divide-gray-700">
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="p-4 lg:p-6 hover:bg-gray-750 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    {expense.hasReceiptImage && (
                      <button
                        type="button"
                        onClick={async () => {
                          setLoadingReceiptId(expense.id);
                          const image = await fetchReceiptImage(expense.id);
                          setLoadingReceiptId(null);
                          if (image) setViewingReceipt(image);
                        }}
                        className="flex-shrink-0 w-14 h-14 lg:w-16 lg:h-16 rounded-lg border border-gray-600 hover:border-yellow-500 transition-colors bg-gray-900 flex items-center justify-center"
                        title="View receipt"
                      >
                        {loadingReceiptId === expense.id ? (
                          <span className="text-gray-400 text-xs">...</span>
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400" />
                        )}
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
                      <div className="flex justify-end gap-1 mt-2">
                        {(expense.userId === user?.id || isOwnerOf(project)) && (
                          <button
                            onClick={() => setEditingExpense(expense)}
                            className="text-gray-400 hover:text-yellow-500 transition-colors p-1"
                            title="Edit expense"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
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
              <h3 className="text-base lg:text-lg font-medium text-white mb-2">
                {projectExpenses.length === 0 ? 'No expenses yet' : 'No expenses in this category'}
              </h3>
              <p className="text-sm lg:text-base text-gray-400">
                {projectExpenses.length === 0
                  ? 'Start adding expenses to track your project costs'
                  : 'Try a different category filter'}
              </p>
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

        {editingExpense && (
          <EditExpenseModal
            project={project}
            expense={editingExpense}
            updateExpense={updateExpense}
            onClose={() => setEditingExpense(null)}
          />
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
                  Project Value *
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
          const health = getProjectHealth(project);

          return (
            <div key={project.id} className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700 hover:border-gray-600 transition-colors">
              <div className="mb-4">
                <div className="flex items-center justify-end gap-2 mb-2">
                  {isOwnerOf(project) && (
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
                        onClick={() => setViewingSummaryFor(project)}
                        className="text-gray-400 hover:text-yellow-500 transition-colors"
                        title="Summary"
                      >
                        <BarChart3 className="h-4 w-4" />
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
                  {isOwnerOf(project) && (
                    <button
                      onClick={() => handleDelete(project)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div>
                  <h3 className="text-base lg:text-lg font-semibold text-white">{project.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs lg:text-sm font-medium text-white ${getStatusColor(project.status)}`}>
                      {PROJECT_STATUSES.find(s => s.id === project.status)?.name}
                    </span>
                    <button
                      onClick={() => setViewingHealthFor(project)}
                      className={`inline-flex items-center appearance-none px-2 py-1 rounded-full text-xs lg:text-sm font-medium border-0 leading-none whitespace-nowrap transition-opacity hover:opacity-80 ${RAG_BADGE_CLASSES[health.overall]}`}
                      title="View project health"
                    >
                      {RAG_LABEL[health.overall]}
                    </button>
                  </div>
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

                {(() => {
                  const siteProgress = getProgressForProject(project.name);
                  if (siteProgress === null) return null;
                  return (
                    <div className="flex items-center gap-3">
                      <HardHat className="h-4 w-4 text-gray-400" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs lg:text-sm">
                          <span className="text-gray-300">Site Progress</span>
                          <span className="font-medium text-blue-400 text-xs lg:text-sm">{siteProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${Math.min(siteProgress, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

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

      {viewingSummaryFor && (
        <SummaryModal
          project={viewingSummaryFor}
          expenses={expenses}
          updateExpense={updateExpense}
          onClose={() => setViewingSummaryFor(null)}
        />
      )}

      {viewingHealthFor && (
        <ProjectHealthModal
          project={viewingHealthFor}
          health={getProjectHealth(viewingHealthFor)}
          onClose={() => setViewingHealthFor(null)}
        />
      )}
    </div>
  );
};