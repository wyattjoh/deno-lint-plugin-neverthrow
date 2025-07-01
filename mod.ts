import { mustUseResult } from "./rules/must-use-result.ts";

const plugin: Deno.lint.Plugin = {
  name: "neverthrow",
  rules: {
    "must-use-result": mustUseResult,
  },
};

export default plugin;
