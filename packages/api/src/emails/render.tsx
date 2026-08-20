import { render } from '@react-email/render';
import { MagicLinkEmail } from './MagicLinkEmail.js';
import { WelcomeEmail } from './WelcomeEmail.js';

export interface RenderedEmail {
  html: string;
  text: string;
}

export async function renderMagicLinkEmail(magicLink: string): Promise<RenderedEmail> {
  const html = await render(<MagicLinkEmail magicLink={magicLink} />);
  const text = [
    'Sign in to Dripnex',
    '',
    `Open this link: ${magicLink}`,
    '',
    'This link expires in 15 minutes.',
    '',
    "If you didn't ask for this, ignore the email.",
  ].join('\n');
  return { html, text };
}

export async function renderWelcomeEmail(to: string): Promise<RenderedEmail> {
  const unsubscribeUrl = `https://dripnex.app/newsletter/unsubscribe?email=${encodeURIComponent(to)}`;
  const html = await render(<WelcomeEmail unsubscribeUrl={unsubscribeUrl} />);
  const text = [
    'Dripnex',
    '',
    "We'll write when there is something worth sending.",
    '',
    'https://dripnex.app',
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');
  return { html, text };
}
