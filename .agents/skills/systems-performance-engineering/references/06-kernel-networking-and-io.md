# Kernel, Networking, HTTP, and I/O

## 1. Follow bytes end to end

For an HTTP response, trace where body bytes originate, whether they exist as strings/typed arrays/streams/native buffers, how headers are encoded, whether adapters copy or buffer them, and how writes are scheduled. The same payload can cross multiple representations. Count bytes copied and retained, not just object counts.

For request bodies, trace the reverse path: socket/runtime parsing, request abstraction, body stream, buffering, decoding, parsing, validation and application use. Lazy body parsing can save work when body data is not read, but must preserve one-shot stream semantics and errors.

## 2. Syscalls, batching and writes

A socket write can pass through runtime/native buffers and kernel socket buffers; a successful API call does not imply the peer received the bytes. Batching can reduce per-call overhead, but too much buffering can increase latency or memory use. `writev`, `sendfile`, corking and related features have platform/API-specific semantics and may not apply to every runtime.

Do not mandate “one syscall per response” as a universal rule. Headers/body may need separate writes or streaming chunks; the runtime may batch internally; backpressure and partial writes must be handled. Measure actual write behavior if syscall overhead is suspected.

## 3. Socket and TCP behavior

Relevant factors can include connection reuse, send/receive buffers, congestion control, retransmissions, round-trip time, packetization, TLS, MTU, delayed acknowledgments and Nagle interactions. These are not all under framework control. The framework can influence payload size, batching, connection handling, streaming, compression and write patterns, but should not infer network causes from a single benchmark number.

Separate connection setup cost from persistent-connection throughput. Record whether benchmarks use keep-alive, TLS, proxies and realistic request/response sizes.

## 4. Readiness/completion and event notification

Linux `epoll`, BSD/macOS `kqueue`, and Windows IOCP differ. A runtime may use different paths based on platform/version. At framework level, prefer correct asynchronous APIs, backpressure and capability boundaries; do not couple portable core to one OS primitive. Verify the runtime's current implementation before claiming how many syscalls or events occur per request.

## 5. Streaming and backpressure

Streaming can reduce whole-body buffering and time-to-first-byte, but adds lifecycle and error complexity. Validate:
- Source/consumer cancellation propagates correctly.
- Backpressure prevents unbounded buffering.
- Errors and aborts release resources.
- Headers/response commitment semantics remain correct.
- Chunks are not unnecessarily copied, but ownership is safe.
- Small chunks do not create excessive per-chunk overhead.

A `ReadableStream` at the API level does not guarantee end-to-end zero-copy streaming; an adapter or runtime may buffer or transform it.

## 6. TLS, compression, parsing and serialization

TLS handshakes, encryption, compression, JSON parsing/stringifying and header processing can dominate lightweight handlers. Identify the layer and workload. Consider payload size, repeated schema work, compression thresholds, connection reuse and whether serialization metadata is rebuilt. Do not remove required security checks or compression blindly to improve raw throughput.

## 7. Filesystem and storage

Synchronous disk access, metadata lookup, many small operations, cache misses and fsync semantics can affect workloads that touch storage. Distinguish page-cache hits from physical storage I/O; distinguish buffered writes from durable persistence. On a request path, avoid blocking filesystem or crypto work unless the architecture explicitly tolerates it.

## 8. Useful instrumentation

Depending on OS/runtime permissions, useful evidence may include syscall summaries, socket statistics, event-loop delay, write counts/bytes, queue depth, CPU profile, packet-level traces, and connection metrics. Tools such as Linux `strace`/`perf` are not portable and may be unavailable in containers. Verify availability and limitations. Prefer runtime/framework instrumentation first when sufficient.

## 9. Common mistakes

- Blaming syscalls when CPU-side normalization or serialization is dominant.
- Blaming the framework for TCP/TLS/network latency without separating server and client time.
- Assuming each response causes a fixed number of writes or syscalls.
- Calling a path zero-copy because it uses a stream or typed array.
- Comparing one benchmark with keep-alive to another that creates connections per request.
- Ignoring backpressure, partial writes, aborts and error-path cleanup while optimizing output.
