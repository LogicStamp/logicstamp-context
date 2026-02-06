import { describe, it, expect } from 'vitest';
import { extractMaterialUI } from '../../../src/extractors/styling/material.js';
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

describe('Material UI Extractor', () => {
  describe('Component Detection', () => {
    it('should extract Material UI components from imports', () => {
      const sourceCode = `
        import { Button, TextField, Card } from '@mui/material';
        
        function MyComponent() {
          return (
            <Card>
              <TextField label="Name" />
              <Button>Submit</Button>
            </Card>
          );
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      expectComponents(result, ['Button', 'TextField', 'Card']);
      expectPackages(result, ['@mui/material']);
    });

    it('should extract Material UI components from JSX usage', () => {
      const sourceCode = `
        import { Button } from '@mui/material';
        
        function MyComponent() {
          return (
            <>
              <Button>Click</Button>
              <TextField />
              <Card />
            </>
          );
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      expectComponents(result, ['Button', 'TextField', 'Card']);
    });

    it('should detect components with aliased imports', () => {
      const sourceCode = `
        import { Button as MUIButton, Card as ContainerCard } from '@mui/material';
        
        function MyComponent() {
          return (
            <ContainerCard>
              <MUIButton>Click</MUIButton>
            </ContainerCard>
          );
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      // Should detect the canonical component names, not just the aliases
      expectComponents(result, ['Button', 'Card']);
    });

    it('should detect default imports from individual packages', () => {
      const sourceCode = `
        import Button from '@mui/material/Button';
        import TextField from '@mui/material/TextField';
        
        function MyComponent() {
          return (
            <>
              <Button>Click</Button>
              <TextField />
            </>
          );
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      expectComponents(result, ['Button', 'TextField']);
      expectPackages(result, ['@mui/material/Button', '@mui/material/TextField']);
    });

    it('should detect default imports with aliases (derives canonical name from module path)', () => {
      const sourceCode = `
        import Btn from '@mui/material/Button';
        import CustomTextField from '@mui/material/TextField';
        
        function MyComponent() {
          return (
            <>
              <Btn>Click</Btn>
              <CustomTextField label="Name" />
            </>
          );
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      // Should detect canonical component names, not the aliases
      expectComponents(result, ['Button', 'TextField']);
      expectPackages(result, ['@mui/material/Button', '@mui/material/TextField']);
    });
  });

  describe('Package Detection', () => {
    it('should detect multiple Material UI packages', () => {
      const sourceCode = `
        import { Button } from '@mui/material';
        import { Add } from '@mui/icons-material';
        
        function MyComponent() {
          return (
            <Button startIcon={<Add />}>Add</Button>
          );
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      expectPackages(result, ['@mui/material', '@mui/icons-material']);
    });

    it('should detect legacy @material-ui/core package', () => {
      const sourceCode = `
        import { Button } from '@material-ui/core';
        
        function MyComponent() {
          return <Button>Click</Button>;
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      expectPackages(result, ['@material-ui/core']);
      expectComponents(result, ['Button']);
    });

    it('should return sorted packages', () => {
      const sourceCode = `
        import { Button } from '@mui/material';
        import { Add } from '@mui/icons-material';
        import { ThemeProvider } from '@mui/system';
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      expectSortedPackages(result);
    });
  });

  describe('Theme Detection', () => {
    const themeTestCases: StyleExtractorTestCase<ReturnType<typeof extractMaterialUI>>[] = [
      {
        description: 'should detect theme usage via useTheme hook',
        sourceCode: `
          import { useTheme } from '@mui/material/styles';
          
          function MyComponent() {
            const theme = useTheme();
            return <div>Hello</div>;
          }
        `,
        assertions: result => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via ThemeProvider',
        sourceCode: `
          import { ThemeProvider } from '@mui/material/styles';
          
          function MyComponent() {
            return <ThemeProvider theme={theme}>Hello</ThemeProvider>;
          }
        `,
        assertions: result => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via createTheme',
        sourceCode: `
          import { createTheme } from '@mui/material/styles';
          
          const theme = createTheme({
            palette: { primary: { main: '#1976d2' } }
          });
        `,
        assertions: result => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via template literal',
        sourceCode: `
          import styled from '@mui/material/styles';
          
          const StyledDiv = styled.div\`
            color: \${props => props.theme.palette.primary.main};
          \`;
        `,
        assertions: result => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via property access',
        sourceCode: `
          import { useTheme } from '@mui/material/styles';
          
          function MyComponent() {
            const theme = useTheme();
            const primaryColor = theme.palette.primary.main;
            const spacing = theme.spacing(2);
            return <div style={{ color: primaryColor, padding: spacing }}>Hello</div>;
          }
        `,
        assertions: result => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
    ];

    runExtractorTests(extractMaterialUI, themeTestCases);
  });

  describe('Styled Detection', () => {
    const styledTestCases: StyleExtractorTestCase<ReturnType<typeof extractMaterialUI>>[] = [
      {
        description: 'should detect styled from @mui/material/styles',
        sourceCode: `
          import { styled } from '@mui/material/styles';
          
          const StyledButton = styled(Button)\`
            padding: 1rem;
          \`;
        `,
        assertions: result => {
          expect(result.features.usesStyled).toBe(true);
        },
      },
      {
        description: 'should detect styled from legacy @material-ui/core/styles',
        sourceCode: `
          import { styled } from '@material-ui/core/styles';
          
          const StyledButton = styled(Button)\`
            padding: 1rem;
          \`;
        `,
        assertions: result => {
          expect(result.features.usesStyled).toBe(true);
        },
      },
      {
        description: 'should detect styled from @mui/system package',
        sourceCode: `
          import { styled } from '@mui/system';
          
          const StyledDiv = styled('div')\`
            padding: 1rem;
          \`;
        `,
        assertions: result => {
          expect(result.features.usesStyled).toBe(true);
          expectPackages(result, ['@mui/system']);
        },
      },
    ];

    runExtractorTests(extractMaterialUI, styledTestCases);
  });

  describe('makeStyles Detection', () => {
    const makeStylesTestCases: StyleExtractorTestCase<ReturnType<typeof extractMaterialUI>>[] = [
      {
        description: 'should detect makeStyles usage',
        sourceCode: `
          import { makeStyles } from '@mui/styles';
          
          const useStyles = makeStyles((theme) => ({
            root: { padding: theme.spacing(2) }
          }));
        `,
        assertions: result => {
          expect(result.features.usesMakeStyles).toBe(true);
        },
      },
      {
        description: 'should detect makeStyles from legacy package',
        sourceCode: `
          import { makeStyles } from '@material-ui/styles';
          
          const useStyles = makeStyles((theme) => ({
            root: { padding: theme.spacing(2) }
          }));
        `,
        assertions: result => {
          expect(result.features.usesMakeStyles).toBe(true);
        },
      },
    ];

    runExtractorTests(extractMaterialUI, makeStylesTestCases);
  });

  describe('Sx Prop Detection', () => {
    it('should detect sx prop usage', () => {
      const sourceCode = `
        import { Button } from '@mui/material';
        
        function MyComponent() {
          return (
            <Button sx={{ color: 'primary.main', padding: 2 }}>
              Click
            </Button>
          );
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesSxProp).toBe(true);
    });
  });

  describe('System Props Detection', () => {
    const systemPropsTestCases: StyleExtractorTestCase<ReturnType<typeof extractMaterialUI>>[] = [
      {
        description: 'should detect system props on Box component',
        sourceCode: `
          import { Box } from '@mui/material';
          
          function MyComponent() {
            return (
              <Box spacing={2} color="primary.main" p={2}>
                Hello
              </Box>
            );
          }
        `,
        assertions: result => {
          expect(result.features.usesSystemProps).toBe(true);
        },
      },
      {
        description: 'should detect system props on Stack component',
        sourceCode: `
          import { Stack } from '@mui/material';
          
          function MyComponent() {
            return (
              <Stack spacing={2} direction="row" p={2}>
                <div>Item 1</div>
                <div>Item 2</div>
              </Stack>
            );
          }
        `,
        assertions: result => {
          expect(result.features.usesSystemProps).toBe(true);
        },
      },
      {
        description: 'should detect system props on Grid component',
        sourceCode: `
          import { Grid } from '@mui/material';
          
          function MyComponent() {
            return (
              <Grid container spacing={2} p={2}>
                <Grid item xs={12}>Content</Grid>
              </Grid>
            );
          }
        `,
        assertions: result => {
          expect(result.features.usesSystemProps).toBe(true);
        },
      },
      {
        description: 'should detect system props on Container component',
        sourceCode: `
          import { Container } from '@mui/material';
          
          function MyComponent() {
            return (
              <Container maxWidth="lg" p={2} spacing={2}>
                Content
              </Container>
            );
          }
        `,
        assertions: result => {
          expect(result.features.usesSystemProps).toBe(true);
        },
      },
    ];

    runExtractorTests(extractMaterialUI, systemPropsTestCases);
  });

  describe('Component Sorting and Limits', () => {
    it('should limit components to 20', () => {
      const sourceCode = `
        import {
          Button, TextField, Card, Checkbox, Chip, Dialog, Divider,
          Fab, FormControl, Grid, Icon, IconButton, Input, Link, List,
          Menu, MenuItem, Paper, Popover, Radio, Rating, Select, Slider,
          Snackbar, Switch, Tab, Table, Tabs, Tooltip, Typography
        } from '@mui/material';
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      expectComponentLimit(result, 20);
    });

    it('should sort components by usage frequency, then alphabetically', () => {
      const sourceCode = `
        import { Button, TextField, Card } from '@mui/material';
        
        function MyComponent() {
          return (
            <>
              <Button>1</Button>
              <Button>2</Button>
              <Button>3</Button>
              <TextField />
              <Card />
            </>
          );
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      // Button: import (+1) + 3 JSX uses (+3) = 4 total
      // TextField: import (+1) + 1 JSX use (+1) = 2 total
      // Card: import (+1) + 1 JSX use (+1) = 2 total
      // Button should appear first due to higher frequency
      // Card and TextField should be sorted alphabetically when tied
      expect(result.components[0]).toBe('Button');
      expectComponents(result, ['Card', 'TextField']);
      // Alphabetically, Card comes before TextField
      const cardIndex = result.components.indexOf('Card');
      const textFieldIndex = result.components.indexOf('TextField');
      expect(cardIndex).toBeLessThan(textFieldIndex);
    });
  });

  describe('Feature Combinations', () => {
    it('should detect multiple features simultaneously', () => {
      const sourceCode = `
        import { Button, Box, useTheme } from '@mui/material';
        import { styled } from '@mui/material/styles';
        
        const StyledButton = styled(Button)\`
          padding: 1rem;
        \`;
        
        function MyComponent() {
          const theme = useTheme();
          return (
            <Box sx={{ p: 2 }} spacing={2}>
              <StyledButton>Click</StyledButton>
            </Box>
          );
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
      expect(result.features.usesSxProp).toBe(true);
      expect(result.features.usesStyled).toBe(true);
      expect(result.features.usesSystemProps).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file', () => {
      const sourceFile = createTestSourceFile('');
      const result = extractMaterialUI(sourceFile);

      expectEmptyResult(result);
      expect(result.features.usesTheme).toBeUndefined();
      expect(result.features.usesSxProp).toBeUndefined();
      expect(result.features.usesStyled).toBeUndefined();
      expect(result.features.usesMakeStyles).toBeUndefined();
      expect(result.features.usesSystemProps).toBeUndefined();
    });

    it('should not detect Material UI when no imports present', () => {
      const sourceCode = `
        function MyComponent() {
          return <div>Hello</div>;
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractMaterialUI(sourceFile);

      expectEmptyResult(result);
    });
  });
});
