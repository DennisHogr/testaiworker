# Debugging AI Fixer Error: "Edit missing required fields"

## Problem

The AI Issue Fixer encountered an error:
```
Error applying edit to src/app/app.css: Edit missing required fields: path, search, replace
```

This means the Langdock API returned an edit object that doesn't have the required fields.

## What I Fixed

I've updated the script with **much better error diagnostics**. Now when you run it again, you'll see:

1. **Detailed API response logging** - Shows exactly what the API returned
2. **Per-edit debugging info** - For each edit:
   - Which edit number it is
   - The path being modified
   - Whether search/replace fields exist
   - The complete edit object in JSON format
3. **Clear error messages** - Shows exactly which field is missing

## How to Debug

When you run the workflow again, look for these sections in the logs:

### Section 1: API Response Summary
```
📦 API Response received:
   can_fix: true
   summary: (description of changes)
   edits: X edits
```

### Section 2: Edit Processing Details
```
🔧 Applying X edit(s)...
  [1/X] Processing edit for: src/app/app.css
  [2/X] Processing edit for: src/app/app.ts
```

### Section 3: If Error Occurs
If there's still an error, you'll now see:
```
❌ Error applying edit #1:
   Path: src/app/app.css (or 'undefined' if missing)
   Has search: true/false
   Has replace: true/false
   Full edit object: { ... complete JSON ... }
   Error: Edit missing required fields (path, search, replace)
```

This tells you exactly which fields are missing!

## Common Causes

### 1. API Response Format Issue
**Problem**: The Langdock API might be returning edits in a different format than expected.

**Example of WRONG format**:
```json
{
  "edits": [
    {
      "file": "src/app.css",    // Wrong key name (should be "path")
      "old_text": "color: red",  // Wrong key name (should be "search")
      "new_text": "color: blue"  // Wrong key name (should be "replace")
    }
  ]
}
```

**Expected CORRECT format**:
```json
{
  "edits": [
    {
      "path": "src/app.css",
      "search": "color: red",
      "replace": "color: blue"
    }
  ]
}
```

### 2. Nested or Array Issues
**Problem**: Edits might be nested in an unexpected structure.

**Example of WRONG format**:
```json
{
  "edits": {
    "files": [
      { "path": "src/app.css", ... }
    ]
  }
}
```

### 3. Type Issues
**Problem**: Fields might exist but be empty, null, or the wrong type.

**Example of WRONG format**:
```json
{
  "path": null,
  "search": "",
  "replace": "some text"
}
```

## Next Steps

### 1. Run the workflow again
Create a new test issue and add the `ai_fix` label. The improved logging will show exactly what's happening.

### 2. Check the Langdock API Documentation
Review the Langdock API documentation to understand:
- What exact response format they return
- If there's specific field naming conventions
- If there's a version of the API you should be using

### 3. Adjust the Prompt (Optional)
The prompt sent to Langdock might need adjustment. It's in the `callLangdockAPI` function around line 200. You could modify it to explicitly request:
```
Return edits with EXACTLY these field names: path, search, replace
```

### 4. Check the Response Parsing
The script extracts JSON from the API response. If the response includes extra text, it should handle it. But if the JSON structure itself is wrong, we need to know what the API is actually returning.

## Updated Error Handling

The script now provides:

✅ **Better validation** - Checks if edit is an object first  
✅ **Field checking** - Lists exactly which fields are missing  
✅ **Full object logging** - Shows the complete edit object  
✅ **Edit numbering** - Shows which edit number failed  
✅ **Path tracking** - Shows path even if edit is malformed  

## Sample Output Format (When Working)

```
🚀 Starting AI Issue Fixer...
✓ Environment validated
📂 Collecting repository files...
📦 Collected 15 files (45KB)
🤖 Calling Langdock API...

📦 API Response received:
   can_fix: true
   summary: Added missing email validation check
   edits: 1 edits

🔧 Applying 1 edit(s)...
  [1/1] Processing edit for: src/app/login.component.ts
✅ Modified: src/app/login.component.ts

✨ Fix applied successfully!
Modified files: src/app/login.component.ts
Summary: Added missing email validation check
```

## How to Share Debug Info

When reporting the issue:

1. Go to GitHub repository → Actions tab
2. Find the workflow run that failed
3. Click the run to see logs
4. Expand the "Run AI fix script" step
5. Copy the section showing:
   - `📦 API Response received:`
   - `🔧 Applying X edit(s)...:`
   - `❌ Error applying edit #X:`

This will show us exactly what the API returned!

---

**The script is now much more informative!** Run it again and the logs will tell us exactly what needs to be fixed.

