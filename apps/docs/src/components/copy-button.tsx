'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function CopyButton({ code, label = 'Copy code' }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md hover:bg-[var(--code-border)] transition-colors text-[var(--code-punctuation)] hover:text-[var(--code-variable)]"
      aria-label={label}
    >
      {copied ? (
        <Check className="size-4 text-[var(--success)]" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
