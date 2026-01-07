import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography } from '@mui/material';
import { toast } from 'react-toastify';

import { useAuth } from '../../contexts/AuthContext';
import { inventoryService } from '../../services/api/inventoryService';
import { required, validateEmail, validatePassword, validatePhone } from '../../utils/validators';

const BusinessSignupPage = () => {
  const navigate = useNavigate();
  const { businessSignup, login, logout } = useAuth();

  const [form, setForm] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    ownerName: '',
    businessPhone: '',
    businessEmail: ''
  });
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!required(form.username) || !required(form.email) || !required(form.fullName) || !required(form.password)) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!validateEmail(form.email)) {
      toast.error('Invalid email');
      return;
    }

    if (form.phone && !validatePhone(form.phone)) {
      toast.error('Invalid phone');
      return;
    }

    if (form.businessEmail && !validateEmail(form.businessEmail)) {
      toast.error('Invalid business email');
      return;
    }

    if (form.businessPhone && !validatePhone(form.businessPhone)) {
      toast.error('Invalid business phone');
      return;
    }

    const pwErrors = validatePassword(form.password);
    if (pwErrors.length > 0) {
      toast.error(`Password: ${pwErrors[0]}`);
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await businessSignup({
        username: form.username,
        email: form.email,
        fullName: form.fullName,
        phone: form.phone,
        password: form.password
      });

      await login(form.username, form.password);

      await inventoryService.updateBusinessSettings({
        businessName: form.businessName || '',
        ownerName: form.ownerName || form.fullName,
        businessPhone: form.businessPhone || form.phone,
        businessEmail: form.businessEmail || form.email
      });

      await logout();
      toast.success('Business admin created. Please login.');
      navigate('/login');
    } catch (err) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Box className="cortex-card" sx={{ width: 'min(700px, 100%)', p: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -1.1 }}>
          Business Admin Signup
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 1 }}>
          Creates the first admin account and initializes business settings.
        </Typography>

        <Box component="form" onSubmit={onSubmit} sx={{ mt: 3, display: 'grid', gap: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Admin Account</Typography>
          <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="Username" value={form.username} onChange={update('username')} fullWidth />
            <TextField label="Email" value={form.email} onChange={update('email')} fullWidth />
            <TextField label="Full Name" value={form.fullName} onChange={update('fullName')} fullWidth />
            <TextField label="Phone (optional)" value={form.phone} onChange={update('phone')} fullWidth />
            <TextField label="Password" type="password" value={form.password} onChange={update('password')} fullWidth />
            <TextField
              label="Confirm Password"
              type="password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              fullWidth
            />
          </Box>

          <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 1 }}>Business Profile</Typography>
          <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="Business Name" value={form.businessName} onChange={update('businessName')} fullWidth />
            <TextField label="Owner Name" value={form.ownerName} onChange={update('ownerName')} fullWidth />
            <TextField label="Business Phone" value={form.businessPhone} onChange={update('businessPhone')} fullWidth />
            <TextField label="Business Email" value={form.businessEmail} onChange={update('businessEmail')} fullWidth />
          </Box>

          <Button type="submit" variant="contained" disabled={loading} size="large">
            {loading ? 'Creating…' : 'Create Admin'}
          </Button>
        </Box>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500, fontSize: '14px' }}>
            Back to Login
          </Link>
        </Box>
      </Box>
    </Box>
  );
};

export default BusinessSignupPage;
