import { useState, useEffect } from 'react';
import { User } from '../types';
import { storageUtils } from '../utils/storage';

export const useUser = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = storageUtils.getUser();
    if (savedUser) {
      setUser(savedUser);
    } else {
      // Set default user if none exists
      const defaultUser: User = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        company: 'Construction Co.',
        role: 'Project Manager',
      };
      setUser(defaultUser);
      storageUtils.saveUser(defaultUser);
    }
    setLoading(false);
  }, []);

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      storageUtils.saveUser(updatedUser);
    }
  };

  return {
    user,
    loading,
    updateUser,
  };
};