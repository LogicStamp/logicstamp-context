/**
 * Token estimation utilities for GPT and Claude models
 * Uses character-based approximations by default
 *
 * For accurate token counts, optionally install:
 * - @dqbd/tiktoken for GPT models (gpt-4o encoding)
 * - @anthropic-ai/tokenizer for Claude (claude-3-5-sonnet-20241022 encoding)
 */

// Lazy-loaded tokenizers (only loaded if available)
let tiktokenEncoder: any = null;
let anthropicTokenizer: any = null;
let tiktokenLoaded = false;
let anthropicLoaded = false;

/**
 * Try to load tiktoken encoder (lazy, only once)
 */
async function loadTiktoken(): Promise<boolean> {
  if (tiktokenLoaded) {
    return tiktokenEncoder !== null;
  }
  tiktokenLoaded = true;
  
  try {
    const tiktoken = await import('@dqbd/tiktoken');
    // Try encoding_for_model first (preferred API)
    if (typeof tiktoken.encoding_for_model === 'function') {
      tiktokenEncoder = tiktoken.encoding_for_model('gpt-4o');
      return true;
    }
    // Fallback to get_encoding if available
    if (typeof tiktoken.get_encoding === 'function') {
      tiktokenEncoder = tiktoken.get_encoding('cl100k_base');
      return true;
    }
    // If neither method exists, tokenizer not usable
    return false;
  } catch (error) {
    // tiktoken not installed - use fallback
    return false;
  }
}

/**
 * Try to load Anthropic tokenizer (lazy, only once)
 */
async function loadAnthropicTokenizer(): Promise<boolean> {
  if (anthropicLoaded) {
    return anthropicTokenizer !== null;
  }
  anthropicLoaded = true;
  
  try {
    const tokenizer = await import('@anthropic-ai/tokenizer');
    // Check if it's a default export or named export
    const tokenizerModule = tokenizer.default || tokenizer;

    // Try to get tokenizer for claude-3-5-sonnet-20241022 (latest stable)
    if (typeof tokenizerModule === 'function') {
      anthropicTokenizer = tokenizerModule;
      return true;
    }
    // Check for countTokens method directly
    if (typeof tokenizerModule.countTokens === 'function') {
      anthropicTokenizer = tokenizerModule;
      return true;
    }
    // If no usable methods, tokenizer not usable
    return false;
  } catch (error) {
    // tokenizer not installed - use fallback
    return false;
  }
}

/**
 * Estimate GPT-4 tokens
 * Uses @dqbd/tiktoken if available, otherwise falls back to character-based approximation
 */
export async function estimateGPT4Tokens(text: string): Promise<number> {
  const hasTiktoken = await loadTiktoken();
  
  if (hasTiktoken && tiktokenEncoder) {
    try {
      return tiktokenEncoder.encode(text).length;
    } catch (error) {
      // Fall through to character-based estimation
    }
  }
  
  // Fallback: character-based approximation
  // GPT-4 typically uses ~4 characters per token for code/JSON
  return Math.ceil(text.length / 4);
}

/**
 * Estimate Claude tokens
 * Uses @anthropic-ai/tokenizer if available, otherwise falls back to character-based approximation
 */
export async function estimateClaudeTokens(text: string): Promise<number> {
  const hasTokenizer = await loadAnthropicTokenizer();
  
  if (hasTokenizer && anthropicTokenizer) {
    try {
      // Try countTokens method first (most common API)
      if (typeof anthropicTokenizer.countTokens === 'function') {
        return anthropicTokenizer.countTokens(text);
      }
      // Try as a function that takes text and returns count
      if (typeof anthropicTokenizer === 'function') {
        const result = anthropicTokenizer(text);
        return typeof result === 'number' ? result : 0;
      }
    } catch (error) {
      // Fall through to character-based estimation
    }
  }
  
  // Fallback: character-based approximation
  // Claude typically uses ~4.5 characters per token for code/JSON
  return Math.ceil(text.length / 4.5);
}

/**
 * Format token count with commas for readability
 */
export function formatTokenCount(count: number): string {
  return count.toLocaleString();
}

/**
 * Check if tokenizers are available
 * Returns status for both GPT-4 and Claude tokenizers
 */
export async function getTokenizerStatus(): Promise<{ gpt4: boolean; claude: boolean }> {
  const gpt4 = await loadTiktoken();
  const claude = await loadAnthropicTokenizer();
  return { gpt4, claude };
}
