# Operating Systems, Processes, Threads, and Concurrency

## 1. User space, kernel space, and system calls

Applications generally execute in user mode. Operations such as certain socket, file and process actions require kernel services and may cross a user/kernel boundary. A syscall is not inherently expensive enough to optimize: its cost depends on the operation, system, frequency, contention and amount of work. Reducing many tiny calls into a batch may help, but only when the workload and API semantics allow it.

Runtime APIs may perform hidden native work or use internal thread pools. Understand the API and runtime before attributing time directly to a syscall.

## 2. Processes, threads, and context switches

A process owns an address space and OS resources; threads are schedulable execution entities within a process. A context switch can involve saving/restoring CPU execution state, scheduler work, cache/TLB effects and possible migration. Costs vary widely. The term “context switch” is often misused for promise resolution, coroutine/fiber switching, event-loop callbacks or ordinary function calls; these are not necessarily OS thread context switches.

For a TypeScript framework, first determine the concurrency model of the runtime and host: event loop, native threads, worker threads, thread pools and runtime-specific internals. Avoid claiming an OS context switch occurs at every async boundary.

## 3. Blocking, non-blocking, and asynchronous work

These are distinct concepts:
- **Blocking**: the current execution agent cannot proceed until an operation completes.
- **Non-blocking**: an API can report that an operation would wait, allowing other work to proceed.
- **Asynchronous**: completion is delivered later through callbacks/events/promises or another mechanism.
- **Parallel**: work actually executes simultaneously on multiple execution resources.

Async syntax does not guarantee non-blocking implementation. CPU-heavy work on an event-loop thread blocks unrelated tasks. Offloading work may introduce queues, serialization/copying, synchronization and scheduling overhead. Measure both direct cost and impact under concurrency.

## 4. Event loops, epoll, kqueue and IOCP

Linux `epoll`, BSD/macOS `kqueue`, and Windows IOCP are different OS mechanisms and expose different readiness/completion models. Runtimes may abstract these details and integrate timers, callbacks, native workers and other queues. Do not assume every HTTP request causes one `epoll_wait`, one syscall or one context switch; events and syscalls are commonly batched, and runtime implementation matters.

When investigating event-loop stalls, consider event-loop delay, CPU-intensive callbacks, synchronous APIs, unresolved microtask bursts, worker-pool saturation, socket queues and slow downstream work.

## 5. Scheduling and contention

Potential sources include run-queue pressure, too many runnable threads, thread-pool saturation, lock contention, atomic contention, priority interactions and migration across CPU cores. Utilization alone is insufficient to distinguish them.

Use the appropriate platform telemetry where available. In containers and VMs, hardware counters and scheduler observations may be restricted or distorted. Note those limits.

## 6. Green threads, fibers, virtual threads

User-space schedulers can make large numbers of logical tasks manageable, but do not erase work. Costs can move to task allocation, scheduling, stack/continuation representation, cancellation, synchronization or carrier-thread blocking. JavaScript promises are not the same mechanism as OS threads or Java virtual threads. Compare actual runtime architecture and workload rather than transferring conclusions across languages.

## 7. Virtual memory and page behavior

Virtual addresses are translated through page tables, with translations cached by TLBs. Page faults can involve mapping work, zeroing, storage I/O or other OS actions. Memory mapping, copy-on-write, page cache, swapping, cgroups and OOM behavior may matter for cold start or large workloads. An ordinary page fault is not automatically disk I/O.

Inspect process/container metrics and OS evidence before attributing an issue to page faults, swapping or NUMA. A high virtual-memory number alone does not mean physical memory pressure.

## 8. Filesystems and synchronous I/O

Synchronous filesystem operations on a request-serving thread can block that execution path. Async filesystem APIs may use kernel async facilities, worker threads, or runtime-specific implementations. File-system metadata, page cache, storage latency and file-descriptor limits can all matter. Confirm the actual environment and API behavior.

## 9. Diagnostic questions

- Is the event loop blocked, waiting, or busy running callbacks?
- Is a native thread pool saturated?
- Are queues growing faster than work completes?
- Is work serialized by a lock, shared counter or single dispatcher?
- Are “context switches” observed by a tool actually OS scheduler switches or merely runtime task transitions?
- Does reducing syscalls or offloading work improve complete latency, or add more scheduling/copy overhead?
