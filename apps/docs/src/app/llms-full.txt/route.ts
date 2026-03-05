import { getLLMText, source } from '@/lib/source';

export const revalidate = false;

const HEADER = `# NextRush — Full Documentation

> Complete documentation for NextRush, a minimal, modular, high-performance Node.js backend framework.

---`;

export async function GET() {
  const scan = source.getPages().map(getLLMText);
  const scanned = await Promise.all(scan);

  const body = `${HEADER}\n\n${scanned.join('\n\n')}`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
