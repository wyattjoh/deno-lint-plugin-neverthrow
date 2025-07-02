# deno-lint-plugin-neverthrow

A Deno lint plugin for [neverthrow](https://github.com/supermacro/neverthrow) that enforces proper handling of Result types to prevent unhandled errors.

## Installation

### From JSR

```bash
deno add jsr:@wyattjoh/deno-lint-plugin-neverthrow
```

### Local Development

1. Clone this repository
2. Add the plugin to your `deno.json`:

```json
{
  "lint": {
    "plugins": ["jsr:@wyattjoh/deno-lint-plugin-neverthrow"],
    "rules": {
      "tags": ["recommended"],
      "include": ["neverthrow/must-use-result"]
    }
  }
}
```

## Usage

Configure the plugin in your `deno.json`:

```json
{
  "lint": {
    "plugins": ["jsr:@wyattjoh/deno-lint-plugin-neverthrow"],
    "rules": {
      "tags": ["recommended"],
      "include": ["neverthrow/must-use-result"]
    }
  }
}
```

Then run the linter:

```bash
deno lint
```

## Rules

### `neverthrow/must-use-result`

Enforces that Result types from neverthrow are properly handled to prevent unhandled errors.

#### ❌ Incorrect

```typescript
import { err, ok, Result } from "neverthrow";

// Unhandled Result calls
ok("value");
err("error");
new Ok("value");
new Err("error");

// Functions with "result" in the name (heuristic)
getResult();

// Assigned but not handled
const result = ok("value");
console.log("not using result");
```

#### ✅ Correct

```typescript
import { err, ok, Result } from "neverthrow";

// Properly handled with unwrapOr
ok("value").unwrapOr("default");

// Properly handled with match
ok("value").match(
  (value) => console.log(value),
  (error) => console.error(error),
);

// Properly handled with _unsafeUnwrap
ok("value")._unsafeUnwrap();

// Method chaining with final handler
ok("value")
  .map((x) => x.toUpperCase())
  .unwrapOr("default");

// Returning Results (considered handled)
function processResult(): Result<string, Error> {
  return ok("value").map((x) => x.toUpperCase());
}

// Arrow function returns
const processResult = () => ok("value").map((x) => x.toUpperCase());
```

## Limitations

This Deno lint plugin uses AST-based analysis without TypeScript's type checker, which means:

- **May have false positives**: Non-Result objects might be flagged if they match Result patterns
- **May miss some cases**: Results passed through complex type transformations might not be detected
- **Heuristic-based**: Uses naming patterns (functions with "result" in the name) and import tracking
- **Less accurate**: Cannot perform the sophisticated type analysis of the original ESLint plugin

For the most accurate Result type checking, consider using the original [eslint-plugin-neverthrow](https://github.com/mdbetancourt/eslint-plugin-neverthrow) with TypeScript-aware ESLint configuration.

## Development

### Commands

- `deno test` - Run tests
- `deno lint` - Lint the codebase
- `deno fmt` - Format the code
- `deno check mod.ts` - Type check

### Testing

```bash
deno test --allow-read --allow-write
```

### Publishing

To publish to JSR:

```bash
deno publish
```

## Differences from ESLint Plugin

This Deno lint plugin is a port of the original ESLint plugin but with significant architectural differences:

1. **No TypeChecker**: Uses AST pattern matching instead of TypeScript type analysis
2. **Simpler Detection**: Focuses on obvious Result usage patterns
3. **Import Tracking**: Tracks neverthrow imports to identify Result factory functions
4. **Heuristic-Based**: Uses naming patterns for function calls that likely return Results

## Contributing

Contributions are welcome! Please feel free to submit issues and enhancement requests.

## License

MIT

## Related

- [neverthrow](https://github.com/supermacro/neverthrow) - The Result type library
- [eslint-plugin-neverthrow](https://github.com/mdbetancourt/eslint-plugin-neverthrow) - The original ESLint version
