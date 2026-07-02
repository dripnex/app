/**
 * Email Service
 *
 * Sends transactional emails via Resend.
 * Falls back to console logging in development.
 */

export interface EmailService {
  sendMagicLink(to: string, magicLink: string): Promise<boolean>;
  sendWelcomeEmail(to: string): Promise<boolean>;
}

/**
 * Create email service using Resend
 */
export function createEmailService(apiKey?: string): EmailService {
  return {
    async sendMagicLink(to: string, magicLink: string): Promise<boolean> {
      if (!apiKey) {
        console.warn('RESEND_API_KEY not configured - email not sent');
        return false;
      }

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Dripnex <noreply@dripnex.app>',
            to: [to],
            subject: 'Sign in to Dripnex',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 24px;">Sign in to Dripnex</h1>
                <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">
                  Click the button below to sign in to your Dripnex account. This link will expire in 15 minutes.
                </p>
                <a href="${magicLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                  Sign in to Dripnex
                </a>
                <p style="font-size: 14px; color: #6b7280; margin-top: 32px;">
                  If you didn't request this email, you can safely ignore it.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
                <p style="font-size: 12px; color: #9ca3af;">
                  Dripnex - Markdown notes, beautifully simple.
                </p>
              </div>
            `,
            text: `Sign in to Dripnex\n\nClick this link to sign in: ${magicLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this email, you can safely ignore it.`,
          }),
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
    },

    async sendWelcomeEmail(to: string): Promise<boolean> {
      if (!apiKey) {
        console.warn('RESEND_API_KEY not configured - welcome email not sent');
        return false;
      }

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Dripnex <hello@dripnex.app>',
            to: [to],
            subject: 'Welcome to Dripnex',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 24px;">Thanks for subscribing!</h1>
                <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">
                  We'll keep you updated on Dripnex news, features, and updates.
                </p>
                <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">
                  In the meantime, check out <a href="https://dripnex.app" style="color: #2563eb; text-decoration: none;">dripnex.app</a> to learn more about our markdown-first note-taking app.
                </p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
                <p style="font-size: 12px; color: #9ca3af;">
                  Dripnex - Markdown notes, beautifully simple.
                </p>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 16px;">
                  Don't want these emails? <a href="https://dripnex.app/newsletter/unsubscribe?email=${encodeURIComponent(to)}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
                </p>
              </div>
            `,
            text: `Thanks for subscribing!\\n\\nWe'll keep you updated on Dripnex news, features, and updates.\\n\\nIn the meantime, check out dripnex.app to learn more about our markdown-first note-taking app.\\n\\n---\\n\\nDon't want these emails? Unsubscribe at: https://dripnex.app/newsletter/unsubscribe?email=${encodeURIComponent(to)}`,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('Resend API error (welcome email):', {
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
    },
  };
}
