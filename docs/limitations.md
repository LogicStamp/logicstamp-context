# Known Limitations

Things that don't work perfectly yet. We're working on improving these areas.

## Overview

LogicStamp Context is pretty accurate overall—around 90% of the time it gets things right. Component structure, props, state, hooks, and imports are usually detected correctly, but there are a few areas where things can be incomplete or a bit off.

- **~95%** - Component Contracts (Props, state, hooks detection)
- **~100%** - Imports Detection (Imports tracked correctly)
- **~90%** - Style Metadata (Static classes work well)

## Hook Parameter Detection

**Issue**

We can detect custom React hooks and list them in the `version.hooks` array, but we don't capture what parameters they take. The contract will show `props: {}` even if the hook actually accepts parameters.

**Example**

**Source Code:**
```typescript
function useTypewriter(text: string, speed = 30, pause = 800) {
  const [displayedText, setDisplayedText] = useState('')
  // ... implementation
  return displayedText
}
```

**Context Output:**
```json
{
  "version": {
    "hooks": ["useTypewriter"]
  },
  "logic": {
    "props": {}
  }
}
```

**Impact:** You'll need to check the source code to see what parameters a hook takes—the context file won't tell you.

## Emit Detection Accuracy

**Issue**

Sometimes we get confused about what's an internal handler vs. a real component emit. If you have an `onClick` that just updates internal state, it might still show up in the `emits` object even though it's not part of the component's public API.

**Example**

**Source Code:**
```typescript
function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  
  return (
    <button onClick={() => setMenuOpen(!menuOpen)}>
      Toggle Menu
    </button>
  )
}
```

**Context Output (Incorrect):**
```json
{
  "logic": {
    "emits": {
      "onClick": {
        "type": "function",
        "signature": "() => void"
      }
    }
  }
}
```

**Impact:** You might see internal handlers listed as emits, which can be confusing when trying to figure out what events the component actually exposes.

## Dynamic Class Parsing

**Issue**

Style extraction works great for static Tailwind classes, but we can't parse template literals or classes that are built from variables. If you're storing classes in variables or building them dynamically, those won't show up in the style metadata.

**Example**

**Source Code:**
```typescript
function Button({ variant }: { variant: 'primary' | 'secondary' }) {
  const base = 'px-4 py-2 rounded-lg font-semibold'
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900'
  }
  
  return (
    <button className={`${base} ${variants[variant]}`}>
      Click me
    </button>
  )
}
```

**Context Output:**
```json
{
  "style": {
    "styleSources": {
      "tailwind": {
        "categories": {}
      }
    }
  }
}
```

**Impact:** This is expected—we just can't parse dynamic classes yet. If you build classes from variables, the style metadata will be incomplete.

## Hook Classification

**Issue**

Custom hooks sometimes get labeled as `react:component` instead of `react:hook`. Makes it harder to tell hooks apart from components when you're looking at the context.

**Example**

**Source Code:**
```typescript
function useTypewriter(text: string, speed = 30) {
  const [displayedText, setDisplayedText] = useState('')
  // ... hook implementation
  return displayedText
}
```

**Context Output (Incorrect):**
```json
{
  "kind": "react:component"
}
```

**Expected Output:**
```json
{
  "kind": "react:hook"
}
```

**Impact:** Hooks and components can look the same in context files, which makes it trickier to tell them apart.

## Summary

**What works really well:**
- Component structure and props
- State variables and hooks
- Import tracking
- Static style metadata
- Dependency graphs

**Areas for improvement:**
- Hook function signatures (parameters not captured)
- Emit detection accuracy (internal handlers vs. actual emits)
- Dynamic style extraction (template literals and variable concatenation)
- Hook classification (`react:hook` vs. `react:component`)

**Bottom line:** We're hitting around 90% accuracy overall. Solid foundation, but there's definitely room to improve. These issues are on our roadmap.

