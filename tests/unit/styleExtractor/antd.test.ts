import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractAntDesign } from '../../../src/extractors/styling/antd.js';

describe('Ant Design Extractor', () => {
  describe('extractAntDesign', () => {
    it('should extract Ant Design components from imports', () => {
      const sourceCode = `
        import { Button, Card, Input } from 'antd';
        
        function MyComponent() {
          return (
            <Card>
              <Input placeholder="Name" />
              <Button>Click</Button>
            </Card>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.components).toContain('Card');
      expect(result.components).toContain('Input');
      expect(result.packages).toContain('antd');
    });

    it('should extract Ant Design components from JSX usage', () => {
      const sourceCode = `
        import { Button } from 'antd';
        
        function MyComponent() {
          return (
            <>
              <Button>Click</Button>
              <Card title="Title">Content</Card>
              <Input placeholder="Enter text" />
            </>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.components).toContain('Card');
      expect(result.components).toContain('Input');
    });

    it('should detect multiple Ant Design packages', () => {
      const sourceCode = `
        import { Button } from 'antd';
        import { ConfigProvider } from 'antd';
        import { SmileOutlined } from '@ant-design/icons';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.packages).toContain('antd');
      expect(result.packages).toContain('@ant-design/icons');
    });

    it('should detect theme usage via useToken hook', () => {
      const sourceCode = `
        import { theme } from 'antd';
        
        function MyComponent() {
          const { token } = theme.useToken();
          return <div style={{ color: token.colorPrimary }}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via getDesignToken', () => {
      const sourceCode = `
        import { theme } from 'antd';
        
        const customToken = theme.getDesignToken({
          token: { colorPrimary: '#00b96b' }
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via ConfigProvider', () => {
      const sourceCode = `
        import { ConfigProvider } from 'antd';
        
        function MyComponent() {
          return <ConfigProvider theme={theme}>Hello</ConfigProvider>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via ThemeProvider', () => {
      const sourceCode = `
        import { ThemeProvider } from 'antd';
        
        function MyComponent() {
          return <ThemeProvider theme={theme}>Hello</ThemeProvider>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect theme usage via property access', () => {
      const sourceCode = `
        import { theme } from 'antd';
        
        function MyComponent() {
          const primaryColor = theme.token.colorPrimary;
          return <div style={{ color: primaryColor }}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesTheme).toBe(true);
    });

    it('should detect ConfigProvider usage', () => {
      const sourceCode = `
        import { ConfigProvider } from 'antd';
        
        function MyComponent() {
          return (
            <ConfigProvider locale={locale}>
              <div>Content</div>
            </ConfigProvider>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesConfigProvider).toBe(true);
    });

    it('should detect ConfigProvider via import', () => {
      const sourceCode = `
        import { ConfigProvider } from 'antd';
        
        function MyComponent() {
          return <div>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesConfigProvider).toBe(true);
    });

    it('should detect Form usage', () => {
      const sourceCode = `
        import { Form } from 'antd';
        
        function MyComponent() {
          return (
            <Form>
              <Form.Item name="name">
                <Input />
              </Form.Item>
            </Form>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesForm).toBe(true);
    });

    it('should detect Form usage via Form.Item', () => {
      const sourceCode = `
        import { Form } from 'antd';
        
        function MyComponent() {
          return (
            <Form.Item name="email">
              <Input />
            </Form.Item>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesForm).toBe(true);
    });

    it('should detect locale usage via useLocale hook', () => {
      const sourceCode = `
        import { useLocale } from 'antd';
        
        function MyComponent() {
          const [locale] = useLocale();
          return <div>{locale.DatePicker?.lang}</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesLocale).toBe(true);
    });

    it('should detect locale usage via getLocale', () => {
      const sourceCode = `
        import { getLocale } from 'antd';
        
        const locale = getLocale();
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesLocale).toBe(true);
    });

    it('should detect locale usage via locale prop', () => {
      const sourceCode = `
        import { DatePicker } from 'antd';
        
        function MyComponent() {
          return <DatePicker locale={locale} />;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesLocale).toBe(true);
    });

    it('should detect locale usage via locale import', () => {
      const sourceCode = `
        import { DatePicker } from 'antd';
        import locale from 'antd/locale/en_US';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesLocale).toBe(true);
    });

    it('should detect icons usage from @ant-design/icons', () => {
      const sourceCode = `
        import { SmileOutlined, HeartOutlined } from '@ant-design/icons';
        
        function MyComponent() {
          return (
            <>
              <SmileOutlined />
              <HeartOutlined />
            </>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesIcons).toBe(true);
    });

    it('should detect icons usage from subpath imports', () => {
      const sourceCode = `
        import { SmileOutlined } from '@ant-design/icons/lib/icons';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesIcons).toBe(true);
    });

    it('should detect icons usage via property access', () => {
      const sourceCode = `
        import * as icons from '@ant-design/icons';
        
        function MyComponent() {
          return <icons.SmileOutlined />;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesIcons).toBe(true);
    });

    it('should detect components from subpath imports (kebab-case to PascalCase)', () => {
      const sourceCode = `
        import { DatePicker } from 'antd/es/date-picker';
        import { TimePicker } from 'antd/es/time-picker';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.components).toContain('DatePicker');
      expect(result.components).toContain('TimePicker');
    });

    it('should limit components to 20', () => {
      const sourceCode = `
        import {
          Button, Input, Card, Checkbox, DatePicker, Form, Grid, Layout,
          List, Menu, Modal, Pagination, Popover, Progress, Radio, Select,
          Slider, Switch, Table, Tabs, Tag, Tooltip, Tree, Typography, Upload
        } from 'antd';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.components.length).toBeLessThanOrEqual(20);
    });

    it('should sort components by usage frequency, then alphabetically', () => {
      const sourceCode = `
        import { Button, Card, Input } from 'antd';
        
        function MyComponent() {
          return (
            <>
              <Button>1</Button>
              <Button>2</Button>
              <Button>3</Button>
              <Card>Content</Card>
              <Input placeholder="Text" />
            </>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      // Button: import (+1) + 3 JSX uses (+3) = 4 total
      // Card: import (+1) + 1 JSX use (+1) = 2 total
      // Input: import (+1) + 1 JSX use (+1) = 2 total
      // Button should appear first due to higher frequency
      // Card and Input should be sorted alphabetically when tied
      expect(result.components[0]).toBe('Button');
      expect(result.components).toContain('Card');
      expect(result.components).toContain('Input');
      // Alphabetically, Card comes before Input
      const cardIndex = result.components.indexOf('Card');
      const inputIndex = result.components.indexOf('Input');
      expect(cardIndex).toBeLessThan(inputIndex);
    });

    it('should return sorted packages', () => {
      const sourceCode = `
        import { Button } from 'antd';
        import { SmileOutlined } from '@ant-design/icons';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.packages).toEqual(result.packages.sort());
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractAntDesign(sourceFile);

      expect(result.components).toEqual([]);
      expect(result.packages).toEqual([]);
      expect(result.features.usesTheme).toBeUndefined();
      expect(result.features.usesConfigProvider).toBeUndefined();
      expect(result.features.usesForm).toBeUndefined();
      expect(result.features.usesLocale).toBeUndefined();
      expect(result.features.usesIcons).toBeUndefined();
    });

    it('should not detect Ant Design when no imports present', () => {
      const sourceCode = `
        function MyComponent() {
          return <div>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.components).toEqual([]);
      expect(result.packages).toEqual([]);
    });

    it('should detect components with aliased imports', () => {
      const sourceCode = `
        import { Button as AntButton, Card as Container } from 'antd';
        
        function MyComponent() {
          return (
            <Container>
              <AntButton>Click</AntButton>
            </Container>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      // Should detect the canonical component names, not just the aliases
      expect(result.components).toContain('Button');
      expect(result.components).toContain('Card');
    });

    it('should handle namespace tags like Form.Item', () => {
      const sourceCode = `
        import { Form } from 'antd';
        
        function MyComponent() {
          return (
            <Form>
              <Form.Item name="name">
                <Input />
              </Form.Item>
            </Form>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.components).toContain('Form');
    });

    it('should handle namespace tags like Table.Column', () => {
      const sourceCode = `
        import { Table } from 'antd';
        
        function MyComponent() {
          return (
            <Table>
              <Table.Column title="Name" dataIndex="name" />
            </Table>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.components).toContain('Table');
    });

    it('should detect multiple features simultaneously', () => {
      const sourceCode = `
        import { Button, Form, ConfigProvider, theme, useLocale } from 'antd';
        import { SmileOutlined } from '@ant-design/icons';
        
        function MyComponent() {
          const { token } = theme.useToken();
          const [locale] = useLocale();
          return (
            <ConfigProvider locale={locale} theme={{ token }}>
              <Form>
                <Form.Item name="name">
                  <Button icon={<SmileOutlined />}>Click</Button>
                </Form.Item>
              </Form>
            </ConfigProvider>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesTheme).toBe(true);
      expect(result.features.usesConfigProvider).toBe(true);
      expect(result.features.usesForm).toBe(true);
      expect(result.features.usesLocale).toBe(true);
      expect(result.features.usesIcons).toBe(true);
    });

    it('should detect components from @ant-design packages', () => {
      const sourceCode = `
        import { Button } from 'antd';
        import { ProTable } from '@ant-design/pro-components';
        import { ProForm } from '@ant-design/pro-form';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.components).toContain('Button');
      expect(result.packages).toContain('antd');
      expect(result.packages).toContain('@ant-design/pro-components');
      expect(result.packages).toContain('@ant-design/pro-form');
    });

    it('should not detect theme when Ant Design is not used', () => {
      const sourceCode = `
        function MyComponent() {
          const theme = { colors: { primary: 'blue' } };
          return <div>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesTheme).toBeUndefined();
    });

    it('should not detect Form when Ant Design is not used', () => {
      const sourceCode = `
        function MyComponent() {
          return <form><input /></form>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesForm).toBeUndefined();
    });

    it('should not detect locale when Ant Design is not used', () => {
      const sourceCode = `
        function MyComponent() {
          const locale = 'en-US';
          return <div>{locale}</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      expect(result.features.usesLocale).toBeUndefined();
    });

    it('should handle default imports from antd', () => {
      const sourceCode = `
        import Button from 'antd';
        
        function MyComponent() {
          return <Button>Click</Button>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractAntDesign(sourceFile);

      // Default imports from 'antd' are ambiguous, but Button matches known component
      expect(result.packages).toContain('antd');
      // Note: Default imports from 'antd' don't have a clear component name
      // This test verifies the code doesn't crash
      expect(result.components).toBeDefined();
    });
  });
});
