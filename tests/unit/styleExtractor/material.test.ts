import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractMaterialUI } from '../../../src/core/styleExtractor/material.js';

describe('Material UI Extractor', () => {
  describe('extractMaterialUI', () => {
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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.components).toContain('TextField');
      expect(result.components).toContain('Card');
      expect(result.packages).toContain('@mui/material');
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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.components).toContain('TextField');
      expect(result.components).toContain('Card');
    });

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.packages).toContain('@mui/material');
      expect(result.packages).toContain('@mui/icons-material');
    });

    it('should detect legacy @material-ui/core package', () => {
      const sourceCode = `
        import { Button } from '@material-ui/core';
        
        function MyComponent() {
          return <Button>Click</Button>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.packages).toContain('@material-ui/core');
      expect(result.components).toContain('Button');
    });

    it('should detect theme usage via useTheme hook', () => {
      const sourceCode = `
        import { useTheme } from '@mui/material/styles';
        
        function MyComponent() {
          const theme = useTheme();
          return <div>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via ThemeProvider', () => {
      const sourceCode = `
        import { ThemeProvider } from '@mui/material/styles';
        
        function MyComponent() {
          return <ThemeProvider theme={theme}>Hello</ThemeProvider>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via createTheme', () => {
      const sourceCode = `
        import { createTheme } from '@mui/material/styles';
        
        const theme = createTheme({
          palette: { primary: { main: '#1976d2' } }
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via template literal', () => {
      const sourceCode = `
        import styled from '@mui/material/styles';
        
        const StyledDiv = styled.div\`
          color: \${props => props.theme.palette.primary.main};
        \`;
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesSxProp).toBe(true);
    });

    it('should detect styled from @mui/material/styles', () => {
      const sourceCode = `
        import { styled } from '@mui/material/styles';
        
        const StyledButton = styled(Button)\`
          padding: 1rem;
        \`;
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesStyled).toBe(true);
    });

    it('should detect styled from legacy @material-ui/core/styles', () => {
      const sourceCode = `
        import { styled } from '@material-ui/core/styles';
        
        const StyledButton = styled(Button)\`
          padding: 1rem;
        \`;
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesStyled).toBe(true);
    });

    it('should detect makeStyles usage', () => {
      const sourceCode = `
        import { makeStyles } from '@mui/styles';
        
        const useStyles = makeStyles((theme) => ({
          root: { padding: theme.spacing(2) }
        }));
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesMakeStyles).toBe(true);
    });

    it('should detect makeStyles from legacy package', () => {
      const sourceCode = `
        import { makeStyles } from '@material-ui/styles';
        
        const useStyles = makeStyles((theme) => ({
          root: { padding: theme.spacing(2) }
        }));
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesMakeStyles).toBe(true);
    });

    it('should detect system props on Box component', () => {
      const sourceCode = `
        import { Box } from '@mui/material';
        
        function MyComponent() {
          return (
            <Box spacing={2} color="primary.main" p={2}>
              Hello
            </Box>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should detect system props on Stack component', () => {
      const sourceCode = `
        import { Stack } from '@mui/material';
        
        function MyComponent() {
          return (
            <Stack spacing={2} direction="row" p={2}>
              <div>Item 1</div>
              <div>Item 2</div>
            </Stack>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should limit components to 20', () => {
      const sourceCode = `
        import {
          Button, TextField, Card, Checkbox, Chip, Dialog, Divider,
          Fab, FormControl, Grid, Icon, IconButton, Input, Link, List,
          Menu, MenuItem, Paper, Popover, Radio, Rating, Select, Slider,
          Snackbar, Switch, Tab, Table, Tabs, Tooltip, Typography
        } from '@mui/material';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.components.length).toBeLessThanOrEqual(20);
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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      // Button: import (+1) + 3 JSX uses (+3) = 4 total
      // TextField: import (+1) + 1 JSX use (+1) = 2 total
      // Card: import (+1) + 1 JSX use (+1) = 2 total
      // Button should appear first due to higher frequency
      // Card and TextField should be sorted alphabetically when tied
      expect(result.components[0]).toBe('Button');
      expect(result.components).toContain('Card');
      expect(result.components).toContain('TextField');
      // Alphabetically, Card comes before TextField
      const cardIndex = result.components.indexOf('Card');
      const textFieldIndex = result.components.indexOf('TextField');
      expect(cardIndex).toBeLessThan(textFieldIndex);
    });

    it('should return sorted packages', () => {
      const sourceCode = `
        import { Button } from '@mui/material';
        import { Add } from '@mui/icons-material';
        import { ThemeProvider } from '@mui/system';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.packages).toEqual(result.packages.sort());
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractMaterialUI(sourceFile);

      expect(result.components).toEqual([]);
      expect(result.packages).toEqual([]);
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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.components).toEqual([]);
      expect(result.packages).toEqual([]);
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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      // Should detect the canonical component names, not just the aliases
      expect(result.components).toContain('Button');
      expect(result.components).toContain('Card');
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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.components).toContain('TextField');
      expect(result.packages).toContain('@mui/material/Button');
      expect(result.packages).toContain('@mui/material/TextField');
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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      // Should detect canonical component names, not the aliases
      expect(result.components).toContain('Button');
      expect(result.components).toContain('TextField');
      expect(result.packages).toContain('@mui/material/Button');
      expect(result.packages).toContain('@mui/material/TextField');
    });

    it('should detect theme usage via property access', () => {
      const sourceCode = `
        import { useTheme } from '@mui/material/styles';
        
        function MyComponent() {
          const theme = useTheme();
          const primaryColor = theme.palette.primary.main;
          const spacing = theme.spacing(2);
          return <div style={{ color: primaryColor, padding: spacing }}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect system props on Grid component', () => {
      const sourceCode = `
        import { Grid } from '@mui/material';
        
        function MyComponent() {
          return (
            <Grid container spacing={2} p={2}>
              <Grid item xs={12}>Content</Grid>
            </Grid>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should detect system props on Container component', () => {
      const sourceCode = `
        import { Container } from '@mui/material';
        
        function MyComponent() {
          return (
            <Container maxWidth="lg" p={2} spacing={2}>
              Content
            </Container>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesSystemProps).toBe(true);
    });

    it('should detect styled from @mui/system package', () => {
      const sourceCode = `
        import { styled } from '@mui/system';
        
        const StyledDiv = styled('div')\`
          padding: 1rem;
        \`;
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesStyled).toBe(true);
      expect(result.packages).toContain('@mui/system');
    });

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractMaterialUI(sourceFile);

      expect(result.features.usesTheme).toBe(true);
      expect(result.features.usesSxProp).toBe(true);
      expect(result.features.usesStyled).toBe(true);
      expect(result.features.usesSystemProps).toBe(true);
    });
  });
});

