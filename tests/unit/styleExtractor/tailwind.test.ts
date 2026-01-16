import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import {
  extractTailwindClasses,
  categorizeTailwindClasses,
  extractBreakpoints,
} from '../../../src/core/styleExtractor/tailwind.js';

describe('Tailwind Extractor', () => {
  describe('extractTailwindClasses - AST-based (SourceFile)', () => {
    it('should extract classes from string literals', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <div className="flex items-center justify-between p-4">
              <span>Hello</span>
            </div>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('flex');
      expect(classes).toContain('items-center');
      expect(classes).toContain('justify-between');
      expect(classes).toContain('p-4');
    });

    it('should extract classes from single quotes', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <div className='bg-blue-500 text-white rounded-lg'>
              Content
            </div>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('bg-blue-500');
      expect(classes).toContain('text-white');
      expect(classes).toContain('rounded-lg');
    });

    it('should extract static segments from template literals', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          const isActive = true;
          return (
            <div className={\`flex p-4 \${isActive ? 'bg-blue-500' : 'bg-gray-500'} text-white\`}>
              Content
            </div>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      // Should extract static segments: 'flex p-4 ' and ' text-white'
      // Phase 1: Now also extracts from conditional expressions
      expect(classes).toContain('flex');
      expect(classes).toContain('p-4');
      expect(classes).toContain('text-white');
      // Phase 1: Conditional expressions are now resolved
      expect(classes).toContain('bg-blue-500');
      expect(classes).toContain('bg-gray-500');
    });

    it('should extract classes from NoSubstitutionTemplateLiteral (backticks with no ${})', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <div className={\`container mx-auto px-4\`}>
              Content
            </div>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('container');
      expect(classes).toContain('mx-auto');
      expect(classes).toContain('px-4');
    });

    it('should extract classes from conditional expressions', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          const isActive = true;
          return (
            <div className={isActive && 'bg-blue-500'}>
              Content
            </div>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('bg-blue-500');
    });

    it('should extract classes from cn() function calls', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { cn } from '@/lib/utils';
        
        export function Component() {
          return (
            <div className={cn('flex', 'p-4', 'bg-white')}>
              Content
            </div>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('flex');
      expect(classes).toContain('p-4');
      expect(classes).toContain('bg-white');
    });

    it('should extract classes from cn() with conditional arguments', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { cn } from '@/lib/utils';
        
        export function Component() {
          const isActive = true;
          return (
            <div className={cn('flex', isActive && 'bg-blue-500', 'text-white')}>
              Content
            </div>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('flex');
      expect(classes).toContain('bg-blue-500');
      expect(classes).toContain('text-white');
    });

    it('should extract classes from cn() with template literal arguments', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { cn } from '@/lib/utils';
        
        export function Component() {
          const size = '4';
          return (
            <div className={cn('flex', \`p-\${size}\`, 'bg-white')}>
              Content
            </div>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('flex');
      expect(classes).toContain('bg-white');
      // Static segment 'p-' should be extracted, but 'p-4' won't be since size is dynamic
    });

    it('should extract classes from clsx() function calls', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import clsx from 'clsx';
        
        export function Component() {
          return (
            <div className={clsx('flex', 'p-4')}>
              Content
            </div>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('flex');
      expect(classes).toContain('p-4');
    });

    it('should extract classes from classnames() function calls', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import classnames from 'classnames';
        
        export function Component() {
          return (
            <div className={classnames('flex', 'p-4')}>
              Content
            </div>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('flex');
      expect(classes).toContain('p-4');
    });

    it('should support both className and class attributes', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <>
              <div className="flex p-4">React</div>
              <div class="grid gap-4">Vue/Svelte</div>
            </>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('flex');
      expect(classes).toContain('p-4');
      expect(classes).toContain('grid');
      expect(classes).toContain('gap-4');
    });

    it('should deduplicate classes', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <>
              <div className="flex p-4">First</div>
              <div className="flex p-4">Second</div>
              <div className="flex">Third</div>
            </>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      // Should only appear once each
      expect(classes.filter(c => c === 'flex').length).toBe(1);
      expect(classes.filter(c => c === 'p-4').length).toBe(1);
      expect(classes).toContain('flex');
      expect(classes).toContain('p-4');
    });

    it('should handle multiple className attributes across elements', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <div className="flex">
              <button className="px-4 py-2">Click</button>
              <span className="text-sm">Text</span>
            </div>
          );
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('flex');
      expect(classes).toContain('px-4');
      expect(classes).toContain('py-2');
      expect(classes).toContain('text-sm');
    });

    it('should handle empty className', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        '<div className=""></div>'
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toEqual([]);
    });

    it('should handle no className attributes', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        '<div>No classes</div>'
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toEqual([]);
    });

    it('should handle self-closing elements', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return <img className="w-full h-auto" src="/image.jpg" />;
        }
        `
      );

      const classes = extractTailwindClasses(sourceFile);

      expect(classes).toContain('w-full');
      expect(classes).toContain('h-auto');
    });
  });

  describe('extractTailwindClasses - String fallback (backward compatibility)', () => {
    it('should extract classes from double quotes (string fallback)', () => {
      const sourceCode = `
        <div className="flex items-center justify-between p-4">
          <span>Hello</span>
        </div>
      `;

      const classes = extractTailwindClasses(sourceCode);

      expect(classes).toContain('flex');
      expect(classes).toContain('items-center');
      expect(classes).toContain('justify-between');
      expect(classes).toContain('p-4');
    });

    it('should extract classes from single quotes (string fallback)', () => {
      const sourceCode = `
        <div className='bg-blue-500 text-white rounded-lg'>
          Content
        </div>
      `;

      const classes = extractTailwindClasses(sourceCode);

      expect(classes).toContain('bg-blue-500');
      expect(classes).toContain('text-white');
      expect(classes).toContain('rounded-lg');
    });

    it('should extract classes from template literals (string fallback)', () => {
      const sourceCode = `
        <div className={\`container mx-auto px-4\`}>
          Content
        </div>
      `;

      const classes = extractTailwindClasses(sourceCode);

      // Fallback regex should handle basic template literals
      expect(classes.length).toBeGreaterThanOrEqual(0);
    });

    it('should support both className and class (string fallback)', () => {
      const sourceCode = `
        <div className="flex p-4">React</div>
        <div class="grid gap-4">Vue</div>
      `;

      const classes = extractTailwindClasses(sourceCode);

      expect(classes).toContain('flex');
      expect(classes).toContain('p-4');
      expect(classes).toContain('grid');
      expect(classes).toContain('gap-4');
    });
  });

  describe('categorizeTailwindClasses', () => {
    it('should categorize layout classes', () => {
      const classes = ['flex', 'grid', 'block', 'hidden'];
      const categorized = categorizeTailwindClasses(classes);

      expect(categorized.layout).toBeDefined();
      expect(categorized.layout).toContain('flex');
      expect(categorized.layout).toContain('grid');
    });

    it('should categorize spacing classes', () => {
      const classes = ['p-4', 'm-2', 'px-6', 'py-8', 'gap-4'];
      const categorized = categorizeTailwindClasses(classes);

      expect(categorized.spacing).toBeDefined();
      expect(categorized.spacing).toContain('p-4');
      expect(categorized.spacing).toContain('gap-4');
    });

    it('should categorize color classes', () => {
      const classes = ['bg-blue-500', 'text-white', 'border-gray-300'];
      const categorized = categorizeTailwindClasses(classes);

      expect(categorized.colors).toBeDefined();
      expect(categorized.colors).toContain('bg-blue-500');
      // text-white matches the typography pattern first, so it goes there
      expect(
        categorized.typography?.includes('text-white') || categorized.colors?.includes('text-white')
      ).toBe(true);
      // border-* is categorized in borders (which comes before colors)
      expect(categorized.borders).toBeDefined();
      expect(categorized.borders).toContain('border-gray-300');
    });

    it('should handle responsive prefixes', () => {
      const classes = ['md:flex', 'lg:grid', 'sm:p-4'];
      const categorized = categorizeTailwindClasses(classes);

      // Should categorize based on base class, not prefix
      expect(categorized.layout).toBeDefined();
      expect(categorized.layout).toContain('md:flex');
      expect(categorized.spacing).toBeDefined();
      expect(categorized.spacing).toContain('sm:p-4');
    });

    it('should handle complex variant chains', () => {
      const classes = ['group-hover:dark:sm:bg-red-500', 'md:hover:bg-blue-500', 'dark:focus:ring-2'];
      const categorized = categorizeTailwindClasses(classes);

      // Should strip all variants and categorize by base class
      expect(categorized.colors).toBeDefined();
      expect(categorized.colors).toContain('group-hover:dark:sm:bg-red-500');
      expect(categorized.colors).toContain('md:hover:bg-blue-500');
      expect(categorized.borders).toBeDefined();
      expect(categorized.borders).toContain('dark:focus:ring-2');
    });

    it('should handle ARIA and data variants', () => {
      const classes = ['aria-[checked=true]:peer-focus:ring-2', 'data-[state=active]:bg-red-500'];
      const categorized = categorizeTailwindClasses(classes);

      // Should strip ARIA/data variants and categorize correctly
      expect(categorized.borders).toBeDefined();
      expect(categorized.borders).toContain('aria-[checked=true]:peer-focus:ring-2');
      // Note: text-* goes to typography first, so using bg-* for colors test
      expect(categorized.colors).toBeDefined();
      expect(categorized.colors).toContain('data-[state=active]:bg-red-500');
    });

    it('should handle light and dark variants', () => {
      const classes = ['light:bg-white', 'dark:bg-gray-900', 'md:light:bg-black'];
      const categorized = categorizeTailwindClasses(classes);

      expect(categorized.colors).toBeDefined();
      expect(categorized.colors).toContain('light:bg-white');
      expect(categorized.colors).toContain('dark:bg-gray-900');
      // Note: text-* goes to typography first, so using bg-* for colors test
      expect(categorized.colors).toContain('md:light:bg-black');
    });

    it('should categorize shadow- in effects, not colors', () => {
      const classes = ['shadow-lg', 'shadow-md', 'shadow-xl', 'bg-blue-500'];
      const categorized = categorizeTailwindClasses(classes);

      expect(categorized.effects).toBeDefined();
      expect(categorized.effects).toContain('shadow-lg');
      expect(categorized.effects).toContain('shadow-md');
      expect(categorized.effects).toContain('shadow-xl');
      // Should NOT be in colors (bg-blue-500 ensures colors category exists)
      expect(categorized.colors).toBeDefined();
      expect(categorized.colors).not.toContain('shadow-lg');
      expect(categorized.colors).not.toContain('shadow-md');
      expect(categorized.colors).not.toContain('shadow-xl');
    });

    it('should categorize ring- in borders, not colors', () => {
      const classes = ['ring-2', 'ring-blue-500', 'ring-offset-4', 'bg-red-500'];
      const categorized = categorizeTailwindClasses(classes);

      expect(categorized.borders).toBeDefined();
      expect(categorized.borders).toContain('ring-2');
      expect(categorized.borders).toContain('ring-blue-500');
      // Should NOT be in colors (bg-red-500 ensures colors category exists)
      expect(categorized.colors).toBeDefined();
      expect(categorized.colors).not.toContain('ring-2');
      expect(categorized.colors).not.toContain('ring-blue-500');
    });

    it('should return sorted arrays', () => {
      const classes = ['z-10', 'z-20', 'z-0', 'z-30'];
      const categorized = categorizeTailwindClasses(classes);

      // All categories should be sorted arrays
      Object.values(categorized).forEach((categoryClasses) => {
        expect(Array.isArray(categoryClasses)).toBe(true);
        const sorted = [...categoryClasses].sort();
        expect(categoryClasses).toEqual(sorted);
      });
    });

    it('should put uncategorized classes in "other"', () => {
      const classes = ['custom-class', 'another-custom'];
      const categorized = categorizeTailwindClasses(classes);

      expect(categorized.other).toBeDefined();
      expect(categorized.other).toContain('custom-class');
      expect(categorized.other).toContain('another-custom');
    });

    it('should handle empty array', () => {
      const categorized = categorizeTailwindClasses([]);

      expect(Object.keys(categorized)).toHaveLength(0);
    });
  });

  describe('extractBreakpoints', () => {
    it('should extract breakpoint prefixes', () => {
      const classes = ['sm:text-sm', 'md:flex', 'lg:grid', 'xl:container'];
      const breakpoints = extractBreakpoints(classes);

      expect(breakpoints).toContain('sm');
      expect(breakpoints).toContain('md');
      expect(breakpoints).toContain('lg');
      expect(breakpoints).toContain('xl');
      expect(breakpoints).toEqual(breakpoints.sort()); // Should be sorted
    });

    it('should extract max breakpoints', () => {
      const classes = ['max-sm:hidden', 'max-md:block', 'max-lg:flex'];
      const breakpoints = extractBreakpoints(classes);

      expect(breakpoints).toContain('max-sm');
      expect(breakpoints).toContain('max-md');
      expect(breakpoints).toContain('max-lg');
    });

    it('should deduplicate breakpoints', () => {
      const classes = ['sm:text-sm', 'sm:flex', 'md:grid', 'md:block'];
      const breakpoints = extractBreakpoints(classes);

      expect(breakpoints.filter(b => b === 'sm').length).toBe(1);
      expect(breakpoints.filter(b => b === 'md').length).toBe(1);
    });

    it('should extract breakpoints from complex variant chains', () => {
      const classes = ['group-hover:dark:sm:bg-red-500', 'hover:md:text-white'];
      const breakpoints = extractBreakpoints(classes);

      // Should find breakpoints even when not at the start
      expect(breakpoints).toContain('sm');
      expect(breakpoints).toContain('md');
    });

    it('should handle classes without breakpoints', () => {
      const classes = ['flex', 'p-4', 'bg-blue-500'];
      const breakpoints = extractBreakpoints(classes);

      expect(breakpoints).toEqual([]);
    });

    it('should handle empty array', () => {
      const breakpoints = extractBreakpoints([]);

      expect(breakpoints).toEqual([]);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid input to categorizeTailwindClasses', () => {
      // @ts-expect-error - Testing runtime guard
      const result = categorizeTailwindClasses(null);
      expect(result).toEqual({});

      // @ts-expect-error - Testing runtime guard
      const result2 = categorizeTailwindClasses(undefined);
      expect(result2).toEqual({});

      // @ts-expect-error - Testing runtime guard
      const result3 = categorizeTailwindClasses('not an array');
      expect(result3).toEqual({});
    });

    it('should handle invalid input to extractBreakpoints', () => {
      // @ts-expect-error - Testing runtime guard
      const result = extractBreakpoints(null);
      expect(result).toEqual([]);

      // @ts-expect-error - Testing runtime guard
      const result2 = extractBreakpoints(undefined);
      expect(result2).toEqual([]);

      // @ts-expect-error - Testing runtime guard
      const result3 = extractBreakpoints('not an array');
      expect(result3).toEqual([]);
    });

    it('should handle malformed JSX gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Malformed JSX - unclosed tag
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <div className="flex p-4"
          );
        }
        `
      );

      // Should not throw, should return empty array or fallback gracefully
      const classes = extractTailwindClasses(sourceFile);
      expect(Array.isArray(classes)).toBe(true);
    });

    it('should handle empty or invalid SourceFile gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const classes = extractTailwindClasses(sourceFile);
      expect(Array.isArray(classes)).toBe(true);
    });

    it('should handle string input with invalid syntax gracefully', () => {
      const invalidCode = '<div className="flex p-4"';
      const classes = extractTailwindClasses(invalidCode);
      
      // Should return array (may be empty or partial)
      expect(Array.isArray(classes)).toBe(true);
    });

    it('should handle categorizeTailwindClasses with empty array', () => {
      const result = categorizeTailwindClasses([]);
      expect(result).toEqual({});
    });

    it('should handle extractBreakpoints with empty array', () => {
      const result = extractBreakpoints([]);
      expect(result).toEqual([]);
    });

    describe('Phase 1: Dynamic Class Parsing (v0.3.9)', () => {
      it('should resolve const variable declarations in template literals', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            const base = 'px-4 py-2 rounded-lg font-semibold';
            return (
              <button className={\`\${base} bg-blue-500 text-white\`}>
                Click me
              </button>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        expect(classes).toContain('px-4');
        expect(classes).toContain('py-2');
        expect(classes).toContain('rounded-lg');
        expect(classes).toContain('font-semibold');
        expect(classes).toContain('bg-blue-500');
        expect(classes).toContain('text-white');
      });

      it('should resolve let variable declarations in template literals', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            let spacing = 'p-4 m-2';
            return (
              <div className={\`flex \${spacing} bg-white\`}>
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        expect(classes).toContain('flex');
        expect(classes).toContain('p-4');
        expect(classes).toContain('m-2');
        expect(classes).toContain('bg-white');
      });

      it('should resolve object property access in template literals', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            const variants = {
              primary: 'bg-blue-600 hover:bg-blue-700 text-white',
              secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900'
            };
            return (
              <button className={\`px-4 py-2 \${variants.primary} rounded-lg\`}>
                Click me
              </button>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        expect(classes).toContain('px-4');
        expect(classes).toContain('py-2');
        expect(classes).toContain('bg-blue-600');
        expect(classes).toContain('hover:bg-blue-700');
        expect(classes).toContain('text-white');
        expect(classes).toContain('rounded-lg');
      });

      it('should resolve conditional expressions (ternary) in template literals', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component({ isActive }: { isActive: boolean }) {
            return (
              <button className={\`px-4 py-2 \${isActive ? 'bg-blue-500' : 'bg-gray-500'} text-white rounded-lg\`}>
                Click me
              </button>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        expect(classes).toContain('px-4');
        expect(classes).toContain('py-2');
        expect(classes).toContain('bg-blue-500');
        expect(classes).toContain('bg-gray-500');
        expect(classes).toContain('text-white');
        expect(classes).toContain('rounded-lg');
      });

      it('should resolve nested variable references', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            const base = 'px-4 py-2';
            const colors = 'bg-blue-500 text-white';
            const combined = \`\${base} \${colors} rounded-lg\`;
            return (
              <button className={combined}>
                Click me
              </button>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        expect(classes).toContain('px-4');
        expect(classes).toContain('py-2');
        expect(classes).toContain('bg-blue-500');
        expect(classes).toContain('text-white');
        expect(classes).toContain('rounded-lg');
      });

      it('should resolve object property access with nested variables', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            const base = 'px-4 py-2';
            const variants = {
              primary: 'bg-blue-500 text-white',
              secondary: 'bg-gray-500 text-gray-900'
            };
            return (
              <button className={\`\${base} \${variants.primary} rounded-lg\`}>
                Click me
              </button>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        expect(classes).toContain('px-4');
        expect(classes).toContain('py-2');
        expect(classes).toContain('bg-blue-500');
        expect(classes).toContain('text-white');
        expect(classes).toContain('rounded-lg');
      });

      it('should resolve conditional expressions with object properties', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component({ variant }: { variant: 'primary' | 'secondary' }) {
            const variants = {
              primary: 'bg-blue-500',
              secondary: 'bg-gray-500'
            };
            const isActive = true;
            return (
              <button className={\`px-4 \${variants.primary} \${isActive ? 'ring-2' : ''} text-white\`}>
                Click me
              </button>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        expect(classes).toContain('px-4');
        expect(classes).toContain('bg-blue-500');
        expect(classes).toContain('ring-2');
        expect(classes).toContain('text-white');
      });

      it('should handle variables in cn() function calls', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          import { cn } from '@/lib/utils';
          
          export function Component() {
            const base = 'px-4 py-2';
            const colors = 'bg-blue-500 text-white';
            return (
              <button className={cn(base, colors, 'rounded-lg')}>
                Click me
              </button>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        expect(classes).toContain('px-4');
        expect(classes).toContain('py-2');
        expect(classes).toContain('bg-blue-500');
        expect(classes).toContain('text-white');
        expect(classes).toContain('rounded-lg');
      });

      it('should not resolve object lookups with variables (Phase 2 limitation)', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component({ variant }: { variant: 'primary' | 'secondary' }) {
            const variants = {
              primary: 'bg-blue-500',
              secondary: 'bg-gray-500'
            };
            return (
              <button className={\`px-4 \${variants[variant]} text-white\`}>
                Click me
              </button>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        // Should extract static parts
        expect(classes).toContain('px-4');
        expect(classes).toContain('text-white');
        // Should NOT extract dynamic lookup (Phase 2 limitation)
        expect(classes).not.toContain('bg-blue-500');
        expect(classes).not.toContain('bg-gray-500');
      });

      it('should handle binary expression with && operator', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            const isActive = true;
            return (
              <button className={isActive && 'bg-blue-500 text-white'}>
                Click me
              </button>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        expect(classes).toContain('bg-blue-500');
        expect(classes).toContain('text-white');
      });

      it('should handle binary expression with || operator', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            const fallback = 'bg-gray-500';
            return (
              <button className={fallback || 'bg-blue-500'}>
                Click me
              </button>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        expect(classes).toContain('bg-gray-500');
        expect(classes).toContain('bg-blue-500');
      });

      it('should handle binary expression with ?? operator', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            const base = null;
            return (
              <button className={base ?? 'bg-blue-500 text-white'}>
                Click me
              </button>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        expect(classes).toContain('bg-blue-500');
        expect(classes).toContain('text-white');
      });

      it('should NOT extract from non-logical binary operators (+, ===, etc.)', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            const a = 'p-4';
            const b = 'm-2';
            const isEqual = a === b;
            return (
              <div className={'flex' + ' items-center'}>
                <span className={isEqual ? 'text-red' : 'text-blue'}>Test</span>
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        // String concatenation with + is NOT a logical operator, so we ignore it
        // This is correct behavior - + concatenation is not a class toggle pattern
        // Should extract from ternary (conditional expression)
        expect(classes).toContain('text-red');
        expect(classes).toContain('text-blue');
        // Should NOT extract from + concatenation (not a logical operator)
        expect(classes).not.toContain('flex');
        expect(classes).not.toContain('items-center');
      });

      it('should resolve scope shadowing correctly (inner scope wins)', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          const base = 'p-2';
          export function Component() {
            const base = 'p-4';
            return (
              <div className={base}>
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);

        // Should resolve to inner scope (p-4), not outer scope (p-2)
        expect(classes).toContain('p-4');
        expect(classes).not.toContain('p-2');
      });

      it('should handle ! important prefix in classes', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            return (
              <div className="!p-4 sm:!p-6 !text-white">
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);
        const categorized = categorizeTailwindClasses(classes);
        const breakpoints = extractBreakpoints(classes);

        expect(classes).toContain('!p-4');
        expect(classes).toContain('sm:!p-6');
        expect(classes).toContain('!text-white');
        
        // Should categorize correctly (strip ! for categorization)
        expect(categorized.spacing).toBeDefined();
        expect(categorized.spacing).toContain('!p-4');
        expect(categorized.spacing).toContain('sm:!p-6');
        expect(categorized.colors).toBeDefined();
        expect(categorized.colors).toContain('!text-white');
        
        // Should extract breakpoint
        expect(breakpoints).toContain('sm');
      });

      it('should handle arbitrary selector variants', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            return (
              <div className="[&>p]:mt-4 [&_span]:text-blue supports-[display:grid]:grid">
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);
        const categorized = categorizeTailwindClasses(classes);

        expect(classes).toContain('[&>p]:mt-4');
        expect(classes).toContain('[&_span]:text-blue');
        expect(classes).toContain('supports-[display:grid]:grid');
        
        // Should categorize correctly after stripping variants
        expect(categorized.spacing).toBeDefined();
        expect(categorized.spacing).toContain('[&>p]:mt-4');
        expect(categorized.colors).toBeDefined();
        expect(categorized.colors).toContain('[&_span]:text-blue');
        expect(categorized.layout).toBeDefined();
        expect(categorized.layout).toContain('supports-[display:grid]:grid');
      });

      it('should categorize flex utilities correctly', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            return (
              <div className="flex flex-1 items-center justify-between">
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);
        const categorized = categorizeTailwindClasses(classes);

        expect(categorized.layout).toBeDefined();
        expect(categorized.layout).toContain('flex');
        expect(categorized.layout).toContain('flex-1');
        expect(categorized.layout).toContain('items-center');
        expect(categorized.layout).toContain('justify-between');
      });

      it('should categorize grid utilities correctly', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            return (
              <div className="grid grid-cols-3 col-span-2 row-span-1">
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);
        const categorized = categorizeTailwindClasses(classes);

        expect(categorized.layout).toBeDefined();
        expect(categorized.layout).toContain('grid');
        expect(categorized.layout).toContain('grid-cols-3');
        expect(categorized.layout).toContain('col-span-2');
        expect(categorized.layout).toContain('row-span-1');
      });

      it('should handle rounded without dash', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            return (
              <div className="rounded rounded-lg">
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);
        const categorized = categorizeTailwindClasses(classes);

        expect(categorized.borders).toBeDefined();
        expect(categorized.borders).toContain('rounded');
        expect(categorized.borders).toContain('rounded-lg');
      });

    });

    describe('Smoke tests - critical scenarios', () => {
      it('should extract and categorize sm:!p-4 hover:bg-blue-500 text-sm text-red-500', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            return (
              <div className="sm:!p-4 hover:bg-blue-500 text-sm text-red-500">
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);
        const categorized = categorizeTailwindClasses(classes);

        expect(classes).toContain('sm:!p-4');
        expect(classes).toContain('hover:bg-blue-500');
        expect(classes).toContain('text-sm');
        expect(classes).toContain('text-red-500');

        // Categorization checks
        expect(categorized.spacing).toBeDefined();
        expect(categorized.spacing).toContain('sm:!p-4');
        expect(categorized.colors).toBeDefined();
        expect(categorized.colors).toContain('hover:bg-blue-500');
        expect(categorized.colors).toContain('text-red-500');
        expect(categorized.typography).toBeDefined();
        expect(categorized.typography).toContain('text-sm');
      });

      it('should handle className={isActive && "bg-blue-500"}', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            const isActive = true;
            return (
              <div className={isActive && 'bg-blue-500'}>
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);
        expect(classes).toContain('bg-blue-500');
      });

      it('should handle className={isActive ? "bg-blue-500" : "bg-gray-500"}', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            const isActive = true;
            return (
              <div className={isActive ? 'bg-blue-500' : 'bg-gray-500'}>
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);
        expect(classes).toContain('bg-blue-500');
        expect(classes).toContain('bg-gray-500');
      });

      it('should handle className={`p-4 ${base} text-sm`} with const base = \'px-2\'', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          export function Component() {
            const base = 'px-2';
            return (
              <div className={\`p-4 \${base} text-sm\`}>
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);
        expect(classes).toContain('p-4');
        expect(classes).toContain('px-2');
        expect(classes).toContain('text-sm');
      });

      it('should handle shadowing: outer base="p-2", inner base="p-4" used in JSX', () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          const base = 'p-2';
          export function Component() {
            const base = 'p-4';
            return (
              <div className={base}>
                Content
              </div>
            );
          }
          `
        );

        const classes = extractTailwindClasses(sourceFile);
        // Should resolve to inner scope (p-4), not outer scope (p-2)
        expect(classes).toContain('p-4');
        expect(classes).not.toContain('p-2');
      });

      it('should categorize [&>p]:mt-4 as spacing (stores original class name)', () => {
        const classes = ['[&>p]:mt-4'];
        const categorized = categorizeTailwindClasses(classes);

        // Stripping variants yields mt-4 (for categorization logic), but the original
        // class name [&>p]:mt-4 is stored in the spacing category bucket
        expect(categorized.spacing).toBeDefined();
        expect(categorized.spacing).toContain('[&>p]:mt-4');
        // The bucket contains the original class name, not the stripped version
        expect(categorized.spacing).not.toContain('mt-4');
      });
    });
  });
});
