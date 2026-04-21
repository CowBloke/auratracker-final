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
      return 'En defaut';
    case 'REJECTED':
      return 'Refuse';
    default:
      return status;
  }
}

export function getLoanStatusPillColor(status: string) {
  switch (status) {
    case 'PENDING':
      return 'bg-sky-400/15 text-sky-300';
    case 'ACTIVE':
      return 'bg-amber-400/15 text-amber-300';
    case 'REPAID':
      return 'bg-emerald-400/15 text-emerald-300';
    case 'DEFAULTED':
      return 'bg-rose-400/15 text-rose-300';
    case 'REJECTED':
      return 'bg-zinc-400/20 text-zinc-300';
    default:
      return 'bg-muted/30 text-muted-foreground';
  }
}
