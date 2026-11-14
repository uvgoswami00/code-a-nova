// All outgoing mail goes through here (ADR-0009).
// Rules: sender NAME is always "Code-a-Nova"; no developer/candidate names in templates;
// every user-supplied value is HTML-escaped.
import { createTransport, type Transporter } from 'nodemailer';
import { config } from '../config/env';
import { escapeHtml } from '../utils/escapeHtml';

export interface ConfirmationDetails {
  fullName: string;
  projectName: string;
  domain: string;
  college: string;
  teamSize: number;
  teamMembers: { name: string; email: string }[];
}

let transporter: Transporter | undefined;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = createTransport({
      host: config.emailHost,
      port: config.emailPort,
      secure: config.emailPort === 465, // 465 = implicit TLS, 587 = STARTTLS
      auth: { user: config.emailUser, pass: config.emailPass }, // Gmail: use an App Password
    });
  }
  return transporter;
}

const from = () => ({
  name: config.emailSenderName,
  address: config.emailFrom,
});

// Shared HTML shell so every email looks consistent.
const layout = (title: string, bodyHtml: string): string => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <div style="background:#4f46e5;color:#fff;padding:16px 24px;font-size:20px;font-weight:bold">Code-a-Nova</div>
    <div style="padding:24px;color:#111827">
      <h2 style="margin-top:0">${escapeHtml(title)}</h2>
      ${bodyHtml}
    </div>
    <div style="background:#f9fafb;color:#6b7280;padding:12px 24px;font-size:12px">
      This is an automated message from Code-a-Nova. Please do not reply.
    </div>
  </div>`;

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const html = layout(
    'Verify your email',
    `<p>Use the code below to verify your account:</p>
     <p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:16px 0">${escapeHtml(otp)}</p>
     <p>This code expires in <b>${config.otpTtlMinutes} minutes</b> and can be used only once.
     If you did not request it, you can ignore this email.</p>`
  );
  await getTransporter().sendMail({
    from: from(),
    to,
    subject: 'Your Code-a-Nova verification code',
    text: `Your Code-a-Nova verification code is ${otp}. It expires in ${config.otpTtlMinutes} minutes.`,
    html,
  });
}

export async function sendRegistrationConfirmation(to: string, registration: ConfirmationDetails): Promise<void> {
  const members = registration.teamMembers.length
    ? `<ul>${registration.teamMembers
        .map((m) => `<li>${escapeHtml(m.name)} (${escapeHtml(m.email)})</li>`)
        .join('')}</ul>`
    : '<p>Solo participation.</p>';

  const html = layout(
    'Registration confirmed',
    `<p>Hi ${escapeHtml(registration.fullName)}, you are registered for <b>${escapeHtml(config.eventName)}</b>.</p>
     <table cellpadding="6" style="border-collapse:collapse">
       <tr><td><b>Project</b></td><td>${escapeHtml(registration.projectName)}</td></tr>
       <tr><td><b>Domain / Track</b></td><td>${escapeHtml(registration.domain)}</td></tr>
       <tr><td><b>College</b></td><td>${escapeHtml(registration.college)}</td></tr>
       <tr><td><b>Team size</b></td><td>${registration.teamSize}</td></tr>
     </table>
     <h3>Team members</h3>
     <p>${escapeHtml(registration.fullName)} (team lead)</p>
     ${members}`
  );
  await getTransporter().sendMail({
    from: from(),
    to,
    subject: `Registration confirmed - ${config.eventName}`,
    text: `Hi ${registration.fullName}, you are registered for ${config.eventName}. Project: ${registration.projectName}. Domain: ${registration.domain}. Team size: ${registration.teamSize}.`,
    html,
  });
}

// Contact-form messages are delivered to the project inbox; replyTo = visitor.
export async function sendContactNotification(input: { name: string; email: string; message: string }): Promise<void> {
  await getTransporter().sendMail({
    from: from(),
    to: config.contactEmail,
    replyTo: input.email,
    subject: 'New contact form message',
    html: layout(
      'New contact message',
      `<p><b>From:</b> ${escapeHtml(input.name)} (${escapeHtml(input.email)})</p><p>${escapeHtml(input.message).replace(/\n/g, '<br>')}</p>`
    ),
    text: `From: ${input.name} (${input.email})\n\n${input.message}`,
  });
}
