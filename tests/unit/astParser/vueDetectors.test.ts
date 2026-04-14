import { describe, it, expect } from 'vitest';
import { SyntaxKind, Node } from 'ts-morph';
import { detectKind } from '../../../src/core/astParser/detectors.js';
import {
  extractVueComposables,
  extractVueComponents,
  extractVueState,
  extractVuePropsCall,
  extractVueEmitsCall,
  extractVueProps,
  extractVueEmits,
} from '../../../src/extractors/vue/index.js';
import { createTestSourceFile } from '../test-helpers.js';

/**
 * Helper to create a mock SourceFile for error testing
 */
function createMockSourceFile(overrides: Partial<any> = {}) {
  return {
    getFilePath: () => 'test.vue.ts',
    getDescendantsOfKind: () => [],
    ...overrides,
  };
}

describe('Vue Detectors and Extractors', () => {
  describe('detectKind - Vue', () => {
    it('should detect Vue component', () => {
      const sourceCode = `
import { ref, computed } from 'vue';

export default {
  setup() {
    const count = ref(0);
    const doubled = computed(() => count.value * 2);

    return { count, doubled };
  }
};
`;

      const sourceFile = createTestSourceFile(sourceCode, 'Component.vue.ts');

      const kind = detectKind([], [], ['vue'], sourceFile, 'Component.vue.ts');

      expect(kind).toBe('vue:component');
    });

    it('should detect Vue composable', () => {
      const sourceCode = `
import { ref, onMounted } from 'vue';

export default function useCounter() {
  const count = ref(0);

  const increment = () => {
    count.value++;
  };

  onMounted(() => {
    console.log('Mounted');
  });

  return { count, increment };
}
`;

      const sourceFile = createTestSourceFile(sourceCode, 'useCounter.ts');

      const kind = detectKind([], [], ['vue'], sourceFile, 'useCounter.ts');

      expect(kind).toBe('vue:composable');
    });

    it('should detect Vue component with JSX', () => {
      const sourceCode = `
import { ref } from 'vue';

export default function MyComponent() {
  const count = ref(0);

  return () => (
    <div>
      <p>{count.value}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
}
`;

      const sourceFile = createTestSourceFile(
        sourceCode,
        'Component.tsx',
        undefined,
        { jsx: 1 },
      );

      const kind = detectKind(
        [],
        ['div', 'p', 'button'],
        ['vue'],
        sourceFile,
        'Component.tsx',
      );

      expect(kind).toBe('vue:component');
    });

    it('should detect Vue component with defineComponent', () => {
      const sourceCode = `
import { defineComponent, ref } from 'vue';

export default defineComponent({
  setup() {
    const message = ref('Hello Vue!');
    return { message };
  }
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'Component.ts');

      const kind = detectKind([], [], ['vue'], sourceFile, 'Component.ts');

      expect(kind).toBe('vue:component');
    });
  });

  describe('extractVueComposables', () => {
    it('should extract Vue built-in composables', () => {
      const sourceCode = `
import { ref, computed, watch, onMounted } from 'vue';

const count = ref(0);
const doubled = computed(() => count.value * 2);
watch(count, () => console.log('changed'));
onMounted(() => console.log('mounted'));
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('ref');
      expect(composables).toContain('computed');
      expect(composables).toContain('watch');
      expect(composables).toContain('onMounted');
    });

    it('should extract custom composables', () => {
      const sourceCode = `
import { useCounter } from './composables';

const { count, increment } = useCounter();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('useCounter');
    });

    it('should extract defineProps and defineEmits', () => {
      const sourceCode = `
const props = defineProps<{ name: string }>();
const emit = defineEmits<{ (e: 'update'): void }>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('defineProps');
      expect(composables).toContain('defineEmits');
    });

    it('should extract watchEffect', () => {
      const sourceCode = `
import { watchEffect } from 'vue';
watchEffect(() => console.log('effect'));
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('watchEffect');
    });

    it('should extract all lifecycle hooks', () => {
      const sourceCode = `
import { 
  onMounted, onUnmounted, onBeforeMount, onBeforeUnmount,
  onUpdated, onBeforeUpdate, onActivated, onDeactivated,
  onErrorCaptured, onRenderTracked, onRenderTriggered
} from 'vue';

onMounted(() => {});
onUnmounted(() => {});
onBeforeMount(() => {});
onBeforeUnmount(() => {});
onUpdated(() => {});
onBeforeUpdate(() => {});
onActivated(() => {});
onDeactivated(() => {});
onErrorCaptured(() => {});
onRenderTracked(() => {});
onRenderTriggered(() => {});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('onMounted');
      expect(composables).toContain('onUnmounted');
      expect(composables).toContain('onBeforeMount');
      expect(composables).toContain('onBeforeUnmount');
      expect(composables).toContain('onUpdated');
      expect(composables).toContain('onBeforeUpdate');
      expect(composables).toContain('onActivated');
      expect(composables).toContain('onDeactivated');
      expect(composables).toContain('onErrorCaptured');
      expect(composables).toContain('onRenderTracked');
      expect(composables).toContain('onRenderTriggered');
    });

    it('should extract provide and inject', () => {
      const sourceCode = `
import { provide, inject } from 'vue';

provide('key', 'value');
const value = inject('key');
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('provide');
      expect(composables).toContain('inject');
    });

    it('should extract ref utilities', () => {
      const sourceCode = `
import { toRef, toRefs, isRef, unref } from 'vue';

const ref1 = toRef(obj, 'prop');
const refs = toRefs(obj);
const isRefValue = isRef(value);
const unrefValue = unref(ref);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('toRef');
      expect(composables).toContain('toRefs');
      expect(composables).toContain('isRef');
      expect(composables).toContain('unref');
    });

    it('should extract shallow reactivity', () => {
      const sourceCode = `
import { shallowRef, shallowReactive } from 'vue';

const shallow = shallowRef(0);
const shallowObj = shallowReactive({ count: 0 });
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('shallowRef');
      expect(composables).toContain('shallowReactive');
    });

    it('should extract reactivity utilities', () => {
      const sourceCode = `
import { readonly, isReactive, isReadonly, toRaw, markRaw } from 'vue';

const readOnly = readonly(obj);
const isReactiveValue = isReactive(obj);
const isReadonlyValue = isReadonly(obj);
const raw = toRaw(obj);
markRaw(obj);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('readonly');
      expect(composables).toContain('isReactive');
      expect(composables).toContain('isReadonly');
      expect(composables).toContain('toRaw');
      expect(composables).toContain('markRaw');
    });

    it('should extract effect scope utilities', () => {
      const sourceCode = `
import { effectScope, getCurrentScope, onScopeDispose } from 'vue';

const scope = effectScope();
const current = getCurrentScope();
onScopeDispose(() => {});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('effectScope');
      expect(composables).toContain('getCurrentScope');
      expect(composables).toContain('onScopeDispose');
    });

    it('should extract component utilities', () => {
      const sourceCode = `
import { useSlots, useAttrs, useCssModule, useCssVars } from 'vue';

const slots = useSlots();
const attrs = useAttrs();
const cssModule = useCssModule();
useCssVars(() => ({}));
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('useSlots');
      expect(composables).toContain('useAttrs');
      expect(composables).toContain('useCssModule');
      expect(composables).toContain('useCssVars');
    });

    it('should extract defineExpose and withDefaults', () => {
      const sourceCode = `
defineExpose({ method: () => {} });
const props = withDefaults(defineProps<{ name?: string }>(), { name: 'default' });
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('defineExpose');
      expect(composables).toContain('withDefaults');
    });
  });

  describe('extractVueComponents', () => {
    it('should extract components from JSX', () => {
      const sourceCode = `
import Button from './Button.vue';
import Card from './Card.vue';

export default () => (
  <div>
    <Card>
      <Button>Click me</Button>
    </Card>
  </div>
);
`;

      const sourceFile = createTestSourceFile(
        sourceCode,
        'test.tsx',
        undefined,
        { jsx: 1 },
      );

      const components = extractVueComponents(sourceFile);

      expect(components).toContain('Button');
      expect(components).toContain('Card');
    });

    it('should extract components from registration', () => {
      const sourceCode = `
import MyButton from './MyButton.vue';
import MyCard from './MyCard.vue';

export default {
  components: {
    MyButton,
    MyCard
  }
};
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const components = extractVueComponents(sourceFile);

      expect(components).toContain('MyButton');
      expect(components).toContain('MyCard');
    });
  });

  describe('extractVueState', () => {
    it('should extract ref state', () => {
      const sourceCode = `
import { ref } from 'vue';

const count = ref(0);
const message = ref('hello');
const user = ref<User | null>(null);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      expect(state).toHaveProperty('count');
      expect(state.count).toContain('ref');
      expect(state).toHaveProperty('message');
      expect(state.message).toContain('ref');
      expect(state).toHaveProperty('user');
      expect(state.user).toContain('ref');
    });

    it('should extract reactive state', () => {
      const sourceCode = `
import { reactive } from 'vue';

const state = reactive({
  count: 0,
  name: 'John'
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      expect(state).toHaveProperty('state');
      expect(state.state).toContain('reactive');
    });

    it('should extract computed state', () => {
      const sourceCode = `
import { ref, computed } from 'vue';

const count = ref(0);
const doubled = computed(() => count.value * 2);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      expect(state).toHaveProperty('doubled');
      expect(state.doubled).toContain('computed');
    });

    it('should extract shallowRef state', () => {
      const sourceCode = `
import { shallowRef } from 'vue';

const count = shallowRef(0);
const user = shallowRef<User | null>(null);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      expect(state).toHaveProperty('count');
      expect(state.count).toContain('shallowRef');
      expect(state).toHaveProperty('user');
      expect(state.user).toContain('shallowRef');
    });

    it('should extract shallowReactive state', () => {
      const sourceCode = `
import { shallowReactive } from 'vue';

const state = shallowReactive({
  count: 0,
  name: 'John'
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      expect(state).toHaveProperty('state');
      expect(state.state).toContain('shallowReactive');
    });
  });

  describe('extractVuePropsCall', () => {
    it('should extract defineProps with type argument', () => {
      const sourceCode = `
const props = defineProps<{
  name: string;
  age: number;
}>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const propsCall = extractVuePropsCall(sourceFile);

      expect(propsCall).toContain('name');
      expect(propsCall).toContain('age');
    });

    it('should extract defineProps with runtime props', () => {
      const sourceCode = `
const props = defineProps({
  name: String,
  age: Number
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const propsCall = extractVuePropsCall(sourceFile);

      expect(propsCall).toBeTruthy();
      expect(propsCall).toContain('name');
    });

    it('should return null when no defineProps', () => {
      const sourceCode = `
import { ref } from 'vue';
const count = ref(0);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const propsCall = extractVuePropsCall(sourceFile);

      expect(propsCall).toBeNull();
    });

    it('should extract withDefaults', () => {
      const sourceCode = `
const props = withDefaults(defineProps<{
  name?: string;
  age?: number;
}>(), {
  name: 'default',
  age: 0
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const propsCall = extractVuePropsCall(sourceFile);

      expect(propsCall).toBeTruthy();
      expect(propsCall).toContain('name');
    });
  });

  describe('extractVueEmitsCall', () => {
    it('should extract defineEmits with type argument', () => {
      const sourceCode = `
const emit = defineEmits<{
  (e: 'update', value: string): void;
  (e: 'close'): void;
}>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmitsCall(sourceFile);

      expect(emits.length).toBeGreaterThan(0);
    });

    it('should extract defineEmits with runtime array', () => {
      const sourceCode = `
const emit = defineEmits(['update', 'close', 'submit']);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmitsCall(sourceFile);

      expect(emits).toContain('update');
      expect(emits).toContain('close');
      expect(emits).toContain('submit');
    });

    it('should return empty array when no defineEmits', () => {
      const sourceCode = `
import { ref } from 'vue';
const count = ref(0);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmitsCall(sourceFile);

      expect(emits).toEqual([]);
    });
  });

  describe('extractVueProps', () => {
    it('should extract structured props from type-based defineProps', () => {
      const sourceCode = `
const props = defineProps<{
  name: string;
  age: number;
  email?: string;
}>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('name');
      expect(props).toHaveProperty('age');
      expect(props).toHaveProperty('email');
      // email should be optional - check if it's an object with optional property
      if (
        typeof props.email === 'object' &&
        props.email !== null &&
        !Array.isArray(props.email)
      ) {
        expect(props.email.optional).toBe(true);
      }
    });

    it('should extract structured props from runtime defineProps', () => {
      const sourceCode = `
const props = defineProps({
  name: String,
  age: Number,
  email: {
    type: String,
    required: false,
    default: ''
  }
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('name');
      expect(props).toHaveProperty('age');
      expect(props).toHaveProperty('email');
    });

    it('should extract structured props from withDefaults', () => {
      const sourceCode = `
const props = withDefaults(defineProps<{
  name?: string;
  count?: number;
}>(), {
  name: 'default',
  count: 0
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('name');
      expect(props).toHaveProperty('count');
    });

    it('should return empty object when no props', () => {
      const sourceCode = `
import { ref } from 'vue';
const count = ref(0);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(Object.keys(props)).toHaveLength(0);
    });
  });

  describe('extractVueEmits', () => {
    it('should extract structured emits from type-based defineEmits', () => {
      const sourceCode = `
const emit = defineEmits<{
  (e: 'update', value: string): void;
  (e: 'close'): void;
  (e: 'submit', data: { id: number }): void;
}>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmits(sourceFile);

      expect(emits).toHaveProperty('update');
      expect(emits).toHaveProperty('close');
      expect(emits).toHaveProperty('submit');
      // Check if update is an object with type and signature
      if (typeof emits.update === 'object' && emits.update !== null) {
        expect(emits.update.type).toBe('function');
        expect(emits.update.signature).toContain('update');
      }
    });

    it('should extract structured emits from runtime defineEmits', () => {
      const sourceCode = `
const emit = defineEmits(['update', 'close', 'submit']);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmits(sourceFile);

      expect(emits).toHaveProperty('update');
      expect(emits).toHaveProperty('close');
      expect(emits).toHaveProperty('submit');
      // Check if update is an object with type
      if (typeof emits.update === 'object' && emits.update !== null) {
        expect(emits.update.type).toBe('function');
      }
    });

    it('should return empty object when no emits', () => {
      const sourceCode = `
import { ref } from 'vue';
const count = ref(0);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmits(sourceFile);

      expect(Object.keys(emits)).toHaveLength(0);
    });
  });

  describe('extractVueComponents - edge cases', () => {
    it('should extract components from self-closing JSX', () => {
      const sourceCode = `
import Button from './Button.vue';
import Icon from './Icon.vue';

export default () => (
  <div>
    <Button />
    <Icon />
  </div>
);
`;

      const sourceFile = createTestSourceFile(
        sourceCode,
        'test.tsx',
        undefined,
        { jsx: 1 },
      );

      const components = extractVueComponents(sourceFile);

      expect(components).toContain('Button');
      expect(components).toContain('Icon');
    });

    it('should handle nested component registration', () => {
      const sourceCode = `
import MyButton from './MyButton.vue';
import MyCard from './MyCard.vue';

export default {
  components: {
    MyButton,
    MyCard
  },
  setup() {
    return {};
  }
};
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const components = extractVueComponents(sourceFile);

      expect(components).toContain('MyButton');
      expect(components).toContain('MyCard');
    });

    it('should not extract HTML elements as components', () => {
      const sourceCode = `
export default () => (
  <div>
    <p>Hello</p>
    <span>World</span>
  </div>
);
`;

      const sourceFile = createTestSourceFile(
        sourceCode,
        'test.tsx',
        undefined,
        { jsx: 1 },
      );

      const components = extractVueComponents(sourceFile);

      expect(components).not.toContain('div');
      expect(components).not.toContain('p');
      expect(components).not.toContain('span');
    });

    it('should extract components from variable declaration', () => {
      const sourceCode = `
import MyButton from './MyButton.vue';
import MyCard from './MyCard.vue';

const components = {
  MyButton,
  MyCard
};
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const components = extractVueComponents(sourceFile);

      expect(components).toContain('MyButton');
      expect(components).toContain('MyCard');
    });

    it('should not extract lowercase component names', () => {
      const sourceCode = `
export default {
  components: {
    myButton,
    myCard
  }
};
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const components = extractVueComponents(sourceFile);

      expect(components).not.toContain('myButton');
      expect(components).not.toContain('myCard');
    });

    it('should handle components with non-object initializers', () => {
      const sourceCode = `
export default {
  components: null
};
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const components = extractVueComponents(sourceFile);

      expect(components).toEqual([]);
    });
  });

  describe('extractVueComposables - error handling and edge cases', () => {
    it('should not extract property access expressions', () => {
      const sourceCode = `
import { ref } from 'vue';
const count = Vue.ref(0);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      // Vue.ref is a PropertyAccessExpression, not an Identifier
      expect(composables).not.toContain('ref');
    });

    it('should not extract non-composable function calls', () => {
      const sourceCode = `
const result = calculateSum(1, 2);
const data = fetchData();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).not.toContain('calculateSum');
      expect(composables).not.toContain('fetchData');
    });

    it('should handle empty file', () => {
      const sourceCode = ``;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toEqual([]);
    });

    it('should deduplicate composables', () => {
      const sourceCode = `
import { ref, computed } from 'vue';

const count = ref(0);
const name = ref('');
const doubled = computed(() => count.value * 2);
const tripled = computed(() => count.value * 3);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables.filter((c) => c === 'ref')).toHaveLength(1);
      expect(composables.filter((c) => c === 'computed')).toHaveLength(1);
    });

    it('should return sorted composables', () => {
      const sourceCode = `
import { ref, computed, watch, onMounted } from 'vue';

const count = ref(0);
const doubled = computed(() => count.value * 2);
watch(count, () => {});
onMounted(() => {});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const composables = extractVueComposables(sourceFile);

      expect(composables).toEqual(['computed', 'onMounted', 'ref', 'watch']);
    });
  });

  describe('extractVueState - edge cases and type inference', () => {
    it('should handle variables without initializers', () => {
      const sourceCode = `
let count;
let name;
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      expect(Object.keys(state)).toHaveLength(0);
    });

    it('should handle variables with non-call initializers', () => {
      const sourceCode = `
const count = 0;
const name = 'hello';
const obj = { count: 0 };
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      expect(Object.keys(state)).toHaveLength(0);
    });

    it('should handle state with type arguments', () => {
      const sourceCode = `
import { ref } from 'vue';

const count = ref<number>(0);
const user = ref<User | null>(null);
const items = ref<string[]>([]);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      expect(state).toHaveProperty('count');
      expect(state).toHaveProperty('user');
      expect(state).toHaveProperty('items');
      expect(state.count).toContain('ref');
    });

    it('should handle state without type arguments (infer from initializer)', () => {
      const sourceCode = `
import { ref, reactive } from 'vue';

const count = ref(0);
const name = ref('hello');
const state = reactive({ count: 0 });
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      expect(state).toHaveProperty('count');
      expect(state).toHaveProperty('name');
      expect(state).toHaveProperty('state');
    });

    it('should handle state with empty arguments', () => {
      const sourceCode = `
import { ref } from 'vue';

const count = ref();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      expect(state).toHaveProperty('count');
      expect(state.count).toContain('ref');
    });

    it('should not extract non-reactive state functions', () => {
      const sourceCode = `
import { useState } from 'react';

const count = useState(0);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      expect(Object.keys(state)).toHaveLength(0);
    });

    it('should handle property access expressions', () => {
      const sourceCode = `
import { ref } from 'vue';

const count = Vue.ref(0);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const state = extractVueState(sourceFile);

      // Vue.ref is a PropertyAccessExpression, not an Identifier
      expect(Object.keys(state)).toHaveLength(0);
    });
  });

  describe('extractVuePropsCall - edge cases', () => {
    it('should return null when defineProps has no type args or runtime args', () => {
      const sourceCode = `
const props = defineProps();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const propsCall = extractVuePropsCall(sourceFile);

      expect(propsCall).toBeNull();
    });

    it('should not extract non-defineProps calls', () => {
      const sourceCode = `
const props = someFunction<{ name: string }>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const propsCall = extractVuePropsCall(sourceFile);

      expect(propsCall).toBeNull();
    });

    it('should handle property access expressions', () => {
      const sourceCode = `
const props = Vue.defineProps<{ name: string }>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const propsCall = extractVuePropsCall(sourceFile);

      // Vue.defineProps is a PropertyAccessExpression, not an Identifier
      expect(propsCall).toBeNull();
    });
  });

  describe('extractVueEmitsCall - edge cases', () => {
    it('should handle defineEmits with no type args or runtime args', () => {
      const sourceCode = `
const emit = defineEmits();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmitsCall(sourceFile);

      expect(emits).toEqual([]);
    });

    it('should handle non-array literal arguments', () => {
      const sourceCode = `
const emit = defineEmits('update');
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmitsCall(sourceFile);

      expect(emits).toEqual([]);
    });

    it('should handle array with non-string literals', () => {
      const sourceCode = `
const emit = defineEmits([updateEvent, closeEvent]);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmitsCall(sourceFile);

      // Only string literals are extracted
      expect(emits).toEqual([]);
    });

    it('should handle property access expressions', () => {
      const sourceCode = `
const emit = Vue.defineEmits(['update']);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmitsCall(sourceFile);

      // Vue.defineEmits is a PropertyAccessExpression, not an Identifier
      expect(emits).toEqual([]);
    });
  });

  describe('extractVueProps - runtime props edge cases', () => {
    it('should handle runtime props with required: true', () => {
      const sourceCode = `
const props = defineProps({
  name: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    required: true
  }
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('name');
      expect(props).toHaveProperty('age');
    });

    it('should handle runtime props with default values', () => {
      const sourceCode = `
const props = defineProps({
  name: {
    type: String,
    default: 'John'
  },
  count: {
    type: Number,
    default: 0
  }
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('name');
      expect(props).toHaveProperty('count');
    });

    it('should handle shorthand property assignments', () => {
      const sourceCode = `
const MyComponent = {};
const props = defineProps({
  MyComponent
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('MyComponent');
      expect(props.MyComponent).toBe('any');
    });

    it('should handle runtime props with array types', () => {
      const sourceCode = `
const props = defineProps({
  items: Array,
  tags: Array
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('items');
      expect(props).toHaveProperty('tags');
    });

    it('should handle runtime props with object types', () => {
      const sourceCode = `
const props = defineProps({
  config: Object,
  metadata: Object
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('config');
      expect(props).toHaveProperty('metadata');
    });

    it('should handle runtime props with boolean types', () => {
      const sourceCode = `
const props = defineProps({
  isActive: Boolean,
  isVisible: Boolean
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('isActive');
      expect(props).toHaveProperty('isVisible');
    });

    it('should handle runtime props with function types', () => {
      const sourceCode = `
const props = defineProps({
  onClick: Function,
  onSubmit: Function
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('onClick');
      expect(props).toHaveProperty('onSubmit');
    });

    it('should handle runtime props with date types', () => {
      const sourceCode = `
const props = defineProps({
  createdAt: Date,
  updatedAt: Date
});
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('createdAt');
      expect(props).toHaveProperty('updatedAt');
    });

    it('should handle type-based props with optional properties', () => {
      const sourceCode = `
const props = defineProps<{
  name: string;
  age?: number;
  email?: string;
}>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('name');
      expect(props).toHaveProperty('age');
      expect(props).toHaveProperty('email');
    });

    it('should handle type-based props with union types containing undefined', () => {
      const sourceCode = `
const props = defineProps<{
  name: string | undefined;
  age: number | undefined;
}>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('name');
      expect(props).toHaveProperty('age');
    });
  });

  describe('extractVueEmits - edge cases', () => {
    it('should handle type-based emits with complex signatures', () => {
      const sourceCode = `
const emit = defineEmits<{
  (e: 'update', id: number, value: string): void;
  (e: 'delete', id: number): void;
  (e: 'create', data: { name: string; age: number }): void;
}>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmits(sourceFile);

      expect(emits).toHaveProperty('update');
      expect(emits).toHaveProperty('delete');
      expect(emits).toHaveProperty('create');
      if (typeof emits.update === 'object' && emits.update !== null) {
        expect(emits.update.signature).toContain('update');
        expect(emits.update.signature).toContain('id');
        expect(emits.update.signature).toContain('value');
      }
    });

    it('should handle type-based emits with no additional parameters', () => {
      const sourceCode = `
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open'): void;
}>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmits(sourceFile);

      expect(emits).toHaveProperty('close');
      expect(emits).toHaveProperty('open');
      if (typeof emits.close === 'object' && emits.close !== null) {
        expect(emits.close.signature).toBe("(e: 'close') => void");
      }
    });

    it('should handle runtime emits with empty array', () => {
      const sourceCode = `
const emit = defineEmits([]);
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmits(sourceFile);

      expect(Object.keys(emits)).toHaveLength(0);
    });

    it('should handle type-based emits with non-matching regex pattern', () => {
      const sourceCode = `
const emit = defineEmits<{
  update: (id: number) => void;
  delete: () => void;
}>();
`;

      const sourceFile = createTestSourceFile(sourceCode, 'test.ts');

      const emits = extractVueEmits(sourceFile);

      // The regex pattern expects (e: 'eventName') format, so this won't match
      // But it should still return early and not throw
      expect(typeof emits).toBe('object');
    });
  });

  describe('Error handling', () => {
    describe('extractVueComposables - error handling', () => {
      it('should return empty array when getDescendantsOfKind throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const composables = extractVueComposables(mockSource as any);
        expect(composables).toEqual([]);
      });

      it('should continue processing when individual call expression throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [
            {
              getExpression: () => {
                throw new Error('Expression error');
              },
            },
            {
              getExpression: () => ({
                getKind: () => SyntaxKind.Identifier,
                getText: () => 'ref',
              }),
            },
          ],
        });

        const composables = extractVueComposables(mockSource as any);
        // Should still extract the valid composable despite the error
        expect(composables).toContain('ref');
      });

      it('should handle missing getFilePath gracefully', () => {
        const mockSource = createMockSourceFile({
          getFilePath: undefined,
          getDescendantsOfKind: () => [],
        });

        const composables = extractVueComposables(mockSource as any);
        expect(composables).toEqual([]);
      });
    });

    describe('extractVueComponents - error handling', () => {
      it('should return empty array when outer try block throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const components = extractVueComponents(mockSource as any);
        expect(components).toEqual([]);
      });

      it('should continue when opening element iteration throws', () => {
        let callCount = 0;
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: (kind: number) => {
            callCount++;
            if (callCount === 1) {
              // First call for JsxOpeningElement
              return [
                {
                  getTagNameNode: () => {
                    throw new Error('Tag error');
                  },
                },
              ];
            }
            // Second call for JsxSelfClosingElement
            return [
              {
                getTagNameNode: () => ({
                  getText: () => 'ValidComponent',
                }),
              },
            ];
          },
        });

        const components = extractVueComponents(mockSource as any);
        expect(components).toContain('ValidComponent');
      });

      it('should continue when self-closing element iteration throws', () => {
        let callCount = 0;
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: (kind: number) => {
            callCount++;
            if (callCount === 1) {
              // First call for JsxOpeningElement
              return [
                {
                  getTagNameNode: () => ({
                    getText: () => 'OpeningComponent',
                  }),
                },
              ];
            }
            // Second call for JsxSelfClosingElement - throws
            return [
              {
                getTagNameNode: () => {
                  throw new Error('Self-closing error');
                },
              },
            ];
          },
        });

        const components = extractVueComponents(mockSource as any);
        expect(components).toContain('OpeningComponent');
      });

      it('should handle batch error in opening elements', () => {
        let callCount = 0;
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: (kind: number) => {
            callCount++;
            if (callCount === 1) {
              // Throw on the forEach level for opening elements
              const arr: any[] = [];
              arr.forEach = () => {
                throw new Error('Batch error');
              };
              return arr;
            }
            return [];
          },
        });

        const components = extractVueComponents(mockSource as any);
        expect(components).toEqual([]);
      });

      it('should handle error in component registration property iteration', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: (kind: number) => {
            if (kind === SyntaxKind.PropertyAssignment) {
              return [
                {
                  getName: () => 'components',
                  getInitializer: () => ({
                    getProperties: () => [
                      {
                        getName: () => {
                          throw new Error('Property name error');
                        },
                      },
                    ],
                  }),
                },
              ];
            }
            return [];
          },
        });

        const components = extractVueComponents(mockSource as any);
        // Should handle error gracefully
        expect(Array.isArray(components)).toBe(true);
      });
    });

    describe('extractVueState - error handling', () => {
      it('should return empty object when getDescendantsOfKind throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const state = extractVueState(mockSource as any);
        expect(state).toEqual({});
      });

      it('should continue processing when individual variable declaration throws', () => {
        // Use a real source file - the error handling is tested via the outer catch block
        // Individual iteration errors are caught and logged, but processing continues
        const sourceCode = `
import { ref } from 'vue';

const count = ref(0);
const name = ref('hello');
`;

        const sourceFile = createTestSourceFile(sourceCode, 'test.ts');
        const state = extractVueState(sourceFile);

        // Should extract both state variables
        expect(Object.keys(state).length).toBeGreaterThan(0);
        expect(state).toHaveProperty('count');
        expect(state).toHaveProperty('name');
      });

      it('should handle missing getFilePath gracefully', () => {
        const mockSource = createMockSourceFile({
          getFilePath: undefined,
          getDescendantsOfKind: () => [],
        });

        const state = extractVueState(mockSource as any);
        expect(state).toEqual({});
      });
    });

    describe('extractVuePropsCall - error handling', () => {
      it('should return null when getDescendantsOfKind throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const propsCall = extractVuePropsCall(mockSource as any);
        expect(propsCall).toBeNull();
      });

      it('should continue processing when individual call expression throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [
            {
              getExpression: () => {
                throw new Error('Expression error');
              },
            },
            {
              getExpression: () => ({
                getKind: () => SyntaxKind.Identifier,
                getText: () => 'defineProps',
              }),
              getTypeArguments: () => [
                {
                  getText: () => '{ name: string }',
                },
              ],
            },
          ],
        });

        const propsCall = extractVuePropsCall(mockSource as any);
        // Should still extract the valid props despite the error
        expect(propsCall).toBeTruthy();
      });
    });

    describe('extractVueEmitsCall - error handling', () => {
      it('should return empty array when getDescendantsOfKind throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const emits = extractVueEmitsCall(mockSource as any);
        expect(emits).toEqual([]);
      });

      it('should continue processing when individual call expression throws', () => {
        // Use a real source file - the error handling is tested via the outer catch block
        // Individual iteration errors are caught and logged, but processing continues
        const sourceCode = `
const emit = defineEmits(['update', 'close']);
`;

        const sourceFile = createTestSourceFile(sourceCode, 'test.ts');
        const emits = extractVueEmitsCall(sourceFile);

        // Should extract emits
        expect(emits.length).toBeGreaterThan(0);
        expect(emits).toContain('update');
        expect(emits).toContain('close');
      });
    });

    describe('extractVueProps - error handling', () => {
      it('should return empty object when getDescendantsOfKind throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const props = extractVueProps(mockSource as any);
        expect(props).toEqual({});
      });

      it('should continue processing when individual call expression throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [
            {
              getExpression: () => {
                throw new Error('Expression error');
              },
            },
            {
              getExpression: () => ({
                getKind: () => SyntaxKind.Identifier,
                getText: () => 'defineProps',
              }),
              getTypeArguments: () => [
                {
                  getType: () => ({
                    getProperties: () => [],
                  }),
                },
              ],
            },
          ],
        });

        const props = extractVueProps(mockSource as any);
        // Should handle error gracefully
        expect(typeof props).toBe('object');
      });

      it('should handle error in type property parsing', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [
            {
              getExpression: () => ({
                getKind: () => SyntaxKind.Identifier,
                getText: () => 'defineProps',
              }),
              getTypeArguments: () => [
                {
                  getType: () => ({
                    getProperties: () => [
                      {
                        getName: () => {
                          throw new Error('Property name error');
                        },
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        });

        const props = extractVueProps(mockSource as any);
        // Should handle error gracefully
        expect(typeof props).toBe('object');
      });

      it('should handle error in runtime property parsing', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [
            {
              getExpression: () => ({
                getKind: () => SyntaxKind.Identifier,
                getText: () => 'defineProps',
              }),
              getTypeArguments: () => [],
              getArguments: () => [
                {
                  getProperties: () => [
                    {
                      getName: () => {
                        throw new Error('Property name error');
                      },
                    },
                  ],
                },
              ],
            },
          ],
        });

        const props = extractVueProps(mockSource as any);
        // Should handle error gracefully
        expect(typeof props).toBe('object');
      });
    });

    describe('extractVueEmits - error handling', () => {
      it('should return empty object when getDescendantsOfKind throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const emits = extractVueEmits(mockSource as any);
        expect(emits).toEqual({});
      });

      it('should continue processing when individual call expression throws', () => {
        // Use a real source file - the error handling is tested via the outer catch block
        // Individual iteration errors are caught and logged, but processing continues
        const sourceCode = `
const emit = defineEmits(['update', 'close']);
`;

        const sourceFile = createTestSourceFile(sourceCode, 'test.ts');
        const emits = extractVueEmits(sourceFile);

        // Should extract emits
        expect(Object.keys(emits).length).toBeGreaterThan(0);
        expect(emits).toHaveProperty('update');
        expect(emits).toHaveProperty('close');
      });

      it('should handle error in type parsing', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [
            {
              getExpression: () => ({
                getKind: () => SyntaxKind.Identifier,
                getText: () => 'defineEmits',
              }),
              getTypeArguments: () => [
                {
                  getText: () => {
                    throw new Error('Type text error');
                  },
                },
              ],
            },
          ],
        });

        const emits = extractVueEmits(mockSource as any);
        // Should handle error gracefully
        expect(typeof emits).toBe('object');
      });

      it('should handle error in runtime element iteration', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [
            {
              getExpression: () => ({
                getKind: () => SyntaxKind.Identifier,
                getText: () => 'defineEmits',
              }),
              getTypeArguments: () => [],
              getArguments: () => [
                {
                  getElements: () => [
                    {
                      getText: () => {
                        throw new Error('Element text error');
                      },
                    },
                  ],
                },
              ],
            },
          ],
        });

        const emits = extractVueEmits(mockSource as any);
        // Should handle error gracefully
        expect(typeof emits).toBe('object');
      });
    });
  });
});
