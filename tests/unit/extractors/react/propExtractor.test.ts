/**
 * Unit tests for propExtractor module
 */

import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractProps } from '../../../../src/extractors/react/propExtractor.js';

/**
 * Helper to create a SourceFile from code string
 */
function createSourceFile(code: string, fileName = 'test.tsx') {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      jsx: 2, // React
      target: 99, // ESNext
      strict: true,
    },
  });
  return project.createSourceFile(fileName, code);
}

describe('propExtractor', () => {
  describe('extractProps from interfaces', () => {
    it('should extract props from interface ending with Props', () => {
      const source = createSourceFile(`
        interface ButtonProps {
          label: string;
          disabled: boolean;
        }
        function Button({ label, disabled }: ButtonProps) {
          return <button disabled={disabled}>{label}</button>;
        }
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('label');
      expect(props).toHaveProperty('disabled');
    });

    it('should not extract from interfaces not ending with Props', () => {
      const source = createSourceFile(`
        interface User {
          name: string;
          age: number;
        }
        interface Config {
          theme: string;
        }
      `);

      const props = extractProps(source);
      expect(props).not.toHaveProperty('name');
      expect(props).not.toHaveProperty('age');
      expect(props).not.toHaveProperty('theme');
    });

    it('should handle optional props with question token', () => {
      const source = createSourceFile(`
        interface ComponentProps {
          required: string;
          optional?: number;
        }
      `);

      const props = extractProps(source);
      expect(props.required).toBe('string');
      // Optional props should have optional flag
      expect(typeof props.optional).toBe('object');
      expect((props.optional as any).optional).toBe(true);
    });

    it('should handle optional props with undefined union', () => {
      const source = createSourceFile(`
        interface ComponentProps {
          value: string | undefined;
        }
      `);

      const props = extractProps(source);
      // Should be marked as optional when type includes undefined
      expect(typeof props.value).toBe('object');
      expect((props.value as any).optional).toBe(true);
    });

    it('should extract function props', () => {
      const source = createSourceFile(`
        interface ButtonProps {
          onClick: () => void;
          onHover: (event: MouseEvent) => void;
        }
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('onClick');
      expect(props).toHaveProperty('onHover');
    });

    it('should handle complex types', () => {
      const source = createSourceFile(`
        interface ComponentProps {
          data: { id: string; name: string };
          items: string[];
          callback: (value: number) => Promise<void>;
        }
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('data');
      expect(props).toHaveProperty('items');
      expect(props).toHaveProperty('callback');
    });

    it('should handle literal union types', () => {
      const source = createSourceFile(`
        interface ButtonProps {
          variant: 'primary' | 'secondary' | 'tertiary';
          size: 'sm' | 'md' | 'lg';
        }
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('variant');
      expect(props).toHaveProperty('size');
    });
  });

  describe('extractProps from type aliases', () => {
    it('should extract props from type alias ending with Props', () => {
      const source = createSourceFile(`
        type CardProps = {
          title: string;
          content: string;
        };
        function Card({ title, content }: CardProps) {
          return <div><h1>{title}</h1><p>{content}</p></div>;
        }
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('title');
      expect(props).toHaveProperty('content');
    });

    it('should not extract from type aliases not ending with Props', () => {
      const source = createSourceFile(`
        type User = {
          name: string;
        };
        type Settings = {
          darkMode: boolean;
        };
      `);

      const props = extractProps(source);
      expect(props).not.toHaveProperty('name');
      expect(props).not.toHaveProperty('darkMode');
    });

    it('should handle optional props in type alias', () => {
      const source = createSourceFile(`
        type ComponentProps = {
          required: string;
          optional?: number;
        };
      `);

      const props = extractProps(source);
      expect(props.required).toBe('string');
      expect(typeof props.optional).toBe('object');
      expect((props.optional as any).optional).toBe(true);
    });
  });

  describe('extractProps from hook files', () => {
    it('should extract hook parameters as props', () => {
      const source = createSourceFile(`
        export function useCounter(initialValue: number, step: number = 1) {
          const [count, setCount] = useState(initialValue);
          return { count, increment: () => setCount(c => c + step) };
        }
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('initialValue');
      expect(props).toHaveProperty('step');
    });

    it('should handle optional hook parameters', () => {
      const source = createSourceFile(`
        export function useApi(endpoint: string, options?: RequestInit) {
          return useFetch(endpoint, options);
        }
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('endpoint');
      expect(props).toHaveProperty('options');
      expect(typeof props.options).toBe('object');
      expect((props.options as any).optional).toBe(true);
    });

    it('should handle exported arrow function hooks', () => {
      const source = createSourceFile(`
        export const useToggle = (initial: boolean = false) => {
          const [value, setValue] = useState(initial);
          return [value, () => setValue(v => !v)] as const;
        };
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('initial');
    });

    it('should not extract from non-exported hooks', () => {
      const source = createSourceFile(`
        function useInternal(value: string) {
          return value.toUpperCase();
        }
      `);

      const props = extractProps(source);
      expect(props).not.toHaveProperty('value');
    });

    it('should merge hook params with Props interface (Props take priority)', () => {
      const source = createSourceFile(`
        interface UseAuthProps {
          redirectUrl: string;
        }
        export function useAuth(token: string, redirectUrl?: string) {
          return { isAuthenticated: !!token };
        }
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('token');
      expect(props).toHaveProperty('redirectUrl');
    });
  });

  describe('edge cases', () => {
    it('should return empty object for file without Props', () => {
      const source = createSourceFile(`
        function helper() {
          return 42;
        }
      `);

      const props = extractProps(source);
      expect(props).toEqual({});
    });

    it('should handle multiple Props interfaces', () => {
      const source = createSourceFile(`
        interface ButtonProps {
          label: string;
        }
        interface IconProps {
          name: string;
        }
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('label');
      expect(props).toHaveProperty('name');
    });

    it('should handle case-insensitive Props suffix', () => {
      const source = createSourceFile(`
        interface buttonprops {
          label: string;
        }
        interface ICONPROPS {
          name: string;
        }
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('label');
      expect(props).toHaveProperty('name');
    });

    it('should handle generic props', () => {
      const source = createSourceFile(`
        interface ListProps<T> {
          items: T[];
          renderItem: (item: T) => React.ReactNode;
        }
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('items');
      expect(props).toHaveProperty('renderItem');
    });

    it('should handle intersection types in Props', () => {
      const source = createSourceFile(`
        interface BaseProps {
          id: string;
        }
        type ComponentProps = BaseProps & {
          name: string;
        };
      `);

      const props = extractProps(source);
      expect(props).toHaveProperty('id');
      expect(props).toHaveProperty('name');
    });
  });
});
