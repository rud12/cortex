export const success = (res, data, message = 'Operation successful') => res.json({ success: true, data, message });

export const error = (res, status, code, message, details) => {
  const payload = { success: false, error: { code, message } };
  if (details) payload.error.details = details;
  return res.status(status).json(payload);
};
