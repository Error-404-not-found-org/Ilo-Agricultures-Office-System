import React, { useState } from 'react';
import { Share } from 'react-native';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { createUser } from '../services/adminUsers.service';

const ROLES = ['farmer', 'technician', 'admin'] as const;
type Role = typeof ROLES[number];

export const useCreateUser = () => {
  const api = useApi();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>('farmer');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Success state
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      toast.error('Email and password are required.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await createUser(api, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} created successfully!`);
      setCreatedCredentials(res.credentials || { email: email.trim().toLowerCase(), password });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create user.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const shareCredentials = async () => {
    if (!createdCredentials) return;
    try {
      await Share.share({
        message: `Login Credentials:\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nRole: ${role}`,
        title: 'New User Credentials',
      });
    } catch (e) {
      toast.error('Failed to share credentials.');
    }
  };

  const handleCreateAnother = () => {
    setCreatedCredentials(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setRole('farmer');
  };

  return {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    role,
    setRole,
    showRolePicker,
    setShowRolePicker,
    loading,
    createdCredentials,
    handleCreate,
    shareCredentials,
    handleCreateAnother,
  };
};
