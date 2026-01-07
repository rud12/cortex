import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';

import inventorySocket from '../services/websocket/inventorySocket';
import { useAuth } from './AuthContext';

const InventoryContext = createContext(null);

export const InventoryProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [updatesByProductId, setUpdatesByProductId] = useState({});
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      inventorySocket.disconnect();
      setSocketConnected(false);
      return;
    }

    inventorySocket.connect();
    const unsub = inventorySocket.subscribe((msg) => {
      if (msg?.type === 'INVENTORY_UPDATE' && msg?.payload?.productId) {
        setUpdatesByProductId((prev) => ({
          ...prev,
          [msg.payload.productId]: {
            ...msg.payload,
            ts: Date.now()
          }
        }));
        toast.info('Stock updated');
      }
    });

    const interval = setInterval(() => {
      setSocketConnected(inventorySocket.connected);
    }, 500);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({ updatesByProductId, socketConnected }),
    [updatesByProductId, socketConnected]
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
};

export const useInventory = () => {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
};
