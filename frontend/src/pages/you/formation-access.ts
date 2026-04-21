import { youApi } from '@/services/api';
import { withRouteError } from './utils';

export async function openFormationAccess(
  businessId: string,
  productId: string,
  mode: 'file' | 'external' | 'auto' = 'auto',
) {
  const access = await withRouteError(
    () => youApi.accessFormationProduct(businessId, productId),
    'Impossible d acceder a cette formation.',
  );
  const result = access.data.result;

  if ((mode === 'external' || mode === 'auto') && result.url && (mode === 'external' || !result.hasAttachment)) {
    window.open(result.url, '_blank', 'noopener,noreferrer');
    return;
  }

  if (mode === 'external' && !result.url) {
    throw new Error('FORMATION_EXTERNAL_URL_UNAVAILABLE');
  }

  if (!result.hasAttachment) {
    if (result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer');
      return;
    }
    throw new Error('FORMATION_ATTACHMENT_UNAVAILABLE');
  }

  const blobResponse = await withRouteError(
    () => youApi.downloadFormationProductFile(businessId, productId),
    'Impossible de telecharger ce fichier.',
  );
  const blob = new Blob([blobResponse.data], { type: result.attachmentMimeType ?? 'application/octet-stream' });
  const objectUrl = window.URL.createObjectURL(blob);
  if (result.attachmentMimeType === 'application/pdf') {
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
  } else {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = result.attachmentOriginalName ?? `${result.title}.bin`;
    link.click();
  }
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}