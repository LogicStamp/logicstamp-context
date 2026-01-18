# Vue Framework Support

LogicStamp Context provides comprehensive support for Vue 3 applications using the Composition API. It automatically detects Vue components, composables, and patterns in your codebase.

> **⚠️ Important Limitation:** LogicStamp analyzes TypeScript files (`.ts`, `.tsx`) only. **Single File Components (`.vue` files) are not currently supported.** This means:
> - ✅ **Works with:** Vue components written in `.ts`/`.tsx` files (JSX/TSX), extracted composables, and Nuxt 3 composables
> - ❌ **Does not work with:** Standard `.vue` SFC files with `<template>` blocks
> 
> See the [Limitations](#limitations) section below for workarounds and details.

## Vue Detection

LogicStamp automatically identifies Vue code by:

- **Vue imports**: Detects imports from `vue` and related packages
- **Composition API**: Recognizes Vue 3 Composition API functions (`ref`, `reactive`, `computed`, etc.)
- **Component patterns**: `defineComponent`, `<script setup>`, and component registration
- **JSX/TSX**: Vue components using JSX/TSX syntax
- **Composables**: Functions following the `useXxx` naming convention

## What Gets Extracted

### Vue Components

Vue components are automatically detected and analyzed:

```typescript
// Example: Counter.vue.ts
import { ref, computed } from 'vue';

export default {
  setup() {
    const count = ref(0);
    const doubled = computed(() => count.value * 2);

    const increment = () => {
      count.value++;
    };

    return { count, doubled, increment };
  }
};
```

**Extracted information:**
- Component kind: `vue:component`
- Composables used: `ref`, `computed`
- State: `count` (ref), `doubled` (computed)
- Functions: `increment`

### Vue Composables

Vue composables (reusable composition functions) are detected:

```typescript
// Example: useCounter.ts
import { ref } from 'vue';

export default function useCounter(initialValue = 0) {
  const count = ref(initialValue);

  const increment = () => {
    count.value++;
  };

  const decrement = () => {
    count.value--;
  };

  return { count, increment, decrement };
}
```

**Extracted information:**
- Component kind: `vue:composable`
- Composables used: `ref`
- Exports: `useCounter` function
- Pattern: Custom composable following Vue conventions

### Component Kinds

LogicStamp categorizes Vue files into different kinds:

- **`vue:component`** - Vue components (using Composition API, reactive state, or component registration)
- **`vue:composable`** - Custom composables (functions starting with "use" and using Vue APIs)
- **`ts:module`** - TypeScript modules/utilities (non-Vue code)
- **`node:cli`** - Node.js CLI scripts (files in `/cli/` directory or using `process.argv`)

## Vue-Specific Features

### Composition API

LogicStamp extracts all Composition API functions used in your components:

**Reactive State:**
- `ref` - Reactive references
- `reactive` - Reactive objects
- `shallowRef` - Shallow reactive references
- `shallowReactive` - Shallow reactive objects
- `computed` - Computed properties
- `readonly` - Read-only reactive data
- `toRef` / `toRefs` - Convert reactive objects to refs
- `triggerRef` - Manually trigger ref updates
- `customRef` - Create custom refs with explicit control
- `isRef` / `unref` - Ref type checking and unwrapping
- `isReactive` / `isReadonly` - Reactivity type checking
- `toRaw` / `markRaw` - Access raw objects and mark non-reactive

**Lifecycle Hooks:**
- `onMounted` - Component mounted
- `onUnmounted` - Component unmounted
- `onBeforeMount` - Before mount
- `onBeforeUnmount` - Before unmount
- `onUpdated` - After update
- `onBeforeUpdate` - Before update
- `onActivated` - Keep-alive activated
- `onDeactivated` - Keep-alive deactivated
- `onErrorCaptured` - Error handling
- `onRenderTracked` - Render tracking (dev mode)
- `onRenderTriggered` - Render trigger tracking (dev mode)

**Watchers:**
- `watch` - Watch reactive sources
- `watchEffect` - Auto-tracked side effects

**Dependency Injection:**
- `provide` - Provide values to descendants
- `inject` - Inject values from ancestors

**Component Instance:**
- `useSlots` - Access component slots
- `useAttrs` - Access component attributes
- `useCssModule` - CSS module bindings
- `useCssVars` - Dynamic CSS variables

**Effect Scope:**
- `effectScope` - Create effect scopes
- `getCurrentScope` - Get current effect scope
- `onScopeDispose` - Cleanup when scope stops

**Script Setup:**
- `defineProps` - Define component props
- `defineEmits` - Define component events
- `defineExpose` - Expose public API
- `withDefaults` - Default prop values

### Props and Emits

LogicStamp detects `defineProps` and `defineEmits` declarations:

```typescript
// Type-based props
const props = defineProps<{
  title: string;
  count?: number;
}>();

// Runtime props with validation
const props = defineProps({
  title: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    default: 0
  }
});

// Emits declaration
const emit = defineEmits<{
  (e: 'update', value: number): void;
  (e: 'close'): void;
}>();

// Runtime emits
const emit = defineEmits(['update', 'close']);
```

**Extracted information:**
- Props types and defaults
- Emit event signatures
- Required vs. optional props

### Reactive State Tracking

LogicStamp tracks all reactive state declarations:

```typescript
import { ref, reactive, computed } from 'vue';

// Refs
const count = ref(0);                    // Extracted: count: ref<number>
const message = ref('hello');            // Extracted: message: ref<string>
const user = ref<User | null>(null);     // Extracted: user: ref<User | null>

// Reactive objects
const state = reactive({                 // Extracted: state: reactive<{...}>
  count: 0,
  name: 'John'
});

// Computed
const doubled = computed(                // Extracted: doubled: computed<number>
  () => count.value * 2
);
```

### Component Registration

LogicStamp detects components used in your Vue files:

```typescript
// JSX/TSX components
import { Button, Card } from './components';

export default () => (
  <Card>
    <Button>Click me</Button>
  </Card>
);

// Components registration
import MyButton from './MyButton.vue';
import MyCard from './MyCard.vue';

const components = {
  MyButton,
  MyCard
};
```

## Usage

### Analyzing Vue Projects

Generate context for a Vue project:

```bash
stamp context
```

The tool will automatically:
1. Detect Vue imports and Composition API usage
2. Extract component structure and composables
3. Track reactive state (refs, reactive, computed)
4. Identify component relationships
5. Generate structured contracts for each component

### With Style Metadata

Extract styling information from Vue components:

```bash
stamp context --include-style
```

This captures:
- Tailwind CSS classes
- CSS Modules
- Scoped styles
- Component-scoped CSS variables

### Integration with Build Tools

LogicStamp works with common Vue build tools:

- **Vite** - No configuration needed
- **Vue CLI** - Works out of the box
- **Nuxt 3** - Full support for Nuxt 3 projects
- **Custom setups** - Compatible with any Vue 3 TypeScript project

## Best Practices

### 1. Use TypeScript

LogicStamp works best with TypeScript:

```typescript
// ✅ Good: Type-safe props
const props = defineProps<{
  title: string;
  count: number;
}>();

// ❌ Less ideal: Runtime-only props
const props = defineProps({
  title: String,
  count: Number
});
```

### 2. Export Component Names

Use named exports or default exports with clear function names:

```typescript
// ✅ Good: Clear component name
export default function TodoList() {
  // ...
}

// ✅ Also good: Named export
export function TodoList() {
  // ...
}

// ❌ Less ideal: Anonymous default export
export default () => {
  // ...
}
```

### 3. Use Composables for Reusable Logic

Extract reusable logic into composables:

```typescript
// composables/useAuth.ts
export function useAuth() {
  const user = ref<User | null>(null);
  const isAuthenticated = computed(() => user.value !== null);

  async function login(credentials: Credentials) {
    // ...
  }

  return { user, isAuthenticated, login };
}
```

### 4. Organize Component Files

Keep related files together:

```
components/
  TodoList/
    TodoList.vue.ts      # Component logic
    TodoList.test.ts     # Tests
    index.ts             # Re-exports
```

## Framework Detection Priority

When a file imports multiple frameworks, LogicStamp uses a priority system:

1. **Backend** (Express/NestJS detected) → `node:api` (highest priority)
2. **Vue** (Vue import + Vue component patterns) → `vue:component` or `vue:composable`
3. **React** (React import or JSX/TSX + React patterns) → `react:component` or `react:hook`
4. **TypeScript module** (no framework patterns) → `ts:module` (default fallback)

**Note:** React is NOT the default fallback. Files without framework patterns become `ts:module`.

**Example:**
```typescript
import { ref } from 'vue';
import { useState } from 'react'; // This file will be analyzed as Vue

export default function MyComponent() {
  const vueState = ref(0);
  const [reactState, setReactState] = useState(0);
  // Analyzed as vue:component, not react:component
}
```

**Recommendation:** Avoid mixing React and Vue in the same file. Keep frameworks separate for accurate analysis.

## Limitations

### Vue 2 Support

LogicStamp currently focuses on Vue 3 Composition API. Vue 2 Options API is not fully supported:

- ❌ Options API (`data`, `methods`, `computed`)
- ❌ Vue 2 Composition API plugin
- ✅ Vue 3 Composition API (`<script setup>`, `setup()`)

### Single File Components (.vue)

LogicStamp analyzes TypeScript files (`.ts`, `.tsx`) only. For `.vue` files:

- Extract the `<script>` section to a separate `.ts` file
- Or use the `<script setup lang="ts">` pattern with separate logic files
- SFC parsing for `.vue` files is not currently supported

> **📋 Planned for future release:** Direct `.vue` file parsing and analysis is planned for a future version. This will allow LogicStamp to automatically extract and analyze Vue Single File Components without requiring manual script extraction.

**Workaround:**

```typescript
// MyComponent.vue
<template>
  <div>{{ message }}</div>
</template>

<script setup lang="ts">
import { useComponentLogic } from './MyComponent.logic.ts';
const { message } = useComponentLogic();
</script>

// MyComponent.logic.ts (analyzed by LogicStamp)
import { ref } from 'vue';

export function useComponentLogic() {
  const message = ref('Hello Vue!');
  return { message };
}
```

### Template Analysis

LogicStamp analyzes TypeScript logic, not Vue templates:

- ✅ Composables, reactive state, and logic
- ✅ Props, emits, and type signatures
- ❌ Template directives (`v-if`, `v-for`)
- ❌ Template refs and DOM manipulation in templates
- ✅ JSX/TSX components (full support)

**Note:** JSX/TSX files are parsed using React JSX mode (`jsx: 1`). Vue JSX syntax is compatible and works correctly, but Vue template syntax (`.vue` files with `<template>` blocks) is not parsed. Only the `<script>` sections of `.vue` files can be analyzed when extracted to separate `.ts` files.

## Examples

### Vue Component with Composition API

```typescript
// components/UserProfile.ts
import { ref, computed, onMounted } from 'vue';
import type { User } from '../types';

export default function UserProfile() {
  const user = ref<User | null>(null);
  const loading = ref(true);

  const displayName = computed(() => {
    if (!user.value) return 'Guest';
    return `${user.value.firstName} ${user.value.lastName}`;
  });

  async function fetchUser() {
    loading.value = true;
    try {
      const response = await fetch('/api/user');
      user.value = await response.json();
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    fetchUser();
  });

  return { user, loading, displayName, fetchUser };
}
```

**Generated Contract:**

```json
{
  "kind": "vue:component",
  "version": {
    "variables": [],
    "hooks": ["ref", "computed", "onMounted"],
    "components": [],
    "functions": ["UserProfile", "fetchUser"]
  },
  "logicSignature": {
    "props": {},
    "emits": {},
    "state": {
      "user": "ref<User | null>",
      "loading": "ref<boolean>",
      "displayName": "computed<string>"
    }
  }
}
```

### Vue Composable

```typescript
// composables/useLocalStorage.ts
import { ref, watch } from 'vue';

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const stored = localStorage.getItem(key);
  const value = ref<T>(stored ? JSON.parse(stored) : defaultValue);

  watch(value, (newValue) => {
    localStorage.setItem(key, JSON.stringify(newValue));
  }, { deep: true });

  return value;
}
```

**Generated Contract:**

```json
{
  "kind": "vue:composable",
  "version": {
    "variables": ["stored"],
    "hooks": ["ref", "watch"],
    "components": [],
    "functions": ["useLocalStorage"]
  },
  "logicSignature": {
    "props": {},
    "emits": {},
    "state": {
      "value": "ref<T>"
    }
  }
}
```

## Related Documentation

- [TypeScript Support](./typescript.md) - Type system features
- [Style Extraction](../features/style.md) - Extracting style metadata
- [CLI Reference](../cli/README.md) - Command-line usage
- [Contract Schema](../schema/contract.md) - UIFContract format

## Vue Ecosystem Support

LogicStamp works with popular Vue ecosystem libraries:

- **Vue Router** - Route definitions and navigation guards
- **Pinia** - State management stores
- **VueUse** - Composable utilities library
- **Nuxt 3** - Full support for Nuxt applications
- **Vite** - Native Vue 3 + Vite projects

For best results, structure your Vue project with TypeScript and the Composition API pattern.
