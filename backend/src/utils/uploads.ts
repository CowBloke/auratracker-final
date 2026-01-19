export const isUploadPath = (value?: string | null) => {
  if (typeof value !== 'string') return false;
  return value.startsWith('/uploads/') || value.startsWith('/api/uploads/');
};

export const isRemoteImageUrl = (value?: string | null) => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const isAllowedImageUrl = (value?: string | null) => {
  return isUploadPath(value) || isRemoteImageUrl(value);
};
