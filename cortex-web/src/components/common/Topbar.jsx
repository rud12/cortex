import React from 'react';
import { Box, Button, Chip, IconButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';

import { useAuth } from '../../contexts/AuthContext';
import { useInventory } from '../../contexts/InventoryContext';

const Topbar = ({ showMenuButton = false, onMenuClick }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { user, roles, logout } = useAuth();
  const { socketConnected } = useInventory();

  return (
    <Box
      className="cortex-card"
      sx={{
        px: { xs: 1.25, sm: 2 },
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25
      }}
    >
      {showMenuButton && (
        <IconButton
          onClick={onMenuClick}
          sx={{
            border: `1px solid ${isDark ? '#1F2937' : '#CBD5E1'}`,
            color: isDark ? '#E5E7EB' : '#0B1220',
            flexShrink: 0
          }}
          aria-label="Open menu"
        >
          <MenuRoundedIcon />
        </IconButton>
      )}

      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {user?.fullName || user?.username || user?.email || 'User'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          <Chip
            size="small"
            label={socketConnected ? 'Live stock: connected' : 'Live stock: reconnecting'}
            sx={{
              bgcolor: socketConnected
                ? (isDark ? 'rgba(34,197,94,0.18)' : 'rgba(4,120,87,0.14)')
                : (isDark ? 'rgba(245,158,11,0.18)' : 'rgba(217,119,6,0.18)'),
              border: `1px solid ${isDark ? '#1F2937' : '#CBD5E1'}`,
              color: isDark ? '#E5E7EB' : '#0B1220'
            }}
          />
          {roles.slice(0, 2).map((role) => (
            <Chip
              key={role}
              size="small"
              label={role}
              sx={{
                bgcolor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(30,64,175,0.12)',
                border: `1px solid ${isDark ? '#1F2937' : '#CBD5E1'}`,
                color: isDark ? '#E5E7EB' : '#0B1220'
              }}
            />
          ))}
        </Box>
      </Box>

      <Button
        variant="outlined"
        color="secondary"
        startIcon={<LogoutRoundedIcon />}
        onClick={logout}
        sx={{
          borderColor: isDark ? '#94A3B8' : '#CBD5E1',
          color: isDark ? '#E5E7EB' : '#0B1220',
          minWidth: { xs: 40, sm: 'auto' },
          px: { xs: 1.25, sm: 2 }
        }}
      >
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          Logout
        </Box>
      </Button>
    </Box>
  );
};

export default Topbar;
