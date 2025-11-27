# Simple App Example

This is a minimal React application demonstrating LogicStamp Context generation.

## Structure

```
src/
  ├── App.tsx           # Main application component
  ├── components/
  │   ├── Button.tsx    # Reusable button component
  │   └── Card.tsx      # Card component (uses Button)
  └── utils/
      └── helpers.ts    # Utility functions
```

## Generate Context

### Unix/Linux/Mac

```bash
chmod +x run.sh
./run.sh
```

### Windows

```powershell
.\run.ps1
```

## What Gets Generated

Running the context generator on this simple app will create a `context.json` file containing:

- **2 root components**: App.tsx and Button.tsx
- **Dependency graph**: Showing how Card depends on Button
- **Logic signatures**: Props, state, and function signatures for each component
- **Code headers**: JSDoc @uif contract blocks

## Validate Output

After generating context, validate it with:

```bash
node ../../dist/cli/validate-index.js context.json
```

## Example Usage

```bash
# Generate with default settings (llm-chat profile)
node ../../dist/cli/index.js .

# Generate with full code inclusion
node ../../dist/cli/index.js . --include-code full

# Generate in pretty format
node ../../dist/cli/index.js . --format pretty --out context.txt

# Preview stats without writing file
node ../../dist/cli/index.js . --dry-run --stats
```
