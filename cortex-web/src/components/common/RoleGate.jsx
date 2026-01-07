import React from 'react';

import { useAuth } from '../../contexts/AuthContext';

const RoleGate = ({ allow = [], children, fallback = null }) => {
  const { hasRole } = useAuth();
  if (!hasRole(allow)) {
    return fallback || (
      <div className="p-6">
        <div className="cortex-card p-6">
          <div className="text-2xl font-semibold">Access denied</div>
          <div className="mt-2 text-white/70">You don’t have permission to view this page.</div>
        </div>
      </div>
    );
  }
  return children;
};

export default RoleGate;
