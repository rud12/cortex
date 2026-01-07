import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { toast } from 'react-toastify';

import SupplierForm from '../../components/inventory/SupplierForm';
import { inventoryService } from '../../services/api/inventoryService';
import { useAuth } from '../../contexts/AuthContext';

const SuppliersPage = () => {
  const { roles } = useAuth();
  const canEdit = roles.includes('Administrator') || roles.includes('WarehouseManager');
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewSupplier, setViewSupplier] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await inventoryService.listSuppliers();
      if (!res?.success) throw new Error(res?.error?.message || 'Failed to load');
      setSuppliers(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <div>
          <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -1.2 }}>
            Suppliers
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.66)', mt: 0.5 }}>
            Maintain supplier contacts for purchase orders.
          </Typography>
        </div>
        <Button
          variant="contained"
          onClick={() => {
            setEditingSupplier(null);
            setFormOpen(true);
          }}
          disabled={!canEdit}
        >
          New Supplier
        </Button>
      </Box>

      <Box sx={{ mt: 2 }} className="cortex-card p-5">
        {loading ? (
          <>
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={220} sx={{ mt: 2 }} />
          </>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 680 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell className="font-semibold">{s.name}</TableCell>
                    <TableCell>{s.contactName || '—'}</TableCell>
                    <TableCell>{s.email || '—'}</TableCell>
                    <TableCell>{s.phone || '—'}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'inline-flex', gap: 1 }}>
                        <Button size="small" variant="outlined" onClick={() => setViewSupplier(s)}>
                          View
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setEditingSupplier(s);
                            setFormOpen(true);
                          }}
                          disabled={!canEdit}
                        >
                          Edit
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Box>

      <SupplierForm
        open={formOpen}
        initial={editingSupplier}
        onClose={(saved) => {
          setFormOpen(false);
          setEditingSupplier(null);
          if (saved) load();
        }}
      />

      <Dialog
        open={Boolean(viewSupplier)}
        onClose={() => setViewSupplier(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ className: 'cortex-dialog-paper' }}
      >
        <DialogTitle>Supplier Details</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 1.2, mt: 1 }}>
            <Typography><strong>Name:</strong> {viewSupplier?.name || '—'}</Typography>
            <Typography><strong>Contact:</strong> {viewSupplier?.contactName || '—'}</Typography>
            <Typography><strong>Email:</strong> {viewSupplier?.email || '—'}</Typography>
            <Typography><strong>Phone:</strong> {viewSupplier?.phone || '—'}</Typography>
            <Typography><strong>Address:</strong> {viewSupplier?.address || '—'}</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button variant="outlined" onClick={() => setViewSupplier(null)}>
                Close
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default SuppliersPage;
