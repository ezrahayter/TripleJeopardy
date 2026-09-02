// Transactional email via Resend. No-ops (and never throws) when RESEND_API_KEY
// isn't set, so the calling flow is unaffected when notifications are off.

const APP_URL = Deno.env.get('PUBLIC_APP_URL') ?? 'https://triple-jeopardy.pages.dev';

export function appUrl(path = ''): string {
  return `${APP_URL}${path}`;
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  /** where a reply goes — e.g. the candidate's reply lands in Ava's inbox */
  replyTo?: string | string[] | null;
}): Promise<void> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return;
  const from = Deno.env.get('EMAIL_FROM') ?? 'Triple Jeopardy <onboarding@resend.dev>';
  const to = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(Boolean);
  if (to.length === 0) return;
  const replyTo = opts.replyTo
    ? (Array.isArray(opts.replyTo) ? opts.replyTo : [opts.replyTo]).filter(Boolean)
    : undefined;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: opts.subject,
        html: opts.html,
        ...(replyTo && replyTo.length ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) console.error('resend send failed', res.status, await res.text());
  } catch (e) {
    console.error('resend send error', e);
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** A plain, readable transactional shell — no images, no tracking. */
export function emailShell(body: string, cta?: { label: string; href: string }): string {
  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.href}" style="background:#26261f;color:#f2ede1;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>`
    : '';
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#26261f;line-height:1.6;max-width:520px">
  <p style="font-weight:900;letter-spacing:-.01em;margin:0 0 2px">Triple Jeopardy</p>
  <p style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b6a5e;margin:0 0 20px">Positive Force</p>
  ${body}
  ${button}
</div>`;
}
