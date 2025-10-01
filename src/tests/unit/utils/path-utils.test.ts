/**
 * Tests for Path Utils
 *
 * @packageDocumentation
 */

import {
  ensureDirectory,
  getAbsolutePath,
  getCommonPrefix,
  getDirName,
  getFileExtension,
  getFileModifiedTime,
  getFileName,
  getFileSize,
  getRelativePath,
  isAbsolutePath,
  isDirectory,
  isFile,
  joinPaths,
  normalizePath,
  pathExists,
  resolvePath,
} from '@/utils/path-utils';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Path Utils', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), 'nextrush-path-utils-test');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('resolvePath', () => {
    it('should resolve relative path to absolute', () => {
      const result = resolvePath('src/test');

      expect(result).toMatch(/src[/\\]test$/);
      expect(result).toMatch(/^[A-Z]:[/\\]|^[/\\]/); // Should start with drive letter or /
    });

    it('should handle already absolute paths', () => {
      const absolutePath =
        process.platform === 'win32' ? 'C:\\test\\path' : '/test/path';
      const result = resolvePath(absolutePath);

      expect(result).toBe(absolutePath);
    });

    it('should handle current directory', () => {
      const result = resolvePath('.');

      expect(result).toBe(process.cwd());
    });

    it('should handle parent directory', () => {
      const result = resolvePath('..');

      expect(result).toContain(
        process.cwd().split(/[/\\]/).slice(0, -1).join('/')
      );
    });
  });

  describe('joinPaths', () => {
    it('should join multiple path segments', () => {
      const result = joinPaths('users', 'documents', 'files');

      expect(result).toBe(join('users', 'documents', 'files'));
    });

    it('should handle single path', () => {
      const result = joinPaths('single');

      expect(result).toBe('single');
    });

    it('should handle empty paths', () => {
      const result = joinPaths('', 'test', '');

      expect(result).toBe('test');
    });

    it('should handle mixed separators', () => {
      const result = joinPaths('users\\documents', 'files/test');

      expect(result).toContain('users');
      expect(result).toContain('documents');
      expect(result).toContain('files');
      expect(result).toContain('test');
    });
  });

  describe('normalizePath', () => {
    it('should normalize path separators', () => {
      const result = normalizePath('users\\documents/files');

      // Should use consistent separators
      expect(result).toBeDefined();
      expect(result).toContain('users');
      expect(result).toContain('documents');
      expect(result).toContain('files');
    });

    it('should handle double separators', () => {
      const result = normalizePath('users//documents///files');

      expect(result).toContain('users');
      expect(result).toContain('documents');
      expect(result).toContain('files');
    });

    it('should handle relative path components', () => {
      const result = normalizePath('users/../documents/./files');

      expect(result).toContain('documents');
      expect(result).toContain('files');
    });
  });

  describe('getFileExtension', () => {
    it('should return file extension with dot', () => {
      expect(getFileExtension('file.txt')).toBe('.txt');
      expect(getFileExtension('image.png')).toBe('.png');
      expect(getFileExtension('archive.tar.gz')).toBe('.gz');
    });

    it('should handle files without extension', () => {
      expect(getFileExtension('README')).toBe('');
      expect(getFileExtension('Makefile')).toBe('');
    });

    it('should handle hidden files', () => {
      expect(getFileExtension('.gitignore')).toBe('');
      expect(getFileExtension('.env.local')).toBe('.local');
    });

    it('should handle paths with directories', () => {
      expect(getFileExtension('src/utils/file.ts')).toBe('.ts');
      expect(getFileExtension('/home/user/document.pdf')).toBe('.pdf');
    });
  });

  describe('getFileName', () => {
    it('should return filename without extension', () => {
      expect(getFileName('path/to/file.txt')).toBe('file');
      expect(getFileName('file.txt')).toBe('file');
      expect(getFileName('image.png')).toBe('image');
    });

    it('should handle files without extension', () => {
      expect(getFileName('README')).toBe('README');
      expect(getFileName('Makefile')).toBe('Makefile');
    });

    it('should handle hidden files', () => {
      expect(getFileName('.gitignore')).toBe('.gitignore');
      expect(getFileName('.env.local')).toBe('.env');
    });

    it('should handle directories', () => {
      expect(getFileName('path/to/directory/')).toBe('directory');
      expect(getFileName('directory')).toBe('directory');
    });
  });

  describe('getDirName', () => {
    it('should return directory path', () => {
      expect(getDirName('path/to/file.txt')).toBe('path/to');
      expect(getDirName('/home/user/document.pdf')).toBe('/home/user');
    });

    it('should handle files in root directory', () => {
      expect(getDirName('file.txt')).toBe('.');
      expect(getDirName('/file.txt')).toBe('/');
    });

    it('should handle directories', () => {
      expect(getDirName('path/to/directory/')).toBe('path/to');
    });
  });

  describe('pathExists', () => {
    it('should return true for existing paths', () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'test content');

      expect(pathExists(testFile)).toBe(true);
      expect(pathExists(testDir)).toBe(true);
    });

    it('should return false for non-existing paths', () => {
      const nonExistentPath = join(testDir, 'does-not-exist.txt');

      expect(pathExists(nonExistentPath)).toBe(false);
    });
  });

  describe('isFile', () => {
    it('should return true for files', () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'test content');

      expect(isFile(testFile)).toBe(true);
    });

    it('should return false for directories', () => {
      expect(isFile(testDir)).toBe(false);
    });

    it('should return false for non-existent paths', () => {
      const nonExistentPath = join(testDir, 'does-not-exist.txt');

      expect(isFile(nonExistentPath)).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('should return true for directories', () => {
      expect(isDirectory(testDir)).toBe(true);
    });

    it('should return false for files', () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'test content');

      expect(isDirectory(testFile)).toBe(false);
    });

    it('should return false for non-existent paths', () => {
      const nonExistentPath = join(testDir, 'does-not-exist');

      expect(isDirectory(nonExistentPath)).toBe(false);
    });
  });

  describe('getFileSize', () => {
    it('should return file size in bytes', () => {
      const testFile = join(testDir, 'test.txt');
      const content = 'test content';
      writeFileSync(testFile, content);

      const size = getFileSize(testFile);

      expect(size).toBe(content.length);
    });

    it('should throw for non-existent files', () => {
      const nonExistentPath = join(testDir, 'does-not-exist.txt');

      expect(() => getFileSize(nonExistentPath)).toThrow('Path is not a file');
    });

    it('should throw for directories', () => {
      expect(() => getFileSize(testDir)).toThrow('Path is not a file');
    });
  });

  describe('getFileModifiedTime', () => {
    it('should return file modification time', () => {
      const testFile = join(testDir, 'test.txt');
      const beforeWrite = Date.now();
      writeFileSync(testFile, 'test content');
      const afterWrite = Date.now();

      const modTime = getFileModifiedTime(testFile);

      expect(modTime).toBeInstanceOf(Date);
      // File modification time should be between write start and write end + small buffer
      expect(modTime.getTime()).toBeGreaterThanOrEqual(beforeWrite - 1000); // 1s before write
      expect(modTime.getTime()).toBeLessThanOrEqual(afterWrite + 1000); // 1s after write
    });

    it('should throw for non-existent files', () => {
      const nonExistentPath = join(testDir, 'does-not-exist.txt');

      expect(() => getFileModifiedTime(nonExistentPath)).toThrow(
        'Path is not a file'
      );
    });

    it('should throw for directories', () => {
      expect(() => getFileModifiedTime(testDir)).toThrow('Path is not a file');
    });
  });

  describe('getRelativePath', () => {
    it('should return relative path when target is in subdirectory', () => {
      const base = '/home/user';
      const path = '/home/user/documents/file.txt';

      const result = getRelativePath(base, path);

      expect(result).toBe('documents/file.txt');
    });

    it('should return original path when not in subdirectory', () => {
      const base = '/home/user/documents';
      const path = '/home/other/file.txt';

      const result = getRelativePath(base, path);

      expect(result).toBe(path);
    });

    it('should handle same directory', () => {
      const base = '/home/user/documents';
      const path = '/home/user/documents';

      const result = getRelativePath(base, path);

      expect(result).toBe('');
    });
  });

  describe('isAbsolutePath', () => {
    it('should detect absolute paths on Unix', () => {
      expect(isAbsolutePath('/home/user')).toBe(true);
      expect(isAbsolutePath('/usr/local/bin')).toBe(true);
    });

    it('should detect relative paths', () => {
      expect(isAbsolutePath('src/utils')).toBe(false);
      expect(isAbsolutePath('./file.txt')).toBe(false);
      expect(isAbsolutePath('../documents')).toBe(false);
    });

    if (process.platform === 'win32') {
      it('should detect absolute paths on Windows', () => {
        expect(isAbsolutePath('C:\\Users\\user')).toBe(true);
        expect(isAbsolutePath('D:\\Projects')).toBe(true);
      });
    }
  });

  describe('getAbsolutePath', () => {
    it('should return absolute path for relative paths', () => {
      const result = getAbsolutePath('src/utils');

      expect(isAbsolutePath(result)).toBe(true);
      expect(result).toContain('src');
      expect(result).toContain('utils');
    });

    it('should return same path for already absolute paths', () => {
      const absolutePath =
        process.platform === 'win32' ? 'C:\\test\\path' : '/test/path';
      const result = getAbsolutePath(absolutePath);

      expect(result).toBe(absolutePath);
    });
  });

  describe('getCommonPrefix', () => {
    it('should return common prefix for multiple paths', () => {
      const paths = [
        '/home/user/documents/file1.txt',
        '/home/user/documents/file2.txt',
        '/home/user/documents/subfolder/file3.txt',
      ];

      const result = getCommonPrefix(paths);

      expect(result).toContain('/home/user/documents');
    });

    it('should return empty string for empty array', () => {
      const result = getCommonPrefix([]);

      expect(result).toBe('');
    });

    it('should return parent directory for single path', () => {
      const result = getCommonPrefix(['/home/user/file.txt']);

      expect(result).toBe('/home/user');
    });

    it('should handle paths with no common prefix', () => {
      const paths = ['/home/user/file1.txt', '/var/log/file2.txt'];

      const result = getCommonPrefix(paths);

      expect(result).toBe('/'); // Only root is common
    });
  });

  describe('ensureDirectory', () => {
    it('should not throw for existing directory', () => {
      expect(() => ensureDirectory(testDir)).not.toThrow();
    });

    it('should throw for non-existent directory', () => {
      const nonExistentDir = join(testDir, 'does-not-exist');

      expect(() => ensureDirectory(nonExistentDir)).toThrow(
        'Directory does not exist'
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty string paths', () => {
      expect(getFileExtension('')).toBe('');
      expect(getFileName('')).toBe('');
      expect(getDirName('')).toBe('.');
    });

    it('should handle paths with only separators', () => {
      expect(getFileName('/')).toBe(''); // basename('/', extname('/')) = basename('/', '') = ''
      expect(getDirName('/')).toBe('/');
    });

    it('should handle Unicode characters in paths', () => {
      const unicodePath = 'documents/文档/файл.txt';

      expect(getFileName(unicodePath)).toBe('файл');
      expect(getFileExtension(unicodePath)).toBe('.txt');
    });

    it('should handle very long filenames', () => {
      const longFilename = 'a'.repeat(100) + '.txt';

      expect(getFileExtension(longFilename)).toBe('.txt');
      expect(getFileName(longFilename)).toBe('a'.repeat(100));
    });
  });
});
