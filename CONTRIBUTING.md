# Contributing to LogicStamp Context

Thank you for your interest in contributing! This document provides guidelines for contributing to logicstamp-context.

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to logicstamp.dev@gmail.com.

## Getting Started

### Prerequisites
- Node.js >= 20
- npm or yarn
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/LogicStamp/logicstamp-context.git
cd logicstamp-context

# Install dependencies
npm install

# Build the project
npm run build

# Link locally for testing
npm link

# Test the CLI
stamp context --help
```

## Branching Strategy

This repository uses a **simple feature → `main` branching model**.

There is **no `develop` branch**. All changes go through short‑lived feature branches into `main`.

### Branches

- **`main`** – always **release‑ready**
- **`feature/*`, `fix/*`, `docs/*`** – short‑lived branches for work

### Typical flow

1. **Create a feature branch from `main`:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/short-description
   ```

2. **Do the work, commit, and push:**

   ```bash
   git add .
   git commit -m "feat: short description"
   git push origin feature/short-description
   ```

3. **Open a Pull Request targeting `main`.**
4. After review and passing checks, **merge into `main`** and delete the branch.

### Releasing to npm

**Routine publishes go through GitHub Actions**, not a local `npm publish`. Pushing a tag `v*.*.*` runs [`.github/workflows/release.yml`](.github/workflows/release.yml), which builds, tests, and publishes to npm using **trusted publishing (OIDC)**—no `NPM_TOKEN` secret is used for that step.

The version bump should land on **`main` via a pull request** (typical with branch protection). **Create and push the tag only after that merge**, from the `main` commit that contains the new `package.json` version. See [Release Process](#release-process) for the full maintainer checklist. `main` should stay release-ready; tags map to npm versions.

---

## Branch Protection & Conventions

### `main` branch protection (recommended)

- Require **pull request reviews** (at least 1 approval)
- Require **status checks** (lint, tests, build, etc.) to pass
- Require branches to be **up to date** before merging
- Disallow **force pushes** and **deletions**

### Branch naming

- `feature/add-x`
- `fix/bug-y`
- `docs/update-z`

### Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` docs-only changes
- `style:` formatting-only changes
- `refactor:` internal refactors
- `test:` tests
- `chore:` tooling / maintenance
- `perf:` performance improvements
- `ci:` CI/CD changes

---

## Best Practices

1. **Keep branches short‑lived** – merge within days, not weeks.
2. **One change per branch** – avoid mixing unrelated work.
3. **Sync with `main` regularly** – `git pull --rebase origin main` on feature branches.
4. **Always use PRs** – even for maintainers.
5. **Tag bundle releases** on `main` so they map cleanly to npm versions.

This lightweight strategy keeps the workflow simple while still being safe and review‑friendly.

## Project Structure

```
logicstamp-context/
├── src/
│   ├── cli/           # CLI entry point and command handling
│   │   ├── index.ts    # Main CLI entry point
│   │   ├── stamp.ts    # Command routing
│   │   ├── commands/  # Command implementations
│   │   │   ├── context.ts
│   │   │   ├── context/  # Context command modules
│   │   │   │   ├── contractBuilder.ts
│   │   │   │   ├── bundleFormatter.ts
│   │   │   │   ├── tokenEstimator.ts
│   │   │   │   ├── fileWriter.ts
│   │   │   │   ├── statsCalculator.ts
│   │   │   │   └── configManager.ts
│   │   │   ├── compare.ts
│   │   │   ├── validate.ts
│   │   │   ├── clean.ts
│   │   │   ├── init.ts
│   │   │   └── style.ts
│   │   ├── handlers/  # Command handlers
│   │   │   ├── contextHandler.ts
│   │   │   ├── compareHandler.ts
│   │   │   ├── validateHandler.ts
│   │   │   ├── cleanHandler.ts
│   │   │   ├── initHandler.ts
│   │   │   └── styleHandler.ts
│   │   └── parser/    # Argument parsing and help text
│   │       ├── argumentParser.ts
│   │       └── helpText.ts
│   ├── core/          # Core functionality
│   │   ├── astParser.ts      # Main AST parsing (orchestrates modules)
│   │   ├── astParser/        # AST parsing modules
│   │   │   ├── detectors.ts   # Component kind detection
│   │   │   └── extractors/   # Extraction modules
│   │   │       ├── componentExtractor.ts
│   │   │       ├── propExtractor.ts
│   │   │       ├── stateExtractor.ts
│   │   │       └── eventExtractor.ts
│   │   ├── styleExtractor.ts # Main style extraction (re-export)
│   │   ├── styleExtractor/   # Style extraction modules
│   │   │   ├── styleExtractor.ts  # Main coordination
│   │   │   ├── tailwind.ts
│   │   │   ├── scss.ts
│   │   │   ├── styled.ts
│   │   │   ├── motion.ts
│   │   │   └── layout.ts
│   │   ├── pack.ts            # Main bundling (orchestrates modules)
│   │   ├── pack/               # Bundling modules
│   │   │   ├── resolver.ts     # Dependency resolution
│   │   │   ├── collector.ts    # Dependency collection
│   │   │   ├── loader.ts       # File loading
│   │   │   └── builder.ts      # Bundle building
│   │   ├── contractBuilder.ts # Contract generation
│   │   ├── manifest.ts        # Dependency graph
│   │   └── signature.ts       # Logic signature extraction
│   ├── types/         # TypeScript type definitions
│   │   └── UIFContract.ts
│   └── utils/         # Utility functions
│       ├── fsx.ts     # File system operations
│       └── hash.ts    # Hashing utilities
├── docs/              # Documentation
├── examples/          # Example outputs
└── dist/              # Compiled output (generated)
```

## Development Workflow

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clear, documented code
   - Follow existing code style
   - Add JSDoc comments for public APIs

3. **Build and test**
   ```bash
   npm run lint
   npm run build

   # Test manually
   logicstamp-context ./test-project
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: Add your feature description"
   ```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Examples:
```
feat: Add support for .jsx files
fix: Resolve path normalization on Windows
docs: Update USAGE guide with new examples
refactor: Extract AST parsing logic
```

## Code Style

### TypeScript Guidelines

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use interfaces for public APIs
- Document complex logic with comments
- Run `npm run lint` before opening a PR
- Use `npm run format` to apply Biome formatting when needed

Example:
```typescript
/**
 * Generate a context bundle from a codebase
 * @param path - Directory to scan
 * @param options - Bundle generation options
 * @returns Promise resolving to context bundle
 */
export async function generateContext(
  path: string,
  options: ContextOptions
): Promise<LogicStampBundle[]> {
  // Implementation
}
```

### File Organization

- One main export per file
- Group related functions
- Keep files under 500 lines
- Use barrel exports for modules

### Naming Conventions

- Files: `camelCase.ts`
- Functions: `camelCase()`
- Types/Interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

## Testing

The project includes a comprehensive test suite with **153 passing tests** covering CLI commands, core modules, and edge cases.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

The test suite includes:
- **E2E tests**: Full CLI workflow testing (context compilation, validation, comparison, cleaning)
- **Unit tests**: Core module testing (AST parsing, contract building, dependency graphs)
- **Integration tests**: End-to-end pipeline verification
- **Determinism tests**: Ensuring consistent output across runs

See [`tests/README.md`](../tests/README.md) for detailed test documentation.

### Before Submitting a PR

Ensure all checks pass:

```bash
npm run lint
npm run build
npm test
```

For manual verification, you can also test manually:

- [ ] Basic context compilation: `stamp context`
- [ ] Custom directory: `stamp context ./src`
- [ ] All profiles: `--profile llm-safe/llm-chat/ci-strict/watch-fast`
- [ ] Code modes: `--include-code none/header/full`
- [ ] Output formats: `--format json/pretty/ndjson/toon`
- [ ] Depth traversal: `--depth 0/1/2`
- [ ] Help command: `--help`
- [ ] Error cases: Empty directory, invalid paths

## Documentation

### Updating Documentation

When adding features, update:

1. **README.md** - Main documentation
2. **docs/guides/usage.md** - Detailed usage guide
3. **CHANGELOG.md** - Version history
4. **CLI help text** - In `src/cli/index.ts`

### Documentation Style

- Use clear, concise language
- Provide examples for all features
- Include both simple and advanced use cases
- Add troubleshooting sections

## Pull Request Process

1. **Before submitting:**
   - Ensure code builds successfully: `npm run build`
   - Test thoroughly (see checklist above)
   - Update relevant documentation
   - Update CHANGELOG.md

2. **PR Description should include:**
   - What problem does this solve?
   - What changes were made?
   - How to test the changes?
   - Any breaking changes?

3. **PR Review:**
   - Maintainers will review your PR
   - Address feedback promptly
   - Keep PR focused on one feature/fix

## Feature Requests

Have an idea? We'd love to hear it!

1. Check existing issues first
2. Open a new issue with:
   - Clear description of the feature
   - Use cases and benefits
   - Potential implementation approach

## Bug Reports

Found a bug? Help us fix it!

1. Check if it's already reported
2. Open an issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version)
   - Sample code or project if possible

## Release Process

(For maintainers)

Releases publish to npm when you push a tag matching `v*.*.*` (see **Release** in GitHub Actions). **Do not create a tag until after the version bump is on `main`**, especially with **squash merge**: the tag must point at the squash commit on `main`, not at an old branch tip.

1. **Branch from `main`**, bump `"version"` in `package.json`, update **`CHANGELOG.md`**, then refresh the lockfile:

   ```bash
   git checkout main && git pull origin main
   git checkout -b chore/release-0.8.4   # rename to match the version

   npm install   # sync package-lock.json after the version change
   git add CHANGELOG.md package.json package-lock.json
   git commit -m "chore: release v0.8.4"
   git push -u origin chore/release-0.8.4
   ```

2. Open a PR to **`main`**, wait for CI, **squash merge**.

3. **Tag from updated `main`** (so the tag matches `package.json` on the commit you merged):

   ```bash
   git checkout main && git pull origin main
   git tag "v$(node -p "require('./package.json').version")"
   git push origin "v$(node -p "require('./package.json').version")"
   ```

   The tag must be `vMAJOR.MINOR.PATCH` and **exactly match** `package.json` (no `v` in the file). The release workflow errors if they differ.

4. In **Actions**, confirm the **Release** run for that tag and **Publish to npm** succeeded.

Trusted Publishing on [npmjs.com](https://www.npmjs.com/) must list this GitHub repo and workflow file **`release.yml`**. Rename the workflow file on GitHub only after updating npm.

**Emergency:** If Actions is down, you may `npm publish` locally **once** for that version—avoid double-publishing the same version; use tokens/2FA as npm requires for your package.

## Questions?

- Open an issue for questions
- Check existing documentation
- Review closed issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Your contributions make this project better for everyone. Thank you for taking the time to contribute!
