# Framer Motion Support

LogicStamp Context provides specialized support for Framer Motion, extracting animation configurations, variants, gestures, and motion patterns from your components.

## Framer Motion Detection

LogicStamp automatically detects Framer Motion usage by:

- **Package imports**: Detects imports from `framer-motion` and subpath imports (e.g., `framer-motion/client`)
- **Motion components**: Recognizes `motion.*` component patterns
- **Animation patterns**: Identifies animation configurations and variants
- **Gesture handlers**: Detects gesture-based interactions

## What Gets Extracted

### Motion Components

Framer Motion components are detected and extracted:

```tsx
import { motion } from 'framer-motion';

function AnimatedBox() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      Content
    </motion.div>
  );
}
```

**Extracted information:**
- Motion component types: `div`, `button`, `span`, etc.
- Animation properties: `initial`, `animate`, `exit`
- Transition configurations
- Animation patterns

### Animation Variants

Animation variants are detected and extracted:

```tsx
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  },
};

function List() {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.li variants={itemVariants}>Item 1</motion.li>
      <motion.li variants={itemVariants}>Item 2</motion.li>
      <motion.li variants={itemVariants}>Item 3</motion.li>
    </motion.ul>
  );
}
```

**Extracted:**
- Variant names: `hidden`, `visible` (property names from variant objects)
- Note: Variant structures, stagger configuration, and variant composition details are not extracted, only variant names are extracted

### Gesture Handlers

Gesture-based interactions are detected:

```tsx
import { motion } from 'framer-motion';

function InteractiveButton() {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      whileFocus={{ outline: '2px solid blue' }}
    >
      Click me
    </motion.button>
  );
}
```

**Extracted gestures:**
- `whileHover` - Hover interactions
- `whileTap` - Click/tap interactions
- `whileDrag` - Drag interactions
- `whileFocus` - Focus interactions
- `whileInView` - Viewport visibility

### Layout Animations

Layout animation patterns are detected:

```tsx
import { motion, AnimatePresence } from 'framer-motion';

function AnimatedList({ items }: { items: string[] }) {
  return (
    <AnimatePresence>
      {items.map((item) => (
        <motion.div
          key={item}
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {item}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
```

**Extracted:**
- Layout animation usage (`layout` prop)
- Layout ID patterns (`layoutId`)
- AnimatePresence usage
- Exit animations

### Viewport Animations

Scroll-triggered animations are detected:

```tsx
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

function ScrollAnimation() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.5 }}
    >
      Content
    </motion.div>
  );
}
```

**Extracted:**
- `useInView` hook usage
- Viewport animation triggers
- Scroll-based animations

### Drag Interactions

Drag functionality is detected:

```tsx
import { motion } from 'framer-motion';

function DraggableCard() {
  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      whileDrag={{ scale: 1.1 }}
      onDragEnd={(event, info) => {
        console.log('Drag ended', info);
      }}
    >
      Drag me
    </motion.div>
  );
}
```

**Detected:**
- Drag prop presence (boolean flag: `hasGestures: true` when drag-related props are present)
- Note: Drag configuration, constraints, and event handlers are not extracted, only the presence of drag-related props is detected

## Style Extraction

When using `stamp context --include-style`, Framer Motion information is included:

```json
{
  "style": {
    "animation": {
      "library": "framer-motion",
      "type": "fade-in",
      "trigger": "inView"
    }
  }
}
```

For motion components:

```json
{
  "style": {
    "sources": ["motion"],
    "motion": {
      "components": ["div", "button"],
      "variants": ["hidden", "visible"],
      "hasGestures": true,
      "hasLayout": false,
      "hasViewport": true
    }
  }
}
```

## Framer Motion-Specific Features

### Animation Types

Common animation patterns are detected:

```tsx
import { motion } from 'framer-motion';

// Fade in
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
/>

// Slide in
<motion.div
  initial={{ x: -100, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
/>

// Scale
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
/>

// Rotate
<motion.div
  initial={{ rotate: -180 }}
  animate={{ rotate: 0 }}
/>
```

**Extracted:**
- Animation type patterns
- Common animation configurations
- Transition timing

### Stagger Animations

Staggered animations are recognized:

```tsx
import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function StaggeredList() {
  return (
    <motion.ul variants={container} initial="hidden" animate="show">
      {items.map((item) => (
        <motion.li key={item.id} variants={item}>
          {item.text}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

**Detected:**
- Variant names from stagger animations (variant names are extracted, but staggerChildren values and stagger configuration are not extracted)

### Spring Animations

Spring physics animations are detected:

```tsx
import { motion } from 'framer-motion';

function SpringAnimation() {
  return (
    <motion.div
      animate={{ x: 100 }}
      transition={{
        type: 'spring',
        stiffness: 100,
        damping: 10,
      }}
    >
      Spring animation
    </motion.div>
  );
}
```

**Detected:**
- Animation presence (boolean flags for gestures, layout, viewport)
- Note: Spring configuration (stiffness, damping, etc.) and physics-based animation values are not extracted, only animation presence is detected

## Usage

```bash
# Extract Framer Motion animations
stamp context --include-style

# Or use the style command
stamp context style
```

## Project Structure

LogicStamp recognizes Framer Motion usage patterns:

```
my-app/
  components/
    AnimatedButton.tsx    # Uses Framer Motion
    Card.tsx
  animations/
    variants.ts           # Animation variants
  app/
    page.tsx
```

## Best Practices

1. **Use variants**: Define reusable animation variants
2. **Performance**: Use `layout` prop for layout animations
3. **Viewport animations**: Use `useInView` for scroll-triggered animations
4. **Gesture feedback**: Provide visual feedback with gesture handlers
5. **AnimatePresence**: Use for enter/exit animations

## Common Patterns

### Fade In Animation

```tsx
import { motion } from 'framer-motion';

function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

### Modal with Animation

```tsx
import { motion, AnimatePresence } from 'framer-motion';

function Modal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6"
          >
            Modal content
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### Scroll-Triggered Animation

```tsx
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

function ScrollReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
```

### Interactive Button

```tsx
import { motion } from 'framer-motion';

function InteractiveButton({ children }: { children: React.ReactNode }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      {children}
    </motion.button>
  );
}
```

### Page Transition

```tsx
import { motion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

## Limitations

- Complex animation sequences may not be fully parsed
- Dynamic variant generation may not be detected
- Some advanced Framer Motion features may have limited extraction
- Animation values computed at runtime may not be captured
- Custom animation hooks may not be recognized

## Related Documentation

- [Style Extraction](../cli/style.md) - Complete style extraction guide
- [React Support](../frameworks/react.md) - React component patterns
- [Layout Patterns](./layout.md) - Layout and visual metadata

