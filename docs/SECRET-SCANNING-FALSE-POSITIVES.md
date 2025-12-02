# GitHub Secret Scanning False Positives

This document explains how to handle false positives from GitHub's secret scanning when working with LogicStamp Context's security scanning features.

## Overview

GitHub's push protection may flag certain patterns in this repository as potential secrets. These are **false positives** caused by:

1. **Secret detection patterns** in `src/utils/secretDetector.ts` that match secret formats (but don't contain actual secrets)
2. **Test files** that contain example/fake secret patterns for testing purposes
3. **Security reports** that document detected patterns (which may reference fake secrets)

All flagged patterns are **detection code or test data**, not actual credentials.

## Common False Positive Scenarios

### Detection Pattern False Positives

The `src/utils/secretDetector.ts` file contains regular expressions that detect secret patterns (AWS keys, GitHub tokens, etc.). These patterns are intentionally obfuscated but may still be flagged by GitHub's scanner.

**Why it's safe:**
- Patterns are constructed dynamically at runtime using string concatenation
- No hardcoded secret values exist in the codebase
- These are detection patterns, not actual secrets

**Example obfuscation:**
```typescript
pattern: (() => {
  const part1 = 'A'.concat('K');
  const part2 = 'I'.concat('A');
  return new RegExp(part1 + part2 + '[0-9A-Z]{16}');
})(),
```

### Test File False Positives

Test files may contain fake secret patterns (e.g., `FAKE_SECRET_KEY_...`) to verify detection works correctly. These are intentionally fake and safe to commit.

### Security Report False Positives

Generated security reports (in `tests/e2e/output/`) may contain references to detected patterns. These reports are excluded from version control via `.gitignore`.

## Resolution

### If Your Push is Blocked

1. **Review the flagged content** — Verify it's from a test file or detection pattern
2. **Use GitHub's bypass option** — When prompted, confirm you understand it's a false positive
3. **Continue with your push**

### For Repository Administrators

To configure push protection exceptions:

1. Go to **Settings** → **Code security and analysis** → **Push protection**
2. Configure exceptions for known false positive patterns
3. Consider allowlisting files like `src/utils/secretDetector.ts` if needed

### Need Help?

If you continue to experience issues:

- Review the flagged content to confirm it's a false positive
- Contact GitHub Support with context about detection patterns or test files
- Check that all security reports are properly excluded via `.gitignore`

## Prevention

To minimize false positives:

- ✅ Security reports are in `.gitignore` (`stamp_security_report.json`)
- ✅ Test files use `FAKE_*` prefixes for fake secrets
- ✅ Detection patterns are obfuscated using string concatenation
- ✅ Generated output directories are excluded from version control

## Related Documentation

- [`docs/cli/security-scan.md`](./cli/security-scan.md) - Security scanning feature documentation
- `.gitignore` - Lists excluded files and directories

