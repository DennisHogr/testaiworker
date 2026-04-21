#!/usr/bin/env node
/**
 * AI Issue Fixer Script
 *
 * This script is triggered by a GitHub Actions workflow when an issue
 * is labeled with "ai_fix". It collects repository context, sends it
 * to the Langdock API to generate a code fix, and applies the changes.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

// Environment variables
const LANGDOCK_API_KEY = process.env.LANGDOCK_API_KEY;
const LANGDOCK_BASE_URL = process.env.LANGDOCK_BASE_URL || 'https://api.langdock.com';
const ISSUE_TITLE = process.env.ISSUE_TITLE || '';
const ISSUE_BODY = process.env.ISSUE_BODY || '';
const ISSUE_NUMBER = process.env.ISSUE_NUMBER || '';
const REPO_NAME = process.env.REPO_NAME || '';

// Directories to collect context from
const CONTEXT_DIRS = ['src', 'app', 'lib', 'tests', 'test', '.'];

// Files to exclude
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /build\//,
  /coverage\//,
  /\.env/,
  /\.env\..*/,
  /\.github\/workflows/,
  /package-lock\.json/,
  /yarn\.lock/,
];

// Unsafe paths that cannot be modified
const UNSAFE_PATHS = [
  '.github/workflows',
  '.env',
  '.env.local',
  '.env.production',
  '.git',
  'node_modules',
  '.github/secrets',
];

/**
 * Validate that LANGDOCK_API_KEY is provided
 */
function validateEnv() {
  if (!LANGDOCK_API_KEY) {
    console.error('❌ Error: LANGDOCK_API_KEY environment variable is not set.');
    console.error('Please configure the LANGDOCK_API_KEY secret in your GitHub repository settings.');
    process.exit(1);
  }
}

/**
 * Check if a file path should be excluded
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Check if a file path is unsafe to modify
 */
function isUnsafePath(filePath) {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return UNSAFE_PATHS.some(unsafe =>
    normalized === unsafe.toLowerCase() ||
    normalized.startsWith(unsafe.toLowerCase() + '/')
  );
}

/**
 * Recursively collect relevant files from the repository
 */
function collectRepositoryFiles(maxTotalSize = 100 * 1024) {
  const files = {};
  let totalSize = 0;

  function visitDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

        // Skip excluded paths
        if (shouldExclude(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Recurse into directories
          visitDir(fullPath);
        } else if (entry.isFile()) {
          // Include common source/config files
          if (
            relativePath.endsWith('.ts') ||
            relativePath.endsWith('.tsx') ||
            relativePath.endsWith('.js') ||
            relativePath.endsWith('.jsx') ||
            relativePath.endsWith('.json') ||
            relativePath.endsWith('.html') ||
            relativePath.endsWith('.css') ||
            relativePath.endsWith('.md') ||
            relativePath === 'package.json'
          ) {
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const fileSize = Buffer.byteLength(content, 'utf-8');

              // Only include if total size doesn't exceed limit
              if (totalSize + fileSize <= maxTotalSize) {
                files[relativePath] = content;
                totalSize += fileSize;
              }
            } catch (err) {
              console.warn(`⚠️  Could not read file ${relativePath}: ${err.message}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`⚠️  Could not access directory ${dir}: ${err.message}`);
    }
  }

  // Start collection from current directory
  visitDir(process.cwd());

  console.log(`📦 Collected ${Object.keys(files).length} files (${Math.round(totalSize / 1024)}KB)`);
  return files;
}

/**
 * Call the Langdock API to generate a fix
 */
async function callLangdockAPI(repositoryFiles) {
  // Format repository context
  const filesContext = Object.entries(repositoryFiles)
    .map(([path, content]) => `## ${path}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n');

  const prompt = `You are a code fixing assistant. A GitHub issue has been reported in this repository.

## GitHub Issue
**Title:** ${ISSUE_TITLE}
**Number:** #${ISSUE_NUMBER}
**Description:**
${ISSUE_BODY}

## Repository Context
${filesContext}

## Your Task
Analyze the issue and provide a minimal, safe code fix. Your fix should:
1. Address the reported problem with the smallest possible change
2. Not modify workflow files, environment files, or infrastructure
3. Include only source code changes
4. Be testable and self-contained

## CRITICAL: Search Text Requirements

IMPORTANT: The "search" field in each edit MUST:
1. Be EXACT: Match the exact text in the file (character-for-character, including all whitespace)
2. Be SPECIFIC: Include enough surrounding context to appear exactly ONCE in the file
3. Be UNAMBIGUOUS: Never use generic patterns like just newlines or single characters
4. Include CONTEXT: Include lines before/after to make it unique
5. Be COMPLETE: Include all whitespace exactly (spaces, tabs, newlines)

EXAMPLES OF GOOD search text:
- "function myFunction() {\n  return 42;\n}"
- "const value = 'old';" (with exact spacing)
- "import React from 'react';\n\nfunction App() {"

EXAMPLES OF BAD search text (DO NOT DO THIS):
- "\n" (just a newline - appears everywhere!)
- "const" (too generic)
- "}" (too generic)
- Single characters or very short strings

## Important Constraints
- DO NOT modify .github/workflows files
- DO NOT modify .env files or environment configuration
- DO NOT modify deployment or infrastructure files
- DO NOT modify secret or authentication files
- ONLY modify application source code that directly addresses the issue

## Output Format
You must respond with ONLY valid JSON (no markdown, no explanations). Use this format:

If you can provide a fix:
{
  "can_fix": true,
  "summary": "Brief explanation of the fix",
  "edits": [
    {
      "path": "relative/file/path",
      "search": "EXACT unique text from the file (including whitespace and context)",
      "replace": "EXACT replacement text with proper formatting"
    }
  ]
}

If you cannot safely fix the issue:
{
  "can_fix": false,
  "reason": "Explanation of why the issue cannot be fixed safely"
}

Remember:
- ONLY output valid JSON. No additional text before or after.
- Each "search" must match EXACTLY once in the file
- Include surrounding context to ensure uniqueness
- Preserve exact whitespace and formatting
- Never use generic or ambiguous search patterns`;

  const payload = {
    model: 'gpt-5.4',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.2,
  };

  return new Promise((resolve, reject) => {
    const apiUrl = new URL(`${LANGDOCK_BASE_URL}/chat/completions`);

    const options = {
      hostname: apiUrl.hostname,
      port: apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80),
      path: apiUrl.pathname + apiUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LANGDOCK_API_KEY}`,
        'User-Agent': 'GitHub-Actions-AI-Fixer/1.0',
      },
    };

    const protocol = apiUrl.protocol === 'https:' ? https : require('http');

    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Langdock API error: ${res.statusCode} - ${data}`));
          return;
        }

        try {
          const response = JSON.parse(data);
          const content = response.choices?.[0]?.message?.content;
          if (!content) {
            reject(new Error('No content in API response'));
            return;
          }

          // Extract JSON from the response (in case there's any surrounding text)
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            reject(new Error(`No valid JSON found in API response: ${content}`));
            return;
          }

          const result = JSON.parse(jsonMatch[0]);
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed to parse API response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

/**
 * Validate that an edit is safe to apply
 */
function validateEdit(edit) {
  if (!edit || typeof edit !== 'object') {
    throw new Error(`❌ Edit is not an object: ${JSON.stringify(edit)}`);
  }

  if (!edit.path || !edit.search || !edit.replace) {
    const missing = [];
    if (!edit.path) missing.push('path');
    if (!edit.search) missing.push('search');
    if (!edit.replace) missing.push('replace');
    throw new Error(`❌ Edit missing required fields (${missing.join(', ')}). Edit object: ${JSON.stringify(edit)}`);
  }

  // Normalize path
  const normalizedPath = edit.path.replace(/\\/g, '/');

  if (isUnsafePath(normalizedPath)) {
    throw new Error(`❌ Unsafe path detected: ${edit.path}`);
  }

  // Prevent path traversal
  if (normalizedPath.includes('..')) {
    throw new Error(`❌ Path traversal detected: ${edit.path}`);
  }

  return true;
}

/**
 * Apply an edit to a file
 */
function applyEdit(edit) {
  validateEdit(edit);

  const filePath = edit.path;
  const fullPath = path.join(process.cwd(), filePath);

  // Verify file exists within repo
  const realPath = fs.realpathSync(fullPath);
  const repoBasis = fs.realpathSync(process.cwd());
  if (!realPath.startsWith(repoBasis)) {
    throw new Error(`❌ File path outside repository: ${edit.path}`);
  }

  // Read the file
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`❌ Could not read file ${filePath}: ${err.message}`);
  }

  // Check that search text exists exactly once
  const occurrences = (content.match(new RegExp(edit.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (occurrences === 0) {
    throw new Error(`❌ Search text not found in ${filePath}. The search text provided does not match any content in the file. This usually means:
    1. The search text is incomplete or missing context
    2. The file content changed since the issue was created
    3. The file uses different whitespace (tabs vs spaces, line endings)

    Search text to find: ${JSON.stringify(edit.search)}`);
  }
  if (occurrences > 1) {
    throw new Error(`❌ Search text is ambiguous (${occurrences} matches) in ${filePath}. The search text appears multiple times in the file. This usually means:
    1. The search text is too generic or too short
    2. Not enough surrounding context was included
    3. The search text needs to include more unique identifiers

    Try making the search text more specific with additional context.
    Search text provided: ${JSON.stringify(edit.search)}`);
  }

  // Apply the replacement
  const newContent = content.replace(edit.search, edit.replace);

  // Write the file
  try {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✅ Modified: ${filePath}`);
    return true;
  } catch (err) {
    throw new Error(`❌ Could not write file ${filePath}: ${err.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting AI Issue Fixer...');

    // Validate environment
    validateEnv();
    console.log('✓ Environment validated');

    // Collect repository files
    console.log('📂 Collecting repository files...');
    const repositoryFiles = collectRepositoryFiles();

    if (Object.keys(repositoryFiles).length === 0) {
      console.error('❌ No repository files found to analyze');
      process.exit(1);
    }

    // Call Langdock API
    console.log('🤖 Calling Langdock API...');
    const fixResult = await callLangdockAPI(repositoryFiles);

    console.log(`\n📦 API Response received:`);
    console.log(`   can_fix: ${fixResult.can_fix}`);
    console.log(`   summary: ${fixResult.summary || '(none)'}`);
    console.log(`   edits: ${fixResult.edits ? fixResult.edits.length + ' edits' : 'none'}`);
    if (fixResult.reason) console.log(`   reason: ${fixResult.reason}`);

    // Handle API response
    if (!fixResult.can_fix) {
      console.log(`\n⚠️  Cannot apply fix: ${fixResult.reason}`);
      console.log('::set-output name=changes_made::false');
      console.log(`::set-output name=reason::${fixResult.reason}`);
      process.exit(0);
    }

    if (!fixResult.edits || fixResult.edits.length === 0) {
      console.log('⚠️  No edits were generated');
      console.log('::set-output name=changes_made::false');
      console.log('::set-output name=reason::No edits were generated by the AI');
      process.exit(0);
    }

    // Apply edits
    console.log(`\n🔧 Applying ${fixResult.edits.length} edit(s)...`);
    const appliedFiles = [];

    for (let i = 0; i < fixResult.edits.length; i++) {
      const edit = fixResult.edits[i];
      try {
        console.log(`  [${i + 1}/${fixResult.edits.length}] Processing edit for: ${edit.path || '(unknown path)'}`);
        applyEdit(edit);
        appliedFiles.push(edit.path);
      } catch (err) {
        console.error(`\n❌ Error applying edit #${i + 1}:`);
        console.error(`   Path: ${edit.path || 'undefined'}`);
        console.error(`   Has search: ${!!edit.search}`);
        console.error(`   Has replace: ${!!edit.replace}`);
        console.error(`   Full edit object: ${JSON.stringify(edit, null, 2)}`);
        console.error(`   Error: ${err.message}`);
        process.exit(1);
      }
    }

    // Output summary
    console.log('\n✨ Fix applied successfully!');
    console.log(`Modified files: ${appliedFiles.join(', ')}`);
    console.log(`Summary: ${fixResult.summary}`);

    // Set GitHub Actions outputs
    console.log('::set-output name=changes_made::true');
    const summaryLines = [
      `**Summary:** ${fixResult.summary}`,
      `**Files modified:** ${appliedFiles.join(', ')}`,
    ];
    const summary = summaryLines.join('\n');
    console.log(`::set-output name=summary::${summary}`);

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

// Run the script
main();

