const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const resolveImageUrl = (value?: string | null) => {
  if (!value) return '';
  if (value.startsWith('/uploads/')) {
    return `${API_URL}${value}`;
  }
  return value;
};
