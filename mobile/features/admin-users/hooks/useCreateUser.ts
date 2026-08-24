import { useState } from 'react';
import { Share } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { createUser, createTechnician } from '../services/adminUsers.service';
import { OTON_MUNICIPALITY } from '../utils/dispatchPayloadBuilders';

type Role = 'farmer' | 'technician' | 'admin';

export const useCreateUser = () => {
  const api = useApi();
  const queryClient = useQueryClient();

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
  const [serviceCapabilities, setServiceCapabilities] = useState<string[]>([]);

  // Success state
  const [createdAccount, setCreatedAccount] = useState<{
    id?: string;
    email?: string;
    phoneNumber?: string;
    role: Role;
    invitationSent: boolean;
    serviceCapabilities?: string[];
  } | null>(null);

  const handleCreate = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phoneNumber.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      toast.error('First and last name are required.');
      return;
    }
    if ((role === 'technician' || role === 'admin') && !trimmedEmail) {
      toast.error('Email is required for staff accounts.');
      return;
    }
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        toast.error('Please enter a valid email address.');
        return;
      }
    }
    if (trimmedPhone) {
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (!/^(09\d{9}|639\d{9}|9\d{9})$/.test(digitsOnly)) {
        toast.error('Please enter a valid Philippine mobile number (09XXXXXXXXX).');
        return;
      }
    }
    if (role === 'technician') {
      if (!city || !barangay) {
        toast.error('Municipality and Barangay are required for the Technician contact address.');
        return;
      }
    }
    if (role === 'farmer' && !trimmedEmail && !trimmedPhone) {
      toast.error('Add an email or phone number for the farmer profile.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        phoneNumber: trimmedPhone,
        address: {
          street: street.trim(),
          barangay,
          city,
          district,
          province: 'Iloilo',
        },
      };

      const result = role === 'technician'
        ? await createTechnician(api, {
            ...payload,
            serviceMunicipalities: [OTON_MUNICIPALITY],
            serviceCapabilities,
          })
        : await createUser(api, { ...payload, role });

      toast.success(
        role === 'farmer'
          ? 'Farmer profile created.'
          : `${role === 'technician' ? 'Technician' : 'Administrator'} invitation sent.`,
      );
      setCreatedAccount({
        id: result?.technician?._id || result?.user?._id || result?._id,
        email: trimmedEmail,
        phoneNumber: trimmedPhone,
        role,
        invitationSent: Boolean(trimmedEmail),
        serviceCapabilities:
          role === 'technician'
            ? result?.technician?.dispatchProfile?.serviceCapabilities ||
              serviceCapabilities
            : undefined,
      });

      // Invalidate relevant query keys so directory & workload update immediately
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-technicians-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-alerts-users'] });
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
    } catch {
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
    setServiceCapabilities([]);
  };

  const toggleServiceCapability = (capability: string) => {
    setServiceCapabilities((current) =>
      current.includes(capability)
        ? current.filter((item) => item !== capability)
        : [...current, capability],
    );
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
    serviceCapabilities,
    toggleServiceCapability,
    createdAccount,
    handleCreate,
    shareCredentials,
    handleCreateAnother,
  };
};
