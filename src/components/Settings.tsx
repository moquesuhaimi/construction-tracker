import React, { useState, useEffect } from 'react';
import { User, Save, Trash2, Download, Upload, Camera, X } from 'lucide-react';
import { storageUtils } from '../utils/storage';
import { useUser } from '../hooks/useUser';
import { User as UserType } from '../types';

export const Settings: React.FC = () => {
  const { user, updateUser } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserType>(user || {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    company: 'Construction Co.',
    role: 'Project Manager',
  });
  const [showImageUpload, setShowImageUpload] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(user);
    }
  }, [user]);

  const handleSave = () => {
    updateUser(formData);
    setIsEditing(false);
    alert('Profile updated successfully!');
  };

  const handleCancel = () => {
    setFormData(user || formData);
    setIsEditing(false);
  };

  const handleExportData = () => {
    const data = {
      projects: storageUtils.getProjects(),
      expenses: storageUtils.getExpenses(),
      user: storageUtils.getUser(),
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `construction-expenses-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (data.projects) storageUtils.saveProjects(data.projects);
        if (data.expenses) storageUtils.saveExpenses(data.expenses);
        if (data.user) storageUtils.saveUser(data.user);
        
        alert('Data imported successfully! Please refresh the page.');
      } catch (error) {
        alert('Error importing data. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      storageUtils.clearAll();
      alert('All data has been cleared. Please refresh the page.');
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size too large. Please select an image under 5MB.');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setFormData({ ...formData, profileImage: imageUrl });
      setShowImageUpload(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, profileImage: undefined });
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm lg:text-base text-gray-400">Manage your profile and app preferences</p>
      </div>

      {/* Profile Settings */}
      <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base lg:text-lg font-semibold text-white">Profile Information</h3>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="text-yellow-500 hover:text-yellow-400 transition-colors text-sm lg:text-base"
            >
              Edit
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleSave}
                className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center justify-center gap-2 text-sm lg:text-base"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm lg:text-base"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 lg:gap-6 mb-6">
          <div className="relative">
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full overflow-hidden bg-yellow-500 flex items-center justify-center">
              {formData.profileImage ? (
                <img
                  src={formData.profileImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="h-8 w-8 lg:h-10 lg:w-10 text-black" />
              )}
            </div>
            
            {isEditing && (
              <div className="absolute -bottom-1 -right-1">
                <button
                  type="button"
                  onClick={() => setShowImageUpload(true)}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black p-1.5 lg:p-2 rounded-full transition-colors shadow-lg"
                  title="Change photo"
                >
                  <Camera className="h-3 w-3 lg:h-4 lg:w-4" />
                </button>
              </div>
            )}
          </div>
          
          <div>
            <h4 className="text-white font-medium text-sm lg:text-base">{user?.name || 'User'}</h4>
            <p className="text-gray-400 text-xs lg:text-sm">{user?.role || 'Role'} at {user?.company || 'Company'}</p>
            {isEditing && formData.profileImage && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="text-red-400 hover:text-red-300 text-xs lg:text-sm mt-1 transition-colors"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!isEditing}
              className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 text-sm lg:text-base"
            />
          </div>

          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={!isEditing}
              className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 text-sm lg:text-base"
            />
          </div>

          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
              Company
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              disabled={!isEditing}
              className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 text-sm lg:text-base"
            />
          </div>

          <div>
            <label className="block text-xs lg:text-sm font-medium text-gray-300 mb-2">
              Role
            </label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              disabled={!isEditing}
              className="w-full px-3 py-2 lg:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 text-sm lg:text-base"
            />
          </div>
        </div>
      </div>

      {/* Image Upload Modal */}
      {showImageUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg p-4 lg:p-6 max-w-md w-full border border-gray-700 my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base lg:text-lg font-semibold text-white">Upload Profile Photo</h3>
              <button
                onClick={() => setShowImageUpload(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-400 text-xs lg:text-sm">
                Choose a profile photo to personalize your account
              </p>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col items-center justify-center p-4 lg:p-6 border-2 border-dashed border-gray-600 rounded-lg hover:border-yellow-500 transition-colors cursor-pointer">
                  <Camera className="h-6 w-6 lg:h-8 lg:w-8 text-gray-400 mb-2" />
                  <span className="text-white font-medium text-xs lg:text-sm">Take Photo</span>
                  <span className="text-gray-400 text-xs">Use camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>

                <label className="flex flex-col items-center justify-center p-4 lg:p-6 border-2 border-dashed border-gray-600 rounded-lg hover:border-yellow-500 transition-colors cursor-pointer">
                  <Upload className="h-6 w-6 lg:h-8 lg:w-8 text-gray-400 mb-2" />
                  <span className="text-white font-medium text-xs lg:text-sm">Upload Image</span>
                  <span className="text-gray-400 text-xs">From gallery</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="text-xs text-gray-400 text-center">
                <p>• Supported formats: JPG, PNG, WebP</p>
                <p>• Maximum file size: 5MB</p>
                <p>• Recommended: Square images work best</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Data Management */}
      <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
        <h3 className="text-base lg:text-lg font-semibold text-white mb-4">Data Management</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleExportData}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors text-sm lg:text-base"
          >
            <Download className="h-4 w-4" />
            Export Data
          </button>

          <label className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer text-sm lg:text-base">
            <Upload className="h-4 w-4" />
            Import Data
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              className="hidden"
            />
          </label>

          <button
            onClick={handleClearData}
            className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors text-sm lg:text-base"
          >
            <Trash2 className="h-4 w-4" />
            Clear All Data
          </button>
        </div>

        <div className="mt-4 text-xs lg:text-sm text-gray-400">
          <p>• Export your data to backup all projects and expenses</p>
          <p>• Import data from a previously exported file</p>
          <p>• Clear all data will permanently delete all information</p>
        </div>
      </div>

      {/* App Information */}
      <div className="bg-gray-800 rounded-lg p-4 lg:p-6 border border-gray-700">
        <h3 className="text-base lg:text-lg font-semibold text-white mb-4">App Information</h3>
        
        <div className="space-y-3 text-xs lg:text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">App Name</span>
            <span className="text-white text-right">Construction Expense Tracker by Builders Cartel</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Version</span>
            <span className="text-white">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Last Updated</span>
            <span className="text-white">2024</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Data Storage</span>
            <span className="text-white">Local Storage</span>
          </div>
        </div>
      </div>
    </div>
  );
};