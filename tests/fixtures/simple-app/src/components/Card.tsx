// @ts-nocheck
import React, { useState } from 'react';
import { Button } from './Button';

interface CardProps {
  title: string;
  description: string;
  onAction?: () => void;
}

export function Card({ title, description, onAction }: CardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600 mb-4">{description}</p>
      {expanded && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-700">Additional details here...</p>
        </div>
      )}
      <div className="flex gap-3 mt-4">
        <Button onClick={handleToggle} variant="secondary">
          {expanded ? 'Collapse' : 'Expand'}
        </Button>
        {onAction && (
          <Button onClick={onAction} variant="primary">
            Action
          </Button>
        )}
      </div>
    </div>
  );
}
