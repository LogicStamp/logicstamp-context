import { describe, it, expect } from 'vitest';
import { extractAntDesign } from '../../../src/extractors/styling/antd.js';
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

describe('Ant Design Extractor', () => {
  describe('Component Detection', () => {
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expectComponents(result, ['Button', 'Card', 'Input']);
      expectPackages(result, ['antd']);
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expectComponents(result, ['Button', 'Card', 'Input']);
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      // Should detect the canonical component names, not just the aliases
      expectComponents(result, ['Button', 'Card']);
    });

    it('should detect components from subpath imports (kebab-case to PascalCase)', () => {
      const sourceCode = `
        import { DatePicker } from 'antd/es/date-picker';
        import { TimePicker } from 'antd/es/time-picker';
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expectComponents(result, ['DatePicker', 'TimePicker']);
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expectComponents(result, ['Form']);
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expectComponents(result, ['Table']);
    });

    it('should handle default imports from antd', () => {
      const sourceCode = `
        import Button from 'antd';
        
        function MyComponent() {
          return <Button>Click</Button>;
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      // Default imports from 'antd' are ambiguous, but Button matches known component
      expectPackages(result, ['antd']);
      // Note: Default imports from 'antd' don't have a clear component name
      // This test verifies the code doesn't crash
      expect(result.components).toBeDefined();
    });
  });

  describe('Package Detection', () => {
    it('should detect multiple Ant Design packages', () => {
      const sourceCode = `
        import { Button } from 'antd';
        import { ConfigProvider } from 'antd';
        import { SmileOutlined } from '@ant-design/icons';
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expectPackages(result, ['antd', '@ant-design/icons']);
    });

    it('should detect components from @ant-design packages', () => {
      const sourceCode = `
        import { Button } from 'antd';
        import { ProTable } from '@ant-design/pro-components';
        import { ProForm } from '@ant-design/pro-form';
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expectComponents(result, ['Button']);
      expectPackages(result, ['antd', '@ant-design/pro-components', '@ant-design/pro-form']);
    });

    it('should return sorted packages', () => {
      const sourceCode = `
        import { Button } from 'antd';
        import { SmileOutlined } from '@ant-design/icons';
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expectSortedPackages(result);
    });
  });

  describe('Theme Detection', () => {
    const themeTestCases: StyleExtractorTestCase<ReturnType<typeof extractAntDesign>>[] = [
      {
        description: 'should detect theme usage via useToken hook',
        sourceCode: `
          import { theme } from 'antd';
          
          function MyComponent() {
            const { token } = theme.useToken();
            return <div style={{ color: token.colorPrimary }}>Hello</div>;
          }
        `,
        assertions: result => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via getDesignToken',
        sourceCode: `
          import { theme } from 'antd';
          
          const customToken = theme.getDesignToken({
            token: { colorPrimary: '#00b96b' }
          });
        `,
        assertions: result => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via ConfigProvider',
        sourceCode: `
          import { ConfigProvider } from 'antd';
          
          function MyComponent() {
            return <ConfigProvider theme={theme}>Hello</ConfigProvider>;
          }
        `,
        assertions: result => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via ThemeProvider',
        sourceCode: `
          import { ThemeProvider } from 'antd';
          
          function MyComponent() {
            return <ThemeProvider theme={theme}>Hello</ThemeProvider>;
          }
        `,
        assertions: result => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
      {
        description: 'should detect theme usage via property access',
        sourceCode: `
          import { theme } from 'antd';
          
          function MyComponent() {
            const primaryColor = theme.token.colorPrimary;
            return <div style={{ color: primaryColor }}>Hello</div>;
          }
        `,
        assertions: result => {
          expect(result.features.usesTheme).toBe(true);
        },
      },
    ];

    runExtractorTests(extractAntDesign, themeTestCases);

    it('should not detect theme when Ant Design is not used', () => {
      const sourceCode = `
        function MyComponent() {
          const theme = { colors: { primary: 'blue' } };
          return <div>Hello</div>;
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expect(result.features.usesTheme).toBeUndefined();
    });
  });

  describe('ConfigProvider Detection', () => {
    const configProviderTestCases: StyleExtractorTestCase<ReturnType<typeof extractAntDesign>>[] = [
      {
        description: 'should detect ConfigProvider usage',
        sourceCode: `
          import { ConfigProvider } from 'antd';
          
          function MyComponent() {
            return (
              <ConfigProvider locale={locale}>
                <div>Content</div>
              </ConfigProvider>
            );
          }
        `,
        assertions: result => {
          expect(result.features.usesConfigProvider).toBe(true);
        },
      },
      {
        description: 'should detect ConfigProvider via import',
        sourceCode: `
          import { ConfigProvider } from 'antd';
          
          function MyComponent() {
            return <div>Hello</div>;
          }
        `,
        assertions: result => {
          expect(result.features.usesConfigProvider).toBe(true);
        },
      },
    ];

    runExtractorTests(extractAntDesign, configProviderTestCases);
  });

  describe('Form Detection', () => {
    const formTestCases: StyleExtractorTestCase<ReturnType<typeof extractAntDesign>>[] = [
      {
        description: 'should detect Form usage',
        sourceCode: `
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
        `,
        assertions: result => {
          expect(result.features.usesForm).toBe(true);
        },
      },
      {
        description: 'should detect Form usage via Form.Item',
        sourceCode: `
          import { Form } from 'antd';
          
          function MyComponent() {
            return (
              <Form.Item name="email">
                <Input />
              </Form.Item>
            );
          }
        `,
        assertions: result => {
          expect(result.features.usesForm).toBe(true);
        },
      },
    ];

    runExtractorTests(extractAntDesign, formTestCases);

    it('should not detect Form when Ant Design is not used', () => {
      const sourceCode = `
        function MyComponent() {
          return <form><input /></form>;
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expect(result.features.usesForm).toBeUndefined();
    });
  });

  describe('Locale Detection', () => {
    const localeTestCases: StyleExtractorTestCase<ReturnType<typeof extractAntDesign>>[] = [
      {
        description: 'should detect locale usage via useLocale hook',
        sourceCode: `
          import { useLocale } from 'antd';
          
          function MyComponent() {
            const [locale] = useLocale();
            return <div>{locale.DatePicker?.lang}</div>;
          }
        `,
        assertions: result => {
          expect(result.features.usesLocale).toBe(true);
        },
      },
      {
        description: 'should detect locale usage via getLocale',
        sourceCode: `
          import { getLocale } from 'antd';
          
          const locale = getLocale();
        `,
        assertions: result => {
          expect(result.features.usesLocale).toBe(true);
        },
      },
      {
        description: 'should detect locale usage via locale prop',
        sourceCode: `
          import { DatePicker } from 'antd';
          
          function MyComponent() {
            return <DatePicker locale={locale} />;
          }
        `,
        assertions: result => {
          expect(result.features.usesLocale).toBe(true);
        },
      },
      {
        description: 'should detect locale usage via locale import',
        sourceCode: `
          import { DatePicker } from 'antd';
          import locale from 'antd/locale/en_US';
        `,
        assertions: result => {
          expect(result.features.usesLocale).toBe(true);
        },
      },
    ];

    runExtractorTests(extractAntDesign, localeTestCases);

    it('should not detect locale when Ant Design is not used', () => {
      const sourceCode = `
        function MyComponent() {
          const locale = 'en-US';
          return <div>{locale}</div>;
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expect(result.features.usesLocale).toBeUndefined();
    });
  });

  describe('Icons Detection', () => {
    const iconsTestCases: StyleExtractorTestCase<ReturnType<typeof extractAntDesign>>[] = [
      {
        description: 'should detect icons usage from @ant-design/icons',
        sourceCode: `
          import { SmileOutlined, HeartOutlined } from '@ant-design/icons';
          
          function MyComponent() {
            return (
              <>
                <SmileOutlined />
                <HeartOutlined />
              </>
            );
          }
        `,
        assertions: result => {
          expect(result.features.usesIcons).toBe(true);
        },
      },
      {
        description: 'should detect icons usage from subpath imports',
        sourceCode: `
          import { SmileOutlined } from '@ant-design/icons/lib/icons';
        `,
        assertions: result => {
          expect(result.features.usesIcons).toBe(true);
        },
      },
      {
        description: 'should detect icons usage via property access',
        sourceCode: `
          import * as icons from '@ant-design/icons';
          
          function MyComponent() {
            return <icons.SmileOutlined />;
          }
        `,
        assertions: result => {
          expect(result.features.usesIcons).toBe(true);
        },
      },
    ];

    runExtractorTests(extractAntDesign, iconsTestCases);
  });

  describe('Component Sorting and Limits', () => {
    it('should limit components to 20', () => {
      const sourceCode = `
        import {
          Button, Input, Card, Checkbox, DatePicker, Form, Grid, Layout,
          List, Menu, Modal, Pagination, Popover, Progress, Radio, Select,
          Slider, Switch, Table, Tabs, Tag, Tooltip, Tree, Typography, Upload
        } from 'antd';
      `;

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expectComponentLimit(result, 20);
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      // Button: import (+1) + 3 JSX uses (+3) = 4 total
      // Card: import (+1) + 1 JSX use (+1) = 2 total
      // Input: import (+1) + 1 JSX use (+1) = 2 total
      // Button should appear first due to higher frequency
      // Card and Input should be sorted alphabetically when tied
      expect(result.components[0]).toBe('Button');
      expectComponents(result, ['Card', 'Input']);
      // Alphabetically, Card comes before Input
      const cardIndex = result.components.indexOf('Card');
      const inputIndex = result.components.indexOf('Input');
      expect(cardIndex).toBeLessThan(inputIndex);
    });
  });

  describe('Feature Combinations', () => {
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expect(result.features.usesTheme).toBe(true);
      expect(result.features.usesConfigProvider).toBe(true);
      expect(result.features.usesForm).toBe(true);
      expect(result.features.usesLocale).toBe(true);
      expect(result.features.usesIcons).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file', () => {
      const sourceFile = createTestSourceFile('');
      const result = extractAntDesign(sourceFile);

      expectEmptyResult(result);
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

      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractAntDesign(sourceFile);

      expectEmptyResult(result);
    });
  });
});
