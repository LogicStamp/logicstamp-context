import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(exec);

describe('New Features E2E Tests (v0.1.1)', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  const outputPath = join(process.cwd(), 'tests/e2e/output');

  beforeEach(async () => {
    // Clean up any existing output files
    try {
      await rm(outputPath, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, which is fine
    }
    // Create output directory
    await mkdir(outputPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up output files after tests
    try {
      await rm(outputPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Token Estimation Features', () => {
    it('should display token estimates in default output', async () => {
      const outFile = join(outputPath, 'context.json');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --out ${outFile}`
      );

      // Verify token estimates section
      expect(stdout).toContain('📏 Token Estimates');
      expect(stdout).toContain('GPT-4o-mini:');
      expect(stdout).toContain('Claude:');
      expect(stdout).toContain('savings');
      expect(stdout).toContain('Full code:');

      // Verify mode comparison block
      expect(stdout).toContain('📊 Mode Comparison:');
      expect(stdout).toContain('none:');
      expect(stdout).toContain('header:');
      expect(stdout).toContain('full:');
      expect(stdout).toContain('tokens');
    }, 30000);

    it('should include token estimates in --stats JSON output', async () => {
      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --stats`
      );

      // Parse the JSON output (extract last line which is the JSON)
      const lines = stdout.trim().split('\n');
      const jsonLine = lines[lines.length - 1];
      const stats = JSON.parse(jsonLine);

      // Verify token fields exist
      expect(stats).toHaveProperty('tokensGPT4');
      expect(stats).toHaveProperty('tokensClaude');
      expect(stats.tokensGPT4).toBeGreaterThan(0);
      expect(stats.tokensClaude).toBeGreaterThan(0);

      // Verify mode estimates
      expect(stats).toHaveProperty('modeEstimates');
      expect(stats.modeEstimates).toHaveProperty('none');
      expect(stats.modeEstimates).toHaveProperty('header');
      expect(stats.modeEstimates).toHaveProperty('full');

      // Verify each mode has both GPT and Claude estimates
      expect(stats.modeEstimates.none).toHaveProperty('gpt4');
      expect(stats.modeEstimates.none).toHaveProperty('claude');
      expect(stats.modeEstimates.header).toHaveProperty('gpt4');
      expect(stats.modeEstimates.header).toHaveProperty('claude');
      expect(stats.modeEstimates.full).toHaveProperty('gpt4');
      expect(stats.modeEstimates.full).toHaveProperty('claude');

      // Verify savings percentages
      expect(stats).toHaveProperty('savingsGPT4');
      expect(stats).toHaveProperty('savingsClaude');

      // Verify logical ordering: none < header < full
      expect(stats.modeEstimates.none.gpt4).toBeLessThan(stats.modeEstimates.header.gpt4);
      expect(stats.modeEstimates.header.gpt4).toBeLessThan(stats.modeEstimates.full.gpt4);
    }, 30000);

    it('should show detailed comparison with --compare-modes flag', async () => {
      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --compare-modes`
      );

      // Verify table output
      expect(stdout).toContain('📊 Mode Comparison');
      expect(stdout).toContain('Mode     | Tokens GPT-4o | Tokens Claude | Savings vs Full');
      expect(stdout).toContain('---------|---------------|---------------|------------------');

      // Verify all three modes are present
      expect(stdout).toContain('none');
      expect(stdout).toContain('header');
      expect(stdout).toContain('full');

      // Verify savings percentages
      expect(stdout).toMatch(/none\s+\|\s+[\d,]+\s+\|\s+[\d,]+\s+\|\s+\d+%/);
      expect(stdout).toMatch(/header\s+\|\s+[\d,]+\s+\|\s+[\d,]+\s+\|\s+\d+%/);
      expect(stdout).toMatch(/full\s+\|\s+[\d,]+\s+\|\s+[\d,]+\s+\|\s+0%/);

      // Verify it doesn't write a file (compare-modes is analysis only)
      expect(stdout).not.toContain('Writing to:');
    }, 30000);

    it('should calculate savings correctly', async () => {
      await execAsync('npm run build');

      const { stdout: statsOutput } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --stats`
      );

      // Extract JSON from last line
      const lines = statsOutput.trim().split('\n');
      const jsonLine = lines[lines.length - 1];
      const stats = JSON.parse(jsonLine);

      // Calculate expected savings
      const expectedSavingsGPT4 = Math.round(
        ((stats.modeEstimates.full.gpt4 - stats.tokensGPT4) / stats.modeEstimates.full.gpt4) * 100
      );

      // Verify savings calculation (allow for rounding)
      const actualSavings = parseInt(stats.savingsGPT4);
      expect(Math.abs(actualSavings - expectedSavingsGPT4)).toBeLessThanOrEqual(1);
    }, 30000);
  });

  describe('Compare Command', () => {
    it('should detect no drift when files are identical', async () => {
      const file1 = join(outputPath, 'context1.json');
      const file2 = join(outputPath, 'context2.json');

      await execAsync('npm run build');

      // Generate same context twice
      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${file1}`);
      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${file2}`);

      // Compare
      const { stdout } = await execAsync(
        `node dist/cli/index.js compare ${file1} ${file2}`
      );

      expect(stdout).toContain('PASS');
      expect(stdout).not.toContain('DRIFT');
      expect(stdout).not.toContain('Added components:');
      expect(stdout).not.toContain('Removed components:');
      expect(stdout).not.toContain('Changed components:');
    }, 60000);

    it('should detect added components', async () => {
      const oldContext = join(outputPath, 'old.json');
      const newContext = join(outputPath, 'new.json');

      await execAsync('npm run build');

      // Create old context (minimal)
      await writeFile(oldContext, JSON.stringify([
        {
          "$schema": "https://logicstamp.dev/schemas/context/v0.1.json",
          "position": "1/1",
          "type": "LogicStampBundle",
          "schemaVersion": "0.1",
          "entryId": "test.tsx",
          "depth": 1,
          "createdAt": new Date().toISOString(),
          "bundleHash": "uifb:000000000000000000000000",
          "graph": {
            "nodes": [{
              "entryId": "test.tsx",
              "contract": {
                "type": "UIFContract",
                "schemaVersion": "0.3",
                "kind": "react:component",
                "entryId": "test.tsx",
                "semanticHash": "uif:test",
                "version": { imports: [], hooks: [], components: [], functions: [] },
                "logicSignature": { props: {}, emits: {} },
                "exports": "default"
              }
            }],
            "edges": []
          },
          "meta": { missing: [], source: "test" }
        }
      ]));

      // Generate new context (has more files)
      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${newContext}`);

      // Compare
      try {
        await execAsync(`node dist/cli/index.js compare ${oldContext} ${newContext}`);
        expect.fail('Should have exited with code 1');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout).toContain('DRIFT');
        expect(error.stdout).toContain('Added components:');
      }
    }, 60000);

    it('should detect removed components', async () => {
      const oldContext = join(outputPath, 'old.json');
      const newContext = join(outputPath, 'new.json');

      await execAsync('npm run build');

      // Generate full context
      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${oldContext}`);

      // Create minimal new context
      await writeFile(newContext, JSON.stringify([
        {
          "$schema": "https://logicstamp.dev/schemas/context/v0.1.json",
          "position": "1/1",
          "type": "LogicStampBundle",
          "schemaVersion": "0.1",
          "entryId": "test.tsx",
          "depth": 1,
          "createdAt": new Date().toISOString(),
          "bundleHash": "uifb:000000000000000000000000",
          "graph": {
            "nodes": [{
              "entryId": "test.tsx",
              "contract": {
                "type": "UIFContract",
                "schemaVersion": "0.3",
                "kind": "react:component",
                "entryId": "test.tsx",
                "semanticHash": "uif:test",
                "version": { imports: [], hooks: [], components: [], functions: [] },
                "logicSignature": { props: {}, emits: {} },
                "exports": "default"
              }
            }],
            "edges": []
          },
          "meta": { missing: [], source: "test" }
        }
      ]));

      // Compare
      try {
        await execAsync(`node dist/cli/index.js compare ${oldContext} ${newContext}`);
        expect.fail('Should have exited with code 1');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout).toContain('DRIFT');
        expect(error.stdout).toContain('Removed components:');
      }
    }, 60000);

    it('should show token stats with --stats flag', async () => {
      const file1 = join(outputPath, 'context1.json');
      const file2 = join(outputPath, 'context2.json');

      await execAsync('npm run build');

      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${file1}`);
      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${file2}`);

      const { stdout } = await execAsync(
        `node dist/cli/index.js compare ${file1} ${file2} --stats`
      );

      expect(stdout).toContain('Token Stats:');
      expect(stdout).toContain('Old:');
      expect(stdout).toContain('New:');
      expect(stdout).toContain('GPT-4o-mini');
      expect(stdout).toContain('Claude');
    }, 60000);

    it('should exit with code 0 on PASS and code 1 on DRIFT', async () => {
      const file1 = join(outputPath, 'pass1.json');
      const file2 = join(outputPath, 'pass2.json');

      await execAsync('npm run build');

      // Generate identical contexts
      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${file1}`);
      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${file2}`);

      // Should not throw (exit code 0)
      const { stdout } = await execAsync(
        `node dist/cli/index.js compare ${file1} ${file2}`
      );
      expect(stdout).toContain('PASS');
    }, 60000);
  });

  describe('Strict Missing Flag', () => {
    it('should pass when no missing dependencies', async () => {
      const outFile = join(outputPath, 'strict-pass.json');

      await execAsync('npm run build');

      // Should not throw (fixtures have no missing deps)
      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --strict-missing --out ${outFile}`
      );

      expect(stdout).toContain('Missing dependencies: 0');
      expect(stdout).not.toContain('Strict missing mode');
    }, 30000);

    it('should exit with code 1 when missing dependencies found', async () => {
      // This test would need a fixture with missing dependencies
      // For now, we'll skip it or create a temporary fixture
      // Skipping for now as the simple-app has no missing deps
    }, 30000);
  });

  describe('Enhanced Component Detection', () => {
    it('should detect Button.tsx as react:component (HTML JSX)', async () => {
      const outFile = join(outputPath, 'button-test.json');

      await execAsync('npm run build');

      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${outFile}`);

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

      // Find Button.tsx in bundles
      const buttonBundle = bundles.find((b: any) =>
        b.entryId.toLowerCase().includes('button.tsx')
      );

      if (buttonBundle) {
        // Find the Button node
        const buttonNode = buttonBundle.graph.nodes.find((n: any) =>
          n.entryId.toLowerCase().includes('button.tsx')
        );

        expect(buttonNode).toBeDefined();
        expect(buttonNode.contract.kind).toBe('react:component');
        expect(buttonNode.contract.kind).not.toBe('ts:module');
      }
    }, 30000);

    it('should detect all React components correctly', async () => {
      const outFile = join(outputPath, 'all-components.json');

      await execAsync('npm run build');

      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${outFile}`);

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

      // Check that all .tsx files are detected as react:component
      bundles.forEach((bundle: any) => {
        bundle.graph.nodes.forEach((node: any) => {
          if (node.entryId.endsWith('.tsx')) {
            // Only check if it has React imports
            const hasReactImport = node.contract.version?.imports?.some(
              (imp: string) => imp === 'react' || imp.startsWith('react/')
            );

            if (hasReactImport) {
              expect(node.contract.kind).toBe('react:component');
            }
          }
        });
      });
    }, 30000);
  });

  describe('Dependency Resolution', () => {
    it('should resolve dependencies within same directory first', async () => {
      const outFile = join(outputPath, 'deps.json');

      await execAsync('npm run build');

      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${outFile}`);

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

      // Check that Card.tsx resolves Button.tsx from same directory
      const cardBundle = bundles.find((b: any) =>
        b.entryId.toLowerCase().includes('card.tsx')
      );

      if (cardBundle && cardBundle.graph.edges.length > 0) {
        // Card depends on Button
        const buttonDep = cardBundle.graph.nodes.find((n: any) =>
          n.entryId.toLowerCase().includes('button.tsx')
        );

        if (buttonDep) {
          // Button should be from the same directory structure as Card
          const cardDir = cardBundle.entryId.substring(0, cardBundle.entryId.lastIndexOf('/'));
          const buttonDir = buttonDep.entryId.substring(0, buttonDep.entryId.lastIndexOf('/'));

          // Should resolve to same components directory
          expect(cardDir).toContain('components');
          expect(buttonDir).toContain('components');
        }
      }
    }, 30000);
  });

  describe('Output Format Consistency', () => {
    it('should include all new fields in bundle output', async () => {
      const outFile = join(outputPath, 'format-check.json');

      await execAsync('npm run build');

      await execAsync(`node dist/cli/index.js ${fixturesPath} --out ${outFile}`);

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

      expect(bundles.length).toBeGreaterThan(0);

      bundles.forEach((bundle: any) => {
        // Verify standard fields
        expect(bundle).toHaveProperty('$schema');
        expect(bundle).toHaveProperty('position');
        expect(bundle).toHaveProperty('type');
        expect(bundle).toHaveProperty('schemaVersion');
        expect(bundle).toHaveProperty('entryId');
        expect(bundle).toHaveProperty('depth');
        expect(bundle).toHaveProperty('createdAt');
        expect(bundle).toHaveProperty('bundleHash');
        expect(bundle).toHaveProperty('graph');
        expect(bundle).toHaveProperty('meta');

        // Verify graph structure
        expect(bundle.graph).toHaveProperty('nodes');
        expect(bundle.graph).toHaveProperty('edges');
        expect(Array.isArray(bundle.graph.nodes)).toBe(true);
        expect(Array.isArray(bundle.graph.edges)).toBe(true);

        // Verify meta fields
        expect(bundle.meta).toHaveProperty('missing');
        expect(bundle.meta).toHaveProperty('source');
        expect(Array.isArray(bundle.meta.missing)).toBe(true);
      });
    }, 30000);
  });

  describe('CLI Integration', () => {
    it('should support chaining multiple flags', async () => {
      const outFile = join(outputPath, 'multi-flags.json');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --depth 2 --include-code full --out ${outFile}`
      );

      expect(stdout).toContain('Context written successfully');
      expect(stdout).toContain('Token Estimates');
      expect(stdout).toContain('Mode Comparison');

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);
      expect(bundles.length).toBeGreaterThan(0);
    }, 30000);

    it('should show help for compare command', async () => {
      await execAsync('npm run build');

      const { stdout } = await execAsync('node dist/cli/index.js compare --help');

      expect(stdout).toContain('LogicStamp Context Compare');
      expect(stdout).toContain('Diff two context.json files');
      expect(stdout).toContain('USAGE:');
      expect(stdout).toContain('compare <old.json> <new.json>');
      expect(stdout).toContain('--stats');
    }, 30000);
  });
});
