export const success = (res, data, message = 'Operation successful', pagination) => {
  const payload = {
    success: true,
    data,
    message
  };

  if (pagination) {
    payload.pagination = pagination;
  }

  return res.json(payload);
};

export const error = (res, status, code, message, details) => {
  const payload = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (details) {
    payload.error.details = details;
  }

  return res.status(status).json(payload);
};
