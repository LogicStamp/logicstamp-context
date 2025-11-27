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
      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
        variant === 'primary'
          ? 'bg-blue-500 hover:bg-blue-600 text-white'
          : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}
