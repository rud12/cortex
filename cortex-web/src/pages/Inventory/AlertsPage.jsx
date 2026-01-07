import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import { toast } from 'react-toastify';

import { inventoryService } from '../../services/api/inventoryService';
import { formatDateTime } from '../../utils/formatters';


const ALERT_VISUAL = {
  LOW_STOCK: {
    icon:        <WarningAmberRoundedIcon fontSize="small" />,
    color:       '#B8903A',
    borderLeft:  '#B8903A',
    rowBg:       'rgba(184,144,58,0.06)',
    rowHover:    'rgba(184,144,58,0.10)',
  },
  STOCKOUT: {
    icon:        <ErrorOutlineRoundedIcon fontSize="small" />,
    color:       '#B05050',
    borderLeft:  '#B05050',
    rowBg:       'rgba(176,80,80,0.06)',
    rowHover:    'rgba(176,80,80,0.10)',
  },
  OVERSTOCK: {
    icon:        <Inventory2RoundedIcon fontSize="small" />,
    color:       '#4A9E8E',
    borderLeft:  '#4A9E8E',
    rowBg:       'rgba(74,158,142,0.06)',
    rowHover:    'rgba(74,158,142,0.10)',
  },
  EXPIRY_SOON: {
    icon:        <EventBusyRoundedIcon fontSize="small" />,
    color:       '#7A8EBE',
    borderLeft:  '#7A8EBE',
    rowBg:       'rgba(122,142,190,0.06)',
    rowHover:    'rgba(122,142,190,0.10)',
  },
};

const DEFAULT_VISUAL = {
  icon:       <WarningAmberRoundedIcon fontSize="small" />,
  color:      'var(--muted)',
  borderLeft: 'transparent',
  rowBg:      'transparent',
  rowHover:   'rgba(120,135,160,0.06)',
};

const alertTypeVisual = (type) => ALERT_VISUAL[type] || DEFAULT_VISUAL;

const AlertsPage = () => {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = await inventoryService.listAlerts(false);
        if (!res?.success) throw new Error(res?.error?.message || 'Failed to load');
        if (mounted) setAlerts(res.data || []);
      } catch (err) {
        toast.error(err.message || 'Failed to load alerts');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, []);

  const alertTypeOptions = useMemo(() => {
    const fromData = Array.from(new Set((alerts || []).map((item) => item?.type).filter(Boolean)));
    return Array.from(new Set(['ALL', ...fromData]));
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (alerts || []).filter((item) => {
      const byType = filterType === 'ALL' || item.type === filterType;
      if (!byType) return false;
      if (!keyword) return true;
      const hay = `${item.type || ''} ${item.message || ''} ${item.product?.name || ''} ${item.product?.sku || ''} ${item.productId || ''}`.toLowerCase();
      return hay.includes(keyword);
    });
  }, [alerts, search, filterType]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 850, letterSpacing: -1.2 }}>
        Alerts
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
        Low stock, stockout, overstock, and expiry warnings.
      </Typography>

      <Box sx={{ mt: 2 }} className="cortex-card p-5">

        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Search alerts"
            placeholder="Type, product, SKU, message"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 300 } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton edge="end" size="small">
                    <SearchRoundedIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <Button
            variant="outlined"
            startIcon={<FilterListRoundedIcon />}
            onClick={(e) => setFilterAnchorEl(e.currentTarget)}
          >
            {filterType === 'ALL' ? 'Filter: All' : `Filter: ${filterType}`}
          </Button>
          <Menu
            anchorEl={filterAnchorEl}
            open={Boolean(filterAnchorEl)}
            onClose={() => setFilterAnchorEl(null)}
          >
            {alertTypeOptions.map((type) => (
              <MenuItem
                key={type}
                selected={type === filterType}
                onClick={() => { setFilterType(type); setFilterAnchorEl(null); }}
              >
                {type === 'ALL' ? 'All Types' : type}
              </MenuItem>
            ))}
          </Menu>
        </Box>

        {loading ? (
          <>
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={220} sx={{ mt: 2 }} />
          </>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Message</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAlerts.map((a) => {
                const visual = alertTypeVisual(a.type);
                return (
                  <TableRow
                    key={a.id}
                    hover
                    sx={{
                      backgroundColor: visual.rowBg,
                      borderLeft: `3px solid ${visual.borderLeft}`,
                      '&:hover': { backgroundColor: visual.rowHover },
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.8, color: visual.color, fontWeight: 600, fontSize: 13 }}>
                        {visual.icon}
                        <span>{a.type}</span>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>{a.product?.name || a.productId}</TableCell>
                    <TableCell sx={{ fontSize: 13, color: 'text.secondary' }}>{a.message}</TableCell>
                    <TableCell sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}>{formatDateTime(a.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
              {filteredAlerts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
                    No alerts found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
};

export default AlertsPage;
