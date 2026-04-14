import { describe, it, expect } from 'vitest';
import { extractChakraUI } from '../../../src/extractors/styling/chakra.js';
import {
  createTestSourceFile,
  expectComponents,
  expectPackages,
  expectSortedPackages,
  expectComponentLimit,
  expectEmptyResult,
  runExtractorTests,
  type StyleExtractorTestCase,
} from './test-helpers.js';

describe('Chakra UI Extractor', () => {
  describe('Component Detection', () => {
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expectComponents(result, ['Button', 'Box', 'Text']);
      expectPackages(result, ['@chakra-ui/react']);
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expectComponents(result, ['Button', 'Box', 'Text']);
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      // Should detect the canonical component names, not just the aliases
      expectComponents(result, ['Button', 'Box']);
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expectComponents(result, ['Box']);
    });

    it('should detect components from different Chakra UI packages', () => {
      const sourceCode = `
        import { Button } from '@chakra-ui/react';
        import { FormControl } from '@chakra-ui/form-control';
        import { Modal } from '@chakra-ui/modal';
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expectComponents(result, ['Button', 'FormControl', 'Modal']);
      expectPackages(result, [
        '@chakra-ui/react',
        '@chakra-ui/form-control',
        '@chakra-ui/modal',
      ]);
    });
  });

  describe('Package Detection', () => {
    it('should detect multiple Chakra UI packages', () => {
      const sourceCode = `
        import { Button } from '@chakra-ui/react';
        import { useColorMode } from '@chakra-ui/react';
        import { extendTheme } from '@chakra-ui/react';
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expectPackages(result, ['@chakra-ui/react']);
    });

    it('should return sorted packages', () => {
      const sourceCode = `
        import { Button } from '@chakra-ui/react';
        import { useColorMode } from '@chakra-ui/react';
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expectSortedPackages(result);
    });
  });

  describe('Theme Detection', () => {
    const themeTestCases: StyleExtractorTestCase<
      ReturnType<typeof extractChakraUI>
    >[] = [
      {
        description: 'should detect theme usage via useTheme hook',
        sourceCode: `
          import { useTheme } from '@chakra-ui/react';
          
          function MyComponent() {
            const theme = useTheme();
            return <div>Hello</div>;
          }
        `,
        assertions: (result) => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via extendTheme',
        sourceCode: `
          import { extendTheme } from '@chakra-ui/react';
          
          const theme = extendTheme({
            colors: { brand: { 500: '#1a202c' } }
          });
        `,
        assertions: (result) => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via createTheme',
        sourceCode: `
          import { createTheme } from '@chakra-ui/react';
          
          const theme = createTheme({
            colors: { brand: { 500: '#1a202c' } }
          });
        `,
        assertions: (result) => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via ChakraProvider',
        sourceCode: `
          import { ChakraProvider } from '@chakra-ui/react';
          
          function MyComponent() {
            return <ChakraProvider theme={theme}>Hello</ChakraProvider>;
          }
        `,
        assertions: (result) => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via ThemeProvider',
        sourceCode: `
          import { ThemeProvider } from '@chakra-ui/react';
          
          function MyComponent() {
            return <ThemeProvider theme={theme}>Hello</ThemeProvider>;
          }
        `,
        assertions: (result) => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via property access',
        sourceCode: `
          import { useTheme } from '@chakra-ui/react';
          
          function MyComponent() {
            const theme = useTheme();
            const color = theme.colors.blue[500];
            return <div style={{ color }}>Hello</div>;
          }
        `,
        assertions: (result) => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
    ];

    runExtractorTests(extractChakraUI, themeTestCases);
  });

  describe('Color Mode Detection', () => {
    const colorModeTestCases: StyleExtractorTestCase<
      ReturnType<typeof extractChakraUI>
    >[] = [
      {
        description: 'should detect color mode usage via useColorMode hook',
        sourceCode: `
          import { useColorMode } from '@chakra-ui/react';
          
          function MyComponent() {
            const { colorMode, toggleColorMode } = useColorMode();
            return <div>Current mode: {colorMode}</div>;
          }
        `,
        assertions: (result) => {
          expect(result.features.usesColorMode).toBe(true);
        },
      },
      {
        description: 'should detect color mode usage via useColorModeValue',
        sourceCode: `
          import { useColorModeValue } from '@chakra-ui/react';
          
          function MyComponent() {
            const bg = useColorModeValue('white', 'gray.800');
            return <div style={{ background: bg }}>Hello</div>;
          }
        `,
        assertions: (result) => {
          expect(result.features.usesColorMode).toBe(true);
        },
      },
      {
        description:
          'should detect color mode usage via ColorModeScript import',
        sourceCode: `
          import { ColorModeScript } from '@chakra-ui/react';
          
          function MyComponent() {
            return <ColorModeScript />;
          }
        `,
        assertions: (result) => {
          expect(result.features.usesColorMode).toBe(true);
        },
      },
      {
        description: 'should detect color mode usage via property access',
        sourceCode: `
          import { useColorMode } from '@chakra-ui/react';
          
          function MyComponent() {
            const { colorMode } = useColorMode();
            const isDark = colorMode === 'dark';
            return <div>{isDark ? 'Dark' : 'Light'}</div>;
          }
        `,
        assertions: (result) => {
          expect(result.features.usesColorMode).toBe(true);
        },
      },
    ];

    runExtractorTests(extractChakraUI, colorModeTestCases);

    it('should not detect color mode when Chakra UI is not used', () => {
      const sourceCode = `
        function MyComponent() {
          const colorMode = 'light';
          return <div>{colorMode}</div>;
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expect(result.features.usesColorMode).toBeUndefined();
    });
  });

  describe('Responsive Props Detection', () => {
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expect(result.features.usesResponsiveProps).toBe(true);
    });

    it('should not detect responsive props when Chakra UI is not used', () => {
      const sourceCode = `
        function MyComponent() {
          return <div style={{ padding: [2, 4, 6] }}>Hello</div>;
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expect(result.features.usesResponsiveProps).toBeUndefined();
    });
  });

  describe('System Props Detection', () => {
    const systemPropsTestCases: StyleExtractorTestCase<
      ReturnType<typeof extractChakraUI>
    >[] = [
      {
        description: 'should detect system props on Box component',
        sourceCode: `
          import { Box } from '@chakra-ui/react';
          
          function MyComponent() {
            return (
              <Box p={4} m={2} bg="blue.500" color="white" rounded="md">
                Hello
              </Box>
            );
          }
        `,
        assertions: (result) => {
          expect(result.features.usesSystemProps).toBe(true);
        },
      },
      {
        description: 'should detect system props on Stack component',
        sourceCode: `
          import { Stack } from '@chakra-ui/react';
          
          function MyComponent() {
            return (
              <Stack spacing={4} p={2} direction="row">
                <div>Item 1</div>
                <div>Item 2</div>
              </Stack>
            );
          }
        `,
        assertions: (result) => {
          expect(result.features.usesSystemProps).toBe(true);
        },
      },
      {
        description: 'should detect system props on Flex component',
        sourceCode: `
          import { Flex } from '@chakra-ui/react';
          
          function MyComponent() {
            return (
              <Flex p={4} justify="space-between" align="center">
                Content
              </Flex>
            );
          }
        `,
        assertions: (result) => {
          expect(result.features.usesSystemProps).toBe(true);
        },
      },
      {
        description: 'should detect system props on HStack component',
        sourceCode: `
          import { HStack } from '@chakra-ui/react';
          
          function MyComponent() {
            return (
              <HStack spacing={4} p={2}>
                <div>Item 1</div>
                <div>Item 2</div>
              </HStack>
            );
          }
        `,
        assertions: (result) => {
          expect(result.features.usesSystemProps).toBe(true);
        },
      },
      {
        description: 'should detect system props on VStack component',
        sourceCode: `
          import { VStack } from '@chakra-ui/react';
          
          function MyComponent() {
            return (
              <VStack spacing={4} p={2}>
                <div>Item 1</div>
                <div>Item 2</div>
              </VStack>
            );
          }
        `,
        assertions: (result) => {
          expect(result.features.usesSystemProps).toBe(true);
        },
      },
      {
        description: 'should detect system props on Grid component',
        sourceCode: `
          import { Grid } from '@chakra-ui/react';
          
          function MyComponent() {
            return (
              <Grid templateColumns="repeat(3, 1fr)" gap={4} p={2}>
                <div>Item 1</div>
              </Grid>
            );
          }
        `,
        assertions: (result) => {
          expect(result.features.usesSystemProps).toBe(true);
        },
      },
      {
        description: 'should detect system props on SimpleGrid component',
        sourceCode: `
          import { SimpleGrid } from '@chakra-ui/react';
          
          function MyComponent() {
            return (
              <SimpleGrid columns={3} spacing={4} p={2}>
                <div>Item 1</div>
              </SimpleGrid>
            );
          }
        `,
        assertions: (result) => {
          expect(result.features.usesSystemProps).toBe(true);
        },
      },
    ];

    runExtractorTests(extractChakraUI, systemPropsTestCases);

    it('should not detect system props when Chakra UI is not used', () => {
      const sourceCode = `
        function MyComponent() {
          return <div p={4} m={2}>Hello</div>;
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expect(result.features.usesSystemProps).toBeUndefined();
    });
  });

  describe('Component Sorting and Limits', () => {
    it('should limit components to 20', () => {
      const sourceCode = `
        import {
          Button, TextField, Card, Checkbox, Chip, Dialog, Divider,
          Flex, FormControl, Grid, Icon, IconButton, Input, Link, List,
          Menu, MenuItem, Modal, Popover, Radio, Select, Slider,
          Switch, Tab, Table, Tabs, Tag, Text, Textarea, Tooltip, VStack
        } from '@chakra-ui/react';
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expectComponentLimit(result, 20);
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      // Button: import (+1) + 3 JSX uses (+3) = 4 total
      // Box: import (+1) + 1 JSX use (+1) = 2 total
      // Text: import (+1) + 1 JSX use (+1) = 2 total
      // Button should appear first due to higher frequency
      // Box and Text should be sorted alphabetically when tied
      expect(result.components[0]).toBe('Button');
      expectComponents(result, ['Box', 'Text']);
      // Alphabetically, Box comes before Text
      const boxIndex = result.components.indexOf('Box');
      const textIndex = result.components.indexOf('Text');
      expect(boxIndex).toBeLessThan(textIndex);
    });
  });

  describe('Feature Combinations', () => {
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
      expect(result.features.usesColorMode).toBe(true);
      expect(result.features.usesResponsiveProps).toBe(true);
      expect(result.features.usesSystemProps).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file', () => {
      const sourceFile = createTestSourceFile('');
      const result = extractChakraUI(sourceFile);

      expectEmptyResult(result);
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractChakraUI(sourceFile);

      expectEmptyResult(result);
    });
  });
});
