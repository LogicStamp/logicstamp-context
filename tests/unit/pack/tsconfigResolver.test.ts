import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildTsconfigResolverContext,
  resolveTsconfigCandidates,
} from '../../../src/core/pack/tsconfigResolver.js';

const tempRoots: string[] = [];

async function createTempRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'logicstamp-tsconfig-'));
  tempRoots.push(root);
  return root;
}

describe('tsconfigResolver', () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots
        .splice(0)
        .map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  it('resolves inherited paths when extends omits the .json suffix', async () => {
    const repoRoot = await createTempRepo();

    await mkdir(join(repoRoot, 'apps/web'), { recursive: true });
    await mkdir(join(repoRoot, 'packages/ui/src'), { recursive: true });

    await writeFile(
      join(repoRoot, 'tsconfig.base.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@repo/ui': ['packages/ui/src/index.ts'],
          },
        },
      }),
      'utf8',
    );
    await writeFile(
      join(repoRoot, 'apps/web/tsconfig.json'),
      JSON.stringify({
        extends: '../../tsconfig.base',
      }),
      'utf8',
    );
    await writeFile(
      join(repoRoot, 'packages/ui/src/index.ts'),
      'export {};',
      'utf8',
    );

    const context = await buildTsconfigResolverContext(repoRoot);

    expect(context).not.toBeNull();
    expect(context?.tsconfigFiles).toContain('apps/web/tsconfig.json');
    expect(
      resolveTsconfigCandidates('@repo/ui', 'apps/web/src/App.tsx', context),
    ).toContain('packages/ui/src/index.ts');
  });

  it('uses the nearest tsconfig for the importing file', async () => {
    const repoRoot = await createTempRepo();

    await mkdir(join(repoRoot, 'apps/web'), { recursive: true });
    await mkdir(join(repoRoot, 'apps/admin'), { recursive: true });

    await writeFile(
      join(repoRoot, 'apps/web/tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: '../..',
          paths: {
            '@shared/*': ['packages/web-shared/src/*'],
          },
        },
      }),
      'utf8',
    );
    await writeFile(
      join(repoRoot, 'apps/admin/tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: '../..',
          paths: {
            '@shared/*': ['packages/admin-shared/src/*'],
          },
        },
      }),
      'utf8',
    );

    const context = await buildTsconfigResolverContext(repoRoot);

    expect(context).not.toBeNull();
    expect(
      resolveTsconfigCandidates(
        '@shared/button',
        'apps/web/src/App.tsx',
        context,
      ),
    ).toContain('packages/web-shared/src/button.ts');
    expect(
      resolveTsconfigCandidates(
        '@shared/button',
        'apps/web/src/App.tsx',
        context,
      ),
    ).not.toContain('packages/admin-shared/src/button.ts');
    expect(
      resolveTsconfigCandidates(
        '@shared/button',
        'apps/admin/src/App.tsx',
        context,
      ),
    ).toContain('packages/admin-shared/src/button.ts');
  });
});
