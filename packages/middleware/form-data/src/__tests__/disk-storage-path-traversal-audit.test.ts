/**
 * @nextrush/form-data - Disk storage path-traversal guard
 * (`audit-unreviewed-security-surface`, area 2: multipart storage).
 *
 * `DiskStorage.handle()`'s default filename path (`sanitizedName`, already
 * cleaned by `sanitizeFilename()`) is safe — proven below. Its SECOND-ORDER
 * defense-in-depth check (`resolved.startsWith(this.dest)`, guarding a
 * user-supplied CUSTOM `filename` option that bypasses `sanitizedName`
 * entirely) has a real sibling-directory bypass: `startsWith` on a bare
 * prefix with no trailing separator treats `/tmp/uploads-evil` as "starting
 * with" `/tmp/uploads`, even though it is a sibling directory, not a
 * subdirectory. This is the finding under test — the default (no custom
 * `filename` option) path is unaffected, since `sanitizedName` can never
 * contain a path separator to begin with.
 */
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DiskStorage } from '../storage/disk';
import type { FileInfo } from '../types';

let root: string;
let dest: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'nextrush-multipart-audit-'));
  // Deliberately create a destination dir whose name is a PREFIX of a
  // sibling directory name, mirroring the real-world shape of the bug
  // (e.g. `uploads` vs. `uploads-internal`).
  dest = join(root, 'uploads');
  await mkdir(dest, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function makeStream(bytes: string): ReadableStream<Uint8Array> {
  const data = new TextEncoder().encode(bytes);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

const baseInfo: FileInfo = {
  fieldName: 'file',
  originalName: 'evil.txt',
  sanitizedName: 'evil.txt',
  encoding: '7bit',
  mimeType: 'text/plain',
};

describe('DiskStorage — default filename path (no custom filename option)', () => {
  it('a sanitized name can never contain a path separator, so the default path cannot escape dest', async () => {
    const storage = new DiskStorage({ dest });
    // Even a maximally hostile sanitizedName (as if sanitizeFilename() had
    // a bug) is passed through join() as a single path SEGMENT here,
    // because DiskStorage.defaultFilename only ever does string
    // concatenation (`${uuid}-${sanitizedName}`), never a join/resolve on
    // attacker input directly.
    const result = await storage.handle(
      makeStream('safe content'),
      { ...baseInfo, sanitizedName: 'evil.txt' }
    );
    expect(result.path?.startsWith(dest)).toBe(true);
  });
});

describe('DiskStorage — custom `filename` option (second-order defense-in-depth check)', () => {
  it('FINDING: a custom filename() returning a sibling-directory-escaping path bypasses the startsWith guard', async () => {
    // Create the sibling directory the crafted filename targets, so a
    // successful escape is observable as a real file landing outside `dest`.
    const siblingDir = `${dest}-evil`;
    await mkdir(siblingDir, { recursive: true });

    const storage = new DiskStorage({
      dest,
      // A custom filename function that does not sanitize its own output —
      // exactly the class of finding this review looks for: a
      // security-relevant decision (where the file lands) made from a value
      // that was never validated against the destination boundary.
      filename: () => '../uploads-evil/escaped.txt',
    });

    const result = await storage.handle(makeStream('escaped content'), baseInfo);

    // FINDING: the file lands in the sibling directory, outside `dest` —
    // the `resolved.startsWith(this.dest)` check did not catch this, because
    // `/…/uploads-evil/escaped.txt` textually starts with `/…/uploads` as a
    // bare string prefix even though it is not inside that directory.
    expect(result.path).toBe(join(siblingDir, 'escaped.txt'));
    expect(result.path?.startsWith(dest)).toBe(true); // the buggy check's own (wrong) view
    expect(result.path?.startsWith(`${dest}/`)).toBe(false); // the correct view: NOT actually inside dest

    const written = await readFile(result.path!, 'utf8');
    expect(written).toBe('escaped content');
  });
});
