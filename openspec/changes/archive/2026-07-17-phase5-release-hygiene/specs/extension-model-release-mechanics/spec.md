## ADDED Requirements

### Requirement: Extension-model migration release bookkeeping is reconciled

The `Plugin → Extension` migration's release bookkeeping SHALL be complete before the v1.0 freeze: the published source MUST contain no legacy `Plugin` contract, and the migration's release-impacting change MUST be recorded via a changeset and a CHANGELOG entry, with no unreconciled migration TODO remaining.

#### Scenario: No legacy Plugin contract remains in source
- **WHEN** the published source (`packages/*/src`) is scanned for the legacy extension contract (`Plugin`, `PluginWithHooks`, `PluginFactory`, `app.plugin()`, `getPlugin()`)
- **THEN** no such type, symbol, or call exists, and any remaining occurrence of the word "Plugin" is incidental prose or a comment, not a type or public API

#### Scenario: Release bookkeeping is present and reconciled
- **WHEN** the release artifacts are inspected
- **THEN** a changeset and a CHANGELOG entry record the `Plugin → Extension` migration's release-impacting change, and no migration TODO checkbox is left unreconciled

#### Scenario: The Extension API is the sole documented extension mechanism
- **WHEN** a consumer looks up how to add a long-lived, app-scoped service
- **THEN** the documentation describes `app.extend(...)` + `await app.ready()` per `ADR-0002`, and no current-tense reference to the removed `app.plugin()` path remains
