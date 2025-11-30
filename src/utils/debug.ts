/**
 * Debug logging utilities
 * Only logs when LOGICSTAMP_DEBUG=1 is set
 */

/**
 * Debug logging helper for module errors
 * @param moduleName - Name of the module (e.g., 'fsx', 'astParser')
 * @param functionName - Name of the function that encountered the error
 * @param context - Additional context to log (file paths, error details, etc.)
 */
export function debugError(
  moduleName: string,
  functionName: string,
  context: Record<string, unknown>
): void {
  if (process.env.LOGICSTAMP_DEBUG === '1') {
    console.error(`[LogicStamp][DEBUG] ${moduleName}.${functionName} error:`, context);
  }
}

