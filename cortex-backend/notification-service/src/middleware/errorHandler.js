import { error } from '../utils/response.js';
export const errorHandler = (err, req, res, next) => {
  console.error(err);
  const s = err?.statusCode || err?.status || 500;
  return error(res, s, err?.errorCode || 'INTERNAL_SERVER_ERROR', s >= 500 ? (err?.message || 'Error') : (err?.message || 'Failed'));
};
