import { ref, computed } from 'vue';
import { Card } from './components/Card';
import { useCounter } from './composables/useCounter';

export default function App() {
  const { count, increment, decrement } = useCounter(0);
  const message = ref('Welcome to Vue App');
  
  const displayMessage = computed(() => {
    return `${message.value} - Count: ${count.value}`;
  });

  const handleCardAction = () => {
    console.log('Card action triggered');
    increment();
  };

  return () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">{displayMessage.value}</h1>
      <div className="max-w-md mx-auto">
        <Card
          title="Welcome"
          description="This is a Vue test component"
          onAction={handleCardAction}
        />
        <div className="mt-4 flex gap-3 justify-center">
          <button
            onClick={increment}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Increment
          </button>
          <button
            onClick={decrement}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            Decrement
          </button>
        </div>
      </div>
    </div>
  );
}

