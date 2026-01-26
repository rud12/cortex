import { error } from '../utils/response.js';

export const errorHandler = (err, req, res, next) => {
  return error(res, 500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
};
