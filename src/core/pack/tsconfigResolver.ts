/**
 * Tsconfig resolver helpers for dependency resolution.
 *
 * Resolves compilerOptions.baseUrl / compilerOptions.paths (including extends chains)
 * into normalized project-relative path candidates that can be matched against manifest keys.
 */

import { access, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { glob } from 'glob';
import { normalizeEntryId } from '../../utils/fsx.js';

interface TsconfigCompilerOptions {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}

interface TsconfigShape {
  extends?: string;
  compilerOptions?: TsconfigCompilerOptions;
}

interface ResolvedBaseUrl {
  value: string;
  fromDir: string;
}

interface LoadedTsconfig {
  baseUrl?: ResolvedBaseUrl;
  paths: Record<string, string[]>;
}

export interface TsconfigPathMapping {
  pattern: string;
  hasWildcard: boolean;
  prefix: string;
  suffix: string;
  targets: string[];
  baseUrlAbs: string;
  sourceTsconfig: string;
}

export interface TsconfigResolverContext {
  projectRoot: string;
  configs: TsconfigConfig[];
  pathMappings: TsconfigPathMapping[];
  baseUrlsAbs: string[];
  tsconfigFiles: string[];
}

export interface TsconfigConfig {
  tsconfigPath: string;
  configDirAbs: string;
  baseUrlAbs: string;
  pathMappings: TsconfigPathMapping[];
}

function stripJsonCommentsAndTrailingCommas(input: string): string {
  let out = '';
  let inString = false;
  let stringQuote = '"';
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      out += ch;
      continue;
    }

    // Line comment
    if (ch === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') {
        i++;
      }
      if (i < input.length) {
        out += '\n';
      }
      continue;
    }

    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < input.length) {
        if (input[i] === '*' && input[i + 1] === '/') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    out += ch;
  }

  // Remove trailing commas outside strings.
  let cleaned = '';
  inString = false;
  escaped = false;
  stringQuote = '"';
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (inString) {
      cleaned += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      cleaned += ch;
      continue;
    }

    if (ch === ',') {
      let j = i + 1;
      while (j < out.length && /\s/.test(out[j])) {
        j++;
      }
      if (out[j] === '}' || out[j] === ']') {
        continue;
      }
    }

    cleaned += ch;
  }

  return cleaned;
}

function parseTsconfig(content: string): TsconfigShape | null {
  try {
    return JSON.parse(content) as TsconfigShape;
  } catch {
    try {
      const stripped = stripJsonCommentsAndTrailingCommas(content);
      return JSON.parse(stripped) as TsconfigShape;
    } catch {
      return null;
    }
  }
}

function toRelativeInsideRoot(
  absolutePath: string,
  projectRoot: string,
): string | null {
  const rel = normalizeEntryId(relative(projectRoot, absolutePath));
  if (rel.startsWith('../') || rel === '..') {
    return null;
  }
  return rel;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveExtendsPath(
  ext: string,
  fromDir: string,
): Promise<string | null> {
  const isLocalPath =
    isAbsolute(ext) || ext.startsWith('./') || ext.startsWith('../');

  if (isLocalPath) {
    const candidateBase = isAbsolute(ext) ? ext : resolve(fromDir, ext);
    const candidates = [candidateBase];
    if (!candidateBase.endsWith('.json')) {
      candidates.push(`${candidateBase}.json`);
    }
    candidates.push(resolve(candidateBase, 'tsconfig.json'));

    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  // Support package-based presets such as "@tsconfig/node20/tsconfig.json".
  const requireFromConfig = createRequire(
    resolve(fromDir, '__logicstamp_tsconfig_resolver__.js'),
  );
  const candidates = [ext];
  if (!ext.endsWith('.json')) {
    candidates.push(`${ext}.json`);
  }
  candidates.push(`${ext}/tsconfig.json`);

  for (const candidate of candidates) {
    try {
      return requireFromConfig.resolve(candidate);
    } catch {
      // Try the next package candidate.
    }
  }

  return null;
}

async function loadTsconfigWithExtends(
  tsconfigPath: string,
  visited: Set<string>,
): Promise<LoadedTsconfig | null> {
  const normalizedPath = normalizeEntryId(tsconfigPath);
  if (visited.has(normalizedPath)) {
    return null;
  }
  visited.add(normalizedPath);

  let content: string;
  try {
    content = await readFile(tsconfigPath, 'utf8');
  } catch {
    return null;
  }

  const parsed = parseTsconfig(content);
  if (!parsed) {
    return null;
  }

  let inherited: LoadedTsconfig = { paths: {} };
  if (parsed.extends) {
    const parentPath = await resolveExtendsPath(
      parsed.extends,
      dirname(tsconfigPath),
    );
    if (parentPath) {
      const loadedParent = await loadTsconfigWithExtends(parentPath, visited);
      if (loadedParent) {
        inherited = loadedParent;
      }
    }
  }

  const localCompilerOptions = parsed.compilerOptions ?? {};
  const localBaseUrl =
    localCompilerOptions.baseUrl !== undefined
      ? {
          value: localCompilerOptions.baseUrl,
          fromDir: dirname(tsconfigPath),
        }
      : inherited.baseUrl;

  return {
    baseUrl: localBaseUrl,
    paths: {
      ...inherited.paths,
      ...(localCompilerOptions.paths ?? {}),
    },
  };
}

function normalizePathMapping(
  pattern: string,
  targets: string[],
  baseUrlAbs: string,
  sourceTsconfig: string,
): TsconfigPathMapping {
  const hasWildcard = pattern.includes('*');
  const wildcardIndex = pattern.indexOf('*');
  const prefix = hasWildcard ? pattern.slice(0, wildcardIndex) : pattern;
  const suffix = hasWildcard ? pattern.slice(wildcardIndex + 1) : '';
  return {
    pattern,
    hasWildcard,
    prefix,
    suffix,
    targets,
    baseUrlAbs,
    sourceTsconfig,
  };
}

export async function buildTsconfigResolverContext(
  projectRoot: string,
): Promise<TsconfigResolverContext | null> {
  const tsconfigFiles = await glob('**/tsconfig*.json', {
    cwd: projectRoot,
    absolute: true,
    nodir: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
    ],
  });

  if (tsconfigFiles.length === 0) {
    return null;
  }

  const normalizedProjectRoot = normalizeEntryId(projectRoot);
  const sortedTsconfigFiles = [...tsconfigFiles].sort((a, b) =>
    normalizeEntryId(relative(projectRoot, a)).localeCompare(
      normalizeEntryId(relative(projectRoot, b)),
    ),
  );
  const pathMappings: TsconfigPathMapping[] = [];
  const baseUrlSet = new Set<string>();
  const loadedFiles: string[] = [];
  const configs: TsconfigConfig[] = [];

  for (const absTsconfigPath of sortedTsconfigFiles) {
    const loaded = await loadTsconfigWithExtends(absTsconfigPath, new Set());
    if (!loaded) {
      continue;
    }

    loadedFiles.push(normalizeEntryId(relative(projectRoot, absTsconfigPath)));
    const configDirAbs = normalizeEntryId(dirname(absTsconfigPath));
    const baseUrlAbs = normalizeEntryId(
      resolve(
        loaded.baseUrl?.fromDir ?? dirname(absTsconfigPath),
        loaded.baseUrl?.value ?? '.',
      ),
    );
    baseUrlSet.add(baseUrlAbs);

    const configPathMappings: TsconfigPathMapping[] = [];

    for (const [pattern, targets] of Object.entries(loaded.paths)) {
      if (!Array.isArray(targets) || targets.length === 0) {
        continue;
      }
      const mapping = normalizePathMapping(
        pattern,
        targets,
        baseUrlAbs,
        normalizeEntryId(absTsconfigPath),
      );
      pathMappings.push(mapping);
      configPathMappings.push(mapping);
    }

    configs.push({
      tsconfigPath: normalizeEntryId(relative(projectRoot, absTsconfigPath)),
      configDirAbs,
      baseUrlAbs,
      pathMappings: configPathMappings,
    });
  }

  if (
    configs.length === 0 &&
    pathMappings.length === 0 &&
    baseUrlSet.size === 0
  ) {
    return null;
  }

  return {
    projectRoot: normalizedProjectRoot,
    configs,
    pathMappings,
    baseUrlsAbs: Array.from(baseUrlSet),
    tsconfigFiles: loadedFiles.sort(),
  };
}

function applyPathMapping(
  mapping: TsconfigPathMapping,
  specifier: string,
): string[] {
  if (mapping.hasWildcard) {
    if (
      !specifier.startsWith(mapping.prefix) ||
      !specifier.endsWith(mapping.suffix)
    ) {
      return [];
    }
    const wildcardValue = specifier.slice(
      mapping.prefix.length,
      specifier.length - mapping.suffix.length,
    );
    return mapping.targets.map((target) => target.replace('*', wildcardValue));
  }

  if (specifier !== mapping.pattern) {
    return [];
  }

  return [...mapping.targets];
}

function expandFileCandidates(basePath: string): string[] {
  const normalizedBase = normalizeEntryId(basePath);
  const withExtensions = [
    normalizedBase,
    `${normalizedBase}.tsx`,
    `${normalizedBase}.ts`,
    `${normalizedBase}.jsx`,
    `${normalizedBase}.js`,
    `${normalizedBase}/index.tsx`,
    `${normalizedBase}/index.ts`,
    `${normalizedBase}/index.jsx`,
    `${normalizedBase}/index.js`,
  ];
  return [...new Set(withExtensions)];
}

function isPackageLikeImport(specifier: string): boolean {
  return (
    !specifier.startsWith('./') &&
    !specifier.startsWith('../') &&
    !specifier.startsWith('/') &&
    !specifier.startsWith('node:')
  );
}

function isSamePathOrDescendant(path: string, parentPath: string): boolean {
  return path === parentPath || path.startsWith(`${parentPath}/`);
}

function tsconfigFilePriority(tsconfigPath: string): number {
  const fileName = basename(tsconfigPath).toLowerCase();
  if (fileName === 'tsconfig.json') {
    return 0;
  }
  if (fileName.startsWith('tsconfig.')) {
    return 1;
  }
  return 2;
}

function selectConfigForImporter(
  parentId: string | undefined,
  context: TsconfigResolverContext,
): TsconfigConfig | null {
  if (!parentId || context.configs.length === 0) {
    return null;
  }

  const importerAbs = normalizeEntryId(
    isAbsolute(parentId) ? parentId : resolve(context.projectRoot, parentId),
  );
  const importerDirAbs = normalizeEntryId(dirname(importerAbs));

  const matchingConfigs = context.configs.filter((config) =>
    isSamePathOrDescendant(importerDirAbs, config.configDirAbs),
  );

  if (matchingConfigs.length === 0) {
    return null;
  }

  return [...matchingConfigs].sort((a, b) => {
    const depthDiff =
      b.configDirAbs.split('/').length - a.configDirAbs.split('/').length;
    if (depthDiff !== 0) {
      return depthDiff;
    }

    const priorityDiff =
      tsconfigFilePriority(a.tsconfigPath) -
      tsconfigFilePriority(b.tsconfigPath);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.tsconfigPath.localeCompare(b.tsconfigPath);
  })[0];
}

export function resolveTsconfigCandidates(
  specifier: string,
  parentId?: string,
  context?: TsconfigResolverContext | null,
): string[] {
  if (!context) {
    return [];
  }

  const candidates = new Set<string>();
  const scopedConfig = selectConfigForImporter(parentId, context);
  const mappings =
    scopedConfig != null
      ? scopedConfig.pathMappings
      : context.configs.length === 0
        ? context.pathMappings
        : [];
  const baseUrls =
    scopedConfig != null
      ? [scopedConfig.baseUrlAbs]
      : context.configs.length === 0
        ? context.baseUrlsAbs
        : [];

  for (const mapping of mappings) {
    const appliedTargets = applyPathMapping(mapping, specifier);
    for (const target of appliedTargets) {
      const absoluteTarget = resolve(mapping.baseUrlAbs, target);
      const rel = toRelativeInsideRoot(absoluteTarget, context.projectRoot);
      if (!rel) continue;
      for (const candidate of expandFileCandidates(rel)) {
        candidates.add(candidate);
      }
    }
  }

  if (candidates.size === 0 && isPackageLikeImport(specifier)) {
    for (const baseUrlAbs of baseUrls) {
      const absoluteTarget = resolve(baseUrlAbs, specifier);
      const rel = toRelativeInsideRoot(absoluteTarget, context.projectRoot);
      if (!rel) continue;
      for (const candidate of expandFileCandidates(rel)) {
        candidates.add(candidate);
      }
    }
  }

  return Array.from(candidates);
}
