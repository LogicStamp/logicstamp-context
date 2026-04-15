import React from 'react';
import { RepoButton } from '@repo/ui';
import { formatBuildDate } from '@repo/shared/date';

export function App() {
  const buildDate = formatBuildDate(new Date('2026-04-15T00:00:00.000Z'));

  return (
    <main>
      <h1>Turbo Web</h1>
      <p>Built on {buildDate}</p>
      <RepoButton label="Ship it" />
    </main>
  );
}
