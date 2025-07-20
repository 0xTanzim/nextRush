/**
 * 🧪 Template Testing Utilities
 * Testing tools for template engine development and validation
 */

import { UltimateTemplateParser } from './parser';
import { UltimateTemplateRenderer } from './renderer';
import { TemplateContext, TemplateOptions, TestRenderResult } from './types';

/**
 * Test template rendering with error handling
 */
export async function testTemplateRender(
  templateContent: string,
  data: TemplateContext,
  options: TemplateOptions = {}
): Promise<TestRenderResult> {
  const errors: string[] = [];

  try {
    const parser = new UltimateTemplateParser(templateContent, options);
    const parseResult = parser.parse();

    const renderer = new UltimateTemplateRenderer(options);
    const html = await renderer.render(parseResult.nodes, data);

    return {
      html,
      errors,
      metadata: parseResult.metadata,
    };
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : 'Unknown rendering error'
    );
    return {
      html: '',
      errors,
    };
  }
}

/**
 * Validate template syntax without rendering
 */
export function validateTemplateSyntax(
  templateContent: string,
  options: TemplateOptions = {}
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const parser = new UltimateTemplateParser(templateContent, options);
    parser.parse();
    return { valid: true, errors: [] };
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : 'Unknown parsing error'
    );
    return { valid: false, errors };
  }
}

/**
 * Benchmark template rendering performance
 */
export async function benchmarkTemplate(
  templateContent: string,
  data: TemplateContext,
  iterations: number = 1000,
  options: TemplateOptions = {}
): Promise<{
  totalTime: number;
  averageTime: number;
  iterationsPerSecond: number;
}> {
  const parser = new UltimateTemplateParser(templateContent, options);
  const parseResult = parser.parse();
  const renderer = new UltimateTemplateRenderer(options);

  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    await renderer.render(parseResult.nodes, data);
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const averageTime = totalTime / iterations;
  const iterationsPerSecond = 1000 / averageTime;

  return {
    totalTime,
    averageTime,
    iterationsPerSecond,
  };
}

/**
 * Compare template engines performance
 */
export async function compareTemplateEngines(
  templateContent: string,
  data: TemplateContext,
  engines: Array<{ name: string; options: TemplateOptions }>,
  iterations: number = 100
): Promise<
  Array<{
    name: string;
    totalTime: number;
    averageTime: number;
    iterationsPerSecond: number;
  }>
> {
  const results = [];

  for (const engine of engines) {
    const result = await benchmarkTemplate(
      templateContent,
      data,
      iterations,
      engine.options
    );
    results.push({
      name: engine.name,
      ...result,
    });
  }

  return results.sort((a, b) => a.averageTime - b.averageTime);
}
