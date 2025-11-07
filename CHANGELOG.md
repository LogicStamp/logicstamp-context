# Changelog

All notable changes to logicstamp-context will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-15

### Added
- Initial release of standalone LogicStamp Context tool
- Scan React/TypeScript codebases and generate AI-friendly context
- AST-based component analysis (no pre-compilation required)
- Three preset profiles: `llm-safe`, `llm-chat`, `ci-strict`
- Code inclusion modes: `none`, `header`, `full`
- Output formats: `json`, `pretty`, `ndjson`
- Depth-based dependency traversal
- Bundle hash generation for cache keys
- Missing dependency tracking
- Comprehensive CLI with help system
- Cross-platform path normalization
- In-memory contract generation
- Deterministic bundle hashing

### Documentation
- Complete README with usage examples
- Detailed USAGE guide with all options
- Example context.json output
- License (MIT)

### Features
- Standalone operation (no LogicStamp CLI required)
- Works on any React/TypeScript project
- Outputs ready for Claude, ChatGPT, and other AI tools
- Performance: ~3-5s for typical projects
- Zero configuration needed

## [Unreleased]

### Planned
- Watch mode for continuous generation
- Custom profile configuration
- Bundle caching
- Output size optimization
- More output format options
- Integration examples for popular AI tools
