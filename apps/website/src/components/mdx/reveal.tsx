'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Gentle viewport fade/slide-in for page sections. SSR / no-JS safe: content is
 * visible by default; only after mount, and only for non-reduced-motion users,
 * does it switch to a hidden-start and reveal on intersection. Reduced-motion
 * users and no-JS consumers get the content fully visible with zero animation.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.classList.add('reveal--ready');
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('reveal--in');
            io.disconnect();
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className ? `reveal ${className}` : 'reveal'}>
      {children}
    </div>
  );
}