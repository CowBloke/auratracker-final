const SUPPORTED_UPLOAD_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

const IMAGE_UPLOAD_MIME_TYPE_ALIASES: Record<string, (typeof SUPPORTED_UPLOAD_IMAGE_MIME_TYPES)[number]> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
};

const CONVERTIBLE_UPLOAD_IMAGE_MIME_TYPES = new Set([
  'image/svg+xml',
  'image/heic',
  'image/heif',
]);

export const IMAGE_UPLOAD_INPUT_ACCEPT = [
  ...SUPPORTED_UPLOAD_IMAGE_MIME_TYPES,
  ...CONVERTIBLE_UPLOAD_IMAGE_MIME_TYPES,
].join(',');

const extractBase64Payload = (dataUrl: string) => {
  const parts = dataUrl.split(',');
  return parts.length > 1 ? parts[1] ?? '' : '';
};

const normalizeUploadImageMimeType = (mimeType?: string | null) => {
  if (typeof mimeType !== 'string') return null;
  const normalized = mimeType.trim().toLowerCase().split(';')[0]?.trim() ?? '';
  if (!normalized) return null;
  if ((SUPPORTED_UPLOAD_IMAGE_MIME_TYPES as readonly string[]).includes(normalized)) {
    return normalized as (typeof SUPPORTED_UPLOAD_IMAGE_MIME_TYPES)[number];
  }
  return IMAGE_UPLOAD_MIME_TYPE_ALIASES[normalized] ?? null;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('Invalid file'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });

const loadImageFromDataUrl = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unsupported image format'));
    image.src = dataUrl;
  });

const dataUrlToUploadPayload = (dataUrl: string, mimeType: string) => {
  const base64Data = extractBase64Payload(dataUrl);
  if (!base64Data) {
    throw new Error('Invalid image payload');
  }

  return {
    base64Data,
    mimeType,
  };
};

const convertImageDataUrlToSupportedFormat = async (dataUrl: string) => {
  const image = await loadImageFromDataUrl(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) {
    throw new Error('Unsupported image format');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Image conversion is not available');
  }

  context.drawImage(image, 0, 0, width, height);

  const webpDataUrl = canvas.toDataURL('image/webp', 0.92);
  if (webpDataUrl.startsWith('data:image/webp;base64,')) {
    return dataUrlToUploadPayload(webpDataUrl, 'image/webp');
  }

  const pngDataUrl = canvas.toDataURL('image/png');
  return dataUrlToUploadPayload(pngDataUrl, 'image/png');
};

export const prepareImageUploadPayload = async (file: File) => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Seules les images sont acceptees.');
  }

  const dataUrl = await readFileAsDataUrl(file);
  const supportedMimeType = normalizeUploadImageMimeType(file.type);

  if (supportedMimeType) {
    return dataUrlToUploadPayload(dataUrl, supportedMimeType);
  }

  if (!CONVERTIBLE_UPLOAD_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new Error('Format non supporte. Utilise JPG, PNG, WebP, GIF ou AVIF.');
  }

  try {
    return await convertImageDataUrlToSupportedFormat(dataUrl);
  } catch {
    throw new Error('Ce format image ne peut pas etre converti automatiquement sur cet appareil.');
  }
};
