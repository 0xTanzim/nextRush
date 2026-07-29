## ADDED Requirements

### Requirement: Documentation Information Architecture
The website documentation SHALL follow a 10-section IA: Getting Started, Concepts, Guides, Recipes, Examples, Production, Architecture, Reference, Migration, Community.

#### Scenario: IA sections exist as directories
- **WHEN** the website documentation is built
- **THEN** `content/docs/` SHALL contain directories: `getting-started`, `concepts`, `guides`, `recipes`, `examples`, `production`, `architecture`, `reference`, `migrate`, `community`

#### Scenario: Guides have sub-categories
- **WHEN** a user browses the Guides section
- **THEN** guides SHALL be grouped into sub-categories including: API Development, Authentication, Data, Communication, Testing, Security, Background Jobs

#### Scenario: Recipes have sub-categories
- **WHEN** a user browses the Recipes section
- **THEN** recipes SHALL be grouped into technology sub-categories including: Database, Auth, Storage, Email, Queue, Payments, Deployment, Monitoring, AI

#### Scenario: Examples section exists
- **WHEN** a user visits the website
- **THEN** there SHALL be an Examples section with at least 3 starter project templates

#### Scenario: Performance is inside Production
- **WHEN** a user visits /docs/production/
- **THEN** the Production section SHALL include performance tuning page(s)
- **AND** /docs/performance/ SHALL redirect to the relevant pages in Production and Architecture

#### Scenario: Help section is dissolved
- **WHEN** a user visits /docs/help/
- **THEN** the Help section SHALL no longer exist
- **AND** its content SHALL be redistributed to Guides, Recipes, Concepts, and Reference

---

### Requirement: Page Templates
The documentation SHALL provide distinct page templates for each content type (Guide, Recipe, Example) defining structure, metadata, and components.

#### Scenario: Guide template has defined structure
- **WHEN** an author creates a Guide page
- **THEN** the page SHALL follow the Guide template: Purpose → Prerequisites → Step-by-Step → Next Steps
- **AND** SHALL include metadata card with difficulty, reading time, and prerequisites

#### Scenario: Recipe template has defined structure
- **WHEN** an author creates a Recipe page
- **THEN** the page SHALL follow the Recipe template: Problem → Solution → Full Solution → Breakdown → Alternatives → Troubleshooting → Related

#### Scenario: Example template has defined structure
- **WHEN** an author creates an Example page
- **THEN** the page SHALL follow the Example template: Overview → Architecture → Quick Start → Project Structure → Features → Deploy → Next Steps
- **AND** SHALL include a features table, architecture diagram, and deploy section

#### Scenario: Metadata card is frontmatter-driven
- **WHEN** a page is rendered
- **THEN** it SHALL display a metadata card showing difficulty (Beginner/Intermediate/Advanced), reading time in minutes, and prerequisites
- **AND** this data SHALL be sourced from the page frontmatter

---

### Requirement: Content Governance
The documentation SHALL implement content lifecycle, classification, and authoring standards.

#### Scenario: Pages have lifecycle states
- **WHEN** a documentation page is published
- **THEN** the page frontmatter SHALL include a `status` field with ONE of: draft | review | stable | deprecated
- **AND** `deprecated` pages SHALL display a deprecation banner and migration path

#### Scenario: Sections have classification levels
- **WHEN** a page is authored
- **THEN** content sections SHALL be classified as Required (mandatory for that content type), Recommended (optional but preferred), or Conditional (applicable only in specific scenarios)

#### Scenario: Search keywords are required
- **WHEN** a page is authored
- **THEN** the frontmatter SHALL include a `keywords` array with search-friendly aliases and alternative phrasings

---

### Requirement: Standardized Callouts
The documentation SHALL use a consistent callout taxonomy across all pages.

#### Scenario: Callout types are defined
- **WHEN** an author uses a callout
- **THEN** the callout SHALL use one of: Info (`💡`), Warning (`⚠️`), Danger (`🚫`), Success (`✅`), Edge Case (`🔍`), Why explanation (`🤔`), Migration note (`📦`), Pro tip (`⚡`), Glossary (`📖`), Related (`🔗`)
- **AND** each callout SHALL follow the pattern: `> <emoji> <Type>: <content>`

---

### Requirement: Cross-linking
The documentation SHALL implement consistent inline cross-linking between related content.

#### Scenario: Related pages are linked
- **WHEN** a page references a concept detailed in another page
- **THEN** the author SHALL add inline cross-links using `→` followed by the link
- **AND** pages SHALL include a "Related" callout at the end linking to sibling pages

---

### Requirement: Learning Paths
Content sections SHALL provide curated learning paths — ordered sequences of pages for domain-specific developer journeys.

#### Scenario: Sections have learning paths
- **WHEN** a user visits a domain section (e.g., Authentication, Database)
- **THEN** the section meta.json SHALL include a `learningPath` array listing page slugs in reading order

---

### Requirement: Redirects
All URL changes from the IA restructure SHALL have 301 redirects.

#### Scenario: Old URLs redirect
- **WHEN** a user visits a pre-restructure URL (e.g., /docs/performance/tuning)
- **THEN** the server SHALL return a 301 redirect to the new URL (e.g., /docs/production/performance-tuning)
- **AND** a redirect map SHALL be maintained in the website configuration

---

### Requirement: Accessibility
All documentation pages SHALL meet WCAG 2.2 AA standards.

#### Scenario: Images have alt text
- **WHEN** a page contains an image
- **THEN** the image SHALL have descriptive alt text
- **AND** decorative images SHALL have empty alt text (`alt=""`)

#### Scenario: Code blocks are accessible
- **WHEN** a page contains a code block
- **THEN** the code block SHALL have a visible language label
- **AND** SHALL support copy-to-clipboard
- **AND** terminal commands and output SHALL be distinguishable

---

### Requirement: Mobile Responsiveness
All documentation pages SHALL render correctly on mobile viewports (320px and above).

#### Scenario: Tables are scrollable
- **WHEN** a page contains a table wider than the viewport
- **THEN** the table SHALL be horizontally scrollable without breaking layout

#### Scenario: Code blocks wrap
- **WHEN** a code block line exceeds viewport width
- **THEN** the code block SHALL scroll horizontally without wrapping
