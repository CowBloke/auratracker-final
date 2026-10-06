import type { YouBusinessLoan } from '@/services/api';

export async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return window.btoa(binary);
}

export function getLoanStartDate(loan: YouBusinessLoan) {
  return new Date(loan.decidedAt ?? loan.createdAt);
}

export function getLoanDueDate(loan: YouBusinessLoan) {
  const dueDate = new Date(getLoanStartDate(loan));
  dueDate.setDate(dueDate.getDate() + Math.max(0, loan.termDays));
  return dueDate;
}

export function formatLoanDate(value: string | Date) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getLoanTimeLeftLabel(loan: YouBusinessLoan) {
  const dueDate = getLoanDueDate(loan);
  const diffMs = dueDate.getTime() - Date.now();

  if (diffMs <= 0) {
    return 'Echeance depassee';
  }

  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days <= 0) {
    return `${hours}h restantes`;
  }

  if (hours === 0) {
    return `${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
  }

  return `${days}j ${hours}h restantes`;
}

export function getLoanStatusLabel(status: string) {
  switch (status) {
    case 'PENDING':
      return 'En attente';
    case 'ACTIVE':
      return 'Actif';
    case 'REPAID':
      return 'Rembourse';
    case 'DEFAULTED':
      return 'En défaut';
    case 'REJECTED':
      return 'Refuse';
    default:
      return status;
  }
}

export function getLoanStatusPillColor(status: string) {
  switch (status) {
    case 'PENDING':
      return 'bg-muted/15 text-primary';
    case 'ACTIVE':
      return 'bg-warning/15 text-warning';
    case 'REPAID':
      return 'bg-success/15 text-success';
    case 'DEFAULTED':
      return 'bg-destructive/15 text-destructive';
    case 'REJECTED':
      return 'bg-secondary/20 text-muted-foreground';
    default:
      return 'bg-muted/30 text-muted-foreground';
  }
}
