/**
 * Token estimation utilities for GPT and Claude models
 * Uses character-based approximations by default
 *
 * Optional tokenizers (package.json optionalDependencies; npm tries to install them):
 * - @dqbd/tiktoken — GPT-4o encoding; counts align with that tiktoken model when load succeeds.
 * - @anthropic-ai/tokenizer — Anthropic documents this as intended for older models; for Claude 3+
 *   it is only a rough approximation vs API tokenization. Prefer `usage` in API responses for billing.
 * If installation fails or is skipped, falls back to character-based estimation (~4 chars/token GPT,
 * ~4.5 Claude).
 */

/** Mutable tokenizer state lives on this class instead of module-level lets. */
export class TokenizerRuntime {
  private tiktokenEncoder: unknown = null;
  private anthropicTokenizer: { countTokens?: (text: string) => number } | null = null;
  private tiktokenLoaded = false;
  private anthropicLoaded = false;

  /**
   * Free tokenizer memory. Tokenizers reload on next use (expensive).
   * Use in long-running processes when you need to minimize memory.
   */
  clear(): void {
    const enc = this.tiktokenEncoder as { free?: () => void } | null;
    if (enc && typeof enc.free === 'function') {
      try {
        enc.free();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.tiktokenEncoder = null;
    this.anthropicTokenizer = null;
    this.tiktokenLoaded = false;
    this.anthropicLoaded = false;
  }

  private async loadTiktoken(): Promise<boolean> {
    if (this.tiktokenLoaded) {
      return this.tiktokenEncoder !== null;
    }
    this.tiktokenLoaded = true;

    try {
      const tiktoken = await import('@dqbd/tiktoken');
      if (typeof tiktoken.encoding_for_model === 'function') {
        this.tiktokenEncoder = tiktoken.encoding_for_model('gpt-4o');
        return true;
      }
      if (typeof tiktoken.get_encoding === 'function') {
        this.tiktokenEncoder = tiktoken.get_encoding('cl100k_base');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async loadAnthropicTokenizer(): Promise<boolean> {
    if (this.anthropicLoaded) {
      return this.anthropicTokenizer !== null;
    }
    this.anthropicLoaded = true;

    try {
      const tokenizer = await import('@anthropic-ai/tokenizer');
      if (typeof tokenizer.countTokens === 'function') {
        this.anthropicTokenizer = tokenizer;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async estimateGPT4Tokens(text: string): Promise<number> {
    const hasTiktoken = await this.loadTiktoken();
    const encoder = this.tiktokenEncoder as { encode?: (s: string) => unknown[] } | null;

    if (hasTiktoken && encoder && typeof encoder.encode === 'function') {
      try {
        return encoder.encode(text).length;
      } catch {
        // Fall through to character-based estimation
      }
    }

    return Math.ceil(text.length / 4);
  }

  async estimateClaudeTokens(text: string): Promise<number> {
    const hasTokenizer = await this.loadAnthropicTokenizer();

    if (hasTokenizer && this.anthropicTokenizer?.countTokens) {
      try {
        return this.anthropicTokenizer.countTokens(text);
      } catch {
        // Fall through to character-based estimation
      }
    }

    return Math.ceil(text.length / 4.5);
  }

  async getTokenizerStatus(): Promise<{ gpt4: boolean; claude: boolean }> {
    const gpt4 = await this.loadTiktoken();
    const claude = await this.loadAnthropicTokenizer();
    return { gpt4, claude };
  }
}

const defaultTokenizerRuntime = new TokenizerRuntime();

/** @internal For tests or alternate lifetimes; CLI uses {@link defaultTokenizerRuntime}. */
export function createTokenizerRuntime(): TokenizerRuntime {
  return new TokenizerRuntime();
}

export function clearTokenizerCache(): void {
  defaultTokenizerRuntime.clear();
}

export async function estimateGPT4Tokens(text: string): Promise<number> {
  return defaultTokenizerRuntime.estimateGPT4Tokens(text);
}

export async function estimateClaudeTokens(text: string): Promise<number> {
  return defaultTokenizerRuntime.estimateClaudeTokens(text);
}

export function formatTokenCount(count: number): string {
  return count.toLocaleString();
}

export async function getTokenizerStatus(): Promise<{ gpt4: boolean; claude: boolean }> {
  return defaultTokenizerRuntime.getTokenizerStatus();
}
