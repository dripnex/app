import type { Metadata } from 'next';
import AuthCard from './AuthCard';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Dripnex. We’ll email you a one-time link.',
};

export default function LoginPage() {
  return (
    <section className="flex min-h-[80vh] items-center justify-center px-5 pt-28 pb-20">
      <AuthCard mode="signin" />
    </section>
  );
}
