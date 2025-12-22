import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { decode as decodeToon } from '@toon-format/toon';

const execAsync = promisify(exec);

describe('CLI TOON Format', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  let outputPath: string;

  beforeEach(async () => {
    const uniqueId = randomUUID().substring(0, 8);
    outputPath = join(process.cwd(), 'tests/e2e/output', `toon-${uniqueId}`);
    await mkdir(outputPath, { recursive: true });
  });

  afterEach(async () => {
    if (outputPath) {
      try {
        await rm(outputPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('should generate valid TOON output with --format toon', async () => {
    const outDir = join(outputPath, 'toon-test');

    const { stdout } = await execAsync(
      `node dist/cli/stamp.js context ${fixturesPath} --format toon --out ${outDir}`
    );

    expect(stdout).toContain('context files written successfully');

    // Verify context_main.json index exists
    const mainIndexPath = join(outDir, 'context_main.json');
    await access(mainIndexPath);

    const indexContent = await readFile(mainIndexPath, 'utf-8');
    const index = JSON.parse(indexContent);

    // Verify .toon extension is used
    expect(index.folders[0].contextFile).toContain('.toon');

    // Verify TOON file exists and is decodable
    const toonFilePath = join(outDir, index.folders[0].contextFile);
    await access(toonFilePath);

    const toonContent = await readFile(toonFilePath, 'utf-8');
    const bundles = decodeToon(toonContent) as any[];

    expect(Array.isArray(bundles)).toBe(true);
    expect(bundles.length).toBeGreaterThan(0);
    expect(bundles[0]).toHaveProperty('type', 'LogicStampBundle');
    expect(bundles[0]).toHaveProperty('graph');
  }, 30000);
});
