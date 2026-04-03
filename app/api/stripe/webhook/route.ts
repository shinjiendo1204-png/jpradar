import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

/**
 * Stripe webhook handler.
 * Updates user plan in Supabase when subscription changes.
 *
 * Set webhook in Stripe Dashboard:
 * Endpoint: https://www.jprader.net/api/stripe/webhook
 * Events: customer.subscription.created, updated, deleted
 */

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-01-27.acacia',
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  const stripe = getStripe();
  const PRICE_TO_PLAN: Record<string, string> = {
    [process.env.STRIPE_PRICE_HUNTER!]: 'hunter',
    [process.env.STRIPE_PRICE_PRO!]: 'pro',
  };

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.supabase_user_id;
    if (!userId) return NextResponse.json({ received: true });

    const priceId = sub.items.data[0]?.price.id;
    const plan = PRICE_TO_PLAN[priceId] || 'free';
    const status = sub.status; // active, past_due, canceled, etc.

    await supabase.from('profiles').upsert({
      id: userId,
      plan,
      subscription_status: status,
      stripe_subscription_id: sub.id,
      plan_updated_at: new Date().toISOString(),
    });
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.supabase_user_id;
    if (!userId) return NextResponse.json({ received: true });

    await supabase.from('profiles').upsert({
      id: userId,
      plan: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      plan_updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ received: true });
}
