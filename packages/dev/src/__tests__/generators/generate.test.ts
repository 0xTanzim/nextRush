import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildFilePath,
  generate,
  resolveGeneratorType,
  resolveOutputDirectory,
  validateName,
} from '../../generators/generate.js';

// ─── resolveGeneratorType ────────────────────────────────────────────────

describe('resolveGeneratorType', () => {
  it('resolves full type names', () => {
    expect(resolveGeneratorType('controller')).toBe('controller');
    expect(resolveGeneratorType('service')).toBe('service');
    expect(resolveGeneratorType('middleware')).toBe('middleware');
    expect(resolveGeneratorType('guard')).toBe('guard');
    expect(resolveGeneratorType('route')).toBe('route');
    expect(resolveGeneratorType('module')).toBe('module');
  });

  it('resolves aliases', () => {
    expect(resolveGeneratorType('c')).toBe('controller');
    expect(resolveGeneratorType('s')).toBe('service');
    expect(resolveGeneratorType('m')).toBe('module');
    expect(resolveGeneratorType('mw')).toBe('middleware');
    expect(resolveGeneratorType('g')).toBe('guard');
    expect(resolveGeneratorType('r')).toBe('route');
  });

  it('is case-insensitive', () => {
    expect(resolveGeneratorType('Controller')).toBe('controller');
    expect(resolveGeneratorType('SERVICE')).toBe('service');
    expect(resolveGeneratorType('GUARD')).toBe('guard');
    expect(resolveGeneratorType('MODULE')).toBe('module');
  });

  it('returns undefined for unknown types', () => {
    expect(resolveGeneratorType('unknown')).toBeUndefined();
    expect(resolveGeneratorType('')).toBeUndefined();
    expect(resolveGeneratorType('model')).toBeUndefined();
  });
});

// ─── validateName ────────────────────────────────────────────────────────

describe('validateName', () => {
  it('accepts lowercase names', () => {
    expect(validateName('user')).toBeUndefined();
    expect(validateName('products')).toBeUndefined();
  });

  it('accepts names with numbers', () => {
    expect(validateName('v2')).toBeUndefined();
    expect(validateName('auth2')).toBeUndefined();
  });

  it('accepts kebab-case names', () => {
    expect(validateName('user-profile')).toBeUndefined();
    expect(validateName('order-item')).toBeUndefined();
  });

  it('rejects empty names', () => {
    expect(validateName('')).toBeDefined();
  });

  it('rejects names starting with numbers', () => {
    expect(validateName('2user')).toBeDefined();
  });

  it('rejects names starting with hyphens', () => {
    expect(validateName('-user')).toBeDefined();
  });

  it('rejects uppercase names', () => {
    expect(validateName('User')).toBeDefined();
    expect(validateName('UserProfile')).toBeDefined();
  });

  it('rejects names with spaces', () => {
    expect(validateName('user profile')).toBeDefined();
  });

  it('rejects names with underscores', () => {
    expect(validateName('user_profile')).toBeDefined();
  });

  it('rejects names with dots', () => {
    expect(validateName('user.profile')).toBeDefined();
  });
});

// ─── buildFilePath ───────────────────────────────────────────────────────

describe('buildFilePath', () => {
  it('builds controller file path', () => {
    const path = buildFilePath('/project', 'controller', 'user');
    expect(path).toBe('/project/src/controllers/user.controller.ts');
  });

  it('builds service file path', () => {
    const path = buildFilePath('/project', 'service', 'user');
    expect(path).toBe('/project/src/services/user.service.ts');
  });

  it('builds middleware file path', () => {
    const path = buildFilePath('/project', 'middleware', 'logger');
    expect(path).toBe('/project/src/middleware/logger.ts');
  });

  it('builds guard file path', () => {
    const path = buildFilePath('/project', 'guard', 'auth');
    expect(path).toBe('/project/src/guards/auth.guard.ts');
  });

  it('builds route file path', () => {
    const path = buildFilePath('/project', 'route', 'products');
    expect(path).toBe('/project/src/routes/products.ts');
  });

  it('builds module file path', () => {
    const path = buildFilePath('/project', 'module', 'todos');
    expect(path).toBe('/project/src/modules/todos.module.ts');
  });

  it('handles kebab-case names', () => {
    const path = buildFilePath('/project', 'controller', 'user-profile');
    expect(path).toBe('/project/src/controllers/user-profile.controller.ts');
  });
});

// ─── resolveOutputDirectory (module-aware placement) ────────────────────

describe('resolveOutputDirectory', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'nextrush-resolve-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('uses flat src/controllers when the project has no modules dir', async () => {
    const dir = await resolveOutputDirectory(tempDir, 'controller', 'user');
    expect(dir).toBe('src/controllers');
  });

  it('co-locates controllers into src/modules/<name> when src/modules exists', async () => {
    await mkdir(join(tempDir, 'src', 'modules'), { recursive: true });
    const dir = await resolveOutputDirectory(tempDir, 'controller', 'user');
    expect(dir).toBe('src/modules/user');
  });

  it('co-locates services into src/modules/<name> when src/modules exists', async () => {
    await mkdir(join(tempDir, 'src', 'modules'), { recursive: true });
    const dir = await resolveOutputDirectory(tempDir, 'service', 'user');
    expect(dir).toBe('src/modules/user');
  });

  it('keeps non-feature types on their flat directories even with modules present', async () => {
    await mkdir(join(tempDir, 'src', 'modules'), { recursive: true });
    expect(await resolveOutputDirectory(tempDir, 'route', 'products')).toBe('src/routes');
    expect(await resolveOutputDirectory(tempDir, 'middleware', 'logger')).toBe('src/middleware');
    expect(await resolveOutputDirectory(tempDir, 'guard', 'auth')).toBe('src/guards');
  });

  it('places a module in its own feature directory even without src/modules yet', async () => {
    const dir = await resolveOutputDirectory(tempDir, 'module', 'todos');
    expect(dir).toBe('src/modules/todos');
  });
});

// ─── generate() integration ─────────────────────────────────────────────

describe('generate (filesystem)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'nextrush-gen-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates a controller file', async () => {
    const filePath = await generate('controller', 'user', tempDir);
    expect(filePath).toContain('user.controller.ts');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('export class UserController');
    expect(content).toContain("@Controller('/user')");
  });

  it('creates a service file', async () => {
    const filePath = await generate('service', 'order', tempDir);
    expect(filePath).toContain('order.service.ts');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('export class OrderService');
    expect(content).toContain('@Service()');
  });

  it('creates a middleware file', async () => {
    const filePath = await generate('middleware', 'logger', tempDir);
    expect(filePath).toContain('logger.ts');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('export const logger: Middleware');
  });

  it('creates a guard file', async () => {
    const filePath = await generate('guard', 'auth', tempDir);
    expect(filePath).toContain('auth.guard.ts');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('export const authGuard: GuardFn');
  });

  it('creates a route file', async () => {
    const filePath = await generate('route', 'products', tempDir);
    expect(filePath).toContain('products.ts');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('createRouter');
    expect(content).toContain('export const productsRouter = createRouter()');
    expect(content).not.toContain('export default');
  });

  it('creates a module file', async () => {
    const filePath = await generate('module', 'todos', tempDir);
    expect(filePath).toContain('src/modules/todos/todos.module.ts');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('export class TodosModule');
    expect(content).toContain('@Module({');
  });

  it('co-locates a controller into its feature module when src/modules exists', async () => {
    await mkdir(join(tempDir, 'src', 'modules'), { recursive: true });
    const filePath = await generate('controller', 'user', tempDir);
    expect(filePath).toContain('src/modules/user/user.controller.ts');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('export class UserController');
    expect(content).toContain("import { UserService } from './user.service.js'");
  });

  it('co-locates a service into its feature module when src/modules exists', async () => {
    await mkdir(join(tempDir, 'src', 'modules'), { recursive: true });
    const filePath = await generate('service', 'user', tempDir);
    expect(filePath).toContain('src/modules/user/user.service.ts');
  });

  it('creates directories recursively', async () => {
    const filePath = await generate('controller', 'user', tempDir);
    expect(filePath).toContain('src/controllers/user.controller.ts');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('UserController');
  });

  it('throws if file already exists', async () => {
    await generate('controller', 'user', tempDir);
    await expect(generate('controller', 'user', tempDir)).rejects.toThrow('File already exists');
  });

  it('handles kebab-case names', async () => {
    const filePath = await generate('service', 'user-profile', tempDir);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain('export class UserProfileService');
  });
});
