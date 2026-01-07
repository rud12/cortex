import React from 'react';
import { Box, Typography } from '@mui/material';

import { formatMoney } from '../../utils/formatters';

const TotalsBar = ({ subtotal, cgstTotal, sgstTotal, taxTotal, grandTotal }) => {
  return (
    <Box className="cortex-card" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
        Totals
      </Typography>

      <Box sx={{ mt: 1.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        <Box>
          <div className="text-xs text-white/60">Subtotal</div>
          <div className="text-lg font-extrabold">{formatMoney(subtotal)}</div>
        </Box>
        <Box>
          <div className="text-xs text-white/60">Grand Total</div>
          <div className="text-lg font-extrabold">{formatMoney(grandTotal)}</div>
        </Box>

        <Box>
          <div className="text-xs text-white/60">CGST</div>
          <div className="text-base font-bold">{formatMoney(cgstTotal)}</div>
        </Box>
        <Box>
          <div className="text-xs text-white/60">SGST</div>
          <div className="text-base font-bold">{formatMoney(sgstTotal)}</div>
        </Box>

        <Box>
          <div className="text-xs text-white/60">Tax Total</div>
          <div className="text-base font-bold">{formatMoney(taxTotal)}</div>
        </Box>
      </Box>

      <Typography variant="caption" sx={{ mt: 1.5, display: 'block', color: 'rgba(255,255,255,0.65)' }}>
        Tip: Ctrl+S to complete transaction • Esc to clear cart.
      </Typography>
    </Box>
  );
};

export default TotalsBar;
