import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { detectKind } from '../../../src/core/astParser/detectors.js';
import {
  extractVueComposables,
  extractVueComponents,
  extractVueState,
  extractVuePropsCall,
  extractVueEmitsCall,
  extractVueProps,
  extractVueEmits,
} from '../../../src/core/astParser/extractors/vueComponentExtractor.js';

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('Component.vue.ts', sourceCode);

      const kind = detectKind([], [], ['vue'], 'Component.vue.ts', sourceFile);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('useCounter.ts', sourceCode);

      const kind = detectKind([], [], ['vue'], 'useCounter.ts', sourceFile);

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

      const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 1 } });
      const sourceFile = project.createSourceFile('Component.tsx', sourceCode);

      const kind = detectKind([], ['div', 'p', 'button'], ['vue'], 'Component.tsx', sourceFile);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('Component.ts', sourceCode);

      const kind = detectKind([], [], ['vue'], 'Component.ts', sourceFile);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('useCounter');
    });

    it('should extract defineProps and defineEmits', () => {
      const sourceCode = `
const props = defineProps<{ name: string }>();
const emit = defineEmits<{ (e: 'update'): void }>();
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const composables = extractVueComposables(sourceFile);

      expect(composables).toContain('defineProps');
      expect(composables).toContain('defineEmits');
    });

    it('should extract watchEffect', () => {
      const sourceCode = `
import { watchEffect } from 'vue';
watchEffect(() => console.log('effect'));
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 1 } });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const propsCall = extractVuePropsCall(sourceFile);

      expect(propsCall).toBeTruthy();
      expect(propsCall).toContain('name');
    });

    it('should return null when no defineProps', () => {
      const sourceCode = `
import { ref } from 'vue';
const count = ref(0);
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const emits = extractVueEmitsCall(sourceFile);

      expect(emits.length).toBeGreaterThan(0);
    });

    it('should extract defineEmits with runtime array', () => {
      const sourceCode = `
const emit = defineEmits(['update', 'close', 'submit']);
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('name');
      expect(props).toHaveProperty('age');
      expect(props).toHaveProperty('email');
      // email should be optional - check if it's an object with optional property
      if (typeof props.email === 'object' && props.email !== null && !Array.isArray(props.email)) {
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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const props = extractVueProps(sourceFile);

      expect(props).toHaveProperty('name');
      expect(props).toHaveProperty('count');
    });

    it('should return empty object when no props', () => {
      const sourceCode = `
import { ref } from 'vue';
const count = ref(0);
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 1 } });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

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

      const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: 1 } });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const components = extractVueComponents(sourceFile);

      expect(components).not.toContain('div');
      expect(components).not.toContain('p');
      expect(components).not.toContain('span');
    });
  });
});
