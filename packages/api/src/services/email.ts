/**
 * Email Service
 *
 * Renders transactional mail with React Email and delivers via Resend.
 * Falls back to console logging when RESEND_API_KEY is missing.
 *
 * Templates live in src/emails/. Do not add inline HTML strings here —
 * see plan.md §3.8.
 */

import { renderMagicLinkEmail, renderWelcomeEmail } from '../emails/render.js';

export interface EmailService {
  sendMagicLink(to: string, magicLink: string): Promise<boolean>;
  sendWelcomeEmail(to: string): Promise<boolean>;
}

interface SendArgs {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function sendResend({ apiKey, from, to, subject, html, text }: SendArgs): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend API error:', {
        status: response.status,
        statusText: response.statusText,
        error,
        to,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email service error:', error);
    return false;
  }
}

export function createEmailService(apiKey?: string): EmailService {
  return {
    async sendMagicLink(to: string, magicLink: string): Promise<boolean> {
      if (!apiKey) {
        console.warn('RESEND_API_KEY not configured - email not sent');
        return false;
      }

      const { html, text } = await renderMagicLinkEmail(magicLink);
      return sendResend({
        apiKey,
        from: 'Dripnex <noreply@dripnex.app>',
        to,
        subject: 'Sign in to Dripnex',
        html,
        text,
      });
    },

    async sendWelcomeEmail(to: string): Promise<boolean> {
      if (!apiKey) {
        console.warn('RESEND_API_KEY not configured - welcome email not sent');
        return false;
      }

      const { html, text } = await renderWelcomeEmail(to);
      return sendResend({
        apiKey,
        from: 'Dripnex <hello@dripnex.app>',
        to,
        subject: 'Dripnex',
        html,
        text,
      });
    },
  };
}
