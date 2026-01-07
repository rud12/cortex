export const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
};

export const validatePassword = (password) => {
  const value = String(password || '');
  const errors = [];
  if (value.length < 8) errors.push('Min 8 characters');
  if (!/[A-Z]/.test(value)) errors.push('Needs uppercase');
  if (!/[a-z]/.test(value)) errors.push('Needs lowercase');
  if (!/[0-9]/.test(value)) errors.push('Needs number');
  if (!/[!@#$%^&*]/.test(value)) errors.push('Needs special char');
  return errors;
};

export const required = (value) => {
  return String(value || '').trim().length > 0;
};

export const validatePhone = (phone) => {
  const value = String(phone || '').trim();
  if (!value) return true;
  return /^[0-9+\-() ]{7,20}$/.test(value);
};
