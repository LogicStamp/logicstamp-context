# Material UI Support

LogicStamp Context provides specialized support for Material UI (MUI), a popular React component library implementing Google's Material Design.

## Material UI Detection

LogicStamp automatically detects Material UI usage by:

- **Package imports**: Detects imports from `@mui/*` or `@material-ui/*` packages
- **Component names**: Recognizes Material UI component names
- **Theme usage**: Identifies Material UI theme and styling patterns
- **System props**: Detects Material UI's `sx` prop and system styling

## What Gets Extracted

### Material UI Components

All Material UI components are detected and extracted:

```tsx
import { Button, Card, CardContent, CardHeader, TextField } from '@mui/material';
import { Alert } from '@mui/material';

function MyComponent() {
  return (
    <Card>
      <CardHeader title="Title" />
      <CardContent>
        <TextField label="Name" />
        <Button variant="contained">Submit</Button>
        <Alert severity="info">Message</Alert>
      </CardContent>
    </Card>
  );
}
```

**Component Detection:**

Components are detected from:
- Named imports: `import { Button, Card } from '@mui/material'`
- Default imports: `import Button from '@mui/material/Button'`
- Default imports with aliases: `import Btn from '@mui/material/Button'` (canonical name derived from module path)
- Aliased imports: `import { Button as MUIButton } from '@mui/material'`
- JSX usage: Components used in JSX are detected and counted

**Component Ranking:**

Components are ranked by usage frequency (most used first), then alphabetically when tied. Up to 20 components are returned to keep context bundles focused.

**Detected components include:**

#### Layout Components
- `Box`, `Container`, `Grid`, `Stack`, `Paper`
- `AppBar`, `Toolbar`, `Drawer`, `BottomNavigation`

#### Form Components
- `Button`, `ButtonGroup`, `IconButton`, `Fab`
- `TextField`, `Input`, `InputBase`, `InputLabel`, `InputAdornment`
- `Checkbox`, `Radio`, `RadioGroup`, `Switch`, `Slider`
- `Select`, `NativeSelect`, `Autocomplete`
- `FormControl`, `FormGroup`, `FormLabel`, `FormHelperText`

#### Data Display
- `Table`, `TableBody`, `TableCell`, `TableContainer`, `TableFooter`, `TableHead`, `TablePagination`, `TableRow`
- `Card`, `CardContent`, `CardHeader`, `CardActions`, `CardMedia`
- `List`, `ListItem`, `ListItemButton`, `ListItemIcon`, `ListItemText`
- `Chip`, `Badge`, `Avatar`, `Divider`, `Separator`
- `Typography`, `Skeleton`, `CircularProgress`, `LinearProgress`

#### Feedback
- `Alert`, `Snackbar`, `Dialog`, `Modal`, `Backdrop`
- `Tooltip`, `Popover`, `Popper`
- `Stepper`, `MobileStepper`, `Pagination`, `Rating`

#### Navigation
- `Breadcrumbs`, `Link`, `Menu`, `MenuItem`, `Tabs`, `Tab`
- `Drawer`, `BottomNavigation`, `SpeedDial`

#### Surfaces
- `Accordion`, `AppBar`, `Card`, `Paper`

### Material UI Packages

LogicStamp detects Material UI package usage:

```tsx
import { Button } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { DataGrid } from '@mui/x-data-grid';
import { LoadingButton } from '@mui/lab';
```

**Detected packages:**
- `@mui/material` - Core components
- `@mui/icons-material` - Material icons
- `@mui/lab` - Lab components
- `@mui/system` - System utilities and styled API
- `@mui/x-date-pickers` - Date pickers
- `@mui/x-data-grid` - Data grid
- `@material-ui/core` - Legacy package
- `@material-ui/icons` - Legacy icons

**Import Patterns:**

All import patterns are supported:
```tsx
// Named imports
import { Button, Card } from '@mui/material';

// Default imports from individual packages
import Button from '@mui/material/Button';

// Default imports with aliases (derives canonical name from module path)
import Btn from '@mui/material/Button';
import CustomTextField from '@mui/material/TextField';

// Aliased named imports
import { Button as MUIButton, Card as ContainerCard } from '@mui/material';

// All are detected correctly
function App() {
  return (
    <ContainerCard>
      <MUIButton>Click</MUIButton>
      <Btn>Also works</Btn>
      <CustomTextField label="Name" />
    </ContainerCard>
  );
}
```

### Theme Usage

Material UI theme usage is detected:

```tsx
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
});

function ThemedComponent() {
  const theme = useTheme();
  return <Box sx={{ color: theme.palette.primary.main }}>Content</Box>;
}
```

**Detected:**
- Theme provider usage (`ThemeProvider` import)
- Theme creation (`createTheme` function calls)
- Theme hook usage (`useTheme` function calls)
- Theme property access (direct `theme.palette`, `theme.spacing`, etc.)
- Theme usage in styled components and template literals
- Note: Custom theme configuration values are not extracted, only theme usage patterns are detected

### Styling Patterns

Material UI's multiple styling approaches are detected:

#### sx Prop

```tsx
import { Box } from '@mui/material';

function StyledBox() {
  return (
    <Box
      sx={{
        p: 2,
        m: 1,
        bgcolor: 'primary.main',
        borderRadius: 1,
        '&:hover': {
          bgcolor: 'primary.dark',
        },
      }}
    >
      Content
    </Box>
  );
}
```

**Extracted:**
- `sx` prop usage
- System properties
- Responsive breakpoints
- Pseudo-selectors

#### styled API

```tsx
import { styled } from '@mui/material/styles';
import { styled as systemStyled } from '@mui/system';
import { Button } from '@mui/material';

const StyledButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: 'white',
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));
```

**Extracted:**
- `styled` API usage from `@mui/material/styles`
- `styled` API usage from `@mui/system`
- Legacy `styled` from `@material-ui/core/styles`
- Theme access in styles
- Styled component patterns

#### makeStyles (Legacy)

```tsx
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
  },
}));
```

**Extracted:**
- `makeStyles` usage (legacy)
- Theme spacing and other utilities

### Component Variants

Material UI component variants are detected:

```tsx
import { Button, Alert, Card } from '@mui/material';

function Variants() {
  return (
    <>
      <Button variant="contained">Contained</Button>
      <Button variant="outlined">Outlined</Button>
      <Button variant="text">Text</Button>
      <Alert severity="error">Error</Alert>
      <Alert severity="warning">Warning</Alert>
      <Alert severity="info">Info</Alert>
      <Alert severity="success">Success</Alert>
    </>
  );
}
```

**Detected:**
- Component usage (components are detected, but variant/color/size prop values are not extracted)

## Style Extraction

When using `stamp context --include-style`, Material UI styling is included:

```json
{
  "style": {
    "sources": ["material-ui"],
    "material-ui": {
      "components": ["Button", "Card", "TextField"],
      "packages": ["@mui/material"],
      "features": {
        "usesTheme": true,
        "usesSxProp": true,
        "usesStyled": false,
        "usesMakeStyles": false,
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

## Material UI-Specific Features

### System Props

Material UI's system props are detected on components that support them:

```tsx
import { Box, Stack, Grid, Container } from '@mui/material';

function SystemProps() {
  return (
    <>
      <Box p={2} m={1} bgcolor="primary.main" spacing={2}>
        Content
      </Box>
      <Stack spacing={2} direction="row" p={2}>
        Items
      </Stack>
      <Grid container spacing={2} p={2}>
        Grid Item
      </Grid>
      <Container maxWidth="lg" p={2} spacing={2}>
        Content
      </Container>
    </>
  );
}
```

**Components that support system props:**
- `Box` - Full system prop support
- `Stack` - Spacing and layout system props
- `Grid` - Spacing and layout system props
- `Container` - Spacing and layout system props

**Extracted:**
- System prop usage (`spacing`, `color`, `bgcolor`, `p`, `m`, `px`, `py`, `mx`, `my`, etc.)
- Spacing system
- Color system
- Layout system

### Responsive Design

Material UI's responsive breakpoints are detected:

```tsx
import { Box } from '@mui/material';

function Responsive() {
  return (
    <Box
      sx={{
        width: { xs: '100%', sm: '50%', md: '33%' },
        p: { xs: 1, sm: 2, md: 3 },
      }}
    >
      Content
    </Box>
  );
}
```

**Detected:**
- `sx` prop usage (boolean flag: `usesSxProp: true`)
- Note: Responsive breakpoints and prop values within `sx` prop objects are not extracted, only the presence of `sx` prop is detected

## Usage

```bash
# Extract Material UI components and styles
stamp context --include-style

# Or use the style command
stamp context style
```

## Material UI Project Structure

LogicStamp recognizes Material UI usage patterns:

```
my-app/
  theme/
    index.ts           # Theme configuration
  components/
    Button.tsx         # Material UI components
  app/
    page.tsx
```

## Best Practices

1. **Use sx prop**: Prefer `sx` prop for styling (modern approach)
2. **Theme configuration**: Centralize theme configuration
3. **Component composition**: Use Material UI's composition patterns
4. **System props**: Leverage system props for common styling
5. **Responsive design**: Use Material UI's responsive breakpoints

## Common Patterns

### Themed Application

```tsx
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* App content */}
    </ThemeProvider>
  );
}
```

### Form with Material UI

```tsx
import { TextField, Button, Box } from '@mui/material';

function MyForm() {
  return (
    <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField label="Name" variant="outlined" />
      <TextField label="Email" type="email" variant="outlined" />
      <Button variant="contained" type="submit">
        Submit
      </Button>
    </Box>
  );
}
```

### Card Component

```tsx
import { Card, CardContent, CardHeader, CardActions, Button } from '@mui/material';

function UserCard({ user }: { user: User }) {
  return (
    <Card>
      <CardHeader title={user.name} subheader={user.email} />
      <CardContent>
        <Typography>{user.bio}</Typography>
      </CardContent>
      <CardActions>
        <Button size="small">Edit</Button>
        <Button size="small">Delete</Button>
      </CardActions>
    </Card>
  );
}
```

## Limitations

- Dynamic theme creation at runtime may not be fully captured
- Custom Material UI component modifications may not be detected
- Some advanced Material UI patterns may have limited extraction
- `makeStyles` (legacy) is detected but may not be fully analyzed

## Related Documentation

- [Style Extraction](../cli/style.md) - Complete style extraction guide
- [React Support](../frameworks/react.md) - React component patterns
- [TypeScript Support](../frameworks/typescript.md) - TypeScript with Material UI

