import { error } from '../utils/response.js';

export const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.name === 'ValidationError') {
    return error(res, 400, 'VALIDATION_ERROR', err.message);
  }

  return error(res, 500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
};
