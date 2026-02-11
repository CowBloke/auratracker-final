const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getUploadsBaseUrl = () => {
  try {
    const parsed = new URL(API_URL, window.location.origin);
    const origin = parsed.origin;
    const normalizedPath = parsed.pathname.replace(/\/+$/, '');

    // If API URL ends with /api, uploads live one level above that path.
    if (normalizedPath.endsWith('/api')) {
      const withoutApi = normalizedPath.slice(0, -4);
      return `${origin}${withoutApi}`;
    }

    return `${origin}${normalizedPath}`;
  } catch {
    return API_URL.replace(/\/+$/, '');
  }
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
