#!/usr/bin/env node

/**
 * NextRush Plugin Architecture Validator (Dependency-Free)
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

class PluginValidator {
  private readonly pluginDir = path.join(process.cwd(), 'src/plugins');
  private readonly results: ValidationResult[] = [];

  async validateAll(): Promise<void> {
    console.log('🔍 Validating NextRush Plugin Architecture...\n');

    const pluginFiles = await this.findPluginFiles(this.pluginDir);

    for (const file of pluginFiles) {
      await this.validatePlugin(file);
    }

    this.printResults();
  }

  // Recursively find all *.plugin.ts files
  private async findPluginFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const pluginFiles: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const nestedFiles = await this.findPluginFiles(fullPath);
        pluginFiles.push(...nestedFiles);
      } else if (entry.isFile() && entry.name.endsWith('.plugin.ts')) {
        pluginFiles.push(fullPath);
      }
    }

    return pluginFiles;
  }

  private async validatePlugin(filePath: string): Promise<void> {
    const result: ValidationResult = {
      file: path.relative(process.cwd(), filePath),
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (!content.includes('extends BasePlugin')) {
        result.errors.push('Plugin must extend BasePlugin');
        result.valid = false;
      }

      const requiredMethods = ['install', 'start', 'stop'];
      for (const method of requiredMethods) {
        if (!content.includes(`${method}(`)) {
          result.errors.push(`Missing required method: ${method}`);
          result.valid = false;
        }
      }

      if (!content.includes('name =')) {
        result.errors.push('Plugin must have a name property');
        result.valid = false;
      }

      if (!content.includes('import') || !content.includes('BasePlugin')) {
        result.errors.push('Plugin must import BasePlugin');
        result.valid = false;
      }

      if (!content.includes('export class') || !content.includes('Plugin')) {
        result.errors.push('Plugin must export a class ending with "Plugin"');
        result.valid = false;
      }

      // Warnings
      if (!content.includes('/**')) {
        result.warnings.push('Plugin should have JSDoc documentation');
      }

      if (!content.includes('this.emit(')) {
        result.warnings.push(
          'Plugin should emit events for lifecycle management'
        );
      }
    } catch (err: any) {
      result.errors.push(`Failed to read file: ${err.message}`);
      result.valid = false;
    }

    this.results.push(result);
  }

  private printResults(): void {
    let totalValid = 0;
    let totalInvalid = 0;

    console.log('📊 Validation Results:\n');

    for (const result of this.results) {
      if (result.valid) {
        console.log(`✅ ${result.file}`);
        totalValid++;
      } else {
        console.log(`❌ ${result.file}`);
        for (const error of result.errors) {
          console.log(`   🔴 ${error}`);
        }
        totalInvalid++;
      }

      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          console.log(`   🟡 ${warning}`);
        }
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   Valid plugins: ${totalValid}`);
    console.log(`   Invalid plugins: ${totalInvalid}`);
    console.log(
      `   Total warnings: ${this.results.reduce(
        (sum, r) => sum + r.warnings.length,
        0
      )}`
    );

    if (totalInvalid > 0) {
      console.log(
        '\n❗ Some plugins failed validation. Please fix the errors above.'
      );
      process.exit(1);
    } else {
      console.log('\n🎉 All plugins passed validation!');
    }
  }
}

// Run the validator
new PluginValidator().validateAll().catch(console.error);
