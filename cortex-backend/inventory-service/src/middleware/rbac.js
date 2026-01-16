import { error } from '../utils/response.js';

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 401, 'NOT_AUTHENTICATED', 'Not authenticated');
    }

    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
    const allowed = roles.some((role) => userRoles.includes(role));

    if (!allowed) {
      return error(res, 403, 'INSUFFICIENT_PERMISSIONS', 'Insufficient permissions');
    }

    next();
  };
};
