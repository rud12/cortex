import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { ToastContainer } from 'react-toastify';

import '@fontsource-variable/space-grotesk';
import 'react-toastify/dist/ReactToastify.css';
import './styles/index.css';

import { buildCortexTheme } from './theme';
import { AuthProvider } from './contexts/AuthContext';
import { InventoryProvider } from './contexts/InventoryContext';
import { ThemeProviderLocal, useThemeLocal } from './contexts/ThemeContext';
import App from './App';

const AppWithTheme = () => {
  const { themeMode } = useThemeLocal();
  const muiTheme = useMemo(() => buildCortexTheme(themeMode), [themeMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    document.body.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div className="cortex-noise" />
      <BrowserRouter>
        <AuthProvider>
          <InventoryProvider>
            <App />
          </InventoryProvider>
        </AuthProvider>
      </BrowserRouter>
      <ToastContainer position="bottom-right" theme={themeMode === 'light' ? 'light' : 'dark'} newestOnTop />
    </ThemeProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProviderLocal>
      <AppWithTheme />
    </ThemeProviderLocal>
  </React.StrictMode>
);
