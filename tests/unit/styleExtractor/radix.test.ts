import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractRadixUI } from '../../../src/core/styleExtractor/radix.js';

describe('Radix UI Extractor', () => {
  describe('Primitive Detection', () => {
    it('should detect Dialog primitives from @radix-ui/react-dialog', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogTrigger, DialogContent, DialogTitle } from '@radix-ui/react-dialog';

        export function App() {
          return (
            <Dialog>
              <DialogTrigger>Open</DialogTrigger>
              <DialogContent>
                <DialogTitle>Title</DialogTitle>
              </DialogContent>
            </Dialog>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.primitives['react-dialog']).toContain('Dialog');
      expect(result.primitives['react-dialog']).toContain('DialogTrigger');
      expect(result.primitives['react-dialog']).toContain('DialogContent');
      expect(result.primitives['react-dialog']).toContain('DialogTitle');
    });

    it('should detect Popover primitives from @radix-ui/react-popover', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover';

        export function App() {
          return (
            <Popover>
              <PopoverTrigger>Click</PopoverTrigger>
              <PopoverContent>Content</PopoverContent>
            </Popover>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.primitives['react-popover']).toContain('Popover');
      expect(result.primitives['react-popover']).toContain('PopoverTrigger');
      expect(result.primitives['react-popover']).toContain('PopoverContent');
    });

    it('should detect multiple Radix packages in same file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogContent } from '@radix-ui/react-dialog';
        import { Tooltip, TooltipTrigger, TooltipContent } from '@radix-ui/react-tooltip';
        import { Tabs, TabsList, TabsTrigger } from '@radix-ui/react-tabs';

        export function App() {
          return (
            <Tabs>
              <TabsList>
                <TabsTrigger>Tab 1</TabsTrigger>
              </TabsList>
              <Tooltip>
                <TooltipTrigger>Hover</TooltipTrigger>
                <TooltipContent>Info</TooltipContent>
              </Tooltip>
              <Dialog>
                <DialogContent>Content</DialogContent>
              </Dialog>
            </Tabs>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.primitives['react-dialog']).toBeDefined();
      expect(result.primitives['react-tooltip']).toBeDefined();
      expect(result.primitives['react-tabs']).toBeDefined();
      expect(result.features.primitiveCount).toBeGreaterThan(5);
    });

    it('should detect namespace imports', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import * as Dialog from '@radix-ui/react-dialog';

        export function App() {
          return (
            <Dialog.Root>
              <Dialog.Trigger>Open</Dialog.Trigger>
              <Dialog.Content>Content</Dialog.Content>
            </Dialog.Root>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.primitives['react-dialog']).toContain('Dialog.*');
    });

    it('should handle empty primitive list', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function App() {
          return <div>No Radix primitives</div>;
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(Object.keys(result.primitives)).toHaveLength(0);
      expect(result.features.primitiveCount).toBeUndefined();
    });
  });

  describe('Control Pattern Detection', () => {
    it('should detect controlled components with multi-line JSX', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogContent } from '@radix-ui/react-dialog';
        import { Tabs, TabsContent } from '@radix-ui/react-tabs';

        export function App() {
          const [open, setOpen] = useState(false);
          const [tab, setTab] = useState('tab1');

          return (
            <>
              <Dialog
                open={open}
                onOpenChange={setOpen}
              >
                <DialogContent>Content</DialogContent>
              </Dialog>
              <Tabs
                value={tab}
                onValueChange={setTab}
              >
                <TabsContent value="tab1">Tab 1</TabsContent>
              </Tabs>
            </>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.patterns.controlled).toContain('Dialog');
      expect(result.patterns.controlled).toContain('Tabs');
    });

    it('should detect controlled components', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogContent } from '@radix-ui/react-dialog';
        import { Tabs, TabsContent } from '@radix-ui/react-tabs';

        export function App() {
          const [open, setOpen] = useState(false);
          const [tab, setTab] = useState('tab1');

          return (
            <>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>Content</DialogContent>
              </Dialog>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsContent value="tab1">Tab 1</TabsContent>
              </Tabs>
            </>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.patterns.controlled).toContain('Dialog');
      expect(result.patterns.controlled).toContain('Tabs');
    });

    it('should detect uncontrolled components', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogContent } from '@radix-ui/react-dialog';
        import { Accordion, AccordionItem } from '@radix-ui/react-accordion';

        export function App() {
          return (
            <>
              <Dialog defaultOpen={true}>
                <DialogContent>Content</DialogContent>
              </Dialog>
              <Accordion defaultValue="item-1">
                <AccordionItem value="item-1">Item</AccordionItem>
              </Accordion>
            </>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.patterns.uncontrolled).toContain('Dialog');
      expect(result.patterns.uncontrolled).toContain('Accordion');
    });

    it('should detect asChild composition pattern', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogTrigger } from '@radix-ui/react-dialog';

        export function App() {
          return (
            <Dialog>
              <DialogTrigger asChild>
                <button>Custom Button</button>
              </DialogTrigger>
            </Dialog>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.patterns.asChild).toBeGreaterThan(0);
    });

    it('should count Portal usage', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogPortal, DialogContent } from '@radix-ui/react-dialog';
        import { Popover, PopoverPortal, PopoverContent } from '@radix-ui/react-popover';

        export function App() {
          return (
            <>
              <Dialog>
                <DialogPortal>
                  <DialogContent>Dialog</DialogContent>
                </DialogPortal>
              </Dialog>
              <Popover>
                <PopoverPortal>
                  <PopoverContent>Popover</PopoverContent>
                </PopoverPortal>
              </Popover>
            </>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.patterns.portals).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Accessibility Detection', () => {
    it('should detect direction support (RTL/LTR)', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogContent } from '@radix-ui/react-dialog';

        export function App() {
          return (
            <Dialog dir="rtl">
              <DialogContent>محتوى</DialogContent>
            </Dialog>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.accessibility.usesDirection).toBe(true);
    });

    it('should detect focus management', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogContent } from '@radix-ui/react-dialog';

        export function App() {
          return (
            <Dialog>
              <DialogContent trapFocus={true}>
                Content with focus trap
              </DialogContent>
            </Dialog>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.accessibility.usesFocusManagement).toBe(true);
    });

    it('should detect keyboard navigation features', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { RadioGroup, RadioGroupItem } from '@radix-ui/react-radio-group';

        export function App() {
          return (
            <RadioGroup loop={true} orientation="horizontal">
              <RadioGroupItem value="1">Option 1</RadioGroupItem>
              <RadioGroupItem value="2">Option 2</RadioGroupItem>
            </RadioGroup>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.accessibility.usesKeyboardNav).toBe(true);
    });

    it('should detect modal usage', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogContent } from '@radix-ui/react-dialog';

        export function App() {
          return (
            <Dialog modal={true}>
              <DialogContent>Modal dialog</DialogContent>
            </Dialog>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.accessibility.usesModal).toBe(true);
    });
  });

  describe('Composition Depth', () => {
    it('should identify simple composition', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Label } from '@radix-ui/react-label';

        export function App() {
          return <Label>Simple label</Label>;
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.features.compositionDepth).toBe('simple');
    });

    it('should identify moderate composition', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Tabs, TabsList, TabsTrigger, TabsContent } from '@radix-ui/react-tabs';
        import { Select, SelectTrigger, SelectContent } from '@radix-ui/react-select';

        export function App() {
          return (
            <Tabs>
              <TabsList>
                <TabsTrigger>Tab 1</TabsTrigger>
              </TabsList>
              <TabsContent>
                <Select>
                  <SelectTrigger />
                  <SelectContent />
                </Select>
              </TabsContent>
            </Tabs>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.features.compositionDepth).toBe('moderate');
    });

    it('should identify complex composition', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Dialog, DialogPortal, DialogContent, DialogTitle } from '@radix-ui/react-dialog';
        import { Tabs, TabsList, TabsTrigger, TabsContent } from '@radix-ui/react-tabs';
        import { Select, SelectTrigger, SelectContent, SelectItem } from '@radix-ui/react-select';
        import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover';
        import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@radix-ui/react-tooltip';

        export function App() {
          return (
            <Dialog>
              <DialogPortal>
                <DialogContent>
                  <DialogTitle>Complex Dialog</DialogTitle>
                  <Tabs>
                    <TabsList>
                      <TabsTrigger>Tab 1</TabsTrigger>
                    </TabsList>
                    <TabsContent>
                      <Select>
                        <SelectTrigger />
                        <SelectContent>
                          <SelectItem value="1">Item</SelectItem>
                        </SelectContent>
                      </Select>
                    </TabsContent>
                  </Tabs>
                  <Popover>
                    <PopoverTrigger>Open</PopoverTrigger>
                    <PopoverContent>Popover</PopoverContent>
                  </Popover>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>Hover</TooltipTrigger>
                      <TooltipContent>Info</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </DialogContent>
              </DialogPortal>
            </Dialog>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.features.compositionDepth).toBe('complex');
      expect(result.features.primitiveCount).toBeGreaterThan(10);
    });
  });

  describe('Form Controls', () => {
    it('should detect Checkbox primitives', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Checkbox, CheckboxIndicator } from '@radix-ui/react-checkbox';

        export function App() {
          return (
            <Checkbox>
              <CheckboxIndicator />
            </Checkbox>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.primitives['react-checkbox']).toContain('Checkbox');
      expect(result.primitives['react-checkbox']).toContain('CheckboxIndicator');
    });

    it('should detect RadioGroup primitives', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { RadioGroup, RadioGroupItem } from '@radix-ui/react-radio-group';

        export function App() {
          return (
            <RadioGroup>
              <RadioGroupItem value="1" />
              <RadioGroupItem value="2" />
            </RadioGroup>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.primitives['react-radio-group']).toContain('RadioGroup');
      expect(result.primitives['react-radio-group']).toContain('RadioGroupItem');
    });

    it('should detect Select primitives', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Select, SelectTrigger, SelectContent, SelectItem } from '@radix-ui/react-select';

        export function App() {
          return (
            <Select>
              <SelectTrigger />
              <SelectContent>
                <SelectItem value="1">Option 1</SelectItem>
              </SelectContent>
            </Select>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.primitives['react-select']).toContain('Select');
      expect(result.primitives['react-select']).toContain('SelectTrigger');
      expect(result.primitives['react-select']).toContain('SelectContent');
      expect(result.primitives['react-select']).toContain('SelectItem');
    });

    it('should detect Slider primitives', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { Slider, SliderTrack, SliderRange, SliderThumb } from '@radix-ui/react-slider';

        export function App() {
          return (
            <Slider>
              <SliderTrack>
                <SliderRange />
              </SliderTrack>
              <SliderThumb />
            </Slider>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      expect(result.primitives['react-slider']).toContain('Slider');
      expect(result.primitives['react-slider']).toContain('SliderTrack');
      expect(result.primitives['react-slider']).toContain('SliderRange');
      expect(result.primitives['react-slider']).toContain('SliderThumb');
    });
  });

  describe('Integration', () => {
    it('should extract complete Radix metadata from realistic component', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import { useState } from 'react';
        import { Dialog, DialogPortal, DialogContent, DialogTitle } from '@radix-ui/react-dialog';
        import { Select, SelectTrigger, SelectContent, SelectItem } from '@radix-ui/react-select';
        import { Label } from '@radix-ui/react-label';

        export function SettingsDialog() {
          const [open, setOpen] = useState(false);

          return (
            <Dialog open={open} onOpenChange={setOpen} modal={true} dir="ltr">
              <DialogPortal>
                <DialogContent trapFocus={true}>
                  <DialogTitle>Settings</DialogTitle>
                  <Label>Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger asChild>
                      <button>Select language</button>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                    </SelectContent>
                  </Select>
                </DialogContent>
              </DialogPortal>
            </Dialog>
          );
        }
        `
      );

      const result = extractRadixUI(sourceFile);

      // Primitives
      expect(result.primitives['react-dialog']).toBeDefined();
      expect(result.primitives['react-select']).toBeDefined();
      expect(result.primitives['react-label']).toBeDefined();

      // Patterns
      expect(result.patterns.controlled).toContain('Dialog');
      expect(result.patterns.uncontrolled).toContain('Select');
      expect(result.patterns.portals).toBeGreaterThan(0);
      expect(result.patterns.asChild).toBeGreaterThan(0);

      // Accessibility
      expect(result.accessibility.usesDirection).toBe(true);
      expect(result.accessibility.usesFocusManagement).toBe(true);
      expect(result.accessibility.usesModal).toBe(true);

      // Features
      expect(result.features.primitiveCount).toBeGreaterThan(5);
      expect(result.features.compositionDepth).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSX gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Malformed JSX - unclosed tag
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import * as Dialog from '@radix-ui/react-dialog';
        
        export function Component() {
          return (
            <Dialog.Root open={true}
          );
        }
        `
      );

      // Should not throw, should return empty object or partial results
      const result = extractRadixUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(typeof result.primitives).toBe('object');
      expect(Array.isArray(result.patterns.controlled)).toBe(true);
    });

    it('should handle SourceFile with syntax errors gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Invalid TypeScript syntax
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import * as Dialog from '@radix-ui/react-dialog';
        function Component() {
          return <Dialog.Root
        // Missing closing
        `
      );

      // Should not throw, should return empty object or partial results
      const result = extractRadixUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(typeof result.primitives).toBe('object');
    });

    it('should handle empty SourceFile gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractRadixUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(result.primitives).toEqual({});
      expect(result.patterns.controlled).toEqual([]);
      expect(result.patterns.uncontrolled).toEqual([]);
      expect(result.patterns.portals).toBe(0);
      expect(result.patterns.asChild).toBe(0);
      expect(result.accessibility).toEqual({});
      expect(result.features).toEqual({});
    });

    it('should handle SourceFile with invalid import declarations gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import * as Dialog from '@radix-ui/react-dialog';
        function Component() {
          return <Dialog.Root>Content</Dialog.Root>;
        }
        `
      );

      // Should handle gracefully even if AST traversal has issues
      const result = extractRadixUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should handle AST traversal errors gracefully', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Code that might cause AST traversal issues
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import * as Dialog from '@radix-ui/react-dialog';
        function Component() {
          const invalid = (() => { throw new Error('test'); })();
          return <Dialog.Root className={invalid}>Content</Dialog.Root>;
        }
        `
      );

      // Should not throw, should handle gracefully
      const result = extractRadixUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should handle complex AST traversal errors in attribute processing', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Code that might cause issues in attribute processing
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        import * as Dialog from '@radix-ui/react-dialog';
        function Component() {
          return (
            <div>
              <Dialog.Root open={true}>Test</Dialog.Root>
              {(() => { throw new Error('test'); })()}
            </div>
          );
        }
        `
      );

      // Should not throw, should return partial results
      const result = extractRadixUI(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(typeof result.primitives).toBe('object');
    });
  });
});
