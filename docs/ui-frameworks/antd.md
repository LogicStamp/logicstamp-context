# Ant Design Support

LogicStamp Context provides specialized support for Ant Design (antd), a popular React component library implementing enterprise-class UI design language.

## Ant Design Detection

LogicStamp automatically detects Ant Design usage by:

- **Package imports**: Detects imports from `antd` or `@ant-design/*` packages
- **Component names**: Recognizes Ant Design component names
- **Subpath imports**: Handles subpath imports like `antd/es/date-picker`
- **JSX usage**: Identifies Ant Design components used in JSX

## What Gets Extracted

### Ant Design Components

All Ant Design components are detected and extracted:

```tsx
import { Button, Card, Form, Input, Table, DatePicker } from 'antd';
import { UserOutlined } from '@ant-design/icons';

function MyComponent() {
  return (
    <Card>
      <Form>
        <Form.Item label="Name">
          <Input prefix={<UserOutlined />} />
        </Form.Item>
        <Button type="primary">Submit</Button>
      </Form>
      <Table dataSource={data} columns={columns} />
    </Card>
  );
}
```

**Component Detection:**

Components are detected from:
- Named imports: `import { Button, Card } from 'antd'`
- Subpath imports: `import DatePicker from 'antd/es/date-picker'`
- Default imports with aliases: `import Btn from 'antd/es/button'` (canonical name derived from module path)
- Aliased imports: `import { Button as AntButton } from 'antd'`
- JSX usage: Components used in JSX are detected and counted
- Namespace components: `Form.Item`, `Table.Column`, etc. are detected

**Component Ranking:**

Components are ranked by usage frequency (most used first), then alphabetically when tied. Up to 20 components are returned to keep context bundles focused.

**How ranking works:** Each component occurrence (imports + JSX usage) increments its count. Components are sorted by count (descending), then alphabetically when tied. Only the top 20 most frequently used components are included. See [Component Ranking and Limits](../../cli/style.md#component-ranking-and-limits) for detailed explanation.

**Detected components include:**

#### Layout Components
- `Layout`, `Row`, `Col`, `Grid`, `Space`, `Divider`
- `Breadcrumb`, `PageHeader`

#### Form Components
- `Button`, `ButtonGroup`, `IconButton`
- `Input`, `InputNumber`, `Textarea`, `InputGroup`, `Input.Search`
- `Form`, `Form.Item`, `Form.List`
- `Checkbox`, `Radio`, `RadioGroup`, `Switch`, `Slider`, `Rate`
- `Select`, `Cascader`, `AutoComplete`, `Mentions`
- `DatePicker`, `TimePicker`, `Calendar`
- `Upload`, `Transfer`

#### Data Display
- `Table`, `List`, `Descriptions`
- `Card`, `Collapse`, `Timeline`
- `Tag`, `Badge`, `Avatar`, `Empty`
- `Typography`, `Typography.Text`, `Typography.Title`, `Typography.Paragraph`
- `Skeleton`, `Progress`, `Statistic`
- `Image`, `Carousel`

#### Feedback
- `Alert`, `Message`, `Notification`, `Modal`, `Drawer`
- `Popconfirm`, `Popover`, `Tooltip`
- `Spin`, `Result`, `Steps`

#### Navigation
- `Menu`, `MenuItem`, `Tabs`, `Tab`
- `Anchor`, `BackTop`, `Pagination`
- `Dropdown`, `Breadcrumb`

#### Other
- `Affix`, `Watermark`, `ConfigProvider`

### Ant Design Packages

LogicStamp detects Ant Design package usage:

```tsx
import { Button } from 'antd';
import { DatePicker } from 'antd/es/date-picker';
import { UserOutlined } from '@ant-design/icons';
import zhCN from 'antd/es/locale/zh_CN';
```

**Detected packages:**
- `antd` - Core components
- `antd/es/*` - Subpath imports (e.g., `antd/es/date-picker`)
- `@ant-design/icons` - Ant Design icons
- `@ant-design/*` - Other Ant Design packages

**Import Patterns:**

All import patterns are supported:
```tsx
// Named imports
import { Button, Card } from 'antd';

// Subpath imports
import DatePicker from 'antd/es/date-picker';
import { DatePicker } from 'antd/es/date-picker';

// Default imports with aliases (derives canonical name from module path)
import Btn from 'antd/es/button';
import CustomDatePicker from 'antd/es/date-picker';

// Aliased named imports
import { Button as AntButton, Card as ContainerCard } from 'antd';

// All are detected correctly
function App() {
  return (
    <ContainerCard>
      <AntButton>Click</AntButton>
      <Btn>Also works</Btn>
      <CustomDatePicker />
    </ContainerCard>
  );
}
```

### Theme Usage

Ant Design theme usage is detected:

```tsx
import { ConfigProvider } from 'antd';
import { theme } from 'antd';
import { useToken } from 'antd/es/theme';
import { getDesignToken } from 'antd/es/theme';

const customTheme = {
  token: {
    colorPrimary: '#00b96b',
  },
};

function ThemedComponent() {
  const { token } = useToken();
  return <Button style={{ backgroundColor: token.colorPrimary }}>Themed</Button>;
}

function App() {
  return (
    <ConfigProvider theme={customTheme}>
      {/* App content */}
    </ConfigProvider>
  );
}
```

**Detected:**
- Theme provider usage (`ConfigProvider` import and JSX usage)
- Theme hook usage (`useToken` function calls)
- Theme function usage (`theme`, `getDesignToken` function calls)
- Theme property access (direct `theme.property` access)
- Note: Custom theme configuration values are not extracted, only theme usage patterns are detected

### ConfigProvider Usage

Ant Design's `ConfigProvider` is detected:

```tsx
import { ConfigProvider } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';

function App() {
  return (
    <ConfigProvider locale={zhCN} theme={customTheme}>
      {/* App content */}
    </ConfigProvider>
  );
}
```

**Detected:**
- `ConfigProvider` import
- `ConfigProvider` JSX usage

### Form Usage

Ant Design's extensive form features are detected:

```tsx
import { Form, Form.Item } from 'antd';

function MyForm() {
  return (
    <Form>
      <Form.Item name="username" label="Username" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="email" label="Email">
        <Input type="email" />
      </Form.Item>
    </Form>
  );
}
```

**Detected:**
- `Form` component usage
- `Form.Item` namespace component usage
- `Form.List` namespace component usage

### Locale/Internationalization Usage

Ant Design's locale and i18n features are detected:

```tsx
import { ConfigProvider } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import { useLocale } from 'antd/es/locale';
import { getLocale } from 'antd/es/locale';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      {/* App content */}
    </ConfigProvider>
  );
}

function MyComponent() {
  const locale = useLocale();
  return <Button>{locale.Button.ok}</Button>;
}
```

**Detected:**
- `useLocale` hook usage
- `getLocale` function calls
- Locale imports (packages containing `locale` or `i18n`)
- `locale` prop usage on components

### Icons Usage

Ant Design icons are detected:

```tsx
import { UserOutlined, HomeOutlined } from '@ant-design/icons';
import { Icon } from '@ant-design/icons';

function MyComponent() {
  return (
    <>
      <UserOutlined />
      <Icon component={CustomIcon} />
    </>
  );
}
```

**Detected:**
- `@ant-design/icons` package imports
- `@ant-design/icons/*` subpath imports
- Icon component usage patterns

## Style Extraction

**Style output shape:** Ant Design data is under `style.styleSources.antd` (see [UIF contracts](../reference/uif-contracts.md)). Default **`--style-mode lean`** keeps **`features` only**. **`--style-mode full`** adds `components` and `packages` arrays. See [Style mode: lean vs full](../cli/style.md#style-mode-lean-vs-full).

When using `stamp context --include-style`, Ant Design styling is included.

**Example (`--style-mode full`):**

```json
{
  "style": {
    "styleSources": {
      "antd": {
        "components": ["Button", "Card", "Form", "Input", "Table"],
        "packages": ["antd", "@ant-design/icons"],
        "features": {
          "usesTheme": true,
          "usesConfigProvider": true,
          "usesForm": true,
          "usesLocale": true,
          "usesIcons": true
        }
      }
    },
    "summary": {
      "mode": "full",
      "sources": ["antd"]
    }
  }
}
```

**Example (`--style-mode lean`, default):**

```json
{
  "style": {
    "styleSources": {
      "antd": {
        "features": {
          "usesTheme": true,
          "usesConfigProvider": true,
          "usesForm": true,
          "usesLocale": true,
          "usesIcons": true
        }
      }
    },
    "summary": {
      "mode": "lean",
      "sources": ["antd"],
      "fullModeBytes": 520
    }
  }
}
```

**Component Extraction Details:**
- Components are ranked by usage frequency (most used first)
- When tied, components are sorted alphabetically
- Up to 20 components are included to keep context bundles focused
- Component usage is counted from both imports and JSX usage
- Namespace components (e.g., `Form.Item`) are detected as part of the parent component

## Ant Design-Specific Features

### Component Composition

Ant Design's compound component pattern is recognized:

```tsx
import { Form, Table } from 'antd';

function MyComponent() {
  return (
    <>
      <Form>
        <Form.Item name="username" label="Username">
          <Input />
        </Form.Item>
        <Form.List name="items">
          {(fields) => fields.map(field => <Form.Item {...field} />)}
        </Form.List>
      </Form>
      <Table>
        <Table.Column title="Name" dataIndex="name" />
        <Table.Column title="Age" dataIndex="age" />
      </Table>
    </>
  );
}
```

**Detected:**
- Namespace component usage (`Form.Item`, `Form.List`, `Table.Column`, etc.)
- Parent component is detected when namespace components are used

### Subpath Imports

Ant Design's subpath import pattern is fully supported:

```tsx
// Subpath imports are detected and component names are derived
import DatePicker from 'antd/es/date-picker';
import { DatePicker } from 'antd/es/date-picker';
import Button from 'antd/es/button';

// Kebab-case paths are converted to PascalCase
// "date-picker" -> "DatePicker"
```

**Extracted:**
- Subpath imports (e.g., `antd/es/date-picker`)
- Component names derived from path segments
- Package names include full subpath

## Usage

```bash
# Extract Ant Design components and styles (lean style output by default)
stamp context --include-style

# Or use the style command
stamp context style

# Include full component/package arrays in style JSON
stamp context style --style-mode full
```

## Ant Design Project Structure

LogicStamp recognizes Ant Design usage patterns:

```
my-app/
  components/
    FormComponent.tsx    # Ant Design components
    TableComponent.tsx
  app/
    page.tsx
  theme/
    index.ts             # Theme configuration
```

## Best Practices

1. **Use ConfigProvider**: Wrap your app with `ConfigProvider` for theme and locale configuration
2. **Form patterns**: Leverage Ant Design's form validation and layout features
3. **Component composition**: Use namespace components (`Form.Item`, `Table.Column`) for better organization
4. **Icons**: Import icons from `@ant-design/icons` for consistency
5. **Subpath imports**: Use subpath imports for better tree-shaking when needed

## Common Patterns

### Themed Application

```tsx
import { ConfigProvider } from 'antd';
import { theme } from 'antd';

const customTheme = {
  token: {
    colorPrimary: '#00b96b',
    borderRadius: 6,
  },
};

function App() {
  return (
    <ConfigProvider theme={customTheme}>
      {/* App content */}
    </ConfigProvider>
  );
}
```

### Form with Ant Design

```tsx
import { Form, Form.Item, Input, Button } from 'antd';

function MyForm() {
  return (
    <Form layout="vertical">
      <Form.Item name="username" label="Username" rules={[{ required: true }]}>
        <Input placeholder="Enter username" />
      </Form.Item>
      <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
        <Input type="email" placeholder="Enter email" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </Form.Item>
    </Form>
  );
}
```

### Table Component

```tsx
import { Table } from 'antd';

const columns = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Age', dataIndex: 'age', key: 'age' },
  { title: 'Address', dataIndex: 'address', key: 'address' },
];

function DataTable({ data }: { data: Data[] }) {
  return <Table dataSource={data} columns={columns} />;
}
```

### Card Component

```tsx
import { Card, Button } from 'antd';

function UserCard({ user }: { user: User }) {
  return (
    <Card
      title={user.name}
      extra={<Button>Edit</Button>}
      actions={[
        <Button key="edit">Edit</Button>,
        <Button key="delete" danger>Delete</Button>,
      ]}
    >
      <p>{user.bio}</p>
    </Card>
  );
}
```

## Limitations

- Dynamic theme creation at runtime may not be fully captured
- Custom Ant Design component modifications may not be detected
- Some advanced Ant Design patterns may have limited extraction
- Locale configuration values are not extracted, only usage patterns are detected

## Related Documentation

- [Style Extraction](../cli/style.md) - Complete style extraction guide
- [React Support](../frameworks/react.md) - React component patterns
- [TypeScript Support](../frameworks/typescript.md) - TypeScript with Ant Design
