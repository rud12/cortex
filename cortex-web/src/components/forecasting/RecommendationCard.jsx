import React from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';

const RecommendationCard = ({
  recommendation,
  derivedThresholds,
  onApplyThresholds,
  applyingThresholds = false
}) => {
  if (!recommendation) {
    return (
      <Box sx={{ color: 'rgba(255,255,255,0.7)' }}>
        No recommendation yet. Generate a forecast to compute reorder suggestions.
      </Box>
    );
  }

  const alert = recommendation.alert;
  const chipSx = (() => {
    if (alert === 'critical') return { bgcolor: 'rgba(255,107,53,0.18)', border: '1px solid rgba(255,107,53,0.45)' };
    if (alert === 'warning') return { bgcolor: 'rgba(255,211,0,0.14)', border: '1px solid rgba(255,211,0,0.35)' };
    return { bgcolor: 'rgba(0,255,209,0.14)', border: '1px solid rgba(0,255,209,0.28)' };
  })();

  return (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
          Reorder Recommendation
        </Typography>
        {alert ? <Chip size="small" label={alert} sx={chipSx} /> : <Chip size="small" label="ok" sx={chipSx} />}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
        <Box>
          <div className="text-xs text-white/60">Current stock</div>
          <div className="text-lg font-extrabold">{Math.round(Number(recommendation.current_stock || 0))}</div>
        </Box>
        <Box>
          <div className="text-xs text-white/60">Reorder point</div>
          <div className="text-lg font-extrabold">{Math.round(Number(recommendation.reorder_point || 0))}</div>
        </Box>
        <Box>
          <div className="text-xs text-white/60">Safety stock</div>
          <div className="text-lg font-extrabold">{Math.round(Number(recommendation.safety_stock || 0))}</div>
        </Box>
        <Box>
          <div className="text-xs text-white/60">EOQ</div>
          <div className="text-lg font-extrabold">{Math.round(Number(recommendation.eoq || 0))}</div>
        </Box>
      </Box>

      <Box sx={{ mt: 0.5 }}>
        <div className="text-xs text-white/60">Recommended order quantity</div>
        <div className="text-2xl font-black">{Math.round(Number(recommendation.recommended_order_quantity || 0))}</div>
      </Box>

      <Box sx={{ mt: 0.5, display: 'grid', gap: 0.75 }}>
        <div className="text-xs text-white/60">Apply stock levels from forecast</div>
        <div className="text-sm font-semibold">
          Reorder {Math.round(Number(derivedThresholds?.reorderLevel || 0))}
          {' • '}
          Max {Math.round(Number(derivedThresholds?.maxStockLevel || 0))}
        </div>
        <Button
          variant="contained"
          size="small"
          onClick={onApplyThresholds}
          disabled={!derivedThresholds || applyingThresholds}
        >
          {applyingThresholds ? 'Applying…' : 'Apply To Product'}
        </Button>
      </Box>

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
        Note: EOQ/ROP are based on model outputs and configured defaults.
      </Typography>
    </Box>
  );
};

export default RecommendationCard;
