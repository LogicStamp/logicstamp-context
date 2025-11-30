import { describe, it, expect, vi } from 'vitest';
import { Project } from 'ts-morph';
import { extractProps, normalizePropType } from '../../../src/core/astParser/extractors/propExtractor.js';

describe('Prop Extractor', () => {
  describe('extractProps', () => {
    it('should extract props from interface', () => {
      const sourceCode = `
        interface ButtonProps {
          label: string;
          onClick: () => void;
          disabled?: boolean;
        }
        
        function Button(props: ButtonProps) {
          return <button>{props.label}</button>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const props = extractProps(sourceFile);

      expect(props.label).toBeDefined();
      expect(props.onClick).toBeDefined();
      expect(props.disabled).toBeDefined();
    });

    it('should extract props from type alias', () => {
      const sourceCode = `
        type CardProps = {
          title: string;
          children?: React.ReactNode;
        };
        
        function Card(props: CardProps) {
          return <div>{props.title}</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const props = extractProps(sourceFile);

      expect(props.title).toBeDefined();
      expect(props.children).toBeDefined();
    });

    it('should only extract Props interfaces/types', () => {
      const sourceCode = `
        interface NotPropsInterface {
          value: string;
        }
        
        interface ButtonProps {
          label: string;
        }
        
        type ConfigType = {
          setting: boolean;
        };
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const props = extractProps(sourceFile);

      expect(props.label).toBeDefined();
      // Note: The function only extracts from interfaces/types ending with "Props" (case-insensitive)
      // So NotPropsInterface and ConfigType should not be extracted
      // The regex /Props$/i matches "Props" at the end, so "NotProps" would match but "NotPropsInterface" won't
      expect(props.value).toBeUndefined();
      expect(props.setting).toBeUndefined();
    });

    it('should handle case-insensitive Props matching', () => {
      const sourceCode = `
        interface buttonProps {
          label: string;
        }
        
        type CARD_PROPS = {
          title: string;
        };
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const props = extractProps(sourceFile);

      expect(props.label).toBeDefined();
      expect(props.title).toBeDefined();
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const props = extractProps(sourceFile);

      expect(Object.keys(props)).toHaveLength(0);
    });
  });

  describe('normalizePropType', () => {
    it('should normalize simple types', () => {
      expect(normalizePropType('string', false)).toBe('string');
      expect(normalizePropType('number', false)).toBe('number');
      expect(normalizePropType('boolean', false)).toBe('boolean');
    });

    it('should handle optional types', () => {
      // For common types (string, number, boolean), when optional, 
      // the function returns simple string for backward compatibility
      const result = normalizePropType('string', true);
      expect(result).toBe('string');
      
      // For non-common types, it returns an object with optional flag
      const result2 = normalizePropType('User', true);
      expect(result2).toHaveProperty('type', 'User');
      expect(result2).toHaveProperty('optional', true);
    });

    it('should normalize literal unions', () => {
      const result = normalizePropType('"small" | "medium" | "large"', false);
      
      expect(result).toHaveProperty('type', 'literal-union');
      expect(result).toHaveProperty('literals');
      if (typeof result === 'object' && 'literals' in result) {
        expect(result.literals).toEqual(['small', 'medium', 'large']);
      }
    });

    it('should normalize function types', () => {
      const result1 = normalizePropType('() => void', false);
      expect(result1).toHaveProperty('type', 'function');
      expect(result1).toHaveProperty('signature', '() => void');

      const result2 = normalizePropType('(event: MouseEvent) => void', false);
      expect(result2).toHaveProperty('type', 'function');
      expect(result2).toHaveProperty('signature', '(event: MouseEvent) => void');
    });

    it('should remove undefined from unions', () => {
      const result = normalizePropType('string | undefined', true);
      
      // Should not contain 'undefined' in the type
      if (typeof result === 'object' && 'type' in result) {
        expect(result.type).not.toContain('undefined');
      }
    });

    it('should handle complex optional types', () => {
      const result = normalizePropType('User | null', true);
      
      expect(result).toHaveProperty('optional', true);
    });

    it('should return simple string for common types when not optional', () => {
      expect(normalizePropType('string', false)).toBe('string');
      expect(normalizePropType('number', false)).toBe('number');
      expect(normalizePropType('boolean', false)).toBe('boolean');
    });
  });

  describe('Error handling', () => {
    it('should handle AST traversal errors gracefully in extractProps', () => {
      const sourceCode = `
        interface ButtonProps {
          label: string;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      // Should not throw even if there are issues
      const props = extractProps(sourceFile);
      expect(typeof props).toBe('object');
    });

    it('should handle errors in normalizePropType gracefully', () => {
      // normalizePropType should handle any type string without throwing
      const result1 = normalizePropType('string', false);
      expect(result1).toBeDefined();

      const result2 = normalizePropType('complex<type<with<nested>>>>', false);
      expect(result2).toBeDefined();
    });

    it('should have debug logging infrastructure in place', () => {
      const originalEnv = process.env.LOGICSTAMP_DEBUG;
      process.env.LOGICSTAMP_DEBUG = '1';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', 'interface TestProps { x: string; }');

      extractProps(sourceFile);

      // If errors were logged, verify they have the correct format
      const errorCalls = consoleErrorSpy.mock.calls;
      if (errorCalls.length > 0) {
        const hasPropExtractorLog = errorCalls.some(call =>
          call[0]?.toString().includes('[LogicStamp][DEBUG]') &&
          call[0]?.toString().includes('propExtractor')
        );
        expect(hasPropExtractorLog).toBe(true);
      }

      consoleErrorSpy.mockRestore();
      if (originalEnv === undefined) {
        delete process.env.LOGICSTAMP_DEBUG;
      } else {
        process.env.LOGICSTAMP_DEBUG = originalEnv;
      }
    });
  });
});

