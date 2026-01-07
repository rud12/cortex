import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { toast } from 'react-toastify';

import { authService } from '../../services/api/authService';
import { required, validateEmail, validatePassword, validatePhone } from '../../utils/validators';
import { formatDateTime } from '../../utils/formatters';

const ALL_ROLES = ['Administrator', 'WarehouseManager', 'WarehouseStaff', 'Cashier'];
const getPrimaryRole = (user) => user?.role || user?.roles?.[0] || '';

const NewUserDialog = ({ open, onClose }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: '',
    password: '',
    role: ''
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      username: '',
      email: '',
      fullName: '',
      phone: '',
      password: '',
      role: ''
    });
  }, [open]);

  const update = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!required(form.username) || !required(form.email) || !required(form.fullName) || !required(form.password)) {
      toast.error('Username, email, full name, and password are required');
      return;
    }
    if (!validateEmail(form.email)) {
      toast.error('Enter a valid email');
      return;
    }
    if (!validatePhone(form.phone)) {
      toast.error('Enter a valid phone number');
      return;
    }
    const pwErrors = validatePassword(form.password);
    if (pwErrors.length > 0) {
      toast.error(`Password: ${pwErrors.join(', ')}`);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        role: form.role || undefined
      };

      const res = await authService.createUser(payload);
      if (!res?.success) {
        throw new Error(res?.error?.message || res?.message || 'Create user failed');
      }
      toast.success('User created');
      onClose(true);
    } catch (err) {
      toast.error(err.message || 'Create user failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => onClose(false)}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      PaperProps={{ className: 'cortex-dialog-paper' }}
    >
      <DialogTitle>New User</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 2, mt: 1 }}>
          <TextField label="Username" value={form.username} onChange={update('username')} />
          <TextField label="Email" value={form.email} onChange={update('email')} />
          <TextField label="Full Name" value={form.fullName} onChange={update('fullName')} />
          <TextField label="Phone (optional)" value={form.phone} onChange={update('phone')} />
          <TextField label="Password" value={form.password} onChange={update('password')} type="password" />

          <Box className="cortex-card" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Role
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="new-user-role-label">Role</InputLabel>
              <Select
                labelId="new-user-role-label"
                label="Role"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                {ALL_ROLES.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              If none selected, backend defaults apply.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
            <Button onClick={() => onClose(false)} variant="outlined">
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? 'Creating…' : 'Create'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

const UsersPage = () => {
  const [loading, setLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await authService.listUsers();
      if (!res?.success) throw new Error(res?.error?.message || res?.message || 'Failed to load users');
      setUsers(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => users || [], [users]);

  const onDelete = async (user) => {
    if (getPrimaryRole(user) === 'Administrator') {
      toast.error('Administrator accounts cannot be deleted');
      return;
    }

    if (!confirm(`Delete ${user.fullName || user.username || user.email}?`)) return;
    try {
      const res = await authService.deleteUser(user.id);
      if (!res?.success) throw new Error(res?.error?.message || res?.message || 'Delete failed');
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const onToggleStatus = async (user) => {
    const isAdministrator = getPrimaryRole(user) === 'Administrator';
    if (isAdministrator) {
      toast.error('Administrator accounts cannot be inactivated');
      return;
    }

    const current = String(user.status || 'ACTIVE').toUpperCase();
    const nextStatus = current === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setActionUserId(user.id);
    try {
      const res = await authService.updateUser(user.id, { status: nextStatus });
      if (!res?.success) throw new Error(res?.error?.message || res?.message || 'Status update failed');
      toast.success(`User marked ${nextStatus.toLowerCase()}`);
      await load();
    } catch (err) {
      toast.error(err.message || 'Status update failed');
    } finally {
      setActionUserId('');
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <div>
          <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -1.2 }}>
            Users
          </Typography>
          <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
            Manage system accounts and roles.
          </Typography>
        </div>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          New User
        </Button>
      </Box>

      <Box sx={{ mt: 2 }} className="cortex-card p-5">
        {loading ? (
          <>
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={260} sx={{ mt: 2 }} />
          </>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Roles</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((u) => {
                  const primaryRole = getPrimaryRole(u);
                  const isAdministrator = primaryRole === 'Administrator';
                  const isInactive = String(u.status || '').toUpperCase() === 'INACTIVE';
                  const isLocked = String(u.status || '').toUpperCase() === 'LOCKED';
                  const isBusy = actionUserId === u.id;
                  const statusColor = isInactive
                    ? '#B05050'
                    : isLocked
                      ? '#B8903A'
                      : '#4A9E8E';
                  return (
                    <TableRow
                      key={u.id}
                      hover
                      sx={isInactive
                        ? {
                            opacity: 0.65,
                            filter: 'grayscale(0.45)'
                          }
                        : undefined}
                    >
                      <TableCell>
                        <div className="font-semibold">{u.fullName || u.username || u.email}</div>
                        <div className="text-xs text-white/60">{u.email}</div>
                      </TableCell>
                      <TableCell>{primaryRole || '—'}</TableCell>
                      <TableCell>
                        <span style={{ color: statusColor, fontWeight: 700 }}>
                          {u.status || '—'}
                        </span>
                      </TableCell>
                      <TableCell>{formatDateTime(u.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'inline-flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onToggleStatus(u)}
                            disabled={isAdministrator || isBusy}
                          >
                            {isAdministrator
                              ? 'Protected'
                              : (String(u.status || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'Inactivate' : 'Activate')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => onDelete(u)}
                            disabled={isAdministrator || isBusy}
                          >
                            {isAdministrator ? 'Protected' : 'Delete'}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ color: 'text.secondary' }}>
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        )}
      </Box>

      <NewUserDialog
        open={createOpen}
        onClose={(created) => {
          setCreateOpen(false);
          if (created) load();
        }}
      />
    </Box>
  );
};

export default UsersPage;
