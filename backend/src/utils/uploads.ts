import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export const SUPPORTED_UPLOAD_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const SUPPORTED_UPLOAD_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export const SUPPORTED_UPLOAD_FILE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

const UPLOAD_IMAGE_MIME_TYPE_ALIASES: Record<string, (typeof SUPPORTED_UPLOAD_IMAGE_MIME_TYPES)[number]> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
};

const UPLOAD_FILE_MIME_TYPE_ALIASES: Record<string, (typeof SUPPORTED_UPLOAD_FILE_MIME_TYPES)[number]> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'application/x-pdf': 'application/pdf',
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

type DecodedUploadFileResult = {
  buffer: Buffer;
  extension: string;
  mimeType: (typeof SUPPORTED_UPLOAD_FILE_MIME_TYPES)[number];
};

type WrittenUploadFileResult = {
  fileName: string;
  sizeBytes: number;
  mimeType: (typeof SUPPORTED_UPLOAD_FILE_MIME_TYPES)[number];
  originalName: string;
};

export const normalizeUploadImageMimeType = (mimeType?: string | null) => {
  if (typeof mimeType !== 'string') return null;
  const normalized = mimeType.trim().toLowerCase().split(';')[0]?.trim() ?? '';
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

export const normalizeUploadFileMimeType = (mimeType?: string | null) => {
  if (typeof mimeType !== 'string') return null;
  const normalized = mimeType.trim().toLowerCase().split(';')[0]?.trim() ?? '';
  if (!normalized) return null;
  if ((SUPPORTED_UPLOAD_FILE_MIME_TYPES as readonly string[]).includes(normalized)) {
    return normalized as (typeof SUPPORTED_UPLOAD_FILE_MIME_TYPES)[number];
  }
  return UPLOAD_FILE_MIME_TYPE_ALIASES[normalized] ?? null;
};

export const inferUploadFileExtension = (mimeType?: string | null) => {
  const normalizedMimeType = normalizeUploadFileMimeType(mimeType);
  switch (normalizedMimeType) {
    case 'application/pdf':
      return 'pdf';
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
    case 'text/plain':
      return 'txt';
    case 'text/csv':
      return 'csv';
    case 'application/json':
      return 'json';
    case 'application/zip':
    case 'application/x-zip-compressed':
      return 'zip';
    case 'application/msword':
      return 'doc';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'application/vnd.ms-excel':
      return 'xls';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx';
    case 'application/vnd.ms-powerpoint':
      return 'ppt';
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return 'pptx';
    default:
      return null;
  }
};

const sanitizeUploadFileName = (fileName?: string | null, fallbackExtension = 'bin') => {
  const rawName = typeof fileName === 'string' ? fileName.trim() : '';
  const cleaned = rawName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 180);
  if (!cleaned) {
    return `document.${fallbackExtension}`;
  }
  return cleaned;
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

export const decodeBase64UploadFile = (
  base64Data?: string | null,
  mimeType?: string | null,
): DecodedUploadFileResult | UploadImageErrorResult => {
  const normalizedMimeType = normalizeUploadFileMimeType(mimeType);
  if (!normalizedMimeType) {
    return {
      error: `Unsupported file type. Allowed: ${SUPPORTED_UPLOAD_FILE_MIME_TYPES.join(', ')}`,
    };
  }

  if (typeof base64Data !== 'string' || base64Data.trim() === '') {
    return { error: 'Invalid file payload' };
  }

  const normalizedPayload = normalizeBase64Payload(base64Data);
  if (!normalizedPayload || !BASE64_PAYLOAD_PATTERN.test(normalizedPayload)) {
    return { error: 'Invalid file payload' };
  }

  const buffer = Buffer.from(normalizedPayload, 'base64');
  if (buffer.byteLength === 0) {
    return { error: 'Invalid file payload' };
  }

  const extension = inferUploadFileExtension(normalizedMimeType);
  if (!extension) {
    return { error: 'Invalid file payload' };
  }

  return {
    buffer,
    extension,
    mimeType: normalizedMimeType,
  };
};

export const writeBase64UploadFile = async ({
  base64Data,
  mimeType,
  fileName,
  uploadDir,
  maxBytes,
}: {
  base64Data?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  uploadDir: string;
  maxBytes: number;
}): Promise<WrittenUploadFileResult | UploadImageErrorResult> => {
  const decoded = decodeBase64UploadFile(base64Data, mimeType);
  if ('error' in decoded) {
    return decoded;
  }

  if (decoded.buffer.byteLength > maxBytes) {
    return { error: `File too large (max ${Math.floor(maxBytes / (1024 * 1024))}MB)` };
  }

  await fs.mkdir(uploadDir, { recursive: true });
  const storedFileName = `${Date.now()}-${randomUUID()}.${decoded.extension}`;
  const absolutePath = path.join(uploadDir, storedFileName);
  await fs.writeFile(absolutePath, decoded.buffer);

  return {
    fileName: storedFileName,
    sizeBytes: decoded.buffer.byteLength,
    mimeType: decoded.mimeType,
    originalName: sanitizeUploadFileName(fileName, decoded.extension),
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

// ─── Video Upload ────────────────────────────────────────────────────────────

const UPLOAD_VIDEO_MIME_TYPE_ALIASES: Record<string, (typeof SUPPORTED_UPLOAD_VIDEO_MIME_TYPES)[number]> = {
  'video/mov': 'video/quicktime',
  'video/x-quicktime': 'video/quicktime',
  'video/x-mp4': 'video/mp4',
};

export const normalizeUploadVideoMimeType = (mimeType?: string | null) => {
  if (typeof mimeType !== 'string') return null;
  const normalized = mimeType.trim().toLowerCase().split(';')[0]?.trim() ?? '';
  if (!normalized) return null;
  if ((SUPPORTED_UPLOAD_VIDEO_MIME_TYPES as readonly string[]).includes(normalized)) {
    return normalized as (typeof SUPPORTED_UPLOAD_VIDEO_MIME_TYPES)[number];
  }
  return UPLOAD_VIDEO_MIME_TYPE_ALIASES[normalized] ?? null;
};

export const inferUploadVideoExtension = (mimeType?: string | null) => {
  const normalizedMimeType = normalizeUploadVideoMimeType(mimeType);
  switch (normalizedMimeType) {
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    default:
      return null;
  }
};

type DecodedUploadVideoResult = {
  buffer: Buffer;
  extension: string;
  mimeType: (typeof SUPPORTED_UPLOAD_VIDEO_MIME_TYPES)[number];
};

type WrittenUploadVideoResult = {
  fileName: string;
  sizeBytes: number;
  mimeType: (typeof SUPPORTED_UPLOAD_VIDEO_MIME_TYPES)[number];
};

export const decodeBase64UploadVideo = (
  base64Data?: string | null,
  mimeType?: string | null,
): DecodedUploadVideoResult | UploadImageErrorResult => {
  const normalizedMimeType = normalizeUploadVideoMimeType(mimeType);
  if (!normalizedMimeType) {
    return {
      error: `Unsupported video type. Allowed: ${SUPPORTED_UPLOAD_VIDEO_MIME_TYPES.map((t) => t.replace('video/', '')).join(', ')}`,
    };
  }

  if (typeof base64Data !== 'string' || base64Data.trim() === '') {
    return { error: 'Invalid video payload' };
  }

  const normalizedPayload = normalizeBase64Payload(base64Data);
  if (!normalizedPayload) {
    return { error: 'Invalid video payload' };
  }

  const buffer = Buffer.from(normalizedPayload, 'base64');
  if (buffer.byteLength === 0) {
    return { error: 'Invalid video payload' };
  }

  const extension = inferUploadVideoExtension(normalizedMimeType);
  if (!extension) {
    return { error: 'Invalid video payload' };
  }

  return { buffer, extension, mimeType: normalizedMimeType };
};

export const writeBase64UploadVideo = async ({
  base64Data,
  mimeType,
  uploadDir,
  maxBytes,
}: {
  base64Data?: string | null;
  mimeType?: string | null;
  uploadDir: string;
  maxBytes: number;
}): Promise<WrittenUploadVideoResult | UploadImageErrorResult> => {
  const decoded = decodeBase64UploadVideo(base64Data, mimeType);
  if ('error' in decoded) return decoded;

  if (decoded.buffer.byteLength > maxBytes) {
    return { error: `Video too large (max ${Math.floor(maxBytes / (1024 * 1024))}MB)` };
  }

  await fs.mkdir(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.${decoded.extension}`;
  const absolutePath = path.join(uploadDir, fileName);
  await fs.writeFile(absolutePath, decoded.buffer);

  return { fileName, sizeBytes: decoded.buffer.byteLength, mimeType: decoded.mimeType };
};
