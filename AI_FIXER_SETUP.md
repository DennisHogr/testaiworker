# GitHub Actions AI Issue Fixer - Setup Guide

## Overview

This repository is now equipped with an automated AI-powered issue fixer that uses the Langdock API to analyze GitHub issues and generate code fixes.

## Files Created

1. **`.github/workflows/ai-fix.yml`**
   - Main GitHub Actions workflow
   - Triggers on issues labeled with `ai_fix`
   - Orchestrates the fix process and PR creation
   - ~105 lines, production-ready

2. **`.github/scripts/ai-fix.js`**
   - Node.js CommonJS script
   - Collects repository context
   - Calls Langdock API
   - Applies fixes safely with validation
   - ~418 lines, well-commented

3. **`README.md`** (updated)
   - Added "AI Issue Fixer" section with setup and usage instructions

## Required Setup

### 1. Add GitHub Secrets

Go to your repository settings → Secrets and variables → Actions and add:

#### Required
- **`LANGDOCK_API_KEY`**: Your Langdock API authentication key
  - Obtain from your Langdock account dashboard
  - Never commit this to the repository

#### Optional
- **`LANGDOCK_BASE_URL`**: Custom Langdock API endpoint
  - Defaults to `https://api.langdock.com` if not provided
  - Only set if using a custom or self-hosted instance

### 2. Verify Permissions

The workflow requires these GitHub Actions permissions (already configured):
- `contents: write` - To commit changes
- `issues: write` - To comment on issues
- `pull-requests: write` - To create pull requests

## How It Works

### Trigger
1. User creates a GitHub issue with a problem description
2. User adds the `ai_fix` label to the issue
3. Workflow automatically starts

### Process
1. **Checkout**: Repository is cloned with full history
2. **Setup**: Node.js 20 is installed
3. **Notify**: Comment posted on issue: "🤖 AI Fixer engaged..."
4. **Analyze**: Script collects relevant source files:
   - From: `src/`, `app/`, `lib/`, `tests/`, `package.json`, `README.md`
   - Excludes: `node_modules/`, `.git/`, `dist/`, `build/`, `.env*`, workflows
   - Limited to ~100KB of file content to keep payloads reasonable
5. **Fix**: Sends issue + repository context to Langdock API
6. **Apply**: If safe, applies the generated edits to files
7. **Create PR**: Opens a pull request on branch `ai-fix/issue-NUMBER`
8. **Notify**: Posts success/failure comment on the issue

### Safety Features

- ✅ Validates all file paths to prevent escapes outside repo
- ✅ Blocks modifications to unsafe locations:
  - `.github/workflows/`
  - `.env` and `.env.*` files
  - `.git/` directory
  - `node_modules/`
  - Deployment/infrastructure files
- ✅ Ensures search text matches exactly once (prevents ambiguous replacements)
- ✅ Verifies files exist and are readable before modifying
- ✅ Requires manual PR review before merging (no auto-merge)
- ✅ Comprehensive error handling with clear messages

## Usage Example

1. **Create an Issue**
   ```
   Title: "Bug: App crashes when input is empty"
   Body: "The login form throws an error when the email field is left empty. 
          It should show a validation message instead."
   ```

2. **Add Label**
   - Add the `ai_fix` label to the issue

3. **Workflow Runs**
   - GitHub Actions automatically triggers
   - You'll see progress in the issue comments

4. **Review the PR**
   - A new PR is created: `ai-fix/issue-123`
   - Review the changes carefully
   - Make manual adjustments if needed
   - Merge when satisfied

## Script Environment Variables

The workflow passes these to the script:
- `GITHUB_TOKEN` - GitHub API authentication (auto-provided)
- `LANGDOCK_API_KEY` - Langdock authentication (from secrets)
- `LANGDOCK_BASE_URL` - API endpoint (from secrets, optional)
- `ISSUE_TITLE` - Title of the GitHub issue
- `ISSUE_BODY` - Full description of the issue
- `ISSUE_NUMBER` - Issue number for reference
- `REPO_NAME` - Repository name (e.g., `owner/repo`)

## API Request Format

The script sends a request to:
```
POST {LANGDOCK_BASE_URL}/v1/chat/completions
```

With payload:
```json
{
  "model": "langdock",
  "messages": [
    {
      "role": "user",
      "content": "... detailed prompt with issue + repo context ..."
    }
  ],
  "temperature": 0.2
}
```

Headers:
```
Authorization: Bearer {LANGDOCK_API_KEY}
Content-Type: application/json
```

## Expected Response Format

The Langdock API should return:

**Success case:**
```json
{
  "can_fix": true,
  "summary": "Added null check for email field validation",
  "edits": [
    {
      "path": "src/app/login.component.ts",
      "search": "if (email) {",
      "replace": "if (email && email.trim()) {"
    }
  ]
}
```

**Cannot fix case:**
```json
{
  "can_fix": false,
  "reason": "Issue requires infrastructure changes outside source code"
}
```

## Workflow Outputs

The workflow posts comments to the issue with results:

### Success
```
✅ Fix applied successfully

📝 Summary:
Added null check for email field validation

🔗 Pull Request: #42
```

### No Changes
```
⚠️ No changes generated - The AI fixer could not generate a safe fix for this issue.

Issue requires infrastructure changes outside source code
```

### Failure
```
❌ Fix attempt failed - An error occurred while processing the fix. 
   Please check the workflow logs.
```

## Troubleshooting

### "LANGDOCK_API_KEY environment variable is not set"
**Solution:** Add the `LANGDOCK_API_KEY` secret to your repository settings.

### "Langdock API error: 401"
**Solution:** Verify that the `LANGDOCK_API_KEY` is correct and has not expired.

### "No changes generated"
**Solution:** The issue might require infrastructure changes or be outside the scope of safe code fixes.
Check the workflow logs for the reason provided by the API.

### "Search text not found" or "ambiguous"
**Solution:** The API generated an edit with text that doesn't exist or matches multiple times in the file.
Review the workflow logs and the file content to understand the issue.

## Production Considerations

✅ **Implemented:**
- Defensive error handling throughout
- No hardcoded secrets (all via GitHub Secrets)
- No auto-merge (requires manual review)
- No workflow file editing (cannot modify CI/CD)
- Minimal dependencies (only Node.js built-ins)
- Clear logging and comments

✅ **Best Practices:**
- Limited file collection (100KB max)
- Exact text matching for replacements
- Path validation and sanitization
- Comprehensive safety checks
- GitHub Actions permissions scoped correctly

## File Size Reference

- `ai-fix.yml`: ~3.2 KB
- `ai-fix.js`: ~13.4 KB
- Total: ~16.6 KB (lightweight, fast to execute)

## Next Steps

1. ✅ Commit these files to your repository
2. ✅ Add `LANGDOCK_API_KEY` secret to GitHub
3. ✅ (Optional) Add `LANGDOCK_BASE_URL` secret if using custom endpoint
4. ✅ Create a test issue with the `ai_fix` label
5. ✅ Monitor the workflow execution
6. ✅ Review and test the generated PR
7. ✅ Provide feedback and iterate

## Support

For issues or improvements:
- Check the workflow logs in GitHub Actions
- Review the script output for error details
- Verify API credentials and endpoint
- Ensure repository has proper permissions

---

**Status:** ✨ Ready to use! The AI Issue Fixer is fully configured and ready to help automate code fixes.

