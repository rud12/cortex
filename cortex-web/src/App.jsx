import React, { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import ProtectedRoute from './components/common/ProtectedRoute';
import RoleGate from './components/common/RoleGate';
import AppShell from './components/common/AppShell';

import LoginPage from './pages/LoginPage/LoginPage';
import BusinessSignupPage from './pages/BusinessSignupPage/BusinessSignupPage';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import ProductsPage from './pages/Inventory/ProductsPage';
import StockPage from './pages/Inventory/StockPage';
import AlertsPage from './pages/Inventory/AlertsPage';
import SuppliersPage from './pages/Suppliers/SuppliersPage';
import PurchaseOrdersPage from './pages/PurchaseOrders/PurchaseOrdersPage';
import ReceivingPage from './pages/Receiving/ReceivingPage';
import POSPage from './pages/POS/POSPage';
import ForecastingPage from './pages/Forecasting/ForecastingPage';
import UsersPage from './pages/Admin/UsersPage';
import VisionDatasetPage from './pages/VisionDataset/VisionDatasetPage';
import SettingsPage from './pages/Settings/SettingsPage';
import NotFoundPage from './pages/NotFoundPage/NotFoundPage';
import { useAuth } from './contexts/AuthContext';

const Page = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
};

const DashboardEntry = () => {
  const { roles } = useAuth();
  const isCashierOnly = roles.includes('Cashier') && !roles.includes('Administrator');
  if (isCashierOnly) {
    return <Navigate to="/pos" replace />;
  }
  return <Page><DashboardPage /></Page>;
};

const App = () => {
  const location = useLocation();

  useEffect(() => {
    const isPos = location.pathname.startsWith('/pos');
    document.body.classList.toggle('pos-mode', isPos);
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={<Page><LoginPage /></Page>}
        />
        <Route path="/login" element={<Page><LoginPage /></Page>} />
        <Route path="/business-signup" element={<Page><BusinessSignupPage /></Page>} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardEntry />} />

          <Route
            path="/inventory/products"
            element={
              <Page>
                <RoleGate allow={["Administrator", "WarehouseManager", "WarehouseStaff"]}>
                  <ProductsPage />
                </RoleGate>
              </Page>
            }
          />
          <Route
            path="/inventory/stock"
            element={
              <Page>
                <RoleGate allow={["Administrator", "WarehouseManager", "WarehouseStaff"]}>
                  <StockPage />
                </RoleGate>
              </Page>
            }
          />
          <Route
            path="/inventory/alerts"
            element={
              <Page>
                <RoleGate allow={["Administrator", "WarehouseManager"]}>
                  <AlertsPage />
                </RoleGate>
              </Page>
            }
          />

          <Route
            path="/suppliers"
            element={
              <Page>
                <RoleGate allow={["Administrator", "WarehouseManager"]}>
                  <SuppliersPage />
                </RoleGate>
              </Page>
            }
          />

          <Route
            path="/purchase-orders"
            element={
              <Page>
                <RoleGate allow={["Administrator", "WarehouseManager"]}>
                  <PurchaseOrdersPage />
                </RoleGate>
              </Page>
            }
          />

          <Route
            path="/receiving"
            element={
              <Page>
                <RoleGate allow={["Administrator", "WarehouseManager", "WarehouseStaff"]}>
                  <ReceivingPage />
                </RoleGate>
              </Page>
            }
          />

          <Route
            path="/vision/dataset"
            element={
              <Page>
                <RoleGate allow={["Administrator", "WarehouseManager", "WarehouseStaff"]}>
                  <VisionDatasetPage />
                </RoleGate>
              </Page>
            }
          />

          <Route
            path="/forecasting"
            element={
              <Page>
                <RoleGate allow={["Administrator", "WarehouseManager"]}>
                  <ForecastingPage />
                </RoleGate>
              </Page>
            }
          />


          <Route
            path="/admin/users"
            element={
              <Page>
                <RoleGate allow={["Administrator"]}>
                  <UsersPage />
                </RoleGate>
              </Page>
            }
          />

          <Route
            path="/settings"
            element={
              <Page>
                <RoleGate allow={["Administrator"]}>
                  <SettingsPage />
                </RoleGate>
              </Page>
            }
          />
        </Route>

        <Route
          path="/pos"
          element={
            <ProtectedRoute>
              <Page>
                <RoleGate allow={["Administrator", "Cashier"]}>
                  <POSPage />
                </RoleGate>
              </Page>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Page><NotFoundPage /></Page>} />
      </Routes>
    </AnimatePresence>
  );
};

export default App;
