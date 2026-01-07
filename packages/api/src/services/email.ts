/**
 * Email Service
 *
 * Sends transactional emails via Resend.
 * Falls back to console logging in development.
 */

export interface EmailService {
  sendMagicLink(to: string, magicLink: string): Promise<boolean>;
}

/**
 * Create email service using Resend
 */
export function createEmailService(apiKey?: string): EmailService {
  return {
    async sendMagicLink(to: string, magicLink: string): Promise<boolean> {
      if (!apiKey) {
        // Development fallback - log to console
        console.log('📧 Magic link email (dev mode):');
        console.log(`   To: ${to}`);
        console.log(`   Link: ${magicLink}`);
        return true;
      }

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Readied <noreply@readied.app>',
            to: [to],
            subject: 'Sign in to Readied',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 24px;">Sign in to Readied</h1>
                <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">
                  Click the button below to sign in to your Readied account. This link will expire in 15 minutes.
                </p>
                <a href="${magicLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                  Sign in to Readied
                </a>
                <p style="font-size: 14px; color: #6b7280; margin-top: 32px;">
                  If you didn't request this email, you can safely ignore it.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
                <p style="font-size: 12px; color: #9ca3af;">
                  Readied - Markdown notes, beautifully simple.
                </p>
              </div>
            `,
            text: `Sign in to Readied\n\nClick this link to sign in: ${magicLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this email, you can safely ignore it.`,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Failed to send email:', error);
          return false;
        }

        return true;
      } catch (error) {
        console.error('Email service error:', error);
        return false;
      }
    },
  };
}
