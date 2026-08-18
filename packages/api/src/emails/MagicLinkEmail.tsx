import { Button, Text } from '@react-email/components';
import { EmailShell } from './EmailShell.js';
import { emailTheme as t } from './theme.js';

export interface MagicLinkEmailProps {
  magicLink: string;
}

export function MagicLinkEmail({ magicLink }: MagicLinkEmailProps) {
  return (
    <EmailShell preview="Sign in to Dripnex" title="Sign in">
      <Text style={body}>Open Dripnex with the button below. The link expires in 15 minutes.</Text>
      <Button href={magicLink} style={button}>
        Sign in
      </Button>
      <Text style={hint}>Or paste this link into a browser:</Text>
      <Text style={url}>{magicLink}</Text>
      <Text style={hint}>If you didn't ask for this, ignore the email.</Text>
    </EmailShell>
  );
}

MagicLinkEmail.PreviewProps = {
  magicLink: 'https://dripnex-web.pages.dev/auth/verify?token=preview',
} satisfies MagicLinkEmailProps;

export default MagicLinkEmail;

const body = {
  color: t.text,
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 28px',
};

const button = {
  backgroundColor: t.text,
  borderRadius: '6px',
  color: t.bg,
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 500,
  lineHeight: '20px',
  padding: '12px 20px',
  textDecoration: 'none',
};

const hint = {
  color: t.secondary,
  fontSize: '13px',
  lineHeight: '20px',
  margin: '28px 0 0',
};

const url = {
  color: t.secondary,
  fontSize: '12px',
  lineHeight: '20px',
  margin: '8px 0 0',
  wordBreak: 'break-all' as const,
};
