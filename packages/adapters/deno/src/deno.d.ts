/**
 * @nextrush/adapter-deno - Hand-rolled Deno runtime types
 *
 * The zero-dependency policy forbids pulling `@types/deno`, so the subset of
 * the Deno runtime API this adapter uses is declared here by hand (audit F-17).
 *
 * ⚠️ VERSION NOTE — verified against **Deno 1.46 / 2.x `Deno.serve`** (stable,
 * 2026-07). If Deno's `serve` signature changes, update these declarations and
 * bump the date. A CI smoke test on real Deno guards against silent drift.
 *
 * Declared as ambient globals (not exported) because `Deno` is a runtime global
 * on the Deno platform; on Node/CI it is absent and only used behind `typeof`
 * guards or in the adapter's own code paths that run exclusively on Deno.
 *
 * @packageDocumentation
 */

declare global {
  /** The subset of `Deno.serve` init options the adapter uses. */
  interface DenoServeInit {
    port?: number;
    hostname?: string;
    signal?: AbortSignal;
    handler: (request: Request, info: DenoServeHandlerInfo) => Response | Promise<Response>;
    onListen?: (params: { port: number; hostname: string }) => void;
    onError?: (error: unknown) => Response | Promise<Response>;
    cert?: string;
    key?: string;
  }

  /** Per-request connection info passed by `Deno.serve`. */
  interface DenoServeHandlerInfo {
    remoteAddr: { hostname: string; port: number };
  }

  /** The `Deno.serve` return value the adapter relies on. */
  interface DenoServer {
    finished: Promise<void>;
    ref(): void;
    unref(): void;
    shutdown(): Promise<void>;
    addr: { port: number; hostname: string };
  }

  /** The subset of the `Deno` global the adapter touches. */
  var Deno: {
    serve(options: DenoServeInit): DenoServer;
    version: { deno: string };
  };
}

export {};
