import { error } from '../utils/response.js';
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.some(r => req.user.roles?.includes(r))) return error(res, req.user ? 403 : 401, req.user ? 'INSUFFICIENT_PERMISSIONS' : 'NOT_AUTHENTICATED', 'Insufficient permissions');
  next();
};
