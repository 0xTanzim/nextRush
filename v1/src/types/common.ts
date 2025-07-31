/**
 * Common type definitions used across the framework
 */

export type Primitive = string | number | boolean | null | undefined;

export type Dict<T = unknown> = Record<string, T>;

export type AnyFunction = (...args: any[]) => any;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface Disposable {
  dispose(): void | Promise<void>;
}

export interface Configurable<T> {
  configure(config: Partial<T>): void;
}

export interface AsyncHandler<TInput, TOutput> {
  handle(input: TInput): Promise<TOutput>;
}

export interface SyncHandler<TInput, TOutput> {
  handle(input: TInput): TOutput;
}
