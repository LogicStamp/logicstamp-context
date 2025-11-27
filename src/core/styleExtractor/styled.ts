/**
 * Styled-components/Emotion extractor - Extracts CSS-in-JS library usage
 */

import { SourceFile } from 'ts-morph';

/**
 * Extract styled-components/emotion styled declarations
 */
export function extractStyledComponents(source: SourceFile): {
  components: string[];
  hasTheme: boolean;
  hasCssProps: boolean;
} {
  const sourceText = source.getFullText();
  const components = new Set<string>();

  // Match styled.div`...` or styled(Component)`...` patterns
  const styledPatterns = [
    /styled\.(\w+)`/g,
    /styled\((\w+)\)`/g,
  ];

  for (const pattern of styledPatterns) {
    for (const match of sourceText.matchAll(pattern)) {
      if (match[1]) components.add(match[1]);
    }
  }

  // Check for theme usage
  const hasTheme = /\$\{.*theme\./.test(sourceText) || /useTheme\(\)/.test(sourceText);

  // Check for css prop usage
  const hasCssProps = /css\s*=\s*\{/.test(sourceText) || /css`/.test(sourceText);

  return {
    components: Array.from(components).sort().slice(0, 10),
    hasTheme,
    hasCssProps,
  };
}

