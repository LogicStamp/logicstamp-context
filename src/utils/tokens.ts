/**
 * Token estimation utilities for GPT and Claude models
 * Uses character-based approximations
 *
 * For production use, consider installing:
 * - @dqbd/tiktoken for GPT models
 * - @anthropic-ai/tokenizer for Claude
 */

/**
 * Estimate GPT-4 tokens using character-based approximation
 * GPT-4 typically uses ~4 characters per token for code/JSON
 */
export function estimateGPT4Tokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate Claude tokens using character-based approximation
 * Claude typically uses ~4.5 characters per token for code/JSON
 */
export function estimateClaudeTokens(text: string): number {
  return Math.ceil(text.length / 4.5);
}

/**
 * Format token count with commas for readability
 */
export function formatTokenCount(count: number): string {
  return count.toLocaleString();
}
