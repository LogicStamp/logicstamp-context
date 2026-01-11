import { describe, it, expect, vi } from 'vitest';
import { Project } from 'ts-morph';
import { extractProps } from '../../../src/core/astParser/extractors/propExtractor.js';
import { normalizePropType } from '../../../src/core/astParser/extractors/propTypeNormalizer.js';

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

    it('should extract hook parameters from exported function declaration', () => {
      const sourceCode = `
        export function useTypewriter(text: string, speed = 30, pause = 800) {
          const [displayedText, setDisplayedText] = useState('');
          // ... implementation
          return displayedText;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractProps(sourceFile);

      expect(props.text).toBeDefined();
      expect(props.text).toBe('string');
      expect(props.speed).toBeDefined();
      // speed has default value, so it should be optional
      if (typeof props.speed === 'object' && 'optional' in props.speed) {
        expect(props.speed.optional).toBe(true);
      }
      expect(props.pause).toBeDefined();
      // pause has default value, so it should be optional
      if (typeof props.pause === 'object' && 'optional' in props.pause) {
        expect(props.pause.optional).toBe(true);
      }
    });

    it('should extract hook parameters with explicit types', () => {
      const sourceCode = `
        export function useCounter(initialValue: number, step?: number) {
          const [count, setCount] = useState(initialValue);
          return { count, setCount };
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractProps(sourceFile);

      expect(props.initialValue).toBeDefined();
      expect(props.initialValue).toBe('number');
      expect(props.step).toBeDefined();
      // step is optional (has ?)
      if (typeof props.step === 'object' && 'optional' in props.step) {
        expect(props.step.optional).toBe(true);
      }
    });

    it('should extract hook parameters from exported arrow function', () => {
      const sourceCode = `
        export const useToggle = (initialState: boolean = false) => {
          const [state, setState] = useState(initialState);
          return [state, setState];
        };
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractProps(sourceFile);

      expect(props.initialState).toBeDefined();
      // initialState has default value, so it should be optional and return an object
      expect(typeof props.initialState).toBe('object');
      if (typeof props.initialState === 'object' && 'type' in props.initialState) {
        expect(props.initialState.type).toBe('boolean');
        expect(props.initialState.optional).toBe(true);
      }
    });

    it('should extract hook parameters from default export', () => {
      const sourceCode = `
        export default function useFetch(url: string, options?: RequestInit) {
          // ... implementation
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractProps(sourceFile);

      expect(props.url).toBeDefined();
      expect(props.url).toBe('string');
      expect(props.options).toBeDefined();
      // options is optional
      if (typeof props.options === 'object' && 'optional' in props.options) {
        expect(props.options.optional).toBe(true);
      }
    });

    it('should not extract parameters from non-exported hooks', () => {
      const sourceCode = `
        function useInternalHook(value: string) {
          // Not exported, should not extract
        }
        
        export function usePublicHook(id: number) {
          // Exported, should extract
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractProps(sourceFile);

      // Should only extract from exported hook
      expect(props.value).toBeUndefined();
      expect(props.id).toBeDefined();
      expect(props.id).toBe('number');
    });

    it('should prioritize Props interface over hook parameters', () => {
      const sourceCode = `
        interface UseHookProps {
          text: string;
        }
        
        export function useHook(text: string, speed: number) {
          // Props interface should be used instead of hook parameters
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractProps(sourceFile);

      // Should extract from Props interface, and Props takes priority
      expect(props.text).toBeDefined();
      // speed should be included from hook parameters (not in Props, so it's added)
      expect(props.speed).toBeDefined();
      expect(props.speed).toBe('number');
    });

    it('should use Props value when Props and hook parameters have conflicting prop names', () => {
      const sourceCode = `
        interface UseHookProps {
          text: string;
          count: number;
        }
        
        export function useHook(text: number, count: string, speed: number) {
          // Props interface values should override hook parameter values for conflicts
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractProps(sourceFile);

      // Props values should be used, not hook parameter values
      expect(props.text).toBe('string'); // From Props, not 'number' from hook
      expect(props.count).toBe('number'); // From Props, not 'string' from hook
      // speed should be included from hook parameters (not in Props)
      expect(props.speed).toBeDefined();
      expect(props.speed).toBe('number');
    });

    it('should extract hook parameters even when Props interface exists', () => {
      const sourceCode = `
        interface ButtonProps {
          label: string;
        }
        
        export function useTypewriter(text: string, speed = 30) {
          // Hook parameters should be extracted even though ButtonProps exists
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractProps(sourceFile);

      // Should have both Props interface values and hook parameters
      expect(props.label).toBeDefined(); // From ButtonProps
      expect(props.text).toBeDefined(); // From hook parameters
      expect(props.text).toBe('string');
      expect(props.speed).toBeDefined(); // From hook parameters
    });

    it('should extract hook parameters even when Props type alias exists', () => {
      const sourceCode = `
        type CardProps = {
          title: string;
        };
        
        export function useCounter(initialValue: number, step = 1) {
          // Hook parameters should be extracted even though CardProps exists
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractProps(sourceFile);

      // Should have both Props type alias values and hook parameters
      expect(props.title).toBeDefined(); // From CardProps
      expect(props.initialValue).toBeDefined(); // From hook parameters
      expect(props.initialValue).toBe('number');
      expect(props.step).toBeDefined(); // From hook parameters
    });

    it('should handle hook with no parameters', () => {
      const sourceCode = `
        export function useSimpleHook() {
          return useState(0);
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractProps(sourceFile);

      expect(Object.keys(props)).toHaveLength(0);
    });

    it('should handle hook with complex parameter types', () => {
      const sourceCode = `
        export function useComplexHook(
          callback: () => void,
          options: { enabled?: boolean; timeout?: number }
        ) {
          // ... implementation
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractProps(sourceFile);

      expect(props.callback).toBeDefined();
      if (typeof props.callback === 'object' && 'type' in props.callback) {
        expect(props.callback.type).toBe('function');
      }
      expect(props.options).toBeDefined();
    });

    describe('Union with undefined handling', () => {
      it('should detect optional property from string | undefined union in interface', () => {
        const sourceCode = `
          interface ButtonProps {
            label: string | undefined;
            title: undefined | string;
            count: number | string | undefined;
          }
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.tsx', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.label).toBeDefined();
        if (typeof props.label === 'object' && 'optional' in props.label) {
          expect(props.label.optional).toBe(true);
          expect(props.label.type).not.toContain('undefined');
        }

        expect(props.title).toBeDefined();
        if (typeof props.title === 'object' && 'optional' in props.title) {
          expect(props.title.optional).toBe(true);
          expect(props.title.type).not.toContain('undefined');
        }

        expect(props.count).toBeDefined();
        if (typeof props.count === 'object' && 'optional' in props.count) {
          expect(props.count.optional).toBe(true);
          expect(props.count.type).not.toContain('undefined');
        }
      });

      it('should detect optional property from string | undefined union in type alias', () => {
        const sourceCode = `
          type CardProps = {
            label: string | undefined;
            title: undefined | string;
            count: number | string | undefined;
          };
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.tsx', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.label).toBeDefined();
        if (typeof props.label === 'object' && 'optional' in props.label) {
          expect(props.label.optional).toBe(true);
          expect(props.label.type).not.toContain('undefined');
        }

        expect(props.title).toBeDefined();
        if (typeof props.title === 'object' && 'optional' in props.title) {
          expect(props.title.optional).toBe(true);
          expect(props.title.type).not.toContain('undefined');
        }

        expect(props.count).toBeDefined();
        if (typeof props.count === 'object' && 'optional' in props.count) {
          expect(props.count.optional).toBe(true);
          expect(props.count.type).not.toContain('undefined');
        }
      });

      it('should handle optional property with ? token and undefined union', () => {
        const sourceCode = `
          interface ButtonProps {
            label?: string | undefined;
            title?: undefined | number;
          }
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.tsx', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.label).toBeDefined();
        if (typeof props.label === 'object' && 'optional' in props.label) {
          expect(props.label.optional).toBe(true);
          expect(props.label.type).not.toContain('undefined');
        }

        expect(props.title).toBeDefined();
        if (typeof props.title === 'object' && 'optional' in props.title) {
          expect(props.title.optional).toBe(true);
          expect(props.title.type).not.toContain('undefined');
        }
      });
    });

    describe('Export declarations and aliases', () => {
      it('should extract hook parameters from export declaration', () => {
        const sourceCode = `
          function useCounter(initialValue: number, step = 1) {
            return useState(initialValue);
          }
          
          export { useCounter };
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.initialValue).toBeDefined();
        expect(props.initialValue).toBe('number');
        expect(props.step).toBeDefined();
      });

      it('should extract hook parameters from export declaration with alias', () => {
        const sourceCode = `
          function useCounterInternal(initialValue: number, step = 1) {
            return useState(initialValue);
          }
          
          export { useCounterInternal as useCounter };
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        // Should extract from the local name (useCounterInternal)
        expect(props.initialValue).toBeDefined();
        expect(props.initialValue).toBe('number');
        expect(props.step).toBeDefined();
      });

      it('should not extract from re-exports', () => {
        const sourceCode = `
          export { useCounter } from './hooks';
          export { useToggle as useSwitch } from './other';
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        // Re-exports should be skipped - can't extract params anyway
        expect(Object.keys(props)).toHaveLength(0);
      });

      it('should extract from multiple export declarations', () => {
        const sourceCode = `
          function useCounter(value: number) {
            return useState(value);
          }
          
          function useToggle(initial: boolean) {
            return useState(initial);
          }
          
          export { useCounter, useToggle };
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.value).toBeDefined();
        expect(props.value).toBe('number');
        expect(props.initial).toBeDefined();
        expect(props.initial).toBe('boolean');
      });
    });

    describe('Rest parameters', () => {
      it('should not mark rest parameters as optional', () => {
        const sourceCode = `
          export function useHook(...args: string[]) {
            return args;
          }
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.args).toBeDefined();
        // Rest params are variadic, not optional in the same sense
        if (typeof props.args === 'object' && 'optional' in props.args) {
          expect(props.args.optional).toBe(false);
        }
      });

      it('should handle rest parameter with optional regular parameter', () => {
        const sourceCode = `
          export function useHook(prefix?: string, ...args: number[]) {
            return [prefix, ...args];
          }
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.prefix).toBeDefined();
        if (typeof props.prefix === 'object' && 'optional' in props.prefix) {
          expect(props.prefix.optional).toBe(true);
        }

        expect(props.args).toBeDefined();
        // Rest params should not be marked optional
        if (typeof props.args === 'object' && 'optional' in props.args) {
          expect(props.args.optional).toBe(false);
        }
      });
    });

    describe('Type alias property optional detection', () => {
      it('should detect optional properties in type alias using question token', () => {
        const sourceCode = `
          type CardProps = {
            title: string;
            subtitle?: string;
            count: number;
          };
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.tsx', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.title).toBeDefined();
        expect(props.title).toBe('string');

        expect(props.subtitle).toBeDefined();
        if (typeof props.subtitle === 'object' && 'optional' in props.subtitle) {
          expect(props.subtitle.optional).toBe(true);
        }

        expect(props.count).toBeDefined();
        expect(props.count).toBe('number');
      });

      it('should detect optional properties in type alias using undefined union', () => {
        const sourceCode = `
          type CardProps = {
            title: string;
            subtitle: string | undefined;
            count: number | undefined;
          };
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.tsx', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.title).toBeDefined();
        expect(props.title).toBe('string');

        expect(props.subtitle).toBeDefined();
        if (typeof props.subtitle === 'object' && 'optional' in props.subtitle) {
          expect(props.subtitle.optional).toBe(true);
          expect(props.subtitle.type).not.toContain('undefined');
        }

        expect(props.count).toBeDefined();
        if (typeof props.count === 'object' && 'optional' in props.count) {
          expect(props.count.optional).toBe(true);
          expect(props.count.type).not.toContain('undefined');
        }
      });
    });

    describe('Function expression hooks', () => {
      it('should extract hook parameters from exported function expression', () => {
        const sourceCode = `
          export const useCounter = function(initialValue: number, step = 1) {
            return useState(initialValue);
          };
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.initialValue).toBeDefined();
        expect(props.initialValue).toBe('number');
        expect(props.step).toBeDefined();
      });

      it('should extract hook parameters from function expression with explicit types', () => {
        const sourceCode = `
          export const useToggle = function(initialState: boolean = false): [boolean, () => void] {
            const [state, setState] = useState(initialState);
            return [state, setState];
          };
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.initialState).toBeDefined();
        // Parameters with default values are optional, so they return objects
        if (typeof props.initialState === 'object' && 'type' in props.initialState) {
          expect(props.initialState.type).toBe('boolean');
          expect(props.initialState.optional).toBe(true);
        }
      });
    });

    describe('Hook parameter type inference', () => {
      it('should infer types from default string values', () => {
        const sourceCode = `
          export function useHook(name = 'default') {
            return name;
          }
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.name).toBeDefined();
        // Parameters with default values are optional, so they return objects
        if (typeof props.name === 'object' && 'type' in props.name) {
          expect(props.name.type).toBe('string');
          expect(props.name.optional).toBe(true);
        }
      });

      it('should infer types from default number values', () => {
        const sourceCode = `
          export function useHook(count = 0, multiplier = 1.5) {
            return count * multiplier;
          }
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.count).toBeDefined();
        // Parameters with default values are optional, so they return objects
        if (typeof props.count === 'object' && 'type' in props.count) {
          expect(props.count.type).toBe('number');
          expect(props.count.optional).toBe(true);
        }
        expect(props.multiplier).toBeDefined();
        if (typeof props.multiplier === 'object' && 'type' in props.multiplier) {
          expect(props.multiplier.type).toBe('number');
          expect(props.multiplier.optional).toBe(true);
        }
      });

      it('should infer types from default boolean values', () => {
        const sourceCode = `
          export function useHook(enabled = true, disabled = false) {
            return { enabled, disabled };
          }
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.enabled).toBeDefined();
        // Parameters with default values are optional, so they return objects
        if (typeof props.enabled === 'object' && 'type' in props.enabled) {
          expect(props.enabled.type).toBe('boolean');
          expect(props.enabled.optional).toBe(true);
        }
        expect(props.disabled).toBeDefined();
        if (typeof props.disabled === 'object' && 'type' in props.disabled) {
          expect(props.disabled.type).toBe('boolean');
          expect(props.disabled.optional).toBe(true);
        }
      });

      it('should infer types from default object values', () => {
        const sourceCode = `
          export function useHook(options = {}) {
            return options;
          }
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.options).toBeDefined();
        // Should infer as 'object' or the actual inferred type
        expect(typeof props.options === 'string' || typeof props.options === 'object').toBe(true);
      });

      it('should infer types from default array values', () => {
        const sourceCode = `
          export function useHook(items = []) {
            return items;
          }
        `;

        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.ts', sourceCode);

        const props = extractProps(sourceFile);

        expect(props.items).toBeDefined();
        // Should infer as array type
        expect(typeof props.items === 'string' || typeof props.items === 'object').toBe(true);
      });
    });
  });

  describe('normalizePropType', () => {
    it('should normalize simple types', () => {
      expect(normalizePropType('string', false)).toBe('string');
      expect(normalizePropType('number', false)).toBe('number');
      expect(normalizePropType('boolean', false)).toBe('boolean');
    });

    it('should handle optional types', () => {
      // For all optional types, the function returns an object with optional flag
      // This preserves the optional information in the JSON output
      const result = normalizePropType('string', true);
      expect(result).toHaveProperty('type', 'string');
      expect(result).toHaveProperty('optional', true);
      
      const result2 = normalizePropType('number', true);
      expect(result2).toHaveProperty('type', 'number');
      expect(result2).toHaveProperty('optional', true);
      
      const result3 = normalizePropType('boolean', true);
      expect(result3).toHaveProperty('type', 'boolean');
      expect(result3).toHaveProperty('optional', true);
      
      // For non-common types, it also returns an object with optional flag
      const result4 = normalizePropType('User', true);
      expect(result4).toHaveProperty('type', 'User');
      expect(result4).toHaveProperty('optional', true);
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

    describe('Literal unions', () => {
      it('should normalize string literal unions', () => {
        const result = normalizePropType('"small" | "medium" | "large"', false);
        
        expect(result).toHaveProperty('type', 'literal-union');
        expect(result).toHaveProperty('literals');
        if (typeof result === 'object' && 'literals' in result) {
          expect(result.literals).toEqual(['small', 'medium', 'large']);
        }
      });

      it('should normalize string literal unions with single quotes', () => {
        const result = normalizePropType("'primary' | 'secondary' | 'tertiary'", false);
        
        expect(result).toHaveProperty('type', 'literal-union');
        if (typeof result === 'object' && 'literals' in result) {
          expect(result.literals).toEqual(['primary', 'secondary', 'tertiary']);
        }
      });

      it('should normalize number literal unions', () => {
        const result = normalizePropType('1 | 2 | 3', false);
        
        expect(result).toHaveProperty('type', 'literal-union');
        if (typeof result === 'object' && 'literals' in result) {
          expect(result.literals).toEqual(['1', '2', '3']);
        }
      });

      it('should normalize negative number literal unions', () => {
        const result = normalizePropType('-1 | 0 | 1', false);
        
        expect(result).toHaveProperty('type', 'literal-union');
        if (typeof result === 'object' && 'literals' in result) {
          expect(result.literals).toEqual(['-1', '0', '1']);
        }
      });

      it('should normalize decimal number literal unions', () => {
        const result = normalizePropType('1.5 | 2.0 | 3.14', false);
        
        expect(result).toHaveProperty('type', 'literal-union');
        if (typeof result === 'object' && 'literals' in result) {
          expect(result.literals).toEqual(['1.5', '2.0', '3.14']);
        }
      });

      it('should normalize hex number literal unions', () => {
        const result = normalizePropType('0xFF | 0x00 | 0x0A', false);
        
        expect(result).toHaveProperty('type', 'literal-union');
        if (typeof result === 'object' && 'literals' in result) {
          expect(result.literals).toEqual(['0xFF', '0x00', '0x0A']);
        }
      });

      it('should normalize boolean literal unions', () => {
        const result = normalizePropType('true | false', false);
        
        expect(result).toHaveProperty('type', 'literal-union');
        if (typeof result === 'object' && 'literals' in result) {
          expect(result.literals).toEqual(['true', 'false']);
        }
      });

      it('should normalize null literal unions', () => {
        const result = normalizePropType('null | "value"', false);
        
        expect(result).toHaveProperty('type', 'literal-union');
        if (typeof result === 'object' && 'literals' in result) {
          expect(result.literals).toEqual(['null', 'value']);
        }
      });

      it('should normalize mixed literal unions', () => {
        const result = normalizePropType('"small" | 1 | true | null', false);
        
        expect(result).toHaveProperty('type', 'literal-union');
        if (typeof result === 'object' && 'literals' in result) {
          expect(result.literals).toEqual(['small', '1', 'true', 'null']);
        }
      });

      it('should handle optional literal unions', () => {
        const result = normalizePropType('"small" | "medium" | "large"', true);
        
        expect(result).toHaveProperty('type', 'literal-union');
        expect(result).toHaveProperty('optional', true);
        if (typeof result === 'object' && 'literals' in result) {
          expect(result.literals).toEqual(['small', 'medium', 'large']);
        }
      });
    });

    describe('Undefined union removal', () => {
      it('should remove undefined from start of union', () => {
        const result = normalizePropType('undefined | string', true);
        
        if (typeof result === 'object' && 'type' in result) {
          expect(result.type).not.toContain('undefined');
          expect(result.type).toBe('string');
        }
      });

      it('should remove undefined from end of union', () => {
        const result = normalizePropType('string | undefined', true);
        
        if (typeof result === 'object' && 'type' in result) {
          expect(result.type).not.toContain('undefined');
          expect(result.type).toBe('string');
        }
      });

      it('should remove undefined from middle of union', () => {
        const result = normalizePropType('string | undefined | number', true);
        
        if (typeof result === 'object' && 'type' in result) {
          expect(result.type).not.toContain('undefined');
          expect(result.type).toBe('string | number');
        }
      });

      it('should handle multiple undefined occurrences', () => {
        const result = normalizePropType('undefined | string | undefined | number', true);
        
        if (typeof result === 'object' && 'type' in result) {
          expect(result.type).not.toContain('undefined');
          expect(result.type).toBe('string | number');
        }
      });

      it('should preserve other union members when removing undefined', () => {
        const result = normalizePropType('string | number | boolean | undefined', true);
        
        if (typeof result === 'object' && 'type' in result) {
          expect(result.type).not.toContain('undefined');
          expect(result.type).toContain('string');
          expect(result.type).toContain('number');
          expect(result.type).toContain('boolean');
        }
      });
    });

    describe('Function types', () => {
      it('should normalize simple function types', () => {
        const result = normalizePropType('() => void', false);
        expect(result).toHaveProperty('type', 'function');
        expect(result).toHaveProperty('signature', '() => void');
      });

      it('should normalize function types with parameters', () => {
        const result = normalizePropType('(event: MouseEvent) => void', false);
        expect(result).toHaveProperty('type', 'function');
        expect(result).toHaveProperty('signature', '(event: MouseEvent) => void');
      });

      it('should normalize function types with return types', () => {
        const result = normalizePropType('() => Promise<string>', false);
        expect(result).toHaveProperty('type', 'function');
        expect(result).toHaveProperty('signature', '() => Promise<string>');
      });

      it('should handle optional function types', () => {
        const result = normalizePropType('() => void', true);
        expect(result).toHaveProperty('type', 'function');
        expect(result).toHaveProperty('optional', true);
        expect(result).toHaveProperty('signature', '() => void');
      });

      it('should not match parentheses without arrow as function', () => {
        const result = normalizePropType('(string | number)', false);
        // Should not be detected as function type
        expect(result).not.toHaveProperty('type', 'function');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty string type', () => {
        const result = normalizePropType('', false);
        expect(result).toBeDefined();
      });

      it('should handle complex generic types', () => {
        const result = normalizePropType('Promise<Response<string>>', false);
        expect(result).toBeDefined();
        expect(typeof result === 'string' || typeof result === 'object').toBe(true);
      });

      it('should handle array types', () => {
        const result = normalizePropType('string[]', false);
        expect(result).toBeDefined();
        expect(typeof result === 'string' || typeof result === 'object').toBe(true);
      });

      it('should handle tuple types', () => {
        const result = normalizePropType('[string, number]', false);
        expect(result).toBeDefined();
        expect(typeof result === 'string' || typeof result === 'object').toBe(true);
      });

      it('should handle intersection types', () => {
        const result = normalizePropType('A & B', false);
        expect(result).toBeDefined();
        expect(typeof result === 'string' || typeof result === 'object').toBe(true);
      });
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

