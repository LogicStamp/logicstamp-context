# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, please report them via email to the maintainers:

**Email**: [logicstamp.dev@gmail.com]

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information with your report:

- The type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## What to Expect

After you submit a security report:

1. **Acknowledgement**: We'll acknowledge your email within 48 hours and provide a more detailed response within 7 days indicating the next steps in handling your report.

2. **Verification**: We'll verify the issue and determine its severity and impact.

3. **Fix Development**: If accepted, we'll develop a fix in a private repository to prevent premature disclosure.

4. **Release**: We'll release a patch version addressing the vulnerability and credit you for the discovery (unless you prefer to remain anonymous).

We appreciate your efforts to responsibly disclose your findings and will make every effort to acknowledge your contributions.

## Security Best Practices

When using LogicStamp Context:

- **Scan trusted codebases only**: The tool reads and processes your source code. Only run it on codebases you trust.

- **Automatic file creation**: The tool automatically creates `context.json` files (one per folder containing components) and a `context_main.json` index file in your project directory when you run `stamp context`. Be aware of where these files are created and review them before committing.

- **Automatic `.gitignore` modifications**: The `stamp init` command will prompt you to add patterns to your `.gitignore` file (or create one if it doesn't exist). These patterns are only added if you answer yes. Your preference is saved for future runs. The `stamp context` command respects these preferences and never prompts (CI-friendly). The following patterns are added:
  - `context.json`
  - `context_*.json` (covers `context_main.json` and other context index files)
  - `*.uif.json`
  - `logicstamp.manifest.json`
  - `.logicstamp/`
  
  Review these changes to ensure they align with your project's needs.

- **Automatic `LLM_CONTEXT.md` creation**: The `stamp init` command will prompt you to create an `LLM_CONTEXT.md` file in your project root. This file is only created if you answer yes. Your preference is saved for future runs. The `stamp context` command respects these preferences and never prompts (CI-friendly). Review this file to ensure it contains appropriate information for your project.

- **Review generated context**: Before sharing `context.json` files, review them to ensure they don't contain sensitive information (API keys, passwords, etc.).

- **Keep dependencies updated**: Regularly update `logicstamp-context` and its dependencies to receive security patches.

## Handling Sensitive Information

🔒 **Sensitive Data / Credentials Handling**

LogicStamp Context does not perform automatic redaction or removal of sensitive information (passwords, API keys, user data, secrets). If such data exists in your source code, it may appear in the generated context bundles. Always review context files before sharing them with external tools or LLMs.

We strongly recommend avoiding hard-coded credentials and using environment variables or secret management tools.

**Security Scanning**: Use the `stamp security scan` command to detect secrets in your codebase before generating context files. The scanner can automatically add files containing secrets to `.stampignore` to prevent them from being included in context generation. See [`docs/cli/security-scan.md`](docs/cli/security-scan.md) for complete documentation.

## Security Considerations

LogicStamp Context:

- **Reads source code**: The tool parses your TypeScript/React source files using AST analysis. It does not execute your code.

- **Never modifies source code**: LogicStamp Context never modifies your existing source files. It only generates new output files and modifies `.gitignore` or creates `LLM_CONTEXT.md` with your explicit approval.

- **No LLM usage**: LogicStamp Context does not use any LLM internally. All analysis is performed through deterministic AST parsing and local static analysis only.

- **No network access**: The tool operates entirely offline and does not make network requests.

- **No code execution**: LogicStamp Context only analyzes code statically; it never executes your code.

- **CI-safe**: LogicStamp Context is safe to run in CI environments because it does not execute user code or make network requests.

- **Local file access**: The tool reads files from your local filesystem based on the scan path you provide.

