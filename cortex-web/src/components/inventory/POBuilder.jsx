import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { toast } from 'react-toastify';

import { inventoryService } from '../../services/api/inventoryService';

const emptyItem = () => ({ productId: '', quantity: 1, unitPrice: 0 });

const numberFieldNoSpinnerSx = {
  '& input[type=number]': {
    MozAppearance: 'textfield'
  },
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
    WebkitAppearance: 'none',
    margin: 0
  }
};

const POBuilder = ({ open, onClose, initialOrder = null }) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [lowStockProductIds, setLowStockProductIds] = useState([]);

  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const isEdit = Boolean(initialOrder?.id);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        const [sRes, pRes, aRes] = await Promise.all([
          inventoryService.listSuppliers(),
          inventoryService.listProducts(1, 500),
          inventoryService.listAlerts(false)
        ]);

        if (sRes?.success) setSuppliers(sRes.data || []);
        if (pRes?.success) setProducts(pRes.data || []);
        const ids = (aRes?.success ? (aRes.data || []) : [])
          .filter((alert) => alert?.type === 'LOW_STOCK' && alert?.resolvedAt == null)
          .map((alert) => alert?.productId)
          .filter(Boolean);
        setLowStockProductIds(Array.from(new Set(ids)));
      } catch {

        setLowStockProductIds([]);
      }
    };

    load();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!initialOrder) {
      setSupplierId('');
      setExpectedDate('');
      setItems([emptyItem()]);
      return;
    }
    setSupplierId(initialOrder.supplierId || '');
    setExpectedDate(initialOrder.expectedDate ? String(initialOrder.expectedDate).slice(0, 10) : '');
    const mapped = Array.isArray(initialOrder.items)
      ? initialOrder.items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0)
        }))
      : [];
    setItems(mapped.length > 0 ? mapped : [emptyItem()]);
  }, [open, initialOrder]);

  const productOptions = useMemo(() => {
    const options = [];
    const seen = new Set();

    const pushOption = (product, parent = null) => {
      if (!product?.id || seen.has(product.id)) return;
      seen.add(product.id);
      const name = parent
        ? `${parent.name} / ${product.variantName || product.name || 'Variant'}`
        : (product.name || 'Product');
      const sku = product.sku ? ` • ${product.sku}` : '';
      const barcode = product.barcode ? ` • ${product.barcode}` : '';
      options.push({
        id: product.id,
        label: `${name}${sku}${barcode}`,
        name,
        sku: product.sku || '',
        barcode: product.barcode || '',
        isVariant: Boolean(parent),
        parentName: parent?.name || null,
        isLowStockSuggested: lowStockProductIds.includes(product.id)
      });
    };

    (products || []).forEach((product) => {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      if (variants.length > 0) {
        variants.forEach((variant) => pushOption(variant, product));
        return;
      }
      pushOption(product, null);
    });

    return options.sort((a, b) => {
      if (a.isLowStockSuggested !== b.isLowStockSuggested) return a.isLowStockSuggested ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  }, [products, lowStockProductIds]);

  const updateItem = (idx, key, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  };

  const addItem = () => setItems((p) => [...p, emptyItem()]);
  const removeItem = (idx) => setItems((p) => p.filter((_, i) => i !== idx));

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!supplierId) {
      toast.error('Supplier is required');
      return;
    }

    const cleanItems = items
      .filter((it) => it.productId)
      .map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice)
      }));

    if (cleanItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        supplierId,
        expectedDate: expectedDate || null,
        items: cleanItems
      };
      const res = isEdit
        ? await inventoryService.updatePurchaseOrder(initialOrder.id, payload)
        : await inventoryService.createPurchaseOrder(payload);

      if (!res?.success) throw new Error(res?.error?.message || (isEdit ? 'Update failed' : 'Create failed'));
      toast.success(isEdit ? 'Purchase order updated' : 'Purchase order created');
      onClose(true);
    } catch (err) {
      toast.error(err.message || (isEdit ? 'Update failed' : 'Create failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => onClose(false)}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      PaperProps={{ className: 'cortex-dialog-paper' }}
    >
      <DialogTitle>{isEdit ? 'Edit Draft Purchase Order' : 'Create Purchase Order'}</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={onSubmit} sx={{ mt: 1, display: 'grid', gap: 2 }}>
          <TextField
            select
            label="Supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            {suppliers.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Expected Date (optional)"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <Box className="cortex-card" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 750 }}>Items</Typography>
            {lowStockProductIds.length > 0 && (
              <Typography sx={{ mt: 0.8, fontSize: 12.5, color: 'rgba(255,255,255,0.72)' }}>
                Suggested first: products with active LOW_STOCK alerts.
              </Typography>
            )}

            <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
              {items.map((it, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 140px 160px 120px' },
                    gap: 1,
                    alignItems: 'center'
                  }}
                >
                  <Autocomplete
                    options={productOptions}
                    value={productOptions.find((option) => option.id === it.productId) || null}
                    onChange={(_, option) => updateItem(idx, 'productId', option?.id || '')}
                    getOptionLabel={(option) => option?.label || ''}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    groupBy={(option) => (option.isLowStockSuggested ? 'Suggested (LOW_STOCK)' : 'All Products')}
                    noOptionsText="No product found"
                    slotProps={{
                      popper: {
                        sx: {
                          zIndex: 1800,
                          '& .MuiAutocomplete-paper': {
                            bgcolor: 'rgba(16, 22, 46, 0.98)',
                            backdropFilter: 'none',
                            border: '1px solid rgba(255,255,255,0.16)',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.55)'
                          },
                          '& .MuiAutocomplete-listbox': {
                            bgcolor: 'rgba(16, 22, 46, 0.98)',
                            py: 0
                          },
                          '& .MuiAutocomplete-option': {
                            borderBottom: '1px solid rgba(255,255,255,0.10)'
                          },
                          '& .MuiAutocomplete-option:last-of-type': {
                            borderBottom: 'none'
                          },
                          '& .MuiAutocomplete-option.Mui-focused': {
                            bgcolor: 'rgba(77,122,255,0.20)'
                          },
                          '& .MuiAutocomplete-option[aria-selected="true"]': {
                            bgcolor: 'rgba(77,122,255,0.28)'
                          }
                        }
                      }
                    }}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} sx={{ py: 0.75 }}>
                        <Box sx={{ width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25 }}>
                              {option.name}
                            </Typography>
                            {option.isLowStockSuggested && (
                              <Chip size="small" label="LOW_STOCK" color="warning" sx={{ height: 20, fontSize: 10 }} />
                            )}
                          </Box>
                          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                            {[option.sku, option.barcode].filter(Boolean).join(' • ') || 'No SKU/Barcode'}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Product"
                        placeholder="Type name, SKU, or barcode"
                      />
                    )}
                  />

                  <TextField
                    label="Qty"
                    type="number"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    inputProps={{ min: 1 }}
                    sx={numberFieldNoSpinnerSx}
                  />

                  <TextField
                    label="Unit Price"
                    type="number"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                    inputProps={{ min: 0, step: 0.01 }}
                    sx={numberFieldNoSpinnerSx}
                  />

                  <Button variant="outlined" color="secondary" onClick={() => removeItem(idx)} disabled={items.length === 1}>
                    Remove
                  </Button>
                </Box>
              ))}

              <Button variant="outlined" onClick={addItem} sx={{ justifySelf: 'start' }}>
                Add Item
              </Button>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="outlined" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Draft' : 'Create PO')}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default POBuilder;
