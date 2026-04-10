import { appConfig, appEndpoints, toAbsoluteUrl } from '@/config/appConfig';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = false;

const MCP_DISCOVERY = {
  name: 'nextrush-docs',
  version: '1.0.0',
  description: 'NextRush documentation discovery endpoint',
  endpoints: {
    llm_txt: appEndpoints.llmTxt,
    docs: appEndpoints.docs,
    llms_txt: appEndpoints.llmsTxt,
    llms_full: appEndpoints.llmsFullTxt,
    skills: appEndpoints.skillsJson,
    agent_spec: appEndpoints.agentSpecJson,
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
      endpoint: toAbsoluteUrl(`${appConfig.paths.markdownApiPrefix}/{slug}.md`),
      status: 'available',
    },
    {
      name: 'list_skills',
      description: 'List available agent skills for NextRush',
      endpoint: appEndpoints.skillsJson,
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
