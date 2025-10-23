import React, { useState } from 'react';
import { Plus, Receipt, Calendar, DollarSign, Building, Camera, Eye } from 'lucide-react';
import { useExpenses } from '../hooks/useExpenses';
import { useProjects } from '../hooks/useProjects';
import { EXPENSE_CATEGORIES } from '../utils/constants';
import { ReceiptUpload } from './ReceiptUpload';

export const AddExpense: React.FC = () => {
  const { addExpense } = useExpenses();
  const { projects } = useProjects();
  const [formData, setFormData] = useState({
    projectId: '',
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    receipt: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReceiptUpload, setShowReceiptUpload] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.projectId || !formData.category || !formData.description || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      await addExpense({
        projectId: formData.projectId,
        category: formData.category,
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        date: formData.date,
        receipt: formData.receipt.trim() || undefined,
      });

      // Reset form
      setFormData({
        projectId: '',
        category: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        receipt: '',
      });

      alert('Expense added successfully!');
    } catch (error) {
      alert('Error adding expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceiptProcessed = (data: { amount?: number; receiptNumber?: string; imageUrl: string }) => {
    // Auto-fill form with extracted data
    if (data.amount) {
      setFormData(prev => ({ ...prev, amount: data.amount!.toString() }));
    }
    if (data.receiptNumber) {
      setFormData(prev => ({ ...prev, receipt: data.receiptNumber! }));
    }
    
    setReceiptImage(data.imageUrl);
    setShowReceiptUpload(false);
  };
  const selectedCategory = EXPENSE_CATEGORIES.find(cat => cat.id === formData.category);

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white">Add Expense</h1>
        <p className="text-sm lg:text-base text-gray-400">Record a new construction expense</p>
      </div>

      {/* Form */}
      <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Selection */}
          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
              <Building className="h-4 w-4 inline mr-2" />
              Project *
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm lg:text-base"
              required
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
              Category *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-3">
              {EXPENSE_CATEGORIES.map((category) => {
                const IconComponent = category.icon;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: category.id })}
                    className={`p-2 lg:p-3 rounded-lg border transition-colors text-left ${
                      formData.category === category.id
                        ? 'border-yellow-500 bg-yellow-500 bg-opacity-20 text-yellow-500'
                        : 'border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs lg:text-sm font-medium">{category.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
                <DollarSign className="h-4 w-4 inline mr-2" />
                Amount *
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm lg:text-base"
                placeholder="0.00"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
                <Calendar className="h-4 w-4 inline mr-2" />
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm lg:text-base"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm lg:text-base"
              placeholder="Enter expense description"
              required
            />
          </div>

          {/* Receipt */}
          <div>
            <div className="space-y-3">
              <label className="block text-xs lg:text-sm font-medium text-gray-300">
                <Receipt className="h-4 w-4 inline mr-2" />
                Receipt (Optional)
              </label>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={formData.receipt}
                  onChange={(e) => setFormData({ ...formData, receipt: e.target.value })}
                  className="flex-1 px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm lg:text-base"
                  placeholder="Enter receipt number"
                />
                <button
                  type="button"
                  onClick={() => setShowReceiptUpload(true)}
                  className="px-4 py-2 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-2 text-sm lg:text-base whitespace-nowrap"
                >
                  <Camera className="h-4 w-4" />
                  Scan Receipt
                </button>
              </div>
              
              {receiptImage && (
                <div className="relative inline-block">
                  <img
                    src={receiptImage}
                    alt="Receipt"
                    className="w-20 h-20 lg:w-24 lg:h-24 object-cover rounded-lg border border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => setReceiptImage(receiptImage)}
                    className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Eye className="h-6 w-6 text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 lg:py-4 px-4 rounded-lg font-medium transition-colors text-sm lg:text-base ${
              isSubmitting
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-500 hover:bg-yellow-600 text-black'
            }`}
          >
            {isSubmitting ? (
              'Adding Expense...'
            ) : (
              <>
                <Plus className="h-4 w-4 inline mr-2" />
                Add Expense
              </>
            )}
          </button>
        </form>
      </div>
      
      {/* Receipt Upload Modal */}
      {showReceiptUpload && (
        <ReceiptUpload
          onReceiptProcessed={handleReceiptProcessed}
          onClose={() => setShowReceiptUpload(false)}
        />
      )}

      {/* Quick Tips */}
      <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
        <h3 className="text-base lg:text-lg font-semibold text-white mb-3">Quick Tips</h3>
        <div className="space-y-2 text-xs lg:text-sm text-gray-400">
          <p>• Make sure to select the correct project before adding expenses</p>
          <p>• Use descriptive names for better expense tracking</p>
          <p>• Scan receipts to automatically extract amounts and receipt numbers</p>
          <p>• Double-check amounts before submitting</p>
        </div>
      </div>
    </div>
  );
};