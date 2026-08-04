import React, { useState } from 'react';
import { Building, Mail, Lock, User as UserIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const Auth: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    try {
      if (mode === 'sign-up') {
        await signUp(email.trim(), password, name.trim());
        setInfo('Account created. Check your email to confirm, then sign in.');
        setMode('sign-in');
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-yellow-500 rounded-lg flex items-center justify-center mb-3">
            <Building className="h-8 w-8 text-black" />
          </div>
          <h1 className="text-xl font-bold">Construction Tracker</h1>
          <p className="text-sm text-gray-400">Expense Management</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex mb-6 bg-gray-900 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setMode('sign-in')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'sign-in' ? 'bg-yellow-500 text-black' : 'text-gray-300'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('sign-up')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'sign-up' ? 'bg-yellow-500 text-black' : 'text-gray-300'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'sign-up' && (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">Full Name</label>
                <div className="relative">
                  <UserIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                    placeholder="Your name"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2">Email</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                  placeholder="you@example.com"
                  required
                />
              </div>
              {mode === 'sign-up' && (
                <p className="text-xs text-gray-500 mt-1">
                  Use the same email your project owner added you with, so you're linked to their project automatically.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            {info && <p className="text-green-500 text-sm">{info}</p>}

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors text-sm ${
                submitting ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-yellow-500 hover:bg-yellow-600 text-black'
              }`}
            >
              {submitting ? 'Please wait...' : mode === 'sign-in' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
