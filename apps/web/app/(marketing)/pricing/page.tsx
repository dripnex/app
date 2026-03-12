import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Heart,
  Zap,
  ShieldCheck,
  Lock,
  RefreshCw,
  Sparkles,
  Check,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { getProductConfig } from '@readied/product-config';

export const metadata: Metadata = {
  title: 'Pricing — Readied',
  description: 'Free forever. Pro when you need it.',
};

export default function PricingPage() {
  const config = getProductConfig();
  const { plans, guarantees, trialDays, trialDescription } = config;
  const proPricing = plans.pro.pricing!;

  const faqs = [
    { q: 'What if you stop developing Readied?', a: guarantees.freeTierForever.description },
    { q: 'Can I cancel my Pro subscription?', a: guarantees.cancelAnytime.description },
    { q: 'Can I export my data?', a: guarantees.noLockIn.description },
    { q: 'What about refunds?', a: guarantees.refund.description },
  ];

  return (
    <section className="relative pt-32 sm:pt-40 pb-24 px-4 sm:px-6">
      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Page header */}
        <header className="text-center mb-16">
          <span className="section-label">Pricing</span>
          <h1 className="section-heading text-4xl lg:text-5xl">
            Free forever.
            <br />
            <span className="text-accent">Pro when you need it.</span>
          </h1>
          <p className="text-lg text-[#a1a1aa] max-w-[540px] mx-auto">
            Start with the free tier -- it does a lot. Upgrade to Pro when you want sync, graph
            view, and all the extras.
          </p>
        </header>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-10">
          {/* Free Tier */}
          <div className="glass-card p-6 sm:p-8">
            <div className="pb-6 border-b border-white/[0.06] mb-4">
              <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-accent/10 text-accent mb-4">
                <Heart size={22} />
              </div>
              <div className="text-lg font-semibold text-[#f4f4f5] mb-2">{plans.free.name}</div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl sm:text-4xl font-bold text-[#f4f4f5]">
                  Free
                </span>
                <span className="text-base text-[#71717a]">forever</span>
              </div>
            </div>

            <p className="text-sm text-[#a1a1aa] mb-6">{plans.free.description}</p>

            <ul className="list-none mb-6 space-y-0">
              {plans.free.features.map((f, i) => (
                <li key={i} className="flex items-center gap-3 py-2 text-sm text-[#a1a1aa]">
                  <span className="flex items-center justify-center shrink-0 w-[22px] h-[22px] rounded-full bg-white/[0.05] text-[#71717a]">
                    <Check size={14} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/download"
              className="flex items-center justify-center gap-3 w-full px-6 py-3 rounded-lg border border-white/[0.08] text-[#a1a1aa] font-medium text-sm transition-colors hover:bg-white/5 hover:text-white"
            >
              <Heart size={20} />
              Download Free
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="relative glass-card-glow p-6 sm:p-8 overflow-hidden">
            <span className="absolute top-5 right-5 font-mono text-xs font-bold uppercase tracking-wider text-white bg-accent px-3 py-1 rounded-full">
              Most popular
            </span>

            <div className="pb-6 border-b border-white/[0.06] mb-4">
              <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-accent/10 text-accent mb-4">
                <Zap size={22} />
              </div>
              <div className="text-lg font-semibold text-[#f4f4f5] mb-2">{plans.pro.name}</div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-3xl sm:text-4xl font-bold text-accent">
                    {proPricing.intervals.monthly.label}
                  </span>
                </div>
                <span className="text-sm text-[#71717a]">or</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-3xl sm:text-4xl font-bold text-accent">
                    {proPricing.intervals.annual.label}
                  </span>
                  <span className="font-mono text-xs font-semibold text-accent bg-accent/10 px-3 py-1 rounded-full">
                    Save {proPricing.annualSavings}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-[#a1a1aa] mb-6">{plans.pro.description}</p>

            <ul className="list-none mb-6 space-y-0">
              {plans.pro.features.map((f, i) => (
                <li key={i} className="flex items-center gap-3 py-2 text-sm text-[#a1a1aa]">
                  <span className="flex items-center justify-center shrink-0 w-[22px] h-[22px] rounded-full bg-accent/10 text-accent">
                    <Check size={14} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 px-4 py-3 mb-6 rounded-lg bg-accent/[0.06] border border-accent/10 text-sm text-[#a1a1aa]">
              <Sparkles size={16} className="text-accent" />
              <span>{trialDescription}</span>
            </div>

            <Link
              href="/download"
              className="flex items-center justify-center gap-3 w-full px-6 py-3 rounded-lg bg-accent text-white font-medium text-sm transition-colors hover:bg-accent-hover"
            >
              <Zap size={20} />
              Start {trialDays}-day free trial
            </Link>
          </div>
        </div>

        {/* Trust signals */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-20 py-6">
          <div className="flex items-center gap-2 text-sm text-[#71717a]">
            <ShieldCheck size={18} className="text-accent" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#71717a]">
            <Lock size={18} className="text-accent" />
            <span>Your data stays local</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#71717a]">
            <RefreshCw size={18} className="text-accent" />
            <span>Cancel anytime</span>
          </div>
        </div>

        {/* FAQ section */}
        <section className="max-w-[640px] mx-auto">
          <div className="text-center mb-8">
            <span className="section-label">FAQ</span>
            <h2 className="section-heading">Questions? We&apos;ve got answers.</h2>
          </div>
          <div className="flex flex-col gap-3 mb-6">
            {faqs.map((faq, i) => (
              <details key={i} className="glass-card overflow-hidden group">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-[#f4f4f5] cursor-pointer list-none [&::-webkit-details-marker]:hidden transition-colors hover:text-accent">
                  <span className="flex-1">{faq.q}</span>
                  <ChevronDown
                    size={20}
                    className="shrink-0 text-[#71717a] transition-transform duration-200 group-open:rotate-180 group-open:text-accent"
                  />
                </summary>
                <p className="px-5 py-4 text-sm text-[#a1a1aa] leading-relaxed border-t border-white/[0.06] m-0">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
          <Link
            href="/faq"
            className="group flex justify-center items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            View all FAQs
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>
      </div>
    </section>
  );
}
