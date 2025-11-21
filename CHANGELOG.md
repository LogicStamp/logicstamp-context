# Changelog

All notable changes to `logicstamp-context` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] – 2025-01-15

### Added
- Initial standalone release of LogicStamp Context.
- Scans React/TypeScript codebases and generates AI-friendly context bundles.
- New per-folder `context.json` and root-level `context_main.json` structure for deterministic project mapping.
- AST-based component analysis (no pre-compilation required).
- Three preset profiles: `llm-safe`, `llm-chat`, `ci-strict`.
- Code inclusion modes: `none`, `header`, `full`.
- Output formats: `json`, `pretty`, `ndjson`.
- Depth-based dependency traversal.
- Deterministic bundle and semantic hashing.
- Missing dependency tracking with diagnostics.
- Standalone CLI with a comprehensive help system.
- Cross-platform path normalization.
- In-memory contract generation pipeline.
- Zero configuration required.
- Works on any React/TypeScript project.

### Features
- Outputs ready for AI tools (Claude, ChatGPT, Cursor, VS Code assistants).
- Fast analysis: ~3–5 seconds for typical 50–150 file projects.
- Designed for reproducibility and CI integration.

### Documentation
- Complete README with installation, usage, and examples.
- Detailed USAGE guide covering all CLI flags and profiles.
- Example `context.json` output for quick reference.
- MIT License included.

## [Unreleased]

### Planned
- Watch mode for continuous generation.
- Custom profile configuration and overrides.
- Bundle caching.
- Output size optimization.
- Additional output formats.
- Integration examples for popular AI assistants.

### Known Limitations (to be addressed)
- No watch mode yet.
- No incremental caching.
- No custom profiles beyond the three presets.
