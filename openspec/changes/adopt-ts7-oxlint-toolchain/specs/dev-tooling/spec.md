# Spec Delta — dev-tooling

## ADDED Requirements

### Requirement: Declaration emission survives a compiler major-line change

The declaration pass in `nextrush build` SHALL emit `.d.ts` output from the TypeScript compiler that
`@nextrush/dev` itself resolves, independent of that compiler's packaging layout — including a
compiler distributed as native per-platform binaries, published as an ES module, or without the
historical `tsserver` entry point. The pass MUST use the resolved local compiler rather than a
`PATH`-looked-up or network-fetched one, and MUST fail the build with an actionable message when no
usable compiler can be resolved, never silently skipping declaration output while reporting success.

#### Scenario: Declarations are emitted with a natively distributed compiler

- **WHEN** the TypeScript version resolved by `@nextrush/dev` is distributed as a platform-native binary rather than a JavaScript entry point
- **THEN** `nextrush build --dts` still produces `.d.ts` files at the same relative layout as their corresponding `.js` outputs

#### Scenario: An unresolvable compiler fails loudly

- **WHEN** no local TypeScript compiler can be resolved for the declaration pass
- **THEN** the build exits non-zero with a message naming the missing package and the install command, and it does not report a successful build with declarations silently absent

#### Scenario: The declaration pass ignores an unrelated compiler on PATH

- **WHEN** a different TypeScript version is available on the host `PATH` than the one `@nextrush/dev` resolves
- **THEN** the declaration pass uses the resolved local compiler, so declared output does not vary with the host environment
