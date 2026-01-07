import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography } from '@mui/material';
import { toast } from 'react-toastify';

import { useAuth } from '../../contexts/AuthContext';
import { required } from '../../utils/validators';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!required(identifier) || !required(password)) {
      toast.error('Please enter identifier and password');
      return;
    }

    setLoading(true);
    try {
      const user = await login(identifier, password);
      const roles = Array.isArray(user?.roles) ? user.roles : [];
      const isCashierOnly = roles.includes('Cashier') && !roles.includes('Administrator');
      navigate(isCashierOnly ? '/pos' : '/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Box className="cortex-card" sx={{ width: 'min(520px, 100%)', p: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -1.1, color: 'text.primary' }}>
          Welcome to CORTEX
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 1 }}>
          Sign in to manage inventory, POS, vision receiving, and forecasting.
        </Typography>

        <Box component="form" onSubmit={onSubmit} sx={{ mt: 3, display: 'grid', gap: 2 }}>
          <TextField
            label="Email or Username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />

          <Button type="submit" variant="contained" disabled={loading} size="large">
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </Box>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Link to="/business-signup" style={{ color: 'var(--accent)', fontWeight: 500, fontSize: '14px' }}>
            Business Admin Signup
          </Link>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginPage;
