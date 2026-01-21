import { error } from '../utils/response.js';

export const authorize = (...roles) => (req, res, next) =>
  !req.user ? error(res, 401, 'NOT_AUTHENTICATED', 'Not authenticated')
  : roles.some(role => (req.user.roles || []).includes(role)) ? next()
  : error(res, 403, 'INSUFFICIENT_PERMISSIONS', 'Insufficient permissions');
