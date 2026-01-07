import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';

import { formatMoney } from '../../utils/formatters';
import { inventoryService } from '../../services/api/inventoryService';

const StockChip = ({ qty, reorderLevel }) => {
  const isLow = reorderLevel > 0 && qty <= reorderLevel;
  const color = qty <= 0 ? 'rgba(255,107,53,0.25)' : isLow ? 'rgba(255,193,7,0.20)' : 'rgba(0,255,209,0.16)';

  return (
    <Chip
      size="small"
      label={qty}
      sx={{
        bgcolor: color,
        border: '1px solid rgba(255,255,255,0.14)',
        color: 'rgba(255,255,255,0.85)'
      }}
    />
  );
};

const getProductOnHand = (product) => {
  const rootOnHand = Number(product?.inventoryItem?.quantityOnHand || 0);
  const variantOnHand = (product?.variants || []).reduce((sum, item) => {
    return sum + Number(item?.inventoryItem?.quantityOnHand || 0);
  }, 0);
  if (product?.hasVariants) return variantOnHand;
  return rootOnHand + variantOnHand;
};

const ProductTable = ({ products, onEdit, onDelete, canEdit, referenceStatusByProduct = {} }) => {
  return (
    <Box className="cortex-card" sx={{ p: 2, overflowX: 'auto' }}>
      <Typography variant="h6" sx={{ fontWeight: 750, mb: 1 }}>
        Products
      </Typography>

      <Table size="small" sx={{ minWidth: 980 }}>
        <TableHead>
          <TableRow>
            <TableCell>Product</TableCell>
            <TableCell>Barcode</TableCell>
            <TableCell align="right">Retail</TableCell>
            <TableCell align="right">MRP</TableCell>
            <TableCell align="right">On Hand</TableCell>
            <TableCell>Variants</TableCell>
            <TableCell>Vision</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar
                    src={inventoryService.inventoryAssetUrl(p.imageUrl)}
                    alt={p.name}
                    variant="rounded"
                    sx={{ width: 42, height: 42 }}
                    imgProps={{
                      onError: (event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = '/product_placeholder.png';
                      }
                    }}
                  />
                  <Box>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-white/60">{p.sku}</div>
                  </Box>
                </Box>
              </TableCell>
              <TableCell>{p.barcode || '—'}</TableCell>
              <TableCell align="right">{formatMoney(p.retailPrice)}</TableCell>
              <TableCell align="right">{formatMoney(p.mrp)}</TableCell>
              <TableCell align="right">
                <StockChip qty={getProductOnHand(p)} reorderLevel={p.reorderLevel || 0} />
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={p.hasVariants ? `${p.variants?.length || 0} variants` : 'No variants'}
                  sx={{ border: '1px solid rgba(255,255,255,0.12)' }}
                />
              </TableCell>
              <TableCell>
                {(() => {
                  const status = referenceStatusByProduct[p.id];
                  const count = status?.reference_images_uploaded ?? 0;
                  const ready = Boolean(status?.vision_ready);
                  return (
                    <Chip
                      size="small"
                      label={`${count} ${ready ? 'Ready' : 'Not Ready'}`}
                      sx={{
                        bgcolor: ready ? 'rgba(0,255,209,0.16)' : 'rgba(255,211,0,0.14)',
                        border: ready ? '1px solid rgba(0,255,209,0.28)' : '1px solid rgba(255,211,0,0.32)'
                      }}
                    />
                  );
                })()}
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="outlined" size="small" onClick={() => onEdit(p)} disabled={!canEdit}>
                    Edit
                  </Button>
                  <Button variant="outlined" size="small" color="secondary" onClick={() => onDelete(p)} disabled={!canEdit}>
                    Delete
                  </Button>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

export default ProductTable;
