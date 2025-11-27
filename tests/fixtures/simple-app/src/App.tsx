import React from 'react';
import { Card } from './components/Card';

export function App() {
  const handleCardAction = () => {
    console.log('Card action triggered');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">Simple App</h1>
      <div className="max-w-md mx-auto">
        <Card
          title="Welcome"
          description="This is a test component"
          onAction={handleCardAction}
        />
      </div>
    </div>
  );
}
