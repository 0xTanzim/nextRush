
Annotations
17 errors
🔍 Quality Checks
Process completed with exit code 1.
🧪 Run Tests (22)
Process completed with exit code 1.
src/tests/unit/utils/path-utils.test.ts > Path Utils > getFileModifiedTime > should return file modification time: src/tests/unit/utils/path-utils.test.ts#L280
AssertionError: expected 1759289246888 to be less than or equal to 1759289246887 ❯ src/tests/unit/utils/path-utils.test.ts:280:33
src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > closes on ping/pong timeout (raw TCP without pong): src/tests/unit/plugins/websocket.plugin.test.ts#L204
Error: Test timed out in 10000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ src/tests/unit/plugins/websocket.plugin.test.ts:204:3

src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > middleware error triggers early close: src/tests/unit/plugins/websocket.plugin.test.ts#L293
ReferenceError: WebSocket is not defined ❯ src/tests/unit/plugins/websocket.plugin.test.ts:293:16
src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > rejects messages larger than maxMessageSize: src/tests/unit/plugins/websocket.plugin.test.ts#L266
ReferenceError: WebSocket is not defined ❯ src/tests/unit/plugins/websocket.plugin.test.ts:266:16
src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > closes on ping/pong timeout (raw TCP without pong): src/tests/unit/plugins/websocket.plugin.test.ts#L204
Error: Test timed out in 10000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ src/tests/unit/plugins/websocket.plugin.test.ts:204:3

src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > denies forbidden origins: src/tests/unit/plugins/websocket.plugin.test.ts#L192
ReferenceError: WebSocket is not defined ❯ src/tests/unit/plugins/websocket.plugin.test.ts:192:16
src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > broadcasts to rooms only: src/tests/unit/plugins/websocket.plugin.test.ts#L143
ReferenceError: WebSocket is not defined ❯ src/tests/unit/plugins/websocket.plugin.test.ts:143:17
src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > supports wildcard routes: src/tests/unit/plugins/websocket.plugin.test.ts#L119
ReferenceError: WebSocket is not defined ❯ src/tests/unit/plugins/websocket.plugin.test.ts:119:16
src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > enforces maxConnections: src/tests/unit/plugins/websocket.plugin.test.ts#L91
ReferenceError: WebSocket is not defined ❯ src/tests/unit/plugins/websocket.plugin.test.ts:91:17
src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > verifyClient=false rejects connection: src/tests/unit/plugins/websocket.plugin.test.ts#L71
ReferenceError: WebSocket is not defined ❯ src/tests/unit/plugins/websocket.plugin.test.ts:71:16
src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > rejects unmatched path: src/tests/unit/plugins/websocket.plugin.test.ts#L50
ReferenceError: WebSocket is not defined ❯ src/tests/unit/plugins/websocket.plugin.test.ts:50:16
src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > accepts connections and echoes messages: src/tests/unit/plugins/websocket.plugin.test.ts#L25
ReferenceError: WebSocket is not defined ❯ src/tests/unit/plugins/websocket.plugin.test.ts:25:16
🧪 Run Tests (20)
The strategy configuration was canceled because "test._22" failed
🧪 Run Tests (18)
The operation was canceled.
🧪 Run Tests (18)
The strategy configuration was canceled because "test._22" failed
=======
==


Run pnpm format:check

> nextrush@2.0.0 format:check /home/runner/work/nextRush/nextRush
> prettier --check "src/**/*.{ts,tsx,js,jsx,json,md}"

Checking formatting...
[warn] src/tests/integration/status-handling.test.ts
[warn] src/tests/unit/core/context/context.body-sync.test.ts
[warn] src/tests/unit/core/context/context.implementation-verification.test.ts
[warn] Code style issues found in 3 files. Run Prettier with --write to fix.
 ELIFECYCLE  Command failed with exit code 1.
Error: Process completed with exit code 1.


====

==


stdout | src/tests/unit/core/context/context.body-sync.test.ts > ✅ FINAL VERIFICATION: ctx.body and ctx.req.body synchronization > should provide complete summary of all implementations

🎉 COMPREHENSIVE IMPLEMENTATION VERIFICATION COMPLETE
=====================================================

✅ RESPONSE METHODS (41/41 IMPLEMENTED):
  Core: json(), send(), html(), text(), xml(), csv(), stream()
  Files: sendFile(), file(), download(), render()
  Redirects: redirect(), redirectPermanent(), redirectTemporary()
  Headers: status(), set(), header(), get(), remove(), removeHeader(), type(), length(), etag(), lastModified()
  Cookies: cookie(), clearCookie()
  Cache: cache(), noCache()
  Security: cors(), security(), compress()
  API: success(), error(), paginate()
  Utils: getContentTypeFromExtension(), getSmartContentType(), generateETag(), convertToCSV(), time(), getNestedValue(), isTruthy()

✅ REQUEST ENHANCEMENTS:
  Properties: ctx.req.params, ctx.req.query, ctx.req.body, ctx.req.pathname
  Methods: ctx.req.param(), ctx.req.get(), etc.

✅ CONTEXT PROPERTIES:
  Body handling: ctx.body (synchronized with ctx.req.body)
  Request/Response: ctx.req, ctx.res
  URL info: ctx.method, ctx.url, ctx.path, ctx.query, ctx.params
  Metadata: ctx.id, ctx.state, ctx.startTime, ctx.ip, ctx.secure, ctx.protocol, ctx.hostname

✅ TYPESCRIPT SUPPORT:
  Complete interface definitions for all 41+ methods
  No casting to any required
  Full IntelliSense support
  Type safety for all parameters and return values

🚀 FINAL STATUS: NEXTRUSH V2 CONTEXT SYSTEM IS FULLY IMPLEMENTED!
   - NO missing implementations
   - NO type-only methods
   - NO broken functionality
   - COMPLETE Express.js compatibility
   - ENTERPRISE-READY type safety

 ✓ src/tests/unit/core/context/context.body-sync.test.ts (2 tests) 9ms
 ✓ src/tests/unit/plugins/index.test.ts (6 tests) 30ms
stdout | src/tests/unit/core/events/debug-event-system.test.ts > Event System Debug > should configure event system correctly
Creating event system...
Event system created
Event system ready (no clear called)

stdout | src/tests/unit/core/events/debug-event-system.test.ts > Event System Debug > should configure event system correctly
Has event store: true
Wildcard subscriptions: 1
Emitting domain event...

stdout | src/tests/unit/core/events/debug-event-system.test.ts > Event System Debug > should configure event system correctly
Events loaded: 1

 ✓ src/tests/unit/core/events/debug-event-system.test.ts (1 test) 106ms
 ✓ src/tests/unit/core/orchestration/index.test.ts (5 tests) 29ms
stdout | src/tests/unit/core/events/isolated-event-persistence.test.ts > Isolated Event Persistence Test > should save and replay events from aggregate
Events loaded: 1 [
  {
    type: 'UserCreated',
    data: { userId: 'user-123', name: 'John Doe', email: 'john@example.com' },
    aggregateId: 'user-123',
    aggregateType: 'User',
    sequenceNumber: 1,
    metadata: {
      id: 'afdb559a-7931-42e2-bc62-a5a08a2176db',
      timestamp: 1759289289377,
      source: 'nextrush-framework',
      version: 1
    }
  }
]

 ✓ src/tests/unit/core/events/isolated-event-persistence.test.ts (1 test) 108ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tests/unit/plugins/websocket.plugin.test.ts > WebSocketPlugin > closes on ping/pong timeout (raw TCP without pong)
Error: Test timed out in 10000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ src/tests/unit/plugins/websocket.plugin.test.ts:204:3
    202|   });
    203|
    204|   it('closes on ping/pong timeout (raw TCP without pong)', async () =>…
       |   ^
    205|     const app = createApp();
    206|     new WebSocketPlugin({

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/tests/unit/utils/path-utils.test.ts > Path Utils > getFileModifiedTime > should return file modification time
AssertionError: expected 1759289246888 to be less than or equal to 1759289246887
 ❯ src/tests/unit/utils/path-utils.test.ts:280:33
    278|
    279|       expect(modTime).toBeInstanceOf(Date);
    280|       expect(modTime.getTime()).toBeLessThanOrEqual(Date.now());
       |                                 ^
    281|       expect(modTime.getTime()).toBeGreaterThan(Date.now() - 5000); //…
    282|     });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯

Vitest caught 1 unhandled error during the test run.
This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.

⎯⎯⎯⎯⎯ Uncaught Exception ⎯⎯⎯⎯⎯
Error: connect ECONNREFUSED 127.0.0.1:37775
 ❯ TCPConnectWrap.afterConnect [as oncomplete] node:net:1637:16

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { errno: -111, code: 'ECONNREFUSED', syscall: 'connect', address: '127.0.0.1', port: 37775 }
This error originated in "src/tests/unit/plugins/websocket.plugin.test.ts" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
The latest test that might've caused the error is "closes on ping/pong timeout (raw TCP without pong)". It might mean one of the following:
- The error was thrown, while Vitest was running this test.
- If the error occurred after the test had been completed, this was the last documented test before it was thrown.
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯


 Test Files  2 failed | 59 passed (61)
      Tests  2 failed | 1459 passed | 1 skipped (1462)
     Errors  1 error
   Start at  03:27:16
   Duration  53.12s (transform 975ms, setup 0ms, collect 2.58s, tests 39.38s, environment 11ms, prepare 4.17s)


Error: Error: Test timed out in 10000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
 ❯ src/tests/unit/plugins/websocket.plugin.test.ts:204:3



Error: AssertionError: expected 1759289246888 to be less than or equal to 1759289246887
 ❯ src/tests/unit/utils/path-utils.test.ts:280:33


 ELIFECYCLE  Test failed. See above for more details.
Error: Process completed with exit code 1.

===
