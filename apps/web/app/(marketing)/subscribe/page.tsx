import type { Metadata } from 'next';
import { getProductConfig } from '@readied/product-config';
import SubscribeFlow from '@/components/SubscribeFlow';

export const metadata: Metadata = {
  title: 'Get Readied Pro',
  description:
    'Start your free trial of Readied Pro with cloud sync, backlinks, and advanced features.',
};

export default function SubscribePage() {
  const config = getProductConfig();

  return (
    <section className="pt-32 sm:pt-40 pb-24 px-4 sm:px-6 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <SubscribeFlow
          trialDays={config.trialDays}
          plans={JSON.parse(JSON.stringify(config.plans))}
          guarantees={JSON.parse(JSON.stringify(config.guarantees))}
        />
      </div>
    </section>
  );
}
