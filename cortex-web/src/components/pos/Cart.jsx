import React from 'react';
import { Box, IconButton, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

import { formatMoney } from '../../utils/formatters';

const qtyInputSx = {
  width: 86,
  '& input[type=number]': {
    MozAppearance: 'textfield',
    textAlign: 'center',
    fontWeight: 800
  },
  '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
    WebkitAppearance: 'none',
    margin: 0
  }
};

const Cart = ({ items = [], onInc, onDec, onSetQty, onRemove }) => {
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0) {
    return (
      <Box className="cortex-card" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
          Cart
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.66)', mt: 0.5 }}>
          Scan a barcode to add items.
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="cortex-card" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
        Cart
      </Typography>

      <Box sx={{ mt: 1.5, display: 'grid', gap: 1.25 }}>
        {list.map((it) => {
          const stockValue = Number(it.availableStock);
          const stockLabel = Number.isFinite(stockValue) ? Math.max(0, stockValue) : '—';

          return (
            <Box
              key={it.productId}
              className="pos-row"
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.10)',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 1,
                alignItems: 'center'
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }} className="truncate">
                  {it.productName}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }} className="truncate">
                  SKU: {it.sku} • {formatMoney(it.unitPrice)} each • Stock: {stockLabel}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <IconButton
                  onClick={() => onDec?.(it.productId)}
                  sx={{ width: 44, height: 44, border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <RemoveRoundedIcon />
                </IconButton>
                <TextField
                  size="small"
                  type="number"
                  value={it.quantity}
                  onChange={(e) => onSetQty?.(it.productId, e.target.value)}
                  inputProps={{
                    min: 1,
                    max: Number.isFinite(stockValue) ? Math.max(0, stockValue) : undefined,
                    step: 1,
                    inputMode: 'numeric',
                    pattern: '[0-9]*'
                  }}
                  sx={qtyInputSx}
                />
                <IconButton
                  onClick={() => onInc?.(it.productId)}
                  sx={{ width: 44, height: 44, border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <AddRoundedIcon />
                </IconButton>
                <IconButton
                  onClick={() => onRemove?.(it.productId)}
                  sx={{ width: 44, height: 44, border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default Cart;
