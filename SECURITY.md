# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, please report them via email to the maintainers:

**Email**: [Insert your security contact email here]

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

- **Review generated context**: Before sharing `context.json` files, review them to ensure they don't contain sensitive information (API keys, passwords, etc.).

- **Use `.gitignore`**: Ensure `context.json` files are properly ignored if they contain sensitive information.

- **Keep dependencies updated**: Regularly update `logicstamp-context` and its dependencies to receive security patches.

## Security Considerations

LogicStamp Context:

- **Reads source code**: The tool parses your TypeScript/React source files using AST analysis. It does not execute your code.

- **No network access**: The tool operates entirely offline and does not make network requests.

- **No code execution**: LogicStamp Context only analyzes code statically; it never executes your code.

- **Local file access**: The tool reads files from your local filesystem based on the scan path you provide.

