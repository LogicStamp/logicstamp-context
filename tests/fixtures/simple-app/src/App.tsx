import React from 'react';
import { Card } from './components/Card';

export function App() {
  const handleCardAction = () => {
    console.log('Card action triggered');
  };

  return (
    <div className="app">
      <h1>Simple App</h1>
      <Card
        title="Welcome"
        description="This is a test component"
        onAction={handleCardAction}
      />
    </div>
  );
}
