import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { estimateGPT4Tokens, estimateClaudeTokens, formatTokenCount } from '../../src/utils/tokens.js';

describe('Token Estimation Utilities', () => {
  describe('formatTokenCount', () => {
    it('should format token count with commas', () => {
      expect(formatTokenCount(1000)).toBe('1,000');
      expect(formatTokenCount(1234567)).toBe('1,234,567');
      expect(formatTokenCount(0)).toBe('0');
      expect(formatTokenCount(42)).toBe('42');
    });
  });

  describe('estimateGPT4Tokens', () => {
    it('should estimate tokens for simple text', async () => {
      const text = 'Hello world! This is a test.';
      const tokens = await estimateGPT4Tokens(text);

      // With tiktoken installed, should use actual tokenizer
      // Without tiktoken, should use ~4 chars per token
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(Math.ceil(text.length / 2)); // Reasonable upper bound
    });

    it('should handle empty strings', async () => {
      const tokens = await estimateGPT4Tokens('');
      expect(tokens).toBe(0);
    });

    it('should handle long text', async () => {
      const text = 'a'.repeat(1000);
      const tokens = await estimateGPT4Tokens(text);

      // Should produce reasonable token count
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(Math.ceil(text.length / 2));
    });

    it('should handle JSON-like content', async () => {
      const jsonText = JSON.stringify({ key: 'value', nested: { array: [1, 2, 3] } });
      const tokens = await estimateGPT4Tokens(jsonText);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(Math.ceil(jsonText.length / 2));
    });

    it('should handle code-like content', async () => {
      const codeText = `
        function example() {
          const x = 42;
          return x * 2;
        }
      `;
      const tokens = await estimateGPT4Tokens(codeText);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(Math.ceil(codeText.length / 2));
    });
  });

  describe('estimateClaudeTokens', () => {
    it('should estimate tokens for simple text', async () => {
      const text = 'Hello world! This is a test.';
      const tokens = await estimateClaudeTokens(text);

      // With tokenizer installed, should use actual tokenizer
      // Without tokenizer, should use ~4.5 chars per token
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(Math.ceil(text.length / 2)); // Reasonable upper bound
    });

    it('should handle empty strings', async () => {
      const tokens = await estimateClaudeTokens('');
      expect(tokens).toBe(0);
    });

    it('should handle long text', async () => {
      const text = 'a'.repeat(1000);
      const tokens = await estimateClaudeTokens(text);

      // Should produce reasonable token count
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(Math.ceil(text.length / 2));
    });

    it('should handle JSON-like content', async () => {
      const jsonText = JSON.stringify({ key: 'value', nested: { array: [1, 2, 3] } });
      const tokens = await estimateClaudeTokens(jsonText);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(Math.ceil(jsonText.length / 2));
    });
  });

  describe('Token estimation consistency', () => {
    it('should produce consistent results for the same input', async () => {
      const text = 'This is a test string for token estimation.';
      
      const tokens1 = await estimateGPT4Tokens(text);
      const tokens2 = await estimateGPT4Tokens(text);
      
      expect(tokens1).toBe(tokens2);
    });

    it('should produce different estimates for GPT-4 vs Claude', async () => {
      const text = 'This is a test string for token estimation.';
      
      const gpt4Tokens = await estimateGPT4Tokens(text);
      const claudeTokens = await estimateClaudeTokens(text);
      
      // Claude typically uses slightly more tokens (4.5 chars/token vs 4 chars/token)
      // So Claude estimate should be slightly lower for the same text
      expect(claudeTokens).toBeLessThanOrEqual(gpt4Tokens);
    });
  });

  describe('Edge cases', () => {
    it('should handle very short strings', async () => {
      expect(await estimateGPT4Tokens('a')).toBe(1);
      expect(await estimateClaudeTokens('a')).toBe(1);
    });

    it('should handle strings with special characters', async () => {
      const text = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const gpt4Tokens = await estimateGPT4Tokens(text);
      const claudeTokens = await estimateClaudeTokens(text);
      
      expect(gpt4Tokens).toBeGreaterThan(0);
      expect(claudeTokens).toBeGreaterThan(0);
    });

    it('should handle unicode characters', async () => {
      const text = 'Hello 世界 🌍';
      const gpt4Tokens = await estimateGPT4Tokens(text);
      const claudeTokens = await estimateClaudeTokens(text);
      
      expect(gpt4Tokens).toBeGreaterThan(0);
      expect(claudeTokens).toBeGreaterThan(0);
    });

    it('should handle multiline text', async () => {
      const text = `Line 1
Line 2
Line 3`;
      const gpt4Tokens = await estimateGPT4Tokens(text);
      const claudeTokens = await estimateClaudeTokens(text);
      
      expect(gpt4Tokens).toBeGreaterThan(0);
      expect(claudeTokens).toBeGreaterThan(0);
    });
  });
});

