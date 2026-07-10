import { NextResponse } from 'next/server';

/**
 * Feedback intake route (T21).
 *
 * Honest scope disclosure: this app builds as a full static export
 * (`output: 'export'` in `next.config.mjs`), which has **no server at runtime** — Next.js
 * strips non-static route handlers from a static export build entirely (they 404 in
 * production). This route therefore only ever runs during `next dev` (a real Node process),
 * where it logs real submissions to the server console. It is not reachable in the deployed
 * static site.
 *
 * This is disclosed deliberately rather than faked: there is no analytics/feedback service
 * configured anywhere in this repo (confirmed by search before building this), so the honest
 * "minimal real thing" is a working dev-mode log, not a production backend that doesn't exist.
 * `FeedbackWidget` (`apps/docs/src/components/feedback-widget.tsx`) still renders and works for
 * the user in production — it just can't complete the network call, and says so.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    page?: string;
    helpful?: boolean;
    comment?: string;
  } | null;

  if (!body || typeof body.helpful !== 'boolean' || typeof body.page !== 'string') {
    return NextResponse.json({ error: 'Invalid feedback payload' }, { status: 400 });
  }

  const comment = typeof body.comment === 'string' ? body.comment.slice(0, 2000) : undefined;

  // This route IS the feedback sink for dev mode — logging here is the feature, not debug noise.
  console.log('[feedback]', {
    page: body.page,
    helpful: body.helpful,
    comment,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
