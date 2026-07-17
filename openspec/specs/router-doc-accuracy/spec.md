# router-doc-accuracy Specification

## Purpose
TBD - created by archiving change fix-router-issues-and-author-radix-rfc. Update Purpose after archive.
## Requirements
### Requirement: Router documentation and type docs accurately describe the segment-trie algorithm
All documentation and type-level doc comments across `@nextrush/router` and `@nextrush/types`
SHALL accurately describe the segment-trie algorithm the router actually implements, with no
residual "radix tree" claims and no stale structural descriptions that misrepresent the
implementation.

#### Scenario: No residual radix claim remains in router code or types
- **WHEN** `@nextrush/router`'s source and `@nextrush/types`' router types are searched for the
  term "radix" (case-insensitive)
- **THEN** no matches remain except an explicitly historical changelog reference

#### Scenario: The router README does not contradict itself
- **WHEN** `packages/router/README.md` is read end-to-end
- **THEN** it describes the algorithm as a segment trie consistently, with no "Radix Tree
  Algorithm" heading or "the radix tree router provides" claim contradicting its own opening

#### Scenario: The TrieNode.children doc matches the code
- **WHEN** `TrieNode.children`'s doc comment is compared to how the code keys that map
- **THEN** the comment accurately states children are keyed by whole path segment, not "by first
  character"

