import { NextRequest, NextResponse } from 'next/server';
import type { DealCalculation } from '@/lib/types';

/**
 * Send deal notifications to Slack or Discord webhooks.
 * Slack: Block Kit format
 * Discord: Embed format with action buttons
 */

interface NotifyRequest {
  webhook_url: string;
  webhook_type?: 'slack' | 'discord';
  deal: DealCalculation & {
    source_url: string;
    image_url?: string;
  };
}

const TIER_EMOJI: Record<string, string> = {
  low: '🟡',
  medium: '🟢',
  high: '💚',
  excellent: '🔥',
};

const PLATFORM_LABELS: Record<string, string> = {
  ebay: 'eBay',
  whatnot: 'Whatnot',
  etsy: 'Etsy',
  amazon: 'Amazon',
};

function formatSlackMessage(deal: NotifyRequest['deal']) {
  const emoji = TIER_EMOJI[deal.profit_tier] || '📦';
  const platformLabel = PLATFORM_LABELS[deal.best_platform] || 'eBay';

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Deal: $${deal.net_profit_usd} profit (${deal.profit_margin_pct}% margin)`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${deal.title_en}*\n_JP: ${deal.title_ja}_`,
        },
        ...(deal.image_url
          ? { accessory: { type: 'image', image_url: deal.image_url, alt_text: deal.title_en } }
          : {}),
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `💴 *Buy in Japan*\n¥${deal.buy_price_jpy.toLocaleString()}` },
          { type: 'mrkdwn', text: `📦 *Est. Forwarding*\n¥${deal.shipping_estimate_jpy.toLocaleString()}` },
          { type: 'mrkdwn', text: `💰 *Sell on ${platformLabel}*\n~$${deal.ebay_sell_price_usd}` },
          { type: 'mrkdwn', text: `✅ *Net Profit*\n*$${deal.net_profit_usd}*` },
          { type: 'mrkdwn', text: `📈 *ROI*\n${deal.roi_pct}%` },
          { type: 'mrkdwn', text: `💱 *Rate*\n¥1 = $${deal.exchange_rate.toFixed(4)}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '🛒 View Product', emoji: true },
            url: deal.source_url,
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: `🔍 Check ${platformLabel}`, emoji: true },
            url: deal.ebay_listings_url,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `jpradar • Best platform: *${platformLabel}* • ${new Date(deal.calculated_at).toUTCString()}`,
          },
        ],
      },
    ],
  };
}

function formatDiscordMessage(deal: NotifyRequest['deal']) {
  const emoji = TIER_EMOJI[deal.profit_tier] || '📦';
  const platformLabel = PLATFORM_LABELS[deal.best_platform] || 'eBay';
  const colorMap: Record<string, number> = {
    low: 0xFFD700,
    medium: 0x00C851,
    high: 0x007E33,
    excellent: 0xFF4444,
  };

  return {
    embeds: [
      {
        title: `${emoji} ${deal.title_en}`,
        description: `*Japanese listing:* ${deal.title_ja}`,
        color: colorMap[deal.profit_tier] || 0x0099FF,
        fields: [
          { name: '💴 Buy Price (Japan)', value: `¥${deal.buy_price_jpy.toLocaleString()}`, inline: true },
          { name: '📦 Forwarding (tenso)', value: `¥${deal.shipping_estimate_jpy.toLocaleString()}`, inline: true },
          { name: '💰 Sell Price', value: `~$${deal.ebay_sell_price_usd} on ${platformLabel}`, inline: true },
          { name: '✅ Net Profit', value: `**$${deal.net_profit_usd}**`, inline: true },
          { name: '📈 Margin', value: `${deal.profit_margin_pct}%`, inline: true },
          { name: '📊 ROI', value: `${deal.roi_pct}%`, inline: true },
        ],
        ...(deal.image_url ? { thumbnail: { url: deal.image_url } } : {}),
        footer: { text: `jpradar • Best platform: ${platformLabel}` },
        timestamp: deal.calculated_at,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: '🛒 View Product', url: deal.source_url },
          { type: 2, style: 5, label: `🔍 Check ${platformLabel}`, url: deal.ebay_listings_url },
        ],
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  let body: NotifyRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { webhook_url, webhook_type = 'slack', deal } = body;

  if (!webhook_url || !deal) {
    return NextResponse.json({ error: 'Missing webhook_url or deal' }, { status: 400 });
  }

  const payload =
    webhook_type === 'discord'
      ? formatDiscordMessage(deal)
      : formatSlackMessage(deal);

  try {
    const res = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Webhook responded ${res.status}: ${text}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
