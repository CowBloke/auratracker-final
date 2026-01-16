export const isUploadPath = (value?: string | null) => {
  return typeof value === 'string' && value.startsWith('/uploads/');
};
