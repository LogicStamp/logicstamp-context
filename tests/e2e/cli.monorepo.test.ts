import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

interface FolderInfo {
  path: string;
  contextFile: string;
  isRoot: boolean;
  rootLabel?: string;
}

interface BundleNode {
  contract?: {
    kind?: string;
    entryId?: string;
  };
}

interface Bundle {
  entryId?: string;
  graph: {
    nodes: BundleNode[];
  };
}

describe('CLI Monorepo Fixture Tests', () => {
  // This fixture is intentionally minimal: it represents a Turborepo-style
  // workspace layout for scanner coverage, not a verbatim create-turbo scaffold.
  const fixturesPath = join(process.cwd(), 'tests/fixtures/turborepo');
  let outputPath: string;

  beforeEach(async () => {
    const uniqueId = randomUUID().substring(0, 8);
    outputPath = join(
      process.cwd(),
      'tests/e2e/output',
      `monorepo-${uniqueId}`,
    );
    await mkdir(outputPath, { recursive: true });
  });

  afterEach(async () => {
    if (outputPath) {
      await rm(outputPath, { recursive: true, force: true });
    }
  });

  it('should generate context for a turborepo-style workspace', async () => {
    const outDir = join(outputPath, 'generated');
    const { stdout } = await execAsync(
      `node dist/cli/index.js ${fixturesPath} --out ${outDir}`,
    );

    expect(stdout).toContain('Scanning');
    expect(stdout).toContain('context files written successfully');

    const mainIndexPath = join(outDir, 'context_main.json');
    await access(mainIndexPath);

    const index = JSON.parse(await readFile(mainIndexPath, 'utf-8')) as {
      folders: FolderInfo[];
    };
    const foldersByPath = new Map(
      index.folders.map((folder) => [folder.path, folder]),
    );

    const expectedFolders = [
      'apps/api/src',
      'apps/web/src',
      'packages/shared/src',
      'packages/ui/src',
    ];

    for (const folderPath of expectedFolders) {
      expect(foldersByPath.has(folderPath)).toBe(true);
      const folderInfo = foldersByPath.get(folderPath);
      expect(folderInfo).toBeDefined();
      if (!folderInfo) {
        throw new Error(`Missing folder info for ${folderPath}`);
      }
      await access(join(outDir, folderInfo.contextFile));
    }

    expect(foldersByPath.get('apps/api/src')).toMatchObject({
      isRoot: true,
      rootLabel: 'App: api',
    });
    expect(foldersByPath.get('apps/web/src')).toMatchObject({
      isRoot: true,
      rootLabel: 'App: web',
    });

    const readBundles = async (folderPath: string): Promise<Bundle[]> => {
      const folderInfo = foldersByPath.get(folderPath);
      expect(folderInfo).toBeDefined();
      if (!folderInfo) {
        throw new Error(`Missing folder info for ${folderPath}`);
      }
      const contextPath = join(outDir, folderInfo.contextFile);
      return JSON.parse(await readFile(contextPath, 'utf-8')) as Bundle[];
    };

    const readKinds = async (folderPath: string): Promise<string[]> => {
      const bundles = await readBundles(folderPath);
      return bundles.flatMap((bundle) =>
        bundle.graph.nodes
          .map((node) => node.contract?.kind)
          .filter((kind): kind is string => Boolean(kind)),
      );
    };

    const webBundles = await readBundles('apps/web/src');

    expect(await readKinds('apps/api/src')).toContain('node:api');
    expect(await readKinds('apps/web/src')).toContain('react:component');
    expect(await readKinds('packages/ui/src')).toContain('ts:module');
    expect(await readKinds('packages/shared/src')).toContain('ts:module');
    expect(
      webBundles.some((bundle) =>
        bundle.graph.nodes.some(
          (node) => node.contract?.kind === 'react:component',
        ),
      ),
    ).toBe(true);
    expect(
      webBundles.some((bundle) =>
        bundle.graph.nodes.some(
          (node) =>
            node.contract?.kind === 'react:component' &&
            node.contract?.entryId === 'packages/ui/src/RepoButton.tsx',
        ),
      ),
    ).toBe(true);
  }, 30000);
});
