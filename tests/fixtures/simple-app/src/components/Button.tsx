// @ts-nocheck
import React from 'react';

interface ButtonProps {
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  children: React.ReactNode;
}

export function Button({ onClick, variant = 'primary', disabled = false, children }: ButtonProps) {
  const handleClick = () => {
    if (!disabled) {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  );
}
