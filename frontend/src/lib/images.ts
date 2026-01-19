const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getUploadsBaseUrl = () => {
  let base = API_URL;
  if (base.endsWith('/')) {
    base = base.slice(0, -1);
  }
  return base;
};

export const resolveImageUrl = (value?: string | null) => {
  if (!value) return '';
  if (value.startsWith('/uploads/') || value.startsWith('/api/uploads/')) {
    const normalizedPath = value.startsWith('/api/uploads/')
      ? value.slice(4)
      : value;
    return `${getUploadsBaseUrl()}${normalizedPath}`;
  }
  return value;
};

export const isUploadPath = (value?: string | null) => {
  return typeof value === 'string' && (value.startsWith('/uploads/') || value.startsWith('/api/uploads/'));
};
