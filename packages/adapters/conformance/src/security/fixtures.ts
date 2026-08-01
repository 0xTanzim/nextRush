/**
 * Shared security-suite fixtures for cross-adapter parity (task 2.2).
 *
 * Values are intentionally raw targets/headers — the harness must feed them
 * through each adapter unchanged so findings stay observable, not assumed.
 *
 * @packageDocumentation
 */

/** Forged / mixed forwarded-header chains used by SEC-01 and trust-policy tests. */
export const FORGED_FORWARDED_CHAINS = {
  /** Client-forged leftmost entry in front of a real peer. */
  leftmostForged: {
    'x-forwarded-for': '203.0.113.9, 10.0.0.5',
  },
  /** Three-hop chain: client, untrusted hop, trusted peer. */
  threeHop: {
    'x-forwarded-for': '198.51.100.1, 203.0.113.50, 10.0.0.5',
  },
  /** Rotating leftmost value (rate-limit key bypass pattern). */
  rotatingLeftmost: (n: number): Record<string, string> => ({
    'x-forwarded-for': `203.0.113.${String(n)}, 10.0.0.5`,
  }),
  /** Vendor header present alongside XFF. */
  cloudflarePlusXff: {
    'cf-connecting-ip': '198.51.100.7',
    'x-forwarded-for': '203.0.113.9, 10.0.0.5',
  },
  /** Malformed chain entries mixed with a valid peer. */
  malformedEntries: {
    'x-forwarded-for': 'not-an-ip, , 10.0.0.5',
  },
} as const;

/** Dot-segment path variants (SEC-09) — literal, encoded, double-encoded, filenames. */
export const DOT_SEGMENT_PATHS = {
  /** Must reject (400) once WS-A lands. */
  reject: [
    '/api/webhooks/../admin',
    '/api/%2e%2e/admin',
    '/api/%252e%252e/admin',
    '/api/./users',
    '/../..',
  ],
  /** Must accept — dots are filename content, not traversal segments. */
  accept: ['/files/archive.tar.gz', '/files/..hidden.txt'],
} as const;

/** Mixed-case and repeated-slash request targets (SEC-02 path surface). */
export const PATH_TARGET_VARIANTS = {
  mixedCaseAdminUsers: '/ADMIN/users',
  mixedCaseAdminRoot: '/Admin',
  repeatedSlash: '//a//b',
  tripleSlashRoot: '///',
  deepRepeated: '/a//b///c////d',
} as const;

/** Malformed header names and values for grammar / injection probes (SEC-12). */
export const MALFORMED_HEADERS = {
  nameWithSpace: { 'bad name': 'x' },
  nameWithColon: { 'name:extra': 'x' },
  valueWithCr: { 'x-custom': 'a\rb' },
  valueWithLf: { 'x-custom': 'a\nb' },
  valueWithNul: { 'x-custom': 'a\0b' },
  valueLeadingWs: { 'x-custom': ' leading' },
  valueTrailingWs: { 'x-custom': 'trailing ' },
} as const;

/** Peer / forged addresses used when asserting broken vs fixed client-IP policy. */
export const CLIENT_IP_FIXTURES = {
  forgedClient: '203.0.113.9',
  directPeer: '10.0.0.5',
  alternatePeer: '10.0.0.1',
} as const;
