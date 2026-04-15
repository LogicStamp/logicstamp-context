import React from 'react';

interface RepoButtonProps {
  label: string;
}

export function RepoButton({ label }: RepoButtonProps) {
  return <button>{label}</button>;
}
