import React, { useMemo } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { QRCodeCanvas } from 'qrcode.react';

const METHODS = ['CASH', 'CARD', 'UPI'];

const PaymentPanel = ({
  paymentMethod,
  onPaymentMethodChange,
  onSubmit,
  disabled,
  customer,
  onCustomerChange,
  onLookupByPhone,
  upiId,
  amount
}) => {
  const upiLink = useMemo(() => {
    if (paymentMethod !== 'UPI' || !upiId) return '';
    const params = new URLSearchParams({
      pa: upiId,
      pn: upiId,
      am: Number(amount || 0).toFixed(2),
      cu: 'INR'
    });
    return `upi://pay?${params.toString()}`;
  }, [paymentMethod, upiId, amount]);

  return (
    <Box className="cortex-card" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
        Payment
      </Typography>

      <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {METHODS.map((m) => (
          <Button
            key={m}
            variant={paymentMethod === m ? 'contained' : 'outlined'}
            onClick={() => onPaymentMethodChange?.(m)}
            sx={{ minWidth: 100 }}
          >
            {m}
          </Button>
        ))}
      </Box>

      <Box sx={{ mt: 1.5, display: 'grid', gap: 1.2 }}>
        <TextField
          label="Customer Phone"
          value={customer.phone}
          onChange={(e) => onCustomerChange?.('phone', e.target.value)}
          onBlur={onLookupByPhone}
          required
        />
        <TextField
          label="Customer Name"
          value={customer.name}
          onChange={(e) => onCustomerChange?.('name', e.target.value)}
          required
        />
        <TextField
          label="Customer Email"
          value={customer.email}
          onChange={(e) => onCustomerChange?.('email', e.target.value)}
          required
        />
      </Box>

      {upiLink ? (
        <Box sx={{ mt: 1.8, display: 'grid', placeItems: 'center', gap: 1 }}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'white' }}>
            <QRCodeCanvas value={upiLink} size={160} />
          </Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Scan to pay {Number(amount || 0).toFixed(2)} INR
          </Typography>
        </Box>
      ) : null}

      <Box sx={{ mt: 1.8, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button variant="contained" disabled={disabled} onClick={onSubmit} sx={{ minWidth: 180, minHeight: 44 }}>
          Complete Transaction
        </Button>
      </Box>
    </Box>
  );
};

export default PaymentPanel;
