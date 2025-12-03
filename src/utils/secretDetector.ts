/**
 * Simple secret detection utilities
 * Detects common patterns for API keys, tokens, passwords, etc.
 */

export interface SecretMatch {
  file: string;
  line: number;
  column: number;
  type: string;
  snippet: string;
  severity: 'high' | 'medium' | 'low';
}

/**
 * Common secret patterns to detect
 */
const SECRET_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  severity: 'high' | 'medium' | 'low';
}> = [
  // API Keys
  {
    name: 'API Key',
    pattern: /['"`]?(?:api[_-]?key|apikey)['"`]?\s*[=:]\s*['"`]?([a-zA-Z0-9_\-]{20,})['"`]?/i,
    severity: 'high',
  },
  // AWS Access Keys
  {
    name: 'AWS Access Key',
    // Pattern obfuscated to avoid GitHub secret scanning false positives
    // This is a detection pattern, not an actual secret
    pattern: (() => {
      const part1 = 'A'.concat('K');
      const part2 = 'I'.concat('A');
      return new RegExp(part1 + part2 + '[0-9A-Z]{16}');
    })(),
    severity: 'high',
  },
  // GitHub Tokens
  {
    name: 'GitHub Token',
    // Pattern obfuscated to avoid GitHub secret scanning false positives
    // This is a detection pattern, not an actual secret
    pattern: (() => {
      const prefixes = [
        'g'.concat('h').concat('p_'),
        'g'.concat('h').concat('o_'),
        'g'.concat('h').concat('u_'),
        'g'.concat('h').concat('s_'),
        'g'.concat('h').concat('r_'),
      ];
      return new RegExp(prefixes.map(prefix => `${prefix}[a-zA-Z0-9]{36}`).join('|'));
    })(),
    severity: 'high',
  },
  // Private Keys
  {
    name: 'Private Key',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
    severity: 'high',
  },
  // Passwords
  {
    name: 'Password',
    pattern: /['"`]?(?:password|passwd|pwd)['"`]?\s*[=:]\s*['"`]?([^\s'"`]{8,})['"`]?/i,
    severity: 'high',
  },
  // Tokens
  {
    name: 'Token',
    pattern: /['"`]?(?:token|bearer)['"`]?\s*[=:]\s*['"`]?([a-zA-Z0-9_\-]{20,})['"`]?/i,
    severity: 'high',
  },
  // OAuth Secrets
  {
    name: 'OAuth Secret',
    pattern: /['"`]?(?:oauth[_-]?secret|client[_-]?secret)['"`]?\s*[=:]\s*['"`]?([a-zA-Z0-9_\-]{16,})['"`]?/i,
    severity: 'high',
  },
  // Database URLs with credentials
  {
    name: 'Database URL with Credentials',
    pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/i,
    severity: 'high',
  },
  // JWT Secrets
  {
    name: 'JWT Secret',
    pattern: /['"`]?(?:jwt[_-]?secret|jwt[_-]?key)['"`]?\s*[=:]\s*['"`]?([a-zA-Z0-9_\-]{16,})['"`]?/i,
    severity: 'high',
  },
  // Generic secrets
  {
    name: 'Secret',
    pattern: /['"`]?(?:secret|secret[_-]?key)['"`]?\s*[=:]\s*['"`]?([a-zA-Z0-9_\-]{16,})['"`]?/i,
    severity: 'medium',
  },
];

/**
 * Scan a file for secrets
 */
export function scanFileForSecrets(
  filePath: string,
  content: string
): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const lines = content.split('\n');
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    for (const { name, pattern, severity } of SECRET_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      
      while ((match = regex.exec(line)) !== null) {
        // Extract snippet (first 100 chars around match)
        const matchStart = Math.max(0, match.index - 20);
        const matchEnd = Math.min(line.length, match.index + match[0].length + 20);
        const snippet = line.slice(matchStart, matchEnd).trim();
        
        matches.push({
          file: filePath,
          line: lineIndex + 1,
          column: match.index + 1,
          type: name,
          snippet,
          severity,
        });
        
        // Prevent infinite loops
        if (!pattern.global) {
          break;
        }
      }
    }
  }
  
  return matches;
}

/**
 * Filter out false positives (common patterns that look like secrets but aren't)
 */
export function filterFalsePositives(matches: SecretMatch[]): SecretMatch[] {
  return matches.filter(match => {
    // Skip if snippet contains common false positive patterns
    const snippet = match.snippet.toLowerCase();
    
    // Skip example/test patterns
    if (snippet.includes('example') || snippet.includes('test') || snippet.includes('sample')) {
      return false;
    }
    
    // Skip if it's clearly a comment or documentation
    if (snippet.includes('//') || snippet.includes('/*') || snippet.includes('*')) {
      // But keep if it's an actual assignment
      if (!snippet.includes('=') && !snippet.includes(':')) {
        return false;
      }
    }
    
    // Skip very short matches (likely false positives)
    if (match.type === 'Secret' && match.snippet.length < 20) {
      return false;
    }
    
    return true;
  });
}

