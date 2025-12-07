/**
 * Security scan command - Scans for secrets and generates report
 */

import { resolve, dirname, join, relative } from 'node:path';
import { readFile, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { globFiles, readFileWithText, getRelativePath } from '../../utils/fsx.js';
import { scanFileForSecrets, filterFalsePositives, type SecretMatch } from '../../utils/secretDetector.js';
import { STAMPIGNORE_FILENAME } from '../../utils/stampignore.js';
import { ensureGitignorePatterns, ensurePatternInGitignore } from '../../utils/gitignore.js';
import { debugError } from '../../utils/debug.js';
import { displayPath } from './context/fileWriter.js';

export interface SecurityScanOptions {
  entry?: string;
  out?: string;
  quiet?: boolean;
  /** If true, return result instead of calling process.exit */
  noExit?: boolean;
}

export interface SecurityReport {
  type: 'LogicStampSecurityReport';
  schemaVersion: '0.1';
  createdAt: string;
  projectRoot: string;
  filesScanned: number;
  secretsFound: number;
  matches: SecretMatch[];
  filesWithSecrets: string[];
}

/**
 * Security scan command
 */
/**
 * Prompt user for yes/no confirmation
 */
async function promptYesNo(question: string): Promise<boolean> {
  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export interface SecurityHardResetOptions {
  entry?: string;
  out?: string;
  force?: boolean;
  quiet?: boolean;
}

/**
 * Hard reset command - deletes security report file
 */
export async function securityHardResetCommand(options: SecurityHardResetOptions): Promise<void> {
  const projectRoot = resolve(options.entry || '.');
  const outputPath = options.out || 'stamp_security_report.json';
  const outputFile = outputPath.endsWith('.json') ? outputPath : join(outputPath, 'stamp_security_report.json');
  const reportPath = outputFile;
  
  let shouldReset = options.force;
  
  if (!shouldReset) {
    // Prompt for confirmation
    shouldReset = await promptYesNo(
      `⚠️  This will delete ${displayPath(reportPath)}. Continue?`
    );
  }
  
  if (shouldReset) {
    // Delete report file
    let reportDeleted = false;
    try {
      await unlink(reportPath);
      reportDeleted = true;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        // Only error if file exists but couldn't be deleted
        throw new Error(`Failed to delete report file: ${err.message}`);
      }
    }
    
    if (!options.quiet) {
      if (reportDeleted) {
        console.log(`\n✅ Reset complete:`);
        console.log(`   Deleted ${displayPath(reportPath)}`);
      } else {
        console.log(`\nℹ️  No report file to reset (file doesn't exist)`);
      }
    }
  } else {
    if (!options.quiet) {
      console.log(`\n❌ Reset cancelled`);
    }
    process.exit(0);
  }
}

export interface SecurityScanResult {
  secretsFound: boolean;
  report: SecurityReport;
}

export async function securityScanCommand(options: SecurityScanOptions): Promise<void | SecurityScanResult> {
  const projectRoot = resolve(options.entry || '.');
  const outputPath = options.out || 'stamp_security_report.json';
  const outputDir = outputPath.endsWith('.json') ? dirname(outputPath) : outputPath;
  const outputFile = outputPath.endsWith('.json') ? outputPath : join(outputPath, 'stamp_security_report.json');

  if (!options.quiet) {
    console.log(`🔒 Scanning for secrets in ${displayPath(projectRoot)}...`);
  }

  // Resolve output file relative to project root if it's a relative path
  const resolvedOutputFile = outputFile.startsWith('/') || outputFile.match(/^[A-Z]:/) 
    ? outputFile 
    : join(projectRoot, outputFile);

  // Find all files to scan (TypeScript, JavaScript, and JSON files)
  let files = await globFiles(projectRoot, '.ts,.tsx,.js,.jsx,.json');

  // Exclude the report file and .stampignore from scanning (they may contain secrets)
  // Use absolute path comparison to be safe
  const reportFileAbs = resolve(resolvedOutputFile);
  const stampignoreFileAbs = join(projectRoot, STAMPIGNORE_FILENAME);
  
  files = files.filter(file => {
    const fileAbs = resolve(file);
    return fileAbs !== reportFileAbs && fileAbs !== stampignoreFileAbs;
  });

  if (files.length === 0) {
    if (!options.quiet) {
      console.log('   No files found to scan');
    }
    
    // Still create an empty report if noExit is true (called from init)
    if (options.noExit) {
      const emptyReport: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot,
        filesScanned: 0,
        secretsFound: 0,
        matches: [], // Already empty, no paths to convert
        filesWithSecrets: [], // Already empty, no paths to convert
      };
      
      // Resolve output file relative to project root if it's a relative path
      const resolvedOutputFile = outputFile.startsWith('/') || outputFile.match(/^[A-Z]:/) 
        ? outputFile 
        : join(projectRoot, outputFile);
      const resolvedOutputDir = dirname(resolvedOutputFile);
      
      try {
        await mkdir(resolvedOutputDir, { recursive: true });
        await writeFile(resolvedOutputFile, JSON.stringify(emptyReport, null, 2), 'utf8');
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        debugError('security', 'securityScanCommand', {
          outputFile: resolvedOutputFile,
          message: err.message,
          code: err.code,
        });
        throw new Error(`Failed to write security report: ${err.message}`);
      }

      // Automatically ensure report file is in .gitignore to prevent accidental commits
      try {
        const reportPathRelative = relative(projectRoot, resolvedOutputFile).replace(/\\/g, '/');
        const isDefaultPath = outputPath === 'stamp_security_report.json' || 
                              (outputPath.endsWith('.json') && resolvedOutputFile.endsWith('stamp_security_report.json'));
        
        if (isDefaultPath) {
          // Default path - ensure all LogicStamp patterns are in .gitignore
          await ensureGitignorePatterns(projectRoot);
        } else {
          // Custom path - ensure this specific file is in .gitignore
          await ensurePatternInGitignore(projectRoot, reportPathRelative);
        }
      } catch (error) {
        // Non-fatal: log warning but don't fail the scan
        if (!options.quiet) {
          const err = error as Error;
          console.warn(`\n⚠️  Warning: Could not update .gitignore: ${err.message}`);
          console.warn(`   Please manually add the report file to .gitignore to prevent accidental commits.`);
        }
      }
      
      if (!options.quiet) {
        console.log(`\n✅ No secrets detected`);
        console.log(`📝 Report written to: ${displayPath(resolvedOutputFile)}`);
      }
      
      return { secretsFound: false, report: emptyReport };
    }
    
    return;
  }

  if (!options.quiet) {
    console.log(`   Scanning ${files.length} files...`);
  }

  // Scan each file for secrets
  const allMatches: SecretMatch[] = [];
  const filesWithSecrets = new Set<string>();

  // Maximum file size to scan (10MB) - prevents DoS on huge files
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  for (const file of files) {
    try {
      // Check file size before reading
      const fileStats = await stat(file);
      if (fileStats.size > MAX_FILE_SIZE) {
        if (!options.quiet) {
          console.warn(`   ⚠️  Skipped ${file}: file too large (${Math.round(fileStats.size / 1024 / 1024)}MB > 10MB)`);
        }
        continue;
      }

      const { text } = await readFileWithText(file);
      const matches = scanFileForSecrets(file, text);
      const filteredMatches = filterFalsePositives(matches);

      if (filteredMatches.length > 0) {
        allMatches.push(...filteredMatches);
        filesWithSecrets.add(file);
      }
    } catch (error) {
      // Skip files that can't be read (binary, permissions, etc.)
      if (!options.quiet) {
        console.warn(`   ⚠️  Skipped ${file}: ${(error as Error).message}`);
      }
    }
  }

  // Generate report - convert absolute paths to relative before serializing
  const report: SecurityReport = {
    type: 'LogicStampSecurityReport',
    schemaVersion: '0.1',
    createdAt: new Date().toISOString(),
    projectRoot,
    filesScanned: files.length,
    secretsFound: allMatches.length,
    matches: allMatches.map(match => ({
      ...match,
      file: getRelativePath(projectRoot, match.file),
    })),
    filesWithSecrets: Array.from(filesWithSecrets)
      .map(file => getRelativePath(projectRoot, file))
      .sort(),
  };

  // Write report
  const resolvedOutputDir = dirname(resolvedOutputFile);
  
  try {
    await mkdir(resolvedOutputDir, { recursive: true });
    await writeFile(resolvedOutputFile, JSON.stringify(report, null, 2), 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('security', 'securityScanCommand', {
      outputFile: resolvedOutputFile,
      message: err.message,
      code: err.code,
    });
    throw new Error(`Failed to write security report: ${err.message}`);
  }

  // Automatically ensure report file is in .gitignore to prevent accidental commits
  // The report contains sensitive information (locations of secrets)
  try {
    const reportPathRelative = relative(projectRoot, resolvedOutputFile).replace(/\\/g, '/');
    const isDefaultPath = outputPath === 'stamp_security_report.json' || 
                          (outputPath.endsWith('.json') && resolvedOutputFile.endsWith('stamp_security_report.json'));
    
    if (isDefaultPath) {
      // Default path - ensure all LogicStamp patterns are in .gitignore
      await ensureGitignorePatterns(projectRoot);
    } else {
      // Custom path - ensure this specific file is in .gitignore
      await ensurePatternInGitignore(projectRoot, reportPathRelative);
    }
  } catch (error) {
    // Non-fatal: log warning but don't fail the scan
    if (!options.quiet) {
      const err = error as Error;
      console.warn(`\n⚠️  Warning: Could not update .gitignore: ${err.message}`);
      console.warn(`   Please manually add the report file to .gitignore to prevent accidental commits.`);
    }
  }

  // Display results
  if (!options.quiet) {
    console.log(`\n📊 Security Scan Results:`);
    console.log(`   Files scanned: ${files.length}`);
    console.log(`   Secrets found: ${allMatches.length}`);
    console.log(`   Files with secrets: ${filesWithSecrets.size}`);
    
    if (allMatches.length > 0) {
      console.log(`\n⚠️  Secrets detected in the following files:`);
      
      // Group by file
      const matchesByFile = new Map<string, SecretMatch[]>();
      for (const match of allMatches) {
        if (!matchesByFile.has(match.file)) {
          matchesByFile.set(match.file, []);
        }
        matchesByFile.get(match.file)!.push(match);
      }
      
      for (const [file, matches] of matchesByFile.entries()) {
        console.log(`\n   ${displayPath(file)}`);
        for (const match of matches.slice(0, 5)) { // Show first 5 matches per file
          console.log(`      Line ${match.line}: ${match.type} (${match.severity})`);
          console.log(`      ${match.snippet}`);
        }
        if (matches.length > 5) {
          console.log(`      ... and ${matches.length - 5} more`);
        }
      }
      
      console.log(`\n📝 Report written to: ${displayPath(resolvedOutputFile)}`);
    } else {
      console.log(`\n✅ No secrets detected`);
      console.log(`📝 Report written to: ${displayPath(outputFile)}`);
    }
  } else {
    // Quiet mode: just output JSON stats
    console.log(JSON.stringify({
      filesScanned: files.length,
      secretsFound: allMatches.length,
      filesWithSecrets: filesWithSecrets.size,
      reportPath: resolvedOutputFile,
    }));
  }

  // Exit with error code if secrets found (unless noExit is true)
  if (allMatches.length > 0) {
    if (options.noExit) {
      return { secretsFound: true, report };
    } else {
      process.exit(1);
    }
  }
  
  if (options.noExit) {
    return { secretsFound: false, report };
  }
}

