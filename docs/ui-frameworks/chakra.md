# Chakra UI Support

LogicStamp Context provides specialized support for Chakra UI, a popular React component library that provides a set of accessible, composable, and customizable components.

## Chakra UI Detection

LogicStamp automatically detects Chakra UI usage by:

- **Package imports**: Detects imports from `@chakra-ui/*` packages
- **Component names**: Recognizes Chakra UI component names
- **Theme usage**: Identifies Chakra UI theme and styling patterns
- **System props**: Detects Chakra UI's system props on layout components

## What Gets Extracted

### Chakra UI Components

All Chakra UI components are detected and extracted:

```tsx
import { Box, Button, Card, FormControl, Input, Stack } from '@chakra-ui/react';
import { ChakraProvider } from '@chakra-ui/react';

function MyComponent() {
  return (
    <Card>
      <Stack spacing={4}>
        <FormControl>
          <Input placeholder="Name" />
        </FormControl>
        <Button colorScheme="blue">Submit</Button>
      </Stack>
    </Card>
  );
}
```

**Component Detection:**

Components are detected from:
- Named imports: `import { Button, Card } from '@chakra-ui/react'`
- Default imports: `import Button from '@chakra-ui/react'` (canonical name derived from module path)
- Default imports with aliases: `import Btn from '@chakra-ui/react'` (canonical name derived from module path)
- Aliased imports: `import { Button as ChakraButton } from '@chakra-ui/react'`
- JSX usage: Components used in JSX are detected and counted

**Component Ranking:**

Components are ranked by usage frequency (most used first), then alphabetically when tied. Up to 20 components are returned to keep context bundles focused.

**How ranking works:** Each component occurrence (imports + JSX usage) increments its count. Components are sorted by count (descending), then alphabetically when tied. Only the top 20 most frequently used components are included. See [Component Ranking and Limits](../../cli/style.md#component-ranking-and-limits) for detailed explanation.

**Detected components include:**

#### Layout Components
- `Box`, `Container`, `Flex`, `Grid`, `SimpleGrid`, `Stack`, `HStack`, `VStack`, `Wrap`, `WrapItem`
- `AspectRatio`, `Divider`

#### Form Components
- `Button`, `IconButton`, `CloseButton`
- `Input`, `InputGroup`, `InputLeftElement`, `InputRightElement`
- `NumberInput`, `Textarea`, `Select`
- `Checkbox`, `Radio`, `RadioGroup`, `Switch`, `Slider`
- `FormControl`, `FormLabel`, `FormErrorMessage`, `FormHelperText`
- `Editable`

#### Data Display
- `Table`, `List`, `ListItem`
- `Card`, `Badge`, `Tag`, `Avatar`
- `Code`, `Heading`, `Text`
- `Skeleton`, `Spinner`, `CircularProgress`, `Progress`
- `Stat`, `StatLabel`, `StatNumber`, `StatHelpText`
- `Image`, `Alert`, `AlertDialog`

#### Feedback
- `Alert`, `AlertDialog`, `Modal`, `Drawer`
- `Popover`, `Tooltip`
- `Accordion`, `Collapse`

#### Navigation
- `Breadcrumb`, `Link`, `Menu`, `MenuItem`
- `Tabs`, `Tab`

#### Other
- `Icon`, `Container`

### Chakra UI Packages

LogicStamp detects Chakra UI package usage:

```tsx
import { Button } from '@chakra-ui/react';
import { extendTheme } from '@chakra-ui/react';
import { useColorMode } from '@chakra-ui/react';
```

**Detected packages:**
- `@chakra-ui/react` - Core components
- `@chakra-ui/*` - Other Chakra UI packages

**Import Patterns:**

All import patterns are supported:
```tsx
// Named imports
import { Button, Card } from '@chakra-ui/react';

// Default imports from individual packages
import Button from '@chakra-ui/react';

// Default imports with aliases (derives canonical name from module path)
import Btn from '@chakra-ui/react';
import CustomButton from '@chakra-ui/react';

// Aliased named imports
import { Button as ChakraButton, Card as ContainerCard } from '@chakra-ui/react';

// All are detected correctly
function App() {
  return (
    <ContainerCard>
      <ChakraButton>Click</ChakraButton>
      <Btn>Also works</Btn>
      <CustomButton>Works too</CustomButton>
    </ContainerCard>
  );
}
```

### Theme Usage

Chakra UI theme usage is detected:

```tsx
import { ChakraProvider, extendTheme, useTheme } from '@chakra-ui/react';

const theme = extendTheme({
  colors: {
    brand: {
      50: '#f0f9ff',
      500: '#3b82f6',
      900: '#1e3a8a',
    },
  },
});

function ThemedComponent() {
  const theme = useTheme();
  return <Box bg={theme.colors.brand[500]}>Content</Box>;
}

function App() {
  return (
    <ChakraProvider theme={theme}>
      {/* App content */}
    </ChakraProvider>
  );
}
```

**Detected:**
- Theme provider usage (`ChakraProvider` import and JSX usage)
- Theme creation (`extendTheme`, `createTheme` function calls)
- Theme hook usage (`useTheme` function calls)
- Theme property access (direct `theme.property` access)
- Note: Custom theme configuration values are not extracted, only theme usage patterns are detected

### Color Mode Usage

Chakra UI's color mode (dark/light mode) is detected:

```tsx
import { useColorMode, useColorModeValue, ColorModeScript } from '@chakra-ui/react';

function MyComponent() {
  const { colorMode, toggleColorMode } = useColorMode();
  const bg = useColorModeValue('white', 'gray.800');
  
  return (
    <Box bg={bg}>
      <Button onClick={toggleColorMode}>
        Toggle {colorMode === 'light' ? 'Dark' : 'Light'}
      </Button>
    </Box>
  );
}

function App() {
  return (
    <>
      <ColorModeScript />
      <ChakraProvider>
        {/* App content */}
      </ChakraProvider>
    </>
  );
}
```

**Detected:**
- `useColorMode` hook usage
- `useColorModeValue` hook usage
- `ColorModeScript` component usage
- `colorMode` property access

### Responsive Props

Chakra UI's responsive prop pattern (array syntax) is detected:

```tsx
import { Box, Stack, Grid } from '@chakra-ui/react';

function Responsive() {
  return (
    <>
      <Box w={['100%', '50%', '33%']} p={[2, 4, 6]}>
        Responsive Box
      </Box>
      <Stack direction={['column', 'row']} spacing={4}>
        Items
      </Stack>
      <Grid templateColumns={['1fr', '1fr 1fr', '1fr 1fr 1fr']} gap={4}>
        Grid Items
      </Grid>
    </>
  );
}
```

**Detected:**
- Responsive prop usage (array syntax: `[base, md, lg]`)
- Array literal expressions in prop values
- Note: Specific breakpoint values are not extracted, only the presence of responsive props is detected

### System Props

Chakra UI's system props on layout components are detected:

```tsx
import { Box, Stack, Flex, HStack, VStack, Grid, SimpleGrid } from '@chakra-ui/react';

function SystemProps() {
  return (
    <>
      <Box p={4} m={2} bg="blue.500" color="white" borderRadius="md">
        Content
      </Box>
      <Stack spacing={4} p={4} direction="row">
        Items
      </Stack>
      <Flex gap={4} p={4} align="center">
        Flex Items
      </Flex>
      <Grid templateColumns="repeat(3, 1fr)" gap={4} p={4}>
        Grid Items
      </Grid>
    </>
  );
}
```

**Components that support system props:**
- `Box` - Full system prop support
- `Stack`, `HStack`, `VStack` - Spacing and layout system props
- `Flex` - Flexbox system props
- `Grid`, `SimpleGrid` - Grid system props

**Extracted:**
- System prop usage (`p`, `m`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `mx`, `my`, `mt`, `mb`, `ml`, `mr`)
- Sizing props (`w`, `h`, `minW`, `minH`, `maxW`, `maxH`)
- Color props (`bg`, `color`)
- Border props (`border`, `rounded`)
- Shadow and opacity (`shadow`, `opacity`)
- Position props (`zIndex`, `position`, `top`, `right`, `bottom`, `left`)
- Note: Specific prop values are not extracted, only the presence of system props is detected

## Style Extraction

When using `stamp context --include-style`, Chakra UI styling is included:

```json
{
  "style": {
    "sources": ["chakra"],
    "chakra": {
      "components": ["Button", "Card", "Box", "Stack", "Input"],
      "packages": ["@chakra-ui/react"],
      "features": {
        "usesTheme": true,
        "usesColorMode": true,
        "usesResponsiveProps": true,
        "usesSystemProps": true
      }
    }
  }
}
```

**Component Extraction Details:**
- Components are ranked by usage frequency (most used first)
- When tied, components are sorted alphabetically
- Up to 20 components are included to keep context bundles focused
- Component usage is counted from both imports and JSX usage

## Chakra UI-Specific Features

### System Props

Chakra UI's system props provide a shorthand for common styling:

```tsx
import { Box, Stack, Flex } from '@chakra-ui/react';

function SystemProps() {
  return (
    <>
      <Box p={4} m={2} bg="blue.500" color="white" borderRadius="md">
        Content
      </Box>
      <Stack spacing={4} p={4} direction="row">
        Items
      </Stack>
      <Flex gap={4} p={4} align="center">
        Flex Items
      </Flex>
    </>
  );
}
```

**System props detected:**
- Spacing: `p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `m`, `mx`, `my`, `mt`, `mb`, `ml`, `mr`
- Sizing: `w`, `h`, `minW`, `minH`, `maxW`, `maxH`
- Colors: `bg`, `color`
- Borders: `border`, `rounded`
- Effects: `shadow`, `opacity`
- Position: `zIndex`, `position`, `top`, `right`, `bottom`, `left`

### Responsive Design

Chakra UI's responsive prop pattern is detected:

```tsx
import { Box, Stack } from '@chakra-ui/react';

function Responsive() {
  return (
    <>
      <Box w={['100%', '50%', '33%']} p={[2, 4, 6]}>
        Responsive Box
      </Box>
      <Stack direction={['column', 'row']} spacing={4}>
        Items
      </Stack>
    </>
  );
}
```

**Detected:**
- Responsive prop usage (boolean flag: `usesResponsiveProps: true`)
- Note: Responsive breakpoint values within arrays are not extracted, only the presence of responsive props is detected

### Color Mode

Chakra UI's built-in color mode support is detected:

```tsx
import { useColorMode, useColorModeValue, ColorModeScript } from '@chakra-ui/react';

function MyComponent() {
  const { colorMode, toggleColorMode } = useColorMode();
  const bg = useColorModeValue('white', 'gray.800');
  
  return (
    <Box bg={bg}>
      <Button onClick={toggleColorMode}>
        Toggle {colorMode === 'light' ? 'Dark' : 'Light'}
      </Button>
    </Box>
  );
}
```

**Detected:**
- Color mode hook usage (`useColorMode`, `useColorModeValue`)
- Color mode script usage (`ColorModeScript`)
- Color mode property access

## Usage

```bash
# Extract Chakra UI components and styles
stamp context --include-style

# Or use the style command
stamp context style
```

## Chakra UI Project Structure

LogicStamp recognizes Chakra UI usage patterns:

```
my-app/
  theme/
    index.ts           # Theme configuration
  components/
    Button.tsx         # Chakra UI components
  app/
    page.tsx
```

## Best Practices

1. **Use ChakraProvider**: Wrap your app with `ChakraProvider` for theme configuration
2. **System props**: Leverage system props for common styling on layout components
3. **Responsive props**: Use array syntax for responsive design
4. **Color mode**: Use `useColorMode` and `useColorModeValue` for dark/light mode support
5. **Component composition**: Use Chakra UI's composition patterns

## Common Patterns

### Themed Application

```tsx
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { ColorModeScript } from '@chakra-ui/react';

const theme = extendTheme({
  colors: {
    brand: {
      50: '#f0f9ff',
      500: '#3b82f6',
      900: '#1e3a8a',
    },
  },
});

function App() {
  return (
    <>
      <ColorModeScript />
      <ChakraProvider theme={theme}>
        {/* App content */}
      </ChakraProvider>
    </>
  );
}
```

### Form with Chakra UI

```tsx
import { FormControl, FormLabel, Input, Button, Stack } from '@chakra-ui/react';

function MyForm() {
  return (
    <Stack spacing={4} as="form">
      <FormControl>
        <FormLabel>Name</FormLabel>
        <Input placeholder="Enter name" />
      </FormControl>
      <FormControl>
        <FormLabel>Email</FormLabel>
        <Input type="email" placeholder="Enter email" />
      </FormControl>
      <Button type="submit" colorScheme="blue">
        Submit
      </Button>
    </Stack>
  );
}
```

### Card Component

```tsx
import { Card, CardHeader, CardBody, CardFooter, Button, Heading } from '@chakra-ui/react';

function UserCard({ user }: { user: User }) {
  return (
    <Card>
      <CardHeader>
        <Heading size="md">{user.name}</Heading>
      </CardHeader>
      <CardBody>
        <Text>{user.bio}</Text>
      </CardBody>
      <CardFooter>
        <Button size="sm">Edit</Button>
        <Button size="sm" colorScheme="red">Delete</Button>
      </CardFooter>
    </Card>
  );
}
```

### Responsive Layout

```tsx
import { Box, Stack, Grid } from '@chakra-ui/react';

function ResponsiveLayout() {
  return (
    <Box p={[4, 6, 8]}>
      <Stack direction={['column', 'row']} spacing={4}>
        <Box w={['100%', '50%']}>Left</Box>
        <Box w={['100%', '50%']}>Right</Box>
      </Stack>
      <Grid templateColumns={['1fr', '1fr 1fr', '1fr 1fr 1fr']} gap={4} mt={4}>
        <Box>Item 1</Box>
        <Box>Item 2</Box>
        <Box>Item 3</Box>
      </Grid>
    </Box>
  );
}
```

## Limitations

- Dynamic theme creation at runtime may not be fully captured
- Custom Chakra UI component modifications may not be detected
- Some advanced Chakra UI patterns may have limited extraction
- Responsive prop values within arrays are not extracted, only the presence of responsive props is detected
- System prop values are not extracted, only the presence of system props is detected

## Related Documentation

- [Style Extraction](../cli/style.md) - Complete style extraction guide
- [React Support](../frameworks/react.md) - React component patterns
- [TypeScript Support](../frameworks/typescript.md) - TypeScript with Chakra UI
