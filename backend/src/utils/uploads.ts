import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export const SUPPORTED_UPLOAD_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

const UPLOAD_IMAGE_MIME_TYPE_ALIASES: Record<string, (typeof SUPPORTED_UPLOAD_IMAGE_MIME_TYPES)[number]> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
};

const BASE64_PAYLOAD_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

type UploadImageErrorResult = {
  error: string;
};

type DecodedUploadImageResult = {
  buffer: Buffer;
  extension: string;
  mimeType: (typeof SUPPORTED_UPLOAD_IMAGE_MIME_TYPES)[number];
};

type WrittenUploadImageResult = {
  fileName: string;
  sizeBytes: number;
  mimeType: (typeof SUPPORTED_UPLOAD_IMAGE_MIME_TYPES)[number];
};

export const normalizeUploadImageMimeType = (mimeType?: string | null) => {
  if (typeof mimeType !== 'string') return null;
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return null;
  if ((SUPPORTED_UPLOAD_IMAGE_MIME_TYPES as readonly string[]).includes(normalized)) {
    return normalized as (typeof SUPPORTED_UPLOAD_IMAGE_MIME_TYPES)[number];
  }
  return UPLOAD_IMAGE_MIME_TYPE_ALIASES[normalized] ?? null;
};

export const inferUploadImageExtension = (mimeType?: string | null) => {
  const normalizedMimeType = normalizeUploadImageMimeType(mimeType);
  switch (normalizedMimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/avif':
      return 'avif';
    default:
      return null;
  }
};

const normalizeBase64Payload = (value: string) =>
  value
    .trim()
    .replace(/^data:[^;,]+;base64,/i, '')
    .replace(/\s+/g, '');

export const decodeBase64UploadImage = (
  base64Data?: string | null,
  mimeType?: string | null,
): DecodedUploadImageResult | UploadImageErrorResult => {
  const normalizedMimeType = normalizeUploadImageMimeType(mimeType);
  if (!normalizedMimeType) {
    return {
      error: `Unsupported image type. Allowed: ${SUPPORTED_UPLOAD_IMAGE_MIME_TYPES.map((type) => type.replace('image/', '')).join(', ')}`,
    };
  }

  if (typeof base64Data !== 'string' || base64Data.trim() === '') {
    return { error: 'Invalid image payload' };
  }

  const normalizedPayload = normalizeBase64Payload(base64Data);
  if (!normalizedPayload || !BASE64_PAYLOAD_PATTERN.test(normalizedPayload)) {
    return { error: 'Invalid image payload' };
  }

  const buffer = Buffer.from(normalizedPayload, 'base64');
  if (buffer.byteLength === 0) {
    return { error: 'Invalid image payload' };
  }

  const extension = inferUploadImageExtension(normalizedMimeType);
  if (!extension) {
    return { error: 'Invalid image payload' };
  }

  return {
    buffer,
    extension,
    mimeType: normalizedMimeType,
  };
};

export const writeBase64UploadImage = async ({
  base64Data,
  mimeType,
  uploadDir,
  maxBytes,
}: {
  base64Data?: string | null;
  mimeType?: string | null;
  uploadDir: string;
  maxBytes: number;
}): Promise<WrittenUploadImageResult | UploadImageErrorResult> => {
  const decoded = decodeBase64UploadImage(base64Data, mimeType);
  if ('error' in decoded) {
    return decoded;
  }

  if (decoded.buffer.byteLength > maxBytes) {
    return { error: `Image too large (max ${Math.floor(maxBytes / (1024 * 1024))}MB)` };
  }

  await fs.mkdir(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.${decoded.extension}`;
  const absolutePath = path.join(uploadDir, fileName);
  await fs.writeFile(absolutePath, decoded.buffer);

  return {
    fileName,
    sizeBytes: decoded.buffer.byteLength,
    mimeType: decoded.mimeType,
  };
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

export const isLocalUploadPath = (value?: string | null) => {
  if (typeof value !== 'string') return false;
  return value.startsWith('/uploads/') || value.startsWith('/api/uploads/');
};

export const isAllowedImageUrl = (value?: string | null) => {
  return isRemoteImageUrl(value) || isLocalUploadPath(value);
};
