import { GET as getLLMsTxt } from '../llms.txt/route';

export const dynamic = 'force-static';
export const revalidate = false;

export function GET() {
  return getLLMsTxt();
}
