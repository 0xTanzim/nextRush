import { appConfig, toAbsoluteUrl } from '@/config/appConfig';
import { skillsSource } from '@/lib/source';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export function GET() {
  const pages = skillsSource.getPages();

  const skills = pages.map((page) => ({
    name: page.data.skillName as string,
    title: page.data.title,
    description: page.data.description,
    url: toAbsoluteUrl(page.url),
    package: (page.data.package as string) ?? null,
    difficulty: (page.data.difficulty as string) ?? 'intermediate',
    tags: (page.data.tags as string[]) ?? [],
    skillMd: `${appConfig.skillsRepoBaseUrl}/nextrush-${page.data.skillName as string}/SKILL.md`,
  }));

  return NextResponse.json({
    name: appConfig.id,
    version: appConfig.version,
    standard: 'agentskills.io',
    skills,
  });
}
