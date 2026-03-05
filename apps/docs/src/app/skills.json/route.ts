import { skillsSource } from '@/lib/source';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export function GET() {
  const pages = skillsSource.getPages();

  const skills = pages.map((page) => ({
    name: page.data.skillName as string,
    title: page.data.title,
    description: page.data.description,
    url: `https://nextrush.dev${page.url}`,
    package: (page.data.package as string) ?? null,
    difficulty: (page.data.difficulty as string) ?? 'intermediate',
    tags: (page.data.tags as string[]) ?? [],
    skillMd: `https://github.com/0xTanzim/nextrush/tree/feat/v3-dev2/.github/skills/nextrush-${page.data.skillName as string}/SKILL.md`,
  }));

  return NextResponse.json({
    name: 'nextrush',
    version: '3.0.0-alpha.2',
    standard: 'agentskills.io',
    skills,
  });
}
