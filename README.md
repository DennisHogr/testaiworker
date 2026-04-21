# AiFixerTest

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## AI Issue Fixer

This repository includes an automated AI-powered issue fixer that uses the Langdock API to generate and apply code fixes.

### Setup

To enable the AI issue fixer, add the following secrets to your GitHub repository settings:

1. **`LANGDOCK_API_KEY`** (required)
   - Your Langdock API key for authentication
   - Generate this from your Langdock account dashboard

2. **`LANGDOCK_BASE_URL`** (optional)
   - The base URL for the Langdock API
   - Defaults to `https://api.langdock.com` if not set

### Usage

To trigger the AI fixer:

1. Open a GitHub issue and describe the problem you'd like fixed
2. Add the label `ai_fix` to the issue
3. The workflow will automatically:
   - Analyze the issue and repository context
   - Generate a code fix using Langdock API
   - Create a pull request with the proposed changes
   - Post comments with the results

### How it Works

- **Trigger:** Issues labeled with `ai_fix`
- **Collection:** Gathers source files from `src/`, `app/`, `lib/`, and `tests/` directories
- **Safety:** Only modifies application source code, never touches workflows, environment files, or secrets
- **Output:** Creates a branch `ai-fix/issue-NUMBER` with the fix and opens a pull request
- **Review:** Always review the generated PR before merging

### Implementation Details

- Workflow: `.github/workflows/ai-fix.yml`
- Script: `.github/scripts/ai-fix.js`
- Uses GitHub Actions with Node.js 20
- Implements defensive error handling and validation
- No auto-merge; manual review required

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
