import { ref, computed, watch } from 'vue';
import { Button } from './Button';

interface CardProps {
  title: string;
  description: string;
  onAction?: () => void;
}

export function Card(props: CardProps) {
  const expanded = ref(false);
  const count = ref(0);

  const displayCount = computed(() => count.value * 2);

  watch(count, (newValue) => {
    console.log('Count changed to:', newValue);
  });

  const handleToggle = () => {
    expanded.value = !expanded.value;
    count.value++;
  };

  const handleAction = () => {
    if (props.onAction) {
      props.onAction();
    }
  };

  return () => (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{props.title}</h2>
      <p className="text-gray-600 mb-4">{props.description}</p>
      {expanded.value && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-700">
            Additional details here... Count: {displayCount.value}
          </p>
        </div>
      )}
      <div className="flex gap-3 mt-4">
        <Button onClick={handleToggle} variant="secondary">
          {expanded.value ? 'Collapse' : 'Expand'}
        </Button>
        {props.onAction && (
          <Button onClick={handleAction} variant="primary">
            Action
          </Button>
        )}
      </div>
    </div>
  );
}

