# GitHub Secret Scanning False Positives

How to handle false positives from GitHub's secret scanning when working with LogicStamp Context's security scanning features.

**For contributors only** — this only affects the LogicStamp Context repository (and forks), not people using the CLI in their own projects.

**No real credentials are stored in this repository** — all flagged patterns are detection code or test data.

## Overview

GitHub's push protection may flag patterns in this repository as potential secrets. These are false positives from:

1. **Secret detection patterns** in `src/utils/secretDetector.ts` — regex patterns that match secret formats but don't contain actual secrets
2. **Test files** — fake secret patterns (e.g., `FAKE_SECRET_KEY_...`) used to verify detection works
3. **Security reports** — generated reports that document detected patterns (excluded from version control)

All flagged patterns are detection code or test data, not actual credentials.

## Common False Positive Scenarios

### Detection Pattern False Positives

The `src/utils/secretDetector.ts` file contains regex patterns that detect secret formats (AWS keys, GitHub tokens, etc.). These patterns don't contain real secrets — they're just detection logic. They're intentionally obfuscated using string concatenation at runtime, but GitHub's scanner may still flag them.

They're safe because:
- Patterns are built dynamically (no hardcoded secrets)
- These are detection patterns, not actual credentials

Example obfuscation:
```typescript
pattern: (() => {
  const part1 = 'A'.concat('K');
  const part2 = 'I'.concat('A');
  return new RegExp(part1 + part2 + '[0-9A-Z]{16}');
})(),
```

### Test File False Positives

Test files contain fake secret patterns (e.g., `FAKE_SECRET_KEY_...`) to verify detection works. They're intentionally fake and safe to commit.

### Security Report False Positives

Generated security reports (in `tests/e2e/output/`) may reference detected patterns. We exclude these reports in `.gitignore`, so they won't trigger false positives.

## Resolution

### If GitHub Blocks Your Push

If GitHub blocks your push, check that the flagged content is from a test file or detection pattern. Then use GitHub's bypass option to confirm it's a false positive and continue with your push.

### For Repository Administrators

If this keeps happening, you can tweak GitHub's push protection settings:

1. Go to **Settings** → **Code security and analysis** → **Push protection**
2. Configure exceptions for known false positive patterns
3. Consider allowlisting files like `src/utils/secretDetector.ts` if needed

### Still Having Issues?

- Contact GitHub Support with context about detection patterns or test files
- Make sure security reports are in `.gitignore` so they're excluded

## Prevention

We minimize false positives by:
- Excluding security reports in `.gitignore` (`stamp_security_report.json`)
- Using `FAKE_*` prefixes for fake secrets in test files
- Obfuscating detection patterns with string concatenation
- Excluding generated output directories from version control

## Related Documentation

- [`docs/cli/security-scan.md`](./cli/security-scan.md) - Security scanning feature documentation
- `.gitignore` - Lists excluded files and directories

