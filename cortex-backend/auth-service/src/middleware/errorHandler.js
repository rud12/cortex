import { error } from '../utils/response.js';
export const errorHandler = (err, req, res, next) => {
  console.error(err);
  error(res, err.name === 'ValidationError' ? 400 : 500, err.name === 'ValidationError' ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR', err.name === 'ValidationError' ? err.message : 'Internal server error');
};
