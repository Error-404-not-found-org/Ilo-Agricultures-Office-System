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
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<Role>('farmer');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [barangay, setBarangay] = useState('');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Success state
  const [createdAccount, setCreatedAccount] = useState<{
    email?: string;
    phoneNumber?: string;
    role: Role;
    invitationSent: boolean;
  } | null>(null);

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required.');
      return;
    }
    if ((role === 'technician' || role === 'admin') && !email.trim()) {
      toast.error('Email is required for staff accounts.');
      return;
    }
    if (role === 'farmer' && !email.trim() && !phoneNumber.trim()) {
      toast.error('Add an email or phone number for the farmer profile.');
      return;
    }

    setLoading(true);
    try {
      const res = await createUser(api, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        role,
        phoneNumber: phoneNumber.trim(),
        address: {
          street: street.trim(),
          barangay,
          city,
          district,
          province: 'Iloilo',
        },
      });
      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} created successfully!`);
      setCreatedAccount({
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim(),
        role,
        invitationSent: Boolean(email.trim()),
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create user.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const shareCredentials = async () => {
    if (!createdAccount) return;
    try {
      await Share.share({
        message: createdAccount.invitationSent
          ? `BreedSmart invitation sent.\nEmail: ${createdAccount.email}\nRole: ${createdAccount.role}\n\nThe user should open the invitation and set their own password.`
          : `BreedSmart farmer profile created.\nPhone: ${createdAccount.phoneNumber || 'N/A'}\n\nThe farmer can claim this profile later using their verified phone number.`,
        title: 'BreedSmart Account Setup',
      });
    } catch (e) {
      toast.error('Failed to share credentials.');
    }
  };

  const handleCreateAnother = () => {
    setCreatedAccount(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhoneNumber('');
    setRole('farmer');
    setStreet('');
    setCity('');
    setDistrict('');
    setBarangay('');
  };

  return {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    phoneNumber,
    setPhoneNumber,
    role,
    setRole,
    street,
    setStreet,
    city,
    setCity,
    district,
    setDistrict,
    barangay,
    setBarangay,
    showRolePicker,
    setShowRolePicker,
    loading,
    createdAccount,
    handleCreate,
    shareCredentials,
    handleCreateAnother,
  };
};
