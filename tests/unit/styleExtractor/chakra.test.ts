import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractChakraUI } from '../../../src/extractors/styling/chakra.js';

describe('Chakra UI Extractor', () => {
  describe('extractChakraUI', () => {
    it('should extract Chakra UI components from imports', () => {
      const sourceCode = `
        import { Button, Box, Text } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <Box>
              <Text>Hello</Text>
              <Button>Click</Button>
            </Box>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.components).toContain('Box');
      expect(result.components).toContain('Text');
      expect(result.packages).toContain('@chakra-ui/react');
    });

    it('should extract Chakra UI components from JSX usage', () => {
      const sourceCode = `
        import { Button } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <>
              <Button>Click</Button>
              <Box p={4} />
              <Text fontSize="lg">Hello</Text>
            </>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.components).toContain('Box');
      expect(result.components).toContain('Text');
    });

    it('should detect multiple Chakra UI packages', () => {
      const sourceCode = `
        import { Button } from '@chakra-ui/react';
        import { useColorMode } from '@chakra-ui/react';
        import { extendTheme } from '@chakra-ui/react';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.packages).toContain('@chakra-ui/react');
    });

    it('should detect theme usage via useTheme hook', () => {
      const sourceCode = `
        import { useTheme } from '@chakra-ui/react';
        
        function MyComponent() {
          const theme = useTheme();
          return <div>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via extendTheme', () => {
      const sourceCode = `
        import { extendTheme } from '@chakra-ui/react';
        
        const theme = extendTheme({
          colors: { brand: { 500: '#1a202c' } }
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via createTheme', () => {
      const sourceCode = `
        import { createTheme } from '@chakra-ui/react';
        
        const theme = createTheme({
          colors: { brand: { 500: '#1a202c' } }
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via ChakraProvider', () => {
      const sourceCode = `
        import { ChakraProvider } from '@chakra-ui/react';
        
        function MyComponent() {
          return <ChakraProvider theme={theme}>Hello</ChakraProvider>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via ThemeProvider', () => {
      const sourceCode = `
        import { ThemeProvider } from '@chakra-ui/react';
        
        function MyComponent() {
          return <ThemeProvider theme={theme}>Hello</ThemeProvider>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via property access', () => {
      const sourceCode = `
        import { useTheme } from '@chakra-ui/react';
        
        function MyComponent() {
          const theme = useTheme();
          const color = theme.colors.blue[500];
          return <div style={{ color }}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect color mode usage via useColorMode hook', () => {
      const sourceCode = `
        import { useColorMode } from '@chakra-ui/react';
        
        function MyComponent() {
          const { colorMode, toggleColorMode } = useColorMode();
          return <div>Current mode: {colorMode}</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesColorMode).toBe(true);
    });

    it('should detect color mode usage via useColorModeValue', () => {
      const sourceCode = `
        import { useColorModeValue } from '@chakra-ui/react';
        
        function MyComponent() {
          const bg = useColorModeValue('white', 'gray.800');
          return <div style={{ background: bg }}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesColorMode).toBe(true);
    });

    it('should detect color mode usage via ColorModeScript import', () => {
      const sourceCode = `
        import { ColorModeScript } from '@chakra-ui/react';
        
        function MyComponent() {
          return <ColorModeScript />;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesColorMode).toBe(true);
    });

    it('should detect color mode usage via property access', () => {
      const sourceCode = `
        import { useColorMode } from '@chakra-ui/react';
        
        function MyComponent() {
          const { colorMode } = useColorMode();
          const isDark = colorMode === 'dark';
          return <div>{isDark ? 'Dark' : 'Light'}</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesColorMode).toBe(true);
    });

    it('should detect responsive props (array syntax)', () => {
      const sourceCode = `
        import { Box } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <Box p={[2, 4, 6]} fontSize={['sm', 'md', 'lg']}>
              Responsive
            </Box>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesResponsiveProps).toBe(true);
    });

    it('should detect system props on Box component', () => {
      const sourceCode = `
        import { Box } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <Box p={4} m={2} bg="blue.500" color="white" rounded="md">
              Hello
            </Box>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should detect system props on Stack component', () => {
      const sourceCode = `
        import { Stack } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <Stack spacing={4} p={2} direction="row">
              <div>Item 1</div>
              <div>Item 2</div>
            </Stack>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should detect system props on Flex component', () => {
      const sourceCode = `
        import { Flex } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <Flex p={4} justify="space-between" align="center">
              Content
            </Flex>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should detect system props on HStack component', () => {
      const sourceCode = `
        import { HStack } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <HStack spacing={4} p={2}>
              <div>Item 1</div>
              <div>Item 2</div>
            </HStack>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should detect system props on VStack component', () => {
      const sourceCode = `
        import { VStack } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <VStack spacing={4} p={2}>
              <div>Item 1</div>
              <div>Item 2</div>
            </VStack>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should detect system props on Grid component', () => {
      const sourceCode = `
        import { Grid } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <Grid templateColumns="repeat(3, 1fr)" gap={4} p={2}>
              <div>Item 1</div>
            </Grid>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should detect system props on SimpleGrid component', () => {
      const sourceCode = `
        import { SimpleGrid } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <SimpleGrid columns={3} spacing={4} p={2}>
              <div>Item 1</div>
            </SimpleGrid>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should limit components to 20', () => {
      const sourceCode = `
        import {
          Button, TextField, Card, Checkbox, Chip, Dialog, Divider,
          Flex, FormControl, Grid, Icon, IconButton, Input, Link, List,
          Menu, MenuItem, Modal, Popover, Radio, Select, Slider,
          Switch, Tab, Table, Tabs, Tag, Text, Textarea, Tooltip, VStack
        } from '@chakra-ui/react';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.components.length).toBeLessThanOrEqual(20);
    });

    it('should sort components by usage frequency, then alphabetically', () => {
      const sourceCode = `
        import { Button, Box, Text } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <>
              <Button>1</Button>
              <Button>2</Button>
              <Button>3</Button>
              <Box p={4} />
              <Text>Hello</Text>
            </>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      // Button: import (+1) + 3 JSX uses (+3) = 4 total
      // Box: import (+1) + 1 JSX use (+1) = 2 total
      // Text: import (+1) + 1 JSX use (+1) = 2 total
      // Button should appear first due to higher frequency
      // Box and Text should be sorted alphabetically when tied
      expect(result.components[0]).toBe('Button');
      expect(result.components).toContain('Box');
      expect(result.components).toContain('Text');
      // Alphabetically, Box comes before Text
      const boxIndex = result.components.indexOf('Box');
      const textIndex = result.components.indexOf('Text');
      expect(boxIndex).toBeLessThan(textIndex);
    });

    it('should return sorted packages', () => {
      const sourceCode = `
        import { Button } from '@chakra-ui/react';
        import { useColorMode } from '@chakra-ui/react';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.packages).toEqual(result.packages.sort());
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractChakraUI(sourceFile);

      expect(result.components).toEqual([]);
      expect(result.packages).toEqual([]);
      expect(result.features.usesTheme).toBeUndefined();
      expect(result.features.usesColorMode).toBeUndefined();
      expect(result.features.usesResponsiveProps).toBeUndefined();
      expect(result.features.usesSystemProps).toBeUndefined();
    });

    it('should not detect Chakra UI when no imports present', () => {
      const sourceCode = `
        function MyComponent() {
          return <div>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.components).toEqual([]);
      expect(result.packages).toEqual([]);
    });

    it('should detect components with aliased imports', () => {
      const sourceCode = `
        import { Button as ChakraButton, Box as Container } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <Container>
              <ChakraButton>Click</ChakraButton>
            </Container>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      // Should detect the canonical component names, not just the aliases
      expect(result.components).toContain('Button');
      expect(result.components).toContain('Box');
    });

    it('should handle namespace tags like Box.Root', () => {
      const sourceCode = `
        import { Box } from '@chakra-ui/react';
        
        function MyComponent() {
          return (
            <Box.Root p={4}>
              <Box.Content>Hello</Box.Content>
            </Box.Root>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.components).toContain('Box');
    });

    it('should detect multiple features simultaneously', () => {
      const sourceCode = `
        import { Button, Box, useTheme, useColorMode } from '@chakra-ui/react';
        
        function MyComponent() {
          const theme = useTheme();
          const { colorMode } = useColorMode();
          return (
            <Box p={[2, 4, 6]} bg="blue.500" color="white">
              <Button>Click</Button>
            </Box>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
      expect(result.features.usesColorMode).toBe(true);
      expect(result.features.usesResponsiveProps).toBe(true);
      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should detect components from different Chakra UI packages', () => {
      const sourceCode = `
        import { Button } from '@chakra-ui/react';
        import { FormControl } from '@chakra-ui/form-control';
        import { Modal } from '@chakra-ui/modal';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.components).toContain('FormControl');
      expect(result.components).toContain('Modal');
      expect(result.packages).toContain('@chakra-ui/react');
      expect(result.packages).toContain('@chakra-ui/form-control');
      expect(result.packages).toContain('@chakra-ui/modal');
    });

    it('should not detect color mode when Chakra UI is not used', () => {
      const sourceCode = `
        function MyComponent() {
          const colorMode = 'light';
          return <div>{colorMode}</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesColorMode).toBeUndefined();
    });

    it('should not detect responsive props when Chakra UI is not used', () => {
      const sourceCode = `
        function MyComponent() {
          return <div style={{ padding: [2, 4, 6] }}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesResponsiveProps).toBeUndefined();
    });

    it('should not detect system props when Chakra UI is not used', () => {
      const sourceCode = `
        function MyComponent() {
          return <div p={4} m={2}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractChakraUI(sourceFile);

      expect(result.features.usesSystemProps).toBeUndefined();
    });
  });
});
