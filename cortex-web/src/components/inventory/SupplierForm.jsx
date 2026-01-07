import React, { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { toast } from 'react-toastify';

import { inventoryService } from '../../services/api/inventoryService';
import { required } from '../../utils/validators';

const EMPTY_FORM = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: ''
};

const SupplierForm = ({ open, onClose, initial = null }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (!initial) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      name: initial.name || '',
      contactName: initial.contactName || '',
      email: initial.email || '',
      phone: initial.phone || '',
      address: initial.address || ''
    });
  }, [open, initial]);

  const update = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!required(form.name)) {
      toast.error('Supplier name is required');
      return;
    }

    setLoading(true);
    try {
      const res = initial?.id
        ? await inventoryService.updateSupplier(initial.id, form)
        : await inventoryService.createSupplier(form);
      if (!res?.success) throw new Error(res?.error?.message || (initial?.id ? 'Update failed' : 'Create failed'));
      toast.success(initial?.id ? 'Supplier updated' : 'Supplier created');
      onClose(true);
    } catch (err) {
      toast.error(err.message || (initial?.id ? 'Update failed' : 'Create failed'));
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
      <DialogTitle>{initial?.id ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 2, mt: 1 }}>
          <TextField label="Name" value={form.name} onChange={update('name')} />
          <TextField label="Contact Name" value={form.contactName} onChange={update('contactName')} />
          <TextField label="Email" value={form.email} onChange={update('email')} />
          <TextField label="Phone" value={form.phone} onChange={update('phone')} />
          <TextField label="Address" value={form.address} onChange={update('address')} />

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
            <Button onClick={() => onClose(false)} variant="outlined">Cancel</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? (initial?.id ? 'Saving…' : 'Creating…') : (initial?.id ? 'Save' : 'Create')}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierForm;
