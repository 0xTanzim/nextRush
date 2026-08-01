'use client';

import { Check, MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '../lib/cn';

type Vote = 'yes' | 'no';
type Status = 'idle' | 'voted' | 'sent' | 'unavailable';

/**
 * "Was this helpful?" feedback widget (T21).
 *
 * Submits to `/api/feedback` (`apps/website/src/app/api/feedback/route.ts`), which is a real
 * `POST` handler that logs to the server console — but only in `next dev`. This site builds
 * as a static export (`output: 'export'`), which has no server at runtime, so that endpoint
 * does not exist in the deployed site. Rather than silently swallowing the failed request or
 * pretending it succeeded, this component surfaces that honestly (`unavailable` state) so a
 * reader is never told their feedback was recorded when it wasn't.
 */
export function FeedbackWidget() {
  const pathname = usePathname();
  const [vote, setVote] = useState<Vote | null>(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function submit(nextVote: Vote) {
    setVote(nextVote);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pathname, helpful: nextVote === 'yes' }),
      });

      setStatus(res.ok ? 'voted' : 'unavailable');
    } catch {
      setStatus('unavailable');
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!vote || !comment.trim()) return;

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pathname, helpful: vote === 'yes', comment }),
      });

      setStatus(res.ok ? 'sent' : 'unavailable');
    } catch {
      setStatus('unavailable');
    }
  }

  if (status === 'sent') {
    return (
      <FeedbackShell>
        <Check className="size-4 text-fd-primary" aria-hidden />
        <span>Thanks — your feedback was recorded.</span>
      </FeedbackShell>
    );
  }

  return (
    <FeedbackShell>
      <span className="text-sm font-medium text-fd-foreground">Was this helpful?</span>
      <div className="flex items-center gap-2">
        <VoteButton active={vote === 'yes'} label="Yes" onClick={() => submit('yes')}>
          <ThumbsUp className="size-4" aria-hidden />
        </VoteButton>
        <VoteButton active={vote === 'no'} label="No" onClick={() => submit('no')}>
          <ThumbsDown className="size-4" aria-hidden />
        </VoteButton>
      </div>

      {status === 'unavailable' && (
        <p className="text-xs text-fd-muted-foreground">
          Feedback submission isn&apos;t available on this deployment (static export has no
          server at runtime) — your vote wasn&apos;t recorded, but thanks for trying.
        </p>
      )}

      {vote && status === 'voted' && (
        <form onSubmit={submitComment} className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
            <MessageSquare className="size-3.5" aria-hidden />
            Add an optional comment
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-fd-border bg-fd-background p-2 text-sm outline-none focus:ring-2 focus:ring-fd-primary"
            placeholder="What was missing or unclear?"
          />
          <button
            type="submit"
            disabled={!comment.trim()}
            className="self-start rounded-md bg-fd-primary px-3 py-1.5 text-xs font-medium text-fd-primary-foreground disabled:opacity-50"
          >
            Send comment
          </button>
        </form>
      )}
    </FeedbackShell>
  );
}

function FeedbackShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 flex flex-col gap-3 rounded-xl border border-fd-border bg-fd-card/60 p-4">
      {children}
    </div>
  );
}

function VoteButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-fd-border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-fd-primary text-fd-primary-foreground'
          : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground'
      )}
    >
      {children}
      {label}
    </button>
  );
}
