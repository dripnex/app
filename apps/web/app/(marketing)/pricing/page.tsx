import Link from 'next/link';
import {
  Heart,
  Zap,
  ShieldCheck,
  Lock,
  RefreshCw,
  Sparkles,
  Check,
  ArrowRight,
} from 'lucide-react';
import { getProductConfig } from '@dripnex/product-config';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BorderBeam } from '@/components/magicui/border-beam';
import { NumberTicker } from '@/components/magicui/number-ticker';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

export default function PricingPage() {
  const config = getProductConfig();
  const { plans, guarantees, trialDays, trialDescription } = config;
  const proPricing = plans.pro.pricing!;

  // Extract numeric values from price labels for NumberTicker
  const monthlyPrice = proPricing.intervals.monthly.amountCents / 100;
  const annualPrice = proPricing.intervals.annual.amountCents / 100;

  const faqs = [
    { q: 'What if you stop developing Dripnex?', a: guarantees.freeTierForever.description },
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
          <p className="text-lg text-text-secondary max-w-[540px] mx-auto">
            Start with the free tier -- it does a lot. Upgrade to Pro when you want sync, graph
            view, and all the extras.
          </p>
        </header>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-10">
          {/* Free Tier */}
          <Card className="p-6 sm:p-8">
            <div className="pb-6 border-b border-border mb-4">
              <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-accent/10 text-accent mb-4">
                <Heart size={22} />
              </div>
              <div className="text-lg font-semibold text-text-primary mb-2">{plans.free.name}</div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl sm:text-4xl font-bold text-text-primary">
                  Free
                </span>
                <span className="text-base text-text-muted">forever</span>
              </div>
            </div>

            <p className="text-sm text-text-secondary mb-6">{plans.free.description}</p>

            <ul className="list-none mb-6 space-y-0">
              {plans.free.features.map((f, i) => (
                <li key={i} className="flex items-center gap-3 py-2 text-sm text-text-secondary">
                  <span className="flex items-center justify-center shrink-0 w-[22px] h-[22px] rounded-full bg-white/[0.05] text-text-muted">
                    <Check size={14} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button variant="ghost" size="lg" className="w-full" asChild>
              <Link href="/download">
                <Heart size={20} />
                Download Free
              </Link>
            </Button>
          </Card>

          {/* Pro Tier */}
          <Card className="relative overflow-hidden glass-card-glow p-6 sm:p-8">
            <BorderBeam
              size={200}
              duration={8}
              colorFrom="var(--color-accent)"
              colorTo="var(--color-accent-hover)"
            />
            <Badge className="absolute top-5 right-5">Most popular</Badge>

            <div className="pb-6 border-b border-border mb-4">
              <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-accent/10 text-accent mb-4">
                <Zap size={22} />
              </div>
              <div className="text-lg font-semibold text-text-primary mb-2">{plans.pro.name}</div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <div className="flex items-baseline gap-0.5">
                  <span className="font-mono text-3xl sm:text-4xl font-bold text-accent">$</span>
                  <NumberTicker
                    value={monthlyPrice}
                    decimalPlaces={2}
                    className="font-mono text-3xl sm:text-4xl font-bold text-accent"
                  />
                  <span className="font-mono text-3xl sm:text-4xl font-bold text-accent">/mo</span>
                </div>
                <span className="text-sm text-text-muted">or</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="font-mono text-3xl sm:text-4xl font-bold text-accent">$</span>
                  <NumberTicker
                    value={annualPrice}
                    decimalPlaces={0}
                    className="font-mono text-3xl sm:text-4xl font-bold text-accent"
                  />
                  <span className="font-mono text-3xl sm:text-4xl font-bold text-accent">
                    /year
                  </span>
                </div>
                <Badge variant="secondary" className="text-accent bg-accent/10">
                  Save {proPricing.annualSavings}
                </Badge>
              </div>
            </div>

            <p className="text-sm text-text-secondary mb-6">{plans.pro.description}</p>

            <ul className="list-none mb-6 space-y-0">
              {plans.pro.features.map((f, i) => (
                <li key={i} className="flex items-center gap-3 py-2 text-sm text-text-secondary">
                  <span className="flex items-center justify-center shrink-0 w-[22px] h-[22px] rounded-full bg-accent/10 text-accent">
                    <Check size={14} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 px-4 py-3 mb-6 rounded-lg bg-accent/[0.06] border border-accent/10 text-sm text-text-secondary">
              <Sparkles size={16} className="text-accent" />
              <span>{trialDescription}</span>
            </div>

            <Button size="lg" className="w-full" asChild>
              <Link href="/download">
                <Zap size={20} />
                Start {trialDays}-day free trial
              </Link>
            </Button>
          </Card>
        </div>

        {/* Trust signals */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-20 py-6">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <ShieldCheck size={18} className="text-accent" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Lock size={18} className="text-accent" />
            <span>Your data stays local</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-muted">
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

          <Accordion type="single" collapsible className="flex flex-col gap-3 mb-6">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger>{faq.q}</AccordionTrigger>
                <AccordionContent>{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

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
