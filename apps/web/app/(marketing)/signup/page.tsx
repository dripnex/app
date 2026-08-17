import type { Metadata } from 'next';
import AuthCard from '../login/AuthCard';

export const metadata: Metadata = {
  title: 'Sign up',
  description: 'Create a free Dripnex account. We’ll email you a one-time link.',
};

export default function SignupPage() {
  return (
    <section className="flex min-h-[80vh] items-center justify-center px-5 pt-28 pb-20">
      <AuthCard mode="signup" />
    </section>
  );
}