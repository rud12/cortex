import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography
} from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import PointOfSaleRoundedIcon from '@mui/icons-material/PointOfSaleRounded';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';

import { useAuth } from '../../contexts/AuthContext';

const canSee = (userRoles, required) => {
  if (!required || required.length === 0) return true;
  return userRoles.some((r) => required.includes(r));
};

const NavItem = ({ to, icon, label, onClick }) => {
  return (
    <ListItemButton
      component={NavLink}
      to={to}
      onClick={onClick}
      sx={{
        borderRadius: 2,
        mx: 1,
        my: 0.5,
        color: 'var(--text)',
        '&.active': {
          bgcolor: 'var(--sidebarActive)',
          border: '1px solid var(--sidebarBorder)'
        },
        '&:hover': {
          bgcolor: 'var(--sidebarActive)'
        }
      }}
    >
      <ListItemIcon sx={{ minWidth: 38 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </ListItemButton>
  );
};

const Sidebar = ({ onNavigate }) => {
  const { roles } = useAuth();
  const isAdmin = roles.includes('Administrator');
  const isCashierOnly = roles.includes('Cashier') && !isAdmin;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        bgcolor: 'var(--sidebarBg)',
        border: '1px solid var(--sidebarBorder)',
        borderRadius: 3
      }}
    >
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.8 }}>
          CORTEX
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
          Inventory • Vision • Forecasting
        </Typography>
      </Box>
      <Divider sx={{ borderColor: 'var(--sidebarBorder)' }} />
      <List
        dense
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          py: 1
        }}
      >
        {isCashierOnly ? (
          <NavItem to="/pos" icon={<PointOfSaleRoundedIcon />} label="POS" onClick={onNavigate} />
        ) : (
          <>
            <NavItem to="/dashboard" icon={<DashboardRoundedIcon />} label="Dashboard" onClick={onNavigate} />

            {canSee(roles, ['Administrator', 'WarehouseManager', 'WarehouseStaff']) && (
              <>
                <NavItem to="/inventory/products" icon={<Inventory2RoundedIcon />} label="Products" onClick={onNavigate} />
                <NavItem to="/inventory/stock" icon={<Inventory2RoundedIcon />} label="Stock" onClick={onNavigate} />
              </>
            )}

            {canSee(roles, ['Administrator', 'WarehouseManager']) && (
              <NavItem to="/inventory/alerts" icon={<Inventory2RoundedIcon />} label="Alerts" onClick={onNavigate} />
            )}

            {canSee(roles, ['Administrator', 'WarehouseManager']) && (
              <>
                <NavItem to="/suppliers" icon={<LocalShippingRoundedIcon />} label="Suppliers" onClick={onNavigate} />
                <NavItem to="/purchase-orders" icon={<LocalShippingRoundedIcon />} label="Purchase Orders" onClick={onNavigate} />
              </>
            )}

            {canSee(roles, ['Administrator', 'WarehouseManager', 'WarehouseStaff']) && (
              <>
                <NavItem to="/receiving" icon={<CameraAltRoundedIcon />} label="Receiving" onClick={onNavigate} />
                <NavItem to="/vision/dataset" icon={<DataObjectRoundedIcon />} label="Vision Dataset" onClick={onNavigate} />
              </>
            )}

            {canSee(roles, ['Administrator', 'Cashier']) && (
              <NavItem to="/pos" icon={<PointOfSaleRoundedIcon />} label="POS" onClick={onNavigate} />
            )}

            {canSee(roles, ['Administrator', 'WarehouseManager']) && (
              <NavItem to="/forecasting" icon={<QueryStatsRoundedIcon />} label="Forecasting" onClick={onNavigate} />
            )}

            {canSee(roles, ['Administrator']) && (
              <>
                <NavItem to="/admin/users" icon={<PeopleAltRoundedIcon />} label="Users" onClick={onNavigate} />
                <NavItem to="/settings" icon={<SettingsRoundedIcon />} label="Settings" onClick={onNavigate} />
              </>
            )}
          </>
        )}
      </List>
    </Box>
  );
};

export default Sidebar;
