const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const readFileAsDataUrl = (file: File): Promise<string> => {
  if (file.size > MAX_UPLOAD_BYTES) {
    return Promise.reject(new Error('Image too large'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};
