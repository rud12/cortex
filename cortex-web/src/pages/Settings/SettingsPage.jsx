import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  MenuItem,
  Paper,
  TextField,
  Typography
} from '@mui/material';
import { toast } from 'react-toastify';

import { inventoryService } from '../../services/api/inventoryService';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeLocal } from '../../contexts/ThemeContext';

const SettingsPage = () => {
  const { themeMode, themePreference, setThemeMode } = useThemeLocal();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [business, setBusiness] = useState({
    businessName: '',
    ownerName: '',
    businessPhone: '',
    businessEmail: ''
  });

  const [tax, setTax] = useState({ defaultCgst: '0', defaultSgst: '0' });
  const [payment, setPayment] = useState({ upiId: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getSettings();
      if (!res?.success) throw new Error(res?.error?.message || 'Failed to load settings');
      const settings = res.data?.settings || {};
      const userFullName = String(user?.fullName || '').trim();
      const userPhone = String(user?.phone || '').trim();
      const userEmail = String(user?.email || '').trim();
      const businessName = String(settings.businessName || '').trim();
      const ownerName = String(settings.ownerName || '').trim();
      const businessPhone = String(settings.businessPhone || '').trim();
      const businessEmail = String(settings.businessEmail || '').trim();
      setBusiness({
        businessName,
        ownerName: ownerName || userFullName,
        businessPhone: businessPhone || userPhone,
        businessEmail: businessEmail || userEmail
      });
      setTax({
        defaultCgst: String(settings.defaultCgst ?? '0'),
        defaultSgst: String(settings.defaultSgst ?? '0')
      });
      setPayment({ upiId: settings.upiId || '' });
      const hasLocalThemePreference = Boolean(localStorage.getItem('cortex_theme_mode'));
      if (!hasLocalThemePreference && settings.themeMode) {
        setThemeMode(String(settings.themeMode).toLowerCase());
      }
    } catch (err) {
      setBusiness((prev) => ({
        businessName: prev.businessName || '',
        ownerName: prev.ownerName || String(user?.fullName || '').trim(),
        businessPhone: prev.businessPhone || String(user?.phone || '').trim(),
        businessEmail: prev.businessEmail || String(user?.email || '').trim()
      }));
      toast.error(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveBusiness = async () => {
    setSaving(true);
    try {
      const res = await inventoryService.updateBusinessSettings(business);
      if (!res?.success) throw new Error(res?.error?.message || 'Save failed');
      toast.success('Business settings updated');
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveTax = async () => {
    setSaving(true);
    try {
      const res = await inventoryService.updateTaxDefaults({
        defaultCgst: Number(tax.defaultCgst || 0),
        defaultSgst: Number(tax.defaultSgst || 0)
      });
      if (!res?.success) throw new Error(res?.error?.message || 'Save failed');
      toast.success('Tax defaults updated');
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async () => {
    setSaving(true);
    try {
      const res = await inventoryService.updatePaymentSettings(payment);
      if (!res?.success) throw new Error(res?.error?.message || 'Save failed');
      toast.success('Payment settings updated');
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveTheme = async (nextMode) => {
    setThemeMode(nextMode);
    try {
      const resolvedMode = nextMode === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : nextMode;
      await inventoryService.updateThemeSettings({ themeMode: resolvedMode.toUpperCase() });
      toast.success('Theme preference updated');
    } catch (err) {
      toast.error(err.message || 'Theme save failed');
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading settings...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, display: 'grid', gap: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -1.2 }}>Settings</Typography>

      <Paper className="cortex-card" sx={{ p: 2, display: 'grid', gap: 1.2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Business Profile</Typography>
        <TextField label="Business Name" value={business.businessName} onChange={(e) => setBusiness((prev) => ({ ...prev, businessName: e.target.value }))} />
        <TextField label="Owner Name" value={business.ownerName} onChange={(e) => setBusiness((prev) => ({ ...prev, ownerName: e.target.value }))} />
        <TextField label="Business Phone" value={business.businessPhone} onChange={(e) => setBusiness((prev) => ({ ...prev, businessPhone: e.target.value }))} />
        <TextField label="Business Email" value={business.businessEmail} onChange={(e) => setBusiness((prev) => ({ ...prev, businessEmail: e.target.value }))} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={saveBusiness} disabled={saving}>Save</Button>
        </Box>
      </Paper>

      <Paper className="cortex-card" sx={{ p: 2, display: 'grid', gap: 1.2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Default GST</Typography>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField label="Default CGST %" value={tax.defaultCgst} onChange={(e) => setTax((prev) => ({ ...prev, defaultCgst: e.target.value }))} />
          <TextField label="Default SGST %" value={tax.defaultSgst} onChange={(e) => setTax((prev) => ({ ...prev, defaultSgst: e.target.value }))} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={saveTax} disabled={saving}>Save</Button>
        </Box>
      </Paper>

      <Paper className="cortex-card" sx={{ p: 2, display: 'grid', gap: 1.2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Payment</Typography>
        <TextField label="UPI ID" value={payment.upiId} onChange={(e) => setPayment({ upiId: e.target.value })} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={savePayment} disabled={saving}>Save</Button>
        </Box>
      </Paper>

      <Paper className="cortex-card" sx={{ p: 2, display: 'grid', gap: 1.2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Theme</Typography>
        <TextField
          select
          label="Theme Mode"
          value={themePreference}
          onChange={(e) => saveTheme(e.target.value)}
        >
          <MenuItem value="dark">Dark</MenuItem>
          <MenuItem value="light">Light</MenuItem>
          <MenuItem value="system">Same as system ({themeMode === 'dark' ? 'Dark' : 'Light'})</MenuItem>
        </TextField>
      </Paper>

    </Box>
  );
};

export default SettingsPage;
