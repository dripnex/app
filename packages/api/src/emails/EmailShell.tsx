import type { ReactNode } from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { emailTheme as t } from './theme.js';

export function EmailShell({
  preview,
  title,
  children,
}: {
  preview: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={wordmark}>Dripnex</Text>
          <Heading as="h1" style={heading}>
            {title}
          </Heading>
          <Section>{children}</Section>
          <Hr style={rule} />
          <Text style={footer}>Dripnex</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: t.bg,
  fontFamily: t.font,
  margin: 0,
  padding: '48px 16px',
};

const container = {
  backgroundColor: t.bg,
  margin: '0 auto',
  maxWidth: '520px',
  padding: '0 8px',
};

const wordmark = {
  color: t.secondary,
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '0.04em',
  margin: '0 0 32px',
};

const heading = {
  color: t.text,
  fontSize: '22px',
  fontWeight: 600,
  letterSpacing: '-0.02em',
  lineHeight: '28px',
  margin: '0 0 20px',
};

const rule = {
  borderColor: t.border,
  borderTop: `1px solid ${t.border}`,
  margin: '36px 0 16px',
};

const footer = {
  color: t.secondary,
  fontSize: '12px',
  lineHeight: '18px',
  margin: 0,
};
