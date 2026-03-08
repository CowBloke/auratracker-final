import nodemailer from 'nodemailer';

function createTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendBugReportReplyEmail(opts: {
  to: string;
  username: string;
  bugTitle: string;
  adminReply: string;
  status: 'PENDING' | 'DONE';
}) {
  const transporter = createTransporter();
  if (!transporter) return; // Email not configured, skip silently

  const { to, username, bugTitle, adminReply, status } = opts;
  const statusLabel = status === 'DONE' ? 'résolu' : 'en cours de traitement';

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'AuraTracker <noreply@auratracker.com>',
    to,
    subject: `[AuraTracker] Réponse à votre signalement : ${bugTitle}`,
    html: `
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="UTF-8" /></head>
      <body style="font-family:sans-serif;background:#0a0a0a;color:#e4e4e7;padding:32px;">
        <div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:12px;padding:32px;border:1px solid #27272a;">
          <h2 style="margin:0 0 8px;color:#ffffff;">Mise à jour de votre signalement</h2>
          <p style="color:#71717a;margin:0 0 24px;font-size:14px;">Bonjour <strong style="color:#e4e4e7;">${username}</strong>,</p>
          <p style="color:#a1a1aa;font-size:14px;margin:0 0 16px;">
            Votre signalement <strong style="color:#e4e4e7;">"${bugTitle}"</strong> a été marqué comme <strong style="color:#22c55e;">${statusLabel}</strong>.
          </p>
          <div style="background:#09090b;border-left:3px solid #6366f1;border-radius:6px;padding:16px;margin:0 0 24px;">
            <p style="margin:0 0 6px;font-size:12px;color:#71717a;">Réponse de l'équipe</p>
            <p style="margin:0;font-size:14px;color:#e4e4e7;white-space:pre-wrap;">${adminReply}</p>
          </div>
          <p style="color:#52525b;font-size:12px;margin:0;">
            Merci pour votre contribution à l'amélioration d'AuraTracker.
          </p>
        </div>
      </body>
      </html>
    `,
  });
}
