import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Dripnex. Free account, pay later.',
};

export default function LoginPage() {
  return (
    <section className="flex min-h-[80vh] items-center justify-center px-5 pt-28 pb-20">
      <LoginForm />
    </section>
  );
}
