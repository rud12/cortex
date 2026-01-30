import { error } from '../utils/response.js';
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.some(r => req.user?.roles?.includes(r))) return error(res, 403, 'DENIED', 'No permission');
  next();
};
