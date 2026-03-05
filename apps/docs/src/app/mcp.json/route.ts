import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = false;

const MCP_DISCOVERY = {
  name: 'nextrush-docs',
  version: '1.0.0',
  description: 'NextRush documentation discovery endpoint',
  endpoints: {
    docs: 'https://nextrush.dev/docs',
    llms_txt: 'https://nextrush.dev/llms.txt',
    llms_full: 'https://nextrush.dev/llms-full.txt',
    skills: 'https://nextrush.dev/skills.json',
    agent_spec: 'https://nextrush.dev/agent-spec.json',
  },
  tools: [
    {
      name: 'search_docs',
      description: 'Search NextRush documentation by keyword',
      status: 'planned',
    },
    {
      name: 'get_page',
      description: 'Get a documentation page as Markdown by slug',
      endpoint: 'https://nextrush.dev/api/mdx/{slug}',
      status: 'available',
    },
    {
      name: 'list_skills',
      description: 'List available agent skills for NextRush',
      endpoint: 'https://nextrush.dev/skills.json',
      status: 'available',
    },
  ],
};

export function GET() {
  return NextResponse.json(MCP_DISCOVERY, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
