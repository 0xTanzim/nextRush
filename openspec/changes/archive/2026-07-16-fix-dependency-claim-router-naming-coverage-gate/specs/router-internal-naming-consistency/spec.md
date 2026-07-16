## ADDED Requirements

### Requirement: Router internal naming matches the documented algorithm
Router package source (file names, type names, JSDoc, and npm package metadata) SHALL use
terminology consistent with the algorithm the package actually implements and documents
(a segment trie), and SHALL NOT retain contradicting legacy terminology ("radix tree") once the
rename is complete, except where intentionally retained as a transitional npm search keyword.

#### Scenario: No contradicting internal terminology remains
- **WHEN** the router package's source is searched for the term "radix" (case-insensitive)
- **THEN** no matches are found in file names, type names, or JSDoc comments, except an
  explicitly transitional npm keyword entry (if retained) or a historical changelog reference

#### Scenario: Rename does not change the public API surface
- **WHEN** the router package's public-surface snapshot test is run before and after the rename
- **THEN** the exported symbol set is identical, confirming the renamed type
  (`RadixNode` → `TrieNode`) was never part of the public contract
