import { Link, Text } from '@react-email/components';
import { EmailShell } from './EmailShell.js';
import { emailTheme as t } from './theme.js';

export interface WelcomeEmailProps {
  unsubscribeUrl: string;
}

export function WelcomeEmail({ unsubscribeUrl }: WelcomeEmailProps) {
  return (
    <EmailShell preview="Dripnex" title="Dripnex">
      <Text style={body}>We'll write when there is something worth sending.</Text>
      <Text style={body}>
        <Link href="https://dripnex.app" style={link}>
          dripnex.app
        </Link>
      </Text>
      <Text style={hint}>
        <Link href={unsubscribeUrl} style={mutedLink}>
          Unsubscribe
        </Link>
      </Text>
    </EmailShell>
  );
}

WelcomeEmail.PreviewProps = {
  unsubscribeUrl: 'https://dripnex.app/newsletter/unsubscribe?email=you@example.com',
} satisfies WelcomeEmailProps;

export default WelcomeEmail;

const body = {
  color: t.text,
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
};

const link = {
  color: t.text,
  textDecoration: 'underline',
};

const hint = {
  color: t.secondary,
  fontSize: '13px',
  lineHeight: '20px',
  margin: '24px 0 0',
};

const mutedLink = {
  color: t.secondary,
  textDecoration: 'underline',
};
