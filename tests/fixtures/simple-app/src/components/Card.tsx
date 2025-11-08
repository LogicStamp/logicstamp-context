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
    <div className="card">
      <h2>{title}</h2>
      <p>{description}</p>
      {expanded && (
        <div className="card-details">
          <p>Additional details here...</p>
        </div>
      )}
      <div className="card-actions">
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
