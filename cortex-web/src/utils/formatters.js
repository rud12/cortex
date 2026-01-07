export const formatMoney = (value) => {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);
};

export const formatDateTime = (value) => {
  if (!value) return '';
  const dt = new Date(value);
  return dt.toLocaleString();
};

export const formatDate = (value) => {
  if (!value) return '';
  const dt = new Date(value);
  return dt.toLocaleDateString();
};
