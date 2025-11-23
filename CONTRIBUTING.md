# Contributing to LogicStamp Context

Thank you for your interest in contributing! This document provides guidelines for contributing to logicstamp-context.

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
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
logicstamp-context --help
```

## Branching Strategy

This repository uses a **simple feature → `main` branching model** for both:

- **LogicStamp Bundle** (npm package)
- **LogicStamp Site** (`logicstamp.dev`)

There is **no `develop` branch**. All changes go through short‑lived feature branches into `main`.

---

## 1. LogicStamp Bundle (npm package)

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

When you want to publish a new version:

```bash
# From main, with a clean working tree
git checkout main
git pull origin main

# Bump version (pick one)
npm version patch   # or: minor / major

# Push commit + tag
git push --follow-tags

# Publish to npm
npm publish
```

`main` always reflects what is currently released (or ready to be released), and Git tags map to npm versions.

---

## 2. LogicStamp Site (`logicstamp.dev`)

The site uses the same **feature → `main`** model, but “releases” are deployments.

### Branches

- **`main`** – deployed to **production** via Vercel
- **`feature/*`** – new sections, design tweaks, docs changes

### Typical flow

1. **Create a feature branch from `main`:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/update-landing-copy
   ```

2. Make changes, commit, and push the branch.
3. **Open a PR targeting `main`.**
4. Vercel creates a **preview deployment** for the PR.
5. If the preview looks good and checks pass, **merge into `main`**.
6. `main` deploys automatically to production.

No `develop` branch is needed; PR previews act as the staging environment.

---

## 3. Branch Protection & Conventions

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

## 4. Best Practices

1. **Keep branches short‑lived** – merge within days, not weeks.
2. **One change per branch** – avoid mixing unrelated work.
3. **Sync with `main` regularly** – `git pull --rebase origin main` on feature branches.
4. **Always use PRs** – even for maintainers.
5. **Use preview deploys** (site) to validate UX and docs before merging.
6. **Tag bundle releases** on `main` so they map cleanly to npm versions.

This lightweight strategy keeps both repos simple while still being safe and review‑friendly.

## Project Structure

```
logicstamp-context/
├── src/
│   ├── cli/           # CLI entry point
│   │   └── index.ts   # Main CLI logic
│   ├── core/          # Core functionality
│   │   ├── astParser.ts      # TypeScript AST parsing
│   │   ├── contractBuilder.ts # Contract generation
│   │   ├── manifest.ts        # Dependency graph
│   │   ├── pack.ts            # Context bundling
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
- **E2E tests**: Full CLI workflow testing (context generation, validation, comparison, cleaning)
- **Unit tests**: Core module testing (AST parsing, contract building, dependency graphs)
- **Integration tests**: End-to-end pipeline verification
- **Determinism tests**: Ensuring consistent output across runs

See [`tests/README.md`](../tests/README.md) for detailed test documentation.

### Before Submitting a PR

Ensure all tests pass:

```bash
npm run build
npm test
```

For manual verification, you can also test manually:

- [ ] Basic context generation: `stamp context`
- [ ] Custom directory: `stamp context ./src`
- [ ] All profiles: `--profile llm-safe/llm-chat/ci-strict`
- [ ] Code modes: `--include-code none/header/full`
- [ ] Output formats: `--format json/pretty/ndjson`
- [ ] Depth traversal: `--depth 0/1/2`
- [ ] Help command: `--help`
- [ ] Error cases: Empty directory, invalid paths

## Documentation

### Updating Documentation

When adding features, update:

1. **README.md** - Main documentation
2. **docs/USAGE.md** - Detailed usage guide
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

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Build: `npm run build`
4. Commit: `git commit -am "Release v0.x.0"`
5. Tag: `git tag v0.x.0`
6. Push: `git push && git push --tags`
7. Publish: `npm publish`

## Questions?

- Open an issue for questions
- Check existing documentation
- Review closed issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Your contributions make this project better for everyone. Thank you for taking the time to contribute!
