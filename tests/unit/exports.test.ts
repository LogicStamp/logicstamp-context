import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

/**
 * Test that the main entry point exports all expected APIs
 * This ensures the package can be imported correctly by consumers
 */
describe('Main Entry Point Exports', () => {
  // Test that we can import from the main entry point
  // Using dynamic import to test the compiled dist/index.js
  it('should export all core functions', async () => {
    const pkg = await import('../../dist/index.js');
    
    // Core functions
    expect(pkg.extractFromFile).toBeDefined();
    expect(typeof pkg.extractFromFile).toBe('function');
    
    expect(pkg.buildContract).toBeDefined();
    expect(typeof pkg.buildContract).toBe('function');
    
    expect(pkg.pack).toBeDefined();
    expect(typeof pkg.pack).toBe('function');
    
    expect(pkg.computeBundleHash).toBeDefined();
    expect(typeof pkg.computeBundleHash).toBe('function');
    
    expect(pkg.validateHashLock).toBeDefined();
    expect(typeof pkg.validateHashLock).toBe('function');
    
    expect(pkg.buildLogicSignature).toBeDefined();
    expect(typeof pkg.buildLogicSignature).toBe('function');
  });

  it('should export CLI commands', async () => {
    const pkg = await import('../../dist/index.js');
    
    expect(pkg.contextCommand).toBeDefined();
    expect(typeof pkg.contextCommand).toBe('function');
    
    expect(pkg.compareCommand).toBeDefined();
    expect(typeof pkg.compareCommand).toBe('function');
    
    expect(pkg.validateCommand).toBeDefined();
    expect(typeof pkg.validateCommand).toBe('function');
    
    expect(pkg.init).toBeDefined();
    expect(typeof pkg.init).toBe('function');
    
    expect(pkg.cleanCommand).toBeDefined();
    expect(typeof pkg.cleanCommand).toBe('function');
  });

  it('should export types (type-only exports)', async () => {
    // Type exports are compile-time only, but we can verify the module loads
    const pkg = await import('../../dist/index.js');
    
    // The module should load without errors
    expect(pkg).toBeDefined();
    expect(typeof pkg).toBe('object');
  });

  it('should work with a real import from main entry', async () => {
    // Test that we can actually use an exported function
    const { extractFromFile } = await import('../../dist/index.js');
    
    const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app/src');
    const buttonPath = join(fixturesPath, 'components/Button.tsx');
    
    const ast = await extractFromFile(buttonPath);
    
    expect(ast).toBeDefined();
    expect(ast.kind).toBeDefined();
    expect(Array.isArray(ast.imports)).toBe(true);
  });
});

