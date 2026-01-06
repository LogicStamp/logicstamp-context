import { ref, computed } from 'vue';

export function useCounter(initialValue = 0) {
  const count = ref(initialValue);

  const increment = () => {
    count.value++;
  };

  const decrement = () => {
    count.value--;
  };

  const reset = () => {
    count.value = initialValue;
  };

  const doubled = computed(() => count.value * 2);

  return {
    count,
    doubled,
    increment,
    decrement,
    reset,
  };
}

