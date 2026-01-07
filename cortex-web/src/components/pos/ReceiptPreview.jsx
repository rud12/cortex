import React, { useState } from 'react';
import { Box, Button, Divider, Typography } from '@mui/material';
import { toast } from 'react-toastify';

import { formatDateTime, formatMoney } from '../../utils/formatters';
import { posService } from '../../services/api/posService';

const ReceiptPreview = ({ transaction, onNewSale }) => {
  const [downloading, setDownloading] = useState(false);

  if (!transaction) return null;

  const onDownloadBill = async () => {
    if (!transaction?.id || downloading) return;
    setDownloading(true);
    try {
      const { blob, fileName } = await posService.downloadBillPdf(transaction.id);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName || `${transaction.billNumber || 'bill'}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err?.message || 'Failed to download bill PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Box className="cortex-card" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <div>
          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
            Receipt
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
            {transaction.billNumber} • {formatDateTime(transaction.createdAt)}
          </Typography>
        </div>
        <Button variant="outlined" onClick={onNewSale}>
          New Sale
        </Button>
      </Box>
      {transaction.id && (
        <Box sx={{ mt: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={onDownloadBill}
            disabled={downloading}
          >
            {downloading ? 'Downloading...' : 'Download Bill PDF'}
          </Button>
        </Box>
      )}

      <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.10)' }} />

      <Box sx={{ display: 'grid', gap: 1 }}>
        {(transaction.items || []).map((it) => (
          <Box key={it.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <div className="min-w-0">
              <div className="font-semibold truncate">{it.productName}</div>
              <div className="text-xs text-white/60 truncate">
                {it.quantity} × {formatMoney(it.unitPrice)}
              </div>
            </div>
            <div className="font-extrabold">{formatMoney(it.totalPrice)}</div>
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.10)' }} />

      <Box sx={{ display: 'grid', gap: 0.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="text-sm text-white/70">Subtotal</span>
          <span className="text-sm font-bold">{formatMoney(transaction.subtotal)}</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="text-sm text-white/70">Tax</span>
          <span className="text-sm font-bold">{formatMoney(transaction.taxTotal)}</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="text-sm text-white/70">CGST</span>
          <span className="text-sm font-bold">{formatMoney(transaction.cgstTotal || 0)}</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="text-sm text-white/70">SGST</span>
          <span className="text-sm font-bold">{formatMoney(transaction.sgstTotal || 0)}</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="text-sm text-white/70">Discount</span>
          <span className="text-sm font-bold">-{formatMoney(transaction.discountTotal)}</span>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="text-sm text-white/70">Total</span>
          <span className="text-lg font-extrabold">{formatMoney(transaction.grandTotal)}</span>
        </Box>
      </Box>
    </Box>
  );
};

export default ReceiptPreview;
