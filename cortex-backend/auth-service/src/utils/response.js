export const success = (res, data, message = 'Operation successful') => res.json({ success: true, data, message });
export const error = (res, status, code, message, details) => res.status(status).json({ success: false, error: { code, message, ...(details && { details }) } });
