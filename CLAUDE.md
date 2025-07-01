# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Deno lint plugin for [neverthrow](https://github.com/supermacro/neverthrow), a TypeScript library that provides a Result type for better error handling. The plugin enforces proper handling of Result types to prevent unhandled errors.

**Note**: This is a port of the original ESLint plugin, adapted to work with Deno's lint system using AST-based analysis instead of TypeScript's type checker.

## Development Commands

### Testing

```bash
deno test                          # Run all tests
deno test --allow-read --allow-write  # Run tests with file permissions
deno test --no-check               # Run tests without type checking
```

### Linting & Formatting

```bash
deno lint          # Lint the codebase
deno fmt           # Format the code
deno check mod.ts  # Type check the main module
```

### Development Tasks

```bash
deno task test     # Run tests (if defined in deno.json)
deno task lint     # Run linting (if defined in deno.json)
deno task fmt      # Run formatting (if defined in deno.json)
deno task check    # Run type checking (if defined in deno.json)
```

### Publishing

```bash
deno publish       # Publish to JSR
```

## Architecture

### Plugin Structure

- **mod.ts**: Main entry point that exports the Deno lint plugin
- **rules/**: Contains all lint rule implementations
- **utils/**: Contains shared utilities for AST analysis
- **tests/**: Contains test files using Deno's test runner

### Rule Implementation Pattern

Each rule follows the Deno lint rule structure:

1. Rules are defined in `rules/[rule-name].ts`
2. Tests are in `tests/[rule-name]_test.ts`
3. All rules are exported through `mod.ts`

### Key Components

#### must-use-result Rule

The main rule that ensures Result types from neverthrow are properly handled. The rule:

- Uses AST pattern matching to identify Result-like patterns
- Tracks neverthrow imports to identify Result factory functions
- Checks if Results are handled via `match()`, `unwrapOr()`, or `_unsafeUnwrap()`
- Allows Results that are returned from functions
- Uses heuristics (like function names containing "result") for detection

#### AST-Based Analysis

Since Deno lint doesn't have access to TypeScript's type checker, the plugin uses:

- Import tracking to identify neverthrow symbols
- Method call pattern recognition
- Heuristic-based Result detection
- Direct constructor and factory function identification

### Testing Approach

- Uses Deno's built-in test runner
- Tests use `Deno.lint.runPlugin()` to execute the plugin
- Test cases cover both valid (properly handled) and invalid (unhandled) Result usage
- Type declarations are injected into test code for neverthrow types

## Key Implementation Details

### Result Detection (AST-Based)

The plugin identifies Results through:

- **Import tracking**: Monitoring imports from "neverthrow"
- **Constructor calls**: `new Ok()`, `new Err()`
- **Factory functions**: `ok()`, `err()`, `okAsync()`, `errAsync()`
- **Naming heuristics**: Functions with "result" in their names
- **Method patterns**: Calls to Result-specific methods

### Handled Methods

Results are considered properly handled when these methods are called:

- `match()`: Pattern matching on Ok/Err
- `unwrapOr()`: Provide default value
- `_unsafeUnwrap()`: Force unwrap (escape hatch)

### Special Cases

- Results returned from functions are considered handled
- Results in arrow function expressions are considered handled
- Method chaining is traced to find eventual handling
- Import tracking ensures only neverthrow Results are flagged

### Limitations

Due to the AST-based approach without type information:

- May have false positives for non-Result objects with similar patterns
- May miss Results passed through complex type transformations
- Cannot perform sophisticated type inference
- Relies on naming patterns and import tracking for accuracy

## File Structure

```
deno-lint-plugin-neverthrow/
├── mod.ts                    # Main plugin export
├── deno.json                # Deno configuration
├── rules/
│   └── must-use-result.ts   # Main rule implementation
├── utils/
│   └── ast-helpers.ts       # AST analysis utilities
├── tests/
│   └── must-use-result_test.ts  # Test suite
├── README.md                # Documentation
└── CLAUDE.md               # This file
```
