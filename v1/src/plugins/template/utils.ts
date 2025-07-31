/**
 * 🔧 Template Engine Utilities
 * Helper classes and utility functions for the template system
 */

import { Writable } from 'stream';

/**
 * Mock writable stream for collecting rendered output
 */
export class MockWritableStream extends Writable {
  constructor(private chunks: string[]) {
    super();
  }

  override _write(chunk: any, encoding: string, callback: Function): void {
    this.chunks.push(chunk.toString());
    callback();
  }
}

/**
 * HTML escaping utility
 */
export function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get nested value from object using dot notation
 */
export function getValue(context: Record<string, any>, key: string): any {
  const parts = key.split('.');
  let value = context;

  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[part];
  }

  return value;
}

/**
 * Simple condition evaluation for templates
 */
export function evaluateCondition(
  condition: string,
  context: Record<string, any>
): boolean {
  const value = getValue(context, condition);
  return Boolean(value);
}

/**
 * Parse YAML-like frontmatter
 */
export function parseFrontmatter(content: string): {
  content: string;
  frontmatter: any;
} {
  if (!content.startsWith('---\n')) {
    return { content, frontmatter: {} };
  }

  const endIndex = content.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return { content, frontmatter: {} };
  }

  const frontmatterText = content.slice(4, endIndex);
  const mainContent = content.slice(endIndex + 5);

  // Enhanced YAML-like parsing with support for arrays and nested objects
  const frontmatter: any = {};
  const lines = frontmatterText.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const valueStr = line.slice(colonIndex + 1).trim();

    // Parse value
    let value: any = valueStr;

    // Try to parse as JSON for arrays and objects
    if (valueStr.startsWith('[') || valueStr.startsWith('{')) {
      try {
        value = JSON.parse(valueStr);
      } catch {
        // Keep as string if JSON parsing fails
      }
    } else if (valueStr === 'true' || valueStr === 'false') {
      value = valueStr === 'true';
    } else if (!isNaN(Number(valueStr)) && valueStr !== '') {
      value = Number(valueStr);
    } else if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
      value = valueStr.slice(1, -1);
    } else if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
      value = valueStr.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  return { content: mainContent, frontmatter };
}

/**
 * Create slot map from child nodes for component rendering
 */
export function createSlotMap(children: any[]): {
  [slotName: string]: any[];
} {
  const slots: { [slotName: string]: any[] } = {
    default: [],
  };

  for (const child of children) {
    if (child.type === 'component' && child.name === 'slot') {
      const slotName = child.props?.name || 'default';
      if (!slots[slotName]) {
        slots[slotName] = [];
      }
      slots[slotName].push(...(child.children || []));
    } else {
      slots.default.push(child);
    }
  }

  return slots;
}

/**
 * Resolve template path with proper extension handling
 */
export function resolveTemplatePath(
  templatePath: string,
  baseDir: string,
  defaultExtension: string = '.html'
): string {
  const path = require('path');
  let resolvedPath = path.resolve(baseDir, templatePath);

  // Add default extension if not present
  if (!path.extname(resolvedPath) && defaultExtension) {
    resolvedPath += defaultExtension;
  }

  return resolvedPath;
}
