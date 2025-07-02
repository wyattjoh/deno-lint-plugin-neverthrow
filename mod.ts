import { mustUseResult } from "./rules/must-use-result.ts";

/**
 * Deno lint plugin for neverthrow library that enforces proper handling of Result types.
 * This plugin ensures that Result types are not left unhandled, preventing potential
 * runtime errors from unhandled Results.
 *
 * @see https://github.com/supermacro/neverthrow
 */
const plugin: Deno.lint.Plugin = {
  name: "neverthrow",
  rules: {
    "must-use-result": mustUseResult,
  },
};

export default plugin;
