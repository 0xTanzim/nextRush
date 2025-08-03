/**
 * Benchmark Types for NextRush v2
 */

export interface BenchmarkConfig {
  duration?: number;
  concurrent?: number;
  requests?: number;
  profile?: boolean;
  memory?: boolean;
  cpu?: boolean;
  output?: string;
  framework?: string;
  scenario?: string;
}

export interface FrameworkResult {
  framework: string;
  version: string;
  port: number;
  scenarios: ScenarioResult[];
  summary: WeightedResult;
}

export interface ScenarioResult {
  name: string;
  weight: number;
  requests: {
    average: number;
    min: number;
    max: number;
    total: number;
  };
  latency: {
    average: number;
    min: number;
    max: number;
    p50: number;
    p90: number;
    p99: number;
  };
  throughput: {
    average: number;
    min: number;
    max: number;
  };
  errors: number;
  timeouts: number;
  duration: number;
  connections: number;
  pipelining: number;
}

export interface WeightedResult {
  requests: {
    average: number;
  };
  latency: {
    average: number;
  };
  throughput: {
    average: number;
  };
  errors: number;
  timeouts: number;
}

export interface BenchmarkResult {
  results: FrameworkResult[];
  config: BenchmarkConfig;
  summary: {
    winner: FrameworkResult;
    rankings: Ranking[];
    comparison: Comparison[];
  };
}

export interface Ranking {
  framework: string;
  requests: number;
  latency: number;
  throughput: number;
}

export interface Comparison {
  framework: string;
  performance: number;
  latency: number;
  throughput: number;
}

// Autocannon module declaration
declare module 'autocannon' {
  interface AutocannonOptions {
    url: string;
    connections?: number;
    duration?: number;
    pipelining?: number;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }

  interface AutocannonResult {
    requests: {
      average: number;
      min: number;
      max: number;
      total: number;
    };
    latency: {
      average: number;
      min: number;
      max: number;
      p50: number;
      p90: number;
      p99: number;
    };
    throughput: {
      average: number;
      min: number;
      max: number;
    };
    errors: number;
    timeouts: number;
    duration: number;
    connections: number;
    pipelining: number;
  }

  function autocannon(
    options: AutocannonOptions,
    callback: (err: Error | null, result: AutocannonResult) => void
  ): void;
}
