import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Drawer, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AdminChatbotWidget from './AdminChatbotWidget';

const AppShell = () => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '280px 1fr' },
          gap: 2,
          p: { xs: 1.25, md: 2 },
          minHeight: '100vh'
        }}
      >
        {isDesktop ? (
          <Box sx={{ position: 'sticky', top: 16, height: 'calc(100vh - 32px)' }}>
            <Sidebar />
          </Box>
        ) : (
          <Drawer
            open={mobileMenuOpen}
            onClose={closeMobileMenu}
            ModalProps={{ keepMounted: true }}
            PaperProps={{
              sx: {
                width: 300,
                bgcolor: 'transparent',
                boxShadow: 'none',
                p: 1.25
              }
            }}
          >
            <Sidebar onNavigate={closeMobileMenu} />
          </Drawer>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <Topbar
            showMenuButton={!isDesktop}
            onMenuClick={!isDesktop ? () => setMobileMenuOpen(true) : undefined}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
      <AdminChatbotWidget />
    </>
  );
};

export default AppShell;
