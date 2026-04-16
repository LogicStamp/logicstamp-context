/**
 * Unit tests for signature module
 */

import { describe, it, expect } from 'vitest';
import {
  buildLogicSignature,
  generateBehavioralPredictions,
  inferDescription,
} from '../../../src/core/signature.js';
import type { AstExtract } from '../../../src/core/astParser.js';

/**
 * Helper to create a mock AstExtract for testing
 */
function createMockAst(overrides?: Partial<AstExtract>): AstExtract {
  return {
    kind: 'react:component',
    variables: [],
    hooks: [],
    components: [],
    functions: [],
    props: {},
    state: {},
    emits: {},
    imports: [],
    jsxRoutes: [],
    ...overrides,
  };
}

describe('signature', () => {
  describe('buildLogicSignature', () => {
    describe('basic signature building', () => {
      it('should build basic signature from AST', () => {
        const ast = createMockAst({
          props: { title: 'string', count: 'number' },
          emits: { onClick: 'function' },
          state: { isOpen: 'boolean' },
        });

        const result = buildLogicSignature(ast, 'none');

        expect(result.signature.props).toEqual({
          title: 'string',
          count: 'number',
        });
        expect(result.signature.emits).toEqual({ onClick: 'function' });
        expect(result.signature.state).toEqual({ isOpen: 'boolean' });
      });

      it('should omit state when empty', () => {
        const ast = createMockAst({
          props: { title: 'string' },
          emits: {},
          state: {},
        });

        const result = buildLogicSignature(ast, 'none');

        expect(result.signature.state).toBeUndefined();
      });

      it('should return empty predictions and violations for none preset', () => {
        const ast = createMockAst();

        const result = buildLogicSignature(ast, 'none');

        expect(result.prediction).toHaveLength(0);
        expect(result.violations).toHaveLength(0);
      });
    });

    describe('submit-only preset', () => {
      it('should add submit-only preset prediction', () => {
        const ast = createMockAst({
          emits: { onSubmit: 'function' },
        });

        const result = buildLogicSignature(ast, 'submit-only');

        expect(result.prediction).toContain('Contract preset: submit-only');
      });

      it('should allow onSubmit event', () => {
        const ast = createMockAst({
          emits: { onSubmit: 'function' },
        });

        const result = buildLogicSignature(ast, 'submit-only');

        expect(result.violations).toHaveLength(0);
        expect(result.prediction).toContain(
          'onSubmit is the only permitted action handler',
        );
      });

      it('should violate when non-submit events are present', () => {
        const ast = createMockAst({
          emits: {
            onSubmit: 'function',
            onClick: 'function',
            onChange: 'function',
          },
        });

        const result = buildLogicSignature(ast, 'submit-only');

        expect(result.violations.length).toBe(1);
        expect(result.violations[0]).toContain('remove events');
        expect(result.violations[0]).toContain('onClick');
        expect(result.violations[0]).toContain('onChange');
      });

      it('should add loading state prediction when loading state exists', () => {
        const ast = createMockAst({
          emits: { onSubmit: 'function' },
          state: { loading: 'boolean' },
        });

        const result = buildLogicSignature(ast, 'submit-only');

        expect(result.prediction).toContain(
          'Loading state controls button disabled state',
        );
      });

      it('should add loading state prediction for busy state', () => {
        const ast = createMockAst({
          emits: { onSubmit: 'function' },
          state: { busy: 'boolean' },
        });

        const result = buildLogicSignature(ast, 'submit-only');

        expect(result.prediction).toContain(
          'Loading state controls button disabled state',
        );
      });

      it('should add loading state prediction for isLoading state', () => {
        const ast = createMockAst({
          emits: { onSubmit: 'function' },
          state: { isLoading: 'boolean' },
        });

        const result = buildLogicSignature(ast, 'submit-only');

        expect(result.prediction).toContain(
          'Loading state controls button disabled state',
        );
      });

      it('should add disabled button prediction when onSubmit exists', () => {
        const ast = createMockAst({
          emits: { onSubmit: 'function' },
        });

        const result = buildLogicSignature(ast, 'submit-only');

        expect(result.prediction).toContain(
          'When loading=true, submit button should be disabled',
        );
      });
    });

    describe('nav-only preset', () => {
      it('should add nav-only preset prediction', () => {
        const ast = createMockAst({
          emits: { onClick: 'function' },
        });

        const result = buildLogicSignature(ast, 'nav-only');

        expect(result.prediction).toContain('Contract preset: nav-only');
      });

      it('should allow onClick event', () => {
        const ast = createMockAst({
          emits: { onClick: 'function' },
        });

        const result = buildLogicSignature(ast, 'nav-only');

        expect(result.violations).toHaveLength(0);
      });

      it('should violate when missing onClick', () => {
        const ast = createMockAst({
          emits: {},
        });

        const result = buildLogicSignature(ast, 'nav-only');

        expect(result.violations).toContain(
          'Nav-only contract expects an onClick navigation handler',
        );
      });

      it('should violate when non-onClick events are present', () => {
        const ast = createMockAst({
          emits: { onClick: 'function', onSubmit: 'function' },
        });

        const result = buildLogicSignature(ast, 'nav-only');

        expect(result.violations.length).toBe(1);
        expect(result.violations[0]).toContain('remove events');
        expect(result.violations[0]).toContain('onSubmit');
      });

      it('should add navigation prediction', () => {
        const ast = createMockAst({
          emits: { onClick: 'function' },
        });

        const result = buildLogicSignature(ast, 'nav-only');

        expect(result.prediction).toContain(
          'Component handles navigation only, no form submission or data mutation',
        );
      });

      it('should add href prediction when href prop exists', () => {
        const ast = createMockAst({
          props: { href: 'string' },
          emits: { onClick: 'function' },
        });

        const result = buildLogicSignature(ast, 'nav-only');

        expect(result.prediction).toContain(
          'Navigation target specified via href/to prop',
        );
      });

      it('should add href prediction when to prop exists', () => {
        const ast = createMockAst({
          props: { to: 'string' },
          emits: { onClick: 'function' },
        });

        const result = buildLogicSignature(ast, 'nav-only');

        expect(result.prediction).toContain(
          'Navigation target specified via href/to prop',
        );
      });
    });

    describe('display-only preset', () => {
      it('should add display-only preset prediction', () => {
        const ast = createMockAst();

        const result = buildLogicSignature(ast, 'display-only');

        expect(result.prediction).toContain('Contract preset: display-only');
      });

      it('should allow no events', () => {
        const ast = createMockAst({
          props: { title: 'string' },
          emits: {},
        });

        const result = buildLogicSignature(ast, 'display-only');

        expect(
          result.violations.filter((v) => v.includes('no events')),
        ).toHaveLength(0);
      });

      it('should violate when any events are present', () => {
        const ast = createMockAst({
          emits: { onClick: 'function' },
        });

        const result = buildLogicSignature(ast, 'display-only');

        expect(
          result.violations.some((v) => v.includes('no events permitted')),
        ).toBe(true);
        expect(result.violations.some((v) => v.includes('onClick'))).toBe(true);
      });

      it('should add presentational prediction', () => {
        const ast = createMockAst();

        const result = buildLogicSignature(ast, 'display-only');

        expect(result.prediction).toContain(
          'Component is purely presentational with no event handlers',
        );
        expect(result.prediction).toContain(
          'All behavior driven by props only',
        );
      });

      it('should violate when state exists', () => {
        const ast = createMockAst({
          state: { count: 'number' },
        });

        const result = buildLogicSignature(ast, 'display-only');

        expect(
          result.violations.some((v) => v.includes('minimize internal state')),
        ).toBe(true);
        expect(result.violations.some((v) => v.includes('count'))).toBe(true);
      });
    });

    describe('backend API signature aggregation', () => {
      it('should aggregate API signature from backend routes', () => {
        const ast = createMockAst({
          kind: 'node:api',
          backend: {
            framework: 'express',
            routes: [
              {
                method: 'GET',
                path: '/users/:id',
                handler: 'getUser',
                params: ['id'],
                apiSignature: {
                  parameters: { id: 'string' },
                  returnType: 'User',
                  responseType: 'UserResponse',
                },
              },
            ],
          },
        });

        const result = buildLogicSignature(ast, 'none');

        expect(result.signature.apiSignature).toBeDefined();
        expect(result.signature.apiSignature?.parameters).toEqual({
          id: 'string',
        });
        expect(result.signature.apiSignature?.returnType).toBe('User');
        expect(result.signature.apiSignature?.responseType).toBe(
          'UserResponse',
        );
      });

      it('should aggregate parameters from multiple routes', () => {
        const ast = createMockAst({
          kind: 'node:api',
          backend: {
            framework: 'express',
            routes: [
              {
                method: 'GET',
                path: '/users/:id',
                handler: 'getUser',
                params: ['id'],
                apiSignature: {
                  parameters: { id: 'string' },
                },
              },
              {
                method: 'GET',
                path: '/users/:id/posts/:postId',
                handler: 'getUserPost',
                params: ['id', 'postId'],
                apiSignature: {
                  parameters: { postId: 'number' },
                },
              },
            ],
          },
        });

        const result = buildLogicSignature(ast, 'none');

        expect(result.signature.apiSignature?.parameters).toHaveProperty('id');
        expect(result.signature.apiSignature?.parameters).toHaveProperty(
          'postId',
        );
      });

      it('should include requestType for POST/PUT/PATCH routes', () => {
        const ast = createMockAst({
          kind: 'node:api',
          backend: {
            framework: 'express',
            routes: [
              {
                method: 'POST',
                path: '/users',
                handler: 'createUser',
                apiSignature: {
                  requestType: 'CreateUserRequest',
                  responseType: 'UserResponse',
                },
              },
            ],
          },
        });

        const result = buildLogicSignature(ast, 'none');

        expect(result.signature.apiSignature?.requestType).toBe(
          'CreateUserRequest',
        );
      });

      it('should default path parameters to string type', () => {
        const ast = createMockAst({
          kind: 'node:api',
          backend: {
            framework: 'express',
            routes: [
              {
                method: 'GET',
                path: '/users/:id',
                handler: 'getUser',
                params: ['id'],
                // No apiSignature with parameters
              },
            ],
          },
        });

        const result = buildLogicSignature(ast, 'none');

        expect(result.signature.apiSignature?.parameters?.id).toBe('string');
      });

      it('should return undefined apiSignature when no routes', () => {
        const ast = createMockAst({
          kind: 'node:api',
          backend: {
            framework: 'express',
            routes: [],
          },
        });

        const result = buildLogicSignature(ast, 'none');

        expect(result.signature.apiSignature).toBeUndefined();
      });
    });
  });

  describe('generateBehavioralPredictions', () => {
    it('should return empty array for minimal AST', () => {
      const ast = createMockAst();

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toHaveLength(0);
    });

    it('should detect form validation with useForm hook', () => {
      const ast = createMockAst({
        hooks: ['useForm'],
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain('Includes form validation logic');
    });

    it('should detect form validation with validate function', () => {
      const ast = createMockAst({
        functions: ['validateEmail', 'validateForm'],
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain('Includes form validation logic');
    });

    it('should detect side effects with useEffect', () => {
      const ast = createMockAst({
        hooks: ['useEffect'],
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain('Has side effects managed by useEffect');
    });

    it('should detect data fetching with Query hooks', () => {
      const ast = createMockAst({
        hooks: ['useQuery', 'useMutation'],
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain('Fetches or mutates external data');
    });

    it('should detect data fetching with fetch functions', () => {
      const ast = createMockAst({
        functions: ['fetchUsers', 'loadData'],
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain('Fetches or mutates external data');
    });

    it('should detect memoization with useMemo', () => {
      const ast = createMockAst({
        hooks: ['useMemo'],
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain(
        'Uses memoization for performance optimization',
      );
    });

    it('should detect memoization with useCallback', () => {
      const ast = createMockAst({
        hooks: ['useCallback'],
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain(
        'Uses memoization for performance optimization',
      );
    });

    it('should detect context usage', () => {
      const ast = createMockAst({
        hooks: ['useContext'],
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain('Consumes React Context for shared state');
    });

    it('should detect ref usage', () => {
      const ast = createMockAst({
        hooks: ['useRef'],
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain(
        'Uses refs for DOM access or mutable values',
      );
    });

    it('should detect loading states', () => {
      const ast = createMockAst({
        // The function checks for lowercase 'loading' or 'pending' substring
        state: { loading: 'boolean', pending: 'boolean' },
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain('Manages loading/pending UI states');
    });

    it('should detect error states', () => {
      const ast = createMockAst({
        state: { error: 'string | null', hasError: 'boolean' },
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain('Handles and displays error states');
    });

    it('should detect multiple patterns', () => {
      const ast = createMockAst({
        hooks: ['useEffect', 'useMemo', 'useContext'],
        state: { loading: 'boolean', error: 'string | null' },
      });

      const predictions = generateBehavioralPredictions(ast);

      expect(predictions).toContain('Has side effects managed by useEffect');
      expect(predictions).toContain(
        'Uses memoization for performance optimization',
      );
      expect(predictions).toContain('Consumes React Context for shared state');
      expect(predictions).toContain('Manages loading/pending UI states');
      expect(predictions).toContain('Handles and displays error states');
    });
  });

  describe('inferDescription', () => {
    describe('kind-based descriptions', () => {
      it('should describe CLI entry point', () => {
        const ast = createMockAst({ kind: 'node:cli' });

        const description = inferDescription('src/cli/stamp.ts', ast);

        expect(description).toBe('stamp - CLI entry point');
      });

      it('should describe utility module', () => {
        const ast = createMockAst({ kind: 'ts:module' });

        const description = inferDescription('src/utils/helpers.ts', ast);

        expect(description).toBe('helpers - Utility module');
      });

      it('should describe config module', () => {
        const ast = createMockAst({ kind: 'ts:module' });

        const description = inferDescription('src/config.ts', ast);

        expect(description).toBe('config - Configuration module');
      });

      it('should describe type definitions', () => {
        const ast = createMockAst({ kind: 'ts:module' });

        // The function checks fileName, not path - so needs 'type' in filename
        const description = inferDescription('src/types/types.ts', ast);

        expect(description).toBe('types - Type definitions');
      });

      it('should describe interface definitions', () => {
        const ast = createMockAst({ kind: 'ts:module' });

        const description = inferDescription('src/interfaces.ts', ast);

        expect(description).toBe('interfaces - Type definitions');
      });

      it('should describe generic TypeScript module', () => {
        const ast = createMockAst({ kind: 'ts:module' });

        const description = inferDescription('src/core/pack.ts', ast);

        expect(description).toBe('pack - TypeScript module');
      });

      it('should describe custom React hook', () => {
        const ast = createMockAst({ kind: 'react:hook' });

        const description = inferDescription('src/hooks/useAuth.ts', ast);

        expect(description).toBe('useAuth - Custom React hook');
      });
    });

    describe('filename-based descriptions for React components', () => {
      it('should describe button component', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription('src/components/Button.tsx', ast);

        expect(description).toBe('Button - Interactive button component');
      });

      it('should describe form component', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription(
          'src/components/LoginForm.tsx',
          ast,
        );

        expect(description).toBe('LoginForm - Form component with validation');
      });

      it('should describe modal component', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription('src/components/Modal.tsx', ast);

        expect(description).toBe('Modal - Modal/dialog component');
      });

      it('should describe dialog component', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription(
          'src/components/ConfirmDialog.tsx',
          ast,
        );

        expect(description).toBe('ConfirmDialog - Modal/dialog component');
      });

      it('should describe input component', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription(
          'src/components/TextInput.tsx',
          ast,
        );

        expect(description).toBe('TextInput - Form input field');
      });

      it('should describe field component', () => {
        const ast = createMockAst({ kind: 'react:component' });

        // Note: 'FormField' contains 'form' so it matches form pattern first
        // Use a filename without 'form' to test field pattern
        const description = inferDescription(
          'src/components/TextField.tsx',
          ast,
        );

        expect(description).toBe('TextField - Form input field');
      });

      it('should describe card component', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription(
          'src/components/UserCard.tsx',
          ast,
        );

        expect(description).toBe('UserCard - Card display component');
      });

      it('should describe nav component', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription('src/components/NavBar.tsx', ast);

        expect(description).toBe('NavBar - Navigation component');
      });

      it('should describe menu component', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription(
          'src/components/DropdownMenu.tsx',
          ast,
        );

        expect(description).toBe('DropdownMenu - Navigation component');
      });
    });

    describe('state/emits-based descriptions', () => {
      it('should describe interactive component with state', () => {
        const ast = createMockAst({
          kind: 'react:component',
          state: { count: 'number' },
          emits: { onClick: 'function' },
        });

        const description = inferDescription('src/components/Counter.tsx', ast);

        expect(description).toBe(
          'Counter - Interactive component with internal state',
        );
      });

      it('should describe stateful component', () => {
        const ast = createMockAst({
          kind: 'react:component',
          state: { isOpen: 'boolean' },
          emits: {},
        });

        const description = inferDescription(
          'src/components/Accordion.tsx',
          ast,
        );

        expect(description).toBe('Accordion - Stateful component');
      });

      it('should describe interactive component without state', () => {
        const ast = createMockAst({
          kind: 'react:component',
          state: {},
          emits: { onClick: 'function' },
        });

        const description = inferDescription('src/components/Link.tsx', ast);

        expect(description).toBe('Link - Interactive component');
      });

      it('should describe presentational component', () => {
        const ast = createMockAst({
          kind: 'react:component',
          state: {},
          emits: {},
        });

        const description = inferDescription('src/components/Avatar.tsx', ast);

        expect(description).toBe('Avatar - Presentational component');
      });
    });

    describe('path handling', () => {
      it('should handle forward slashes', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription('src/components/Button.tsx', ast);

        expect(description).toContain('Button');
      });

      it('should handle backslashes (Windows)', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription(
          'src\\components\\Button.tsx',
          ast,
        );

        expect(description).toContain('Button');
      });

      it('should handle .ts extension', () => {
        const ast = createMockAst({ kind: 'ts:module' });

        const description = inferDescription('src/utils/helpers.ts', ast);

        expect(description).toBe('helpers - Utility module');
      });

      it('should handle .tsx extension', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription('src/components/Button.tsx', ast);

        expect(description).toContain('Button');
      });

      it('should handle .jsx extension', () => {
        const ast = createMockAst({ kind: 'react:component' });

        const description = inferDescription('src/components/Button.jsx', ast);

        expect(description).toContain('Button');
      });

      it('should handle .js extension', () => {
        const ast = createMockAst({ kind: 'ts:module' });

        const description = inferDescription('src/utils/helpers.js', ast);

        expect(description).toBe('helpers - Utility module');
      });
    });
  });
});
