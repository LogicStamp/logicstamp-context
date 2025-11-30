import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractShadcnUI } from '../../../src/core/styleExtractor/shadcn.js';

describe('ShadCN/UI Extractor', () => {
  describe('Component Detection', () => {
    it('should detect ShadCN components from @/components/ui imports', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';
        import { Card, CardHeader, CardContent } from '@/components/ui/card';

        export function App() {
          return (
            <Card>
              <CardHeader>Title</CardHeader>
              <CardContent>
                <Button>Click me</Button>
              </CardContent>
            </Card>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.components).toContain('Card');
      expect(result.components).toContain('CardHeader');
      expect(result.components).toContain('CardContent');
    });

    it('should detect ShadCN components from ~/components/ui imports', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogContent } from '~/components/ui/dialog';

        export function App() {
          return (
            <Dialog>
              <DialogContent>Content</DialogContent>
            </Dialog>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.components).toContain('Dialog');
      expect(result.components).toContain('DialogContent');
    });

    it('should detect ShadCN components from relative imports', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Sheet, SheetContent } from '../components/ui/sheet';

        export function App() {
          return (
            <Sheet>
              <SheetContent>Content</SheetContent>
            </Sheet>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.components).toContain('Sheet');
      expect(result.components).toContain('SheetContent');
    });

    it('should detect components from JSX usage even without explicit imports', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';

        export function App() {
          return (
            <>
              <Button>Primary</Button>
              <Badge>New</Badge>
              <Alert>
                <AlertTitle>Warning</AlertTitle>
              </Alert>
            </>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.components).toContain('Badge');
      expect(result.components).toContain('Alert');
      expect(result.components).toContain('AlertTitle');
    });

    it('should handle empty component list', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function App() {
          return <div>No ShadCN components</div>;
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.components).toEqual([]);
    });
  });

  describe('Variant Detection', () => {
    it('should extract variant prop values', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';

        export function App() {
          return (
            <>
              <Button variant="default">Default</Button>
              <Button variant="destructive">Delete</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.variants).toBeDefined();
      expect(result.variants.button).toContain('default');
      expect(result.variants.button).toContain('destructive');
      expect(result.variants.button).toContain('outline');
      expect(result.variants.button).toContain('ghost');
    });

    it('should categorize variants by component type', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';
        import { Badge } from '@/components/ui/badge';

        export function App() {
          return (
            <>
              <Button variant="primary">Button</Button>
              <Badge variant="destructive">Badge</Badge>
            </>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.variants.button).toBeDefined();
      expect(result.variants.badge).toBeDefined();
    });

    it('should handle no variants', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';

        export function App() {
          return <Button>No variant</Button>;
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(Object.keys(result.variants)).toHaveLength(0);
    });
  });

  describe('Size Detection', () => {
    it('should extract size prop values', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';

        export function App() {
          return (
            <>
              <Button size="default">Default</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button size="icon">Icon</Button>
            </>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.sizes).toContain('default');
      expect(result.sizes).toContain('sm');
      expect(result.sizes).toContain('lg');
      expect(result.sizes).toContain('icon');
    });

    it('should filter out non-standard sizes', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';

        export function App() {
          return (
            <>
              <Button size="sm">Small</Button>
              <Button size="custom-size">Custom</Button>
            </>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.sizes).toContain('sm');
      expect(result.sizes).not.toContain('custom-size');
    });

    it('should handle no sizes', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';

        export function App() {
          return <Button>No size</Button>;
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.sizes).toEqual([]);
    });
  });

  describe('Feature Detection', () => {
    it('should detect form usage', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { useForm } from 'react-hook-form';
        import { Form, FormField } from '@/components/ui/form';

        export function App() {
          const form = useForm();
          return (
            <Form>
              <FormField name="email" />
            </Form>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.features.usesForm).toBe(true);
    });

    it('should detect theme usage', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { useTheme } from 'next-themes';
        import { Button } from '@/components/ui/button';

        export function App() {
          const { theme } = useTheme();
          return <Button className="dark:bg-gray-900">Toggle</Button>;
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect icon usage', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Check, X } from 'lucide-react';
        import { Button } from '@/components/ui/button';

        export function App() {
          return (
            <Button>
              <Check />
              Confirm
            </Button>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.features.usesIcons).toBe(true);
    });

    it('should calculate component density - low', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';

        export function App() {
          return <Button>Click</Button>;
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.features.componentDensity).toBe('low');
    });

    it('should calculate component density - medium', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';
        import { Card, CardHeader, CardContent } from '@/components/ui/card';
        import { Input } from '@/components/ui/input';

        export function App() {
          return (
            <Card>
              <CardHeader>Form</CardHeader>
              <CardContent>
                <Input />
                <Button>Submit</Button>
              </CardContent>
            </Card>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.features.componentDensity).toBe('medium');
    });

    it('should calculate component density - high', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';
        import { Card, CardHeader, CardContent } from '@/components/ui/card';
        import { Input } from '@/components/ui/input';
        import { Label } from '@/components/ui/label';
        import { Select } from '@/components/ui/select';
        import { Checkbox } from '@/components/ui/checkbox';
        import { Dialog } from '@/components/ui/dialog';
        import { Sheet } from '@/components/ui/sheet';
        import { Tabs } from '@/components/ui/tabs';

        export function App() {
          return (
            <Card>
              <CardHeader>Complex Form</CardHeader>
              <CardContent>
                <Label />
                <Input />
                <Select />
                <Checkbox />
                <Dialog />
                <Sheet />
                <Tabs />
                <Button>Submit</Button>
              </CardContent>
            </Card>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.features.componentDensity).toBe('high');
    });
  });

  describe('Integration', () => {
    it('should extract complete ShadCN metadata from realistic component', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { useForm } from 'react-hook-form';
        import { useTheme } from 'next-themes';
        import { Check } from 'lucide-react';
        import { Button } from '@/components/ui/button';
        import { Card, CardHeader, CardContent } from '@/components/ui/card';
        import { Form, FormField } from '@/components/ui/form';
        import { Input } from '@/components/ui/input';

        export function LoginForm() {
          const form = useForm();
          const { theme } = useTheme();

          return (
            <Card className="dark:bg-gray-900">
              <CardHeader>Login</CardHeader>
              <CardContent>
                <Form>
                  <FormField name="email">
                    <Input />
                  </FormField>
                  <Button variant="default" size="lg">
                    <Check />
                    Submit
                  </Button>
                  <Button variant="ghost" size="sm">Cancel</Button>
                </Form>
              </CardContent>
            </Card>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      // Components
      expect(result.components).toContain('Button');
      expect(result.components).toContain('Card');
      expect(result.components).toContain('Form');
      expect(result.components).toContain('Input');

      // Variants
      expect(result.variants.button).toContain('default');
      expect(result.variants.button).toContain('ghost');

      // Sizes
      expect(result.sizes).toContain('lg');
      expect(result.sizes).toContain('sm');

      // Features
      expect(result.features.usesForm).toBe(true);
      expect(result.features.usesTheme).toBe(true);
      expect(result.features.usesIcons).toBe(true);
      // The component has 8 unique components: Button, Card, CardHeader, CardContent, Form, FormField, Input, Check
      // which is exactly on the boundary for 'medium' (4-8 components)
      expect(result.features.componentDensity).toBe('medium');
    });
  });

  describe('Import Aliases', () => {
    it('should detect components with aliased imports', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button as UIPrimaryButton } from '@/components/ui/button';
        import { Card as ContainerCard } from '@/components/ui/card';

        export function App() {
          return (
            <ContainerCard>
              <UIPrimaryButton>Click me</UIPrimaryButton>
            </ContainerCard>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      // Should detect the canonical component names, not just the aliases
      expect(result.components).toContain('Button');
      expect(result.components).toContain('Card');
    });

    it('should track variant usage with aliased components', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button as PrimaryButton } from '@/components/ui/button';

        export function App() {
          return (
            <PrimaryButton variant="destructive">Delete</PrimaryButton>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.variants.button).toContain('destructive');
    });
  });

  describe('Component Usage Frequency', () => {
    it('should sort components by usage frequency, not alphabetically', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';
        import { Card } from '@/components/ui/card';
        import { Input } from '@/components/ui/input';

        export function App() {
          return (
            <>
              <Button>1</Button>
              <Button>2</Button>
              <Button>3</Button>
              <Button>4</Button>
              <Card>Card</Card>
              <Input />
            </>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      // Button: import (+1) + 4 JSX uses (+4) = 5 total
      // Card: import (+1) + 1 JSX use (+1) = 2 total
      // Input: import (+1) + 1 JSX use (+1) = 2 total
      // Button should appear first due to higher frequency
      // Card and Input should be sorted alphabetically when tied
      expect(result.components[0]).toBe('Button');
      // Alphabetically, Card comes before Input
      expect(result.components).toContain('Card');
      expect(result.components).toContain('Input');
    });
  });

  describe('Card Variant Handling', () => {
    it('should accept custom Card variants without filtering', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Card } from '@/components/ui/card';

        export function App() {
          return (
            <>
              <Card variant="custom-elevated">Custom 1</Card>
              <Card variant="shadow-heavy">Custom 2</Card>
            </>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      // Card should accept any variant value (custom variants are common)
      expect(result.variants.card).toContain('custom-elevated');
      expect(result.variants.card).toContain('shadow-heavy');
    });

    it('should still filter other component variants strictly', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';

        export function App() {
          return (
            <>
              <Button variant="default">Valid</Button>
              <Button variant="custom-button-variant">Invalid</Button>
            </>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      // Button should only include known variants
      expect(result.variants.button).toContain('default');
      expect(result.variants.button).not.toContain('custom-button-variant');
    });
  });

  describe('Theme Detection', () => {
    it('should detect ThemeProvider import', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { ThemeProvider } from '@/components/theme-provider';
        import { Button } from '@/components/ui/button';

        export function App() {
          return (
            <ThemeProvider>
              <Button>Click</Button>
            </ThemeProvider>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect ThemeProvider from next-themes', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { ThemeProvider } from 'next-themes';
        import { Button } from '@/components/ui/button';

        export function App() {
          return (
            <ThemeProvider>
              <Button>Click</Button>
            </ThemeProvider>
          );
        }
        `
      );

      const result = extractShadcnUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSX gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Malformed JSX - unclosed tag
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';
        
        export function Component() {
          return (
            <Button variant="default"
          );
        }
        `
      );

      // Should not throw, should return empty object or partial results
      const result = extractShadcnUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(Array.isArray(result.components)).toBe(true);
    });

    it('should handle SourceFile with syntax errors gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Invalid TypeScript syntax
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';
        function Component() {
          return <Button
        // Missing closing
        `
      );

      // Should not throw, should return empty object or partial results
      const result = extractShadcnUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(Array.isArray(result.components)).toBe(true);
    });

    it('should handle empty SourceFile gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractShadcnUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(result.components).toEqual([]);
      expect(result.variants).toEqual({});
      expect(result.sizes).toEqual([]);
      expect(result.features).toEqual({});
    });

    it('should handle SourceFile with invalid import declarations gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';
        function Component() {
          return <Button>Hello</Button>;
        }
        `
      );

      // Should handle gracefully even if AST traversal has issues
      const result = extractShadcnUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should handle AST traversal errors gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Code that might cause AST traversal issues
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';
        function Component() {
          const invalid = (() => { throw new Error('test'); })();
          return <Button className={invalid}>Content</Button>;
        }
        `
      );

      // Should not throw, should handle gracefully
      const result = extractShadcnUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should handle complex AST traversal errors in feature detection', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Code that might cause issues in feature detection
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Button } from '@/components/ui/button';
        function Component() {
          return (
            <div>
              <Button>Test</Button>
              {(() => { throw new Error('test'); })()}
            </div>
          );
        }
        `
      );

      // Should not throw, should return partial results
      const result = extractShadcnUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(Array.isArray(result.components)).toBe(true);
    });
  });
});
