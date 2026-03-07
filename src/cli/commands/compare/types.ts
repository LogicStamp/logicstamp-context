/**
 * Compare command types and interfaces
 */

export interface LiteSig {
  semanticHash: string;
  imports: string[];
  hooks: string[];
  exportKind: 'default' | 'named' | 'none';
  functions: string[];
  components: string[];
  props: string[];
  emits: string[];
  variables: string[];
  state: Record<string, any>;
}

export interface CompareResult {
  status: 'PASS' | 'DRIFT';
  added: string[];
  removed: string[];
  changed: Array<{
    id: string;
    deltas: Array<{
      type: 'hash' | 'imports' | 'hooks' | 'exports' | 'functions' | 'components' | 'props' | 'emits' | 'variables' | 'state';
      old: any;
      new: any;
    }>;
  }>;
}

/**
 * Result for a single folder's context file comparison
 */
export interface FolderCompareResult {
  folderPath: string;
  contextFile: string;
  status: 'PASS' | 'DRIFT' | 'ADDED' | 'ORPHANED';
  componentResult?: CompareResult; // undefined for ADDED/ORPHANED
  tokenDelta?: { gpt4: number; claude: number };
}

/**
 * Result for multi-file comparison (compares all context files)
 */
export interface MultiFileCompareResult {
  status: 'PASS' | 'DRIFT';
  folders: FolderCompareResult[];
  summary: {
    totalFolders: number;
    addedFolders: number;
    orphanedFolders: number;
    driftFolders: number;
    passFolders: number;
    totalComponentsAdded: number;
    totalComponentsRemoved: number;
    totalComponentsChanged: number;
  };
  orphanedFiles?: string[]; // Files on disk but not in new index
}

export interface CompareOptions {
  oldFile: string;
  newFile: string;
  stats?: boolean;
  approve?: boolean;
  quiet?: boolean;
  gitBaseline?: boolean; // Enable tolerance for git baseline comparisons (normalizes paths)
}

export interface MultiFileCompareOptions {
  oldIndexFile: string;  // Path to old context_main.json
  newIndexFile: string;  // Path to new context_main.json
  stats?: boolean;
  approve?: boolean;
  autoCleanOrphaned?: boolean; // Auto-delete orphaned files with --approve
  quiet?: boolean;
  gitBaseline?: boolean; // Enable tolerance for git baseline comparisons (normalizes paths)
}
