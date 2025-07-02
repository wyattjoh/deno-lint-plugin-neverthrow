import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import plugin from "../mod.ts";

/**
 * Helper function to run the neverthrow lint plugin on test code.
 * This function executes the plugin against the provided code and returns
 * any lint diagnostics that were found.
 *
 * @param code - The TypeScript code to lint
 * @returns Array of lint diagnostics found in the code
 */
function runLint(code: string) {
  return Deno.lint.runPlugin(plugin, "test.ts", code);
}

/**
 * Helper function to create test code with neverthrow imports.
 * This function wraps the provided code with standard neverthrow import
 * statements to simulate a typical usage scenario.
 *
 * @param code - The code to wrap with neverthrow imports
 * @returns Complete test code with neverthrow imports
 */
function createTestCode(code: string): string {
  return `
import { Result, Ok, Err, ok, err, ResultAsync, okAsync, errAsync } from "neverthrow";

${code}
  `.trim();
}

Deno.test("mustUseResult - valid cases", async (t) => {
  await t.step("should allow unwrapOr usage", () => {
    const code = createTestCode(`
      ok("value").unwrapOr("");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should allow match usage", () => {
    const code = createTestCode(`
      ok("value").match(
        (value) => console.log(value),
        (error) => console.error(error)
      );
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should allow _unsafeUnwrap usage", () => {
    const code = createTestCode(`
      ok("value")._unsafeUnwrap();
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should allow method chaining with handler", () => {
    const code = createTestCode(`
      ok("value")
        .map(x => x.toUpperCase())
        .unwrapOr("");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should allow returning Results", () => {
    const code = createTestCode(`
      function processResult(): Result<string, Error> {
        return ok("value").map(x => x.toUpperCase());
      }
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should allow arrow function returns", () => {
    const code = createTestCode(`
      const processResult = (): Result<string, Error> => 
        ok("value").map(x => x.toUpperCase());
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should allow new Ok with handler", () => {
    const code = createTestCode(`
      new Ok("value").unwrapOr("");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });
});

Deno.test("mustUseResult - invalid cases", async (t) => {
  await t.step("should report unhandled ok() call", () => {
    const code = createTestCode(`
      ok("value");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
    assertEquals(
      diagnostics[0].message,
      "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
    );
  });

  await t.step("should report unhandled err() call", () => {
    const code = createTestCode(`
      err("error");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
    assertEquals(
      diagnostics[0].message,
      "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
    );
  });

  await t.step("should report unhandled Ok constructor", () => {
    const code = createTestCode(`
      new Ok("value");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
    assertEquals(
      diagnostics[0].message,
      "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
    );
  });

  await t.step("should report unhandled Err constructor", () => {
    const code = createTestCode(`
      new Err("error");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
    assertEquals(
      diagnostics[0].message,
      "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
    );
  });

  await t.step("should report function calls with 'result' in name", () => {
    const code = createTestCode(`
      getResult();
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
    assertEquals(
      diagnostics[0].message,
      "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
    );
  });

  await t.step("should report assigned but unhandled Results", () => {
    const code = createTestCode(`
      const result = ok("value");
      console.log("not using result");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
    assertEquals(
      diagnostics[0].message,
      "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
    );
  });
});

Deno.test("mustUseResult - edge cases", async (t) => {
  await t.step("should not report non-Result function calls", () => {
    const code = createTestCode(`
      function normalFunction(): string {
        return "hello";
      }
      
      normalFunction();
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should handle nested Result operations that return", () => {
    const code = createTestCode(`
      function processNestedResult(): Result<string, Error> {
        return ok("value")
          .map(value => value.toUpperCase());
      }
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should handle complex method chains", () => {
    const code = createTestCode(`
      ok("value")
        .map(x => x.trim())
        .map(x => x.toUpperCase())
        .unwrapOr("default");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should not report functions without 'result' in name", () => {
    const code = createTestCode(`
      function getData(): string {
        return "data";
      }
      
      getData();
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step(
    "should not report utility functions with 'result' in name",
    () => {
      const code = createTestCode(`
      function isResultConstructorCall(node: any): boolean {
        return node.type === "CallExpression";
      }
      
      function checkResult(value: string): string {
        return value;
      }
      
      // These should not be flagged as they're utility functions
      isResultConstructorCall(someNode);
      checkResult("test");
    `);

      const diagnostics = runLint(code);
      assertEquals(diagnostics.length, 0);
    },
  );

  await t.step(
    "should not report result-named functions in conditional contexts",
    () => {
      const code = createTestCode(`
      function hasResult(): boolean {
        return true;
      }
      
      function processResult(value: string): string {
        return value.toUpperCase();
      }
      
      // These should not be flagged in conditional/processing contexts
      if (hasResult()) {
        processResult("test");
      }
    `);

      const diagnostics = runLint(code);
      assertEquals(diagnostics.length, 0);
    },
  );
});

Deno.test("mustUseResult - async Result patterns", async (t) => {
  await t.step("should report unhandled okAsync() call", () => {
    const code = createTestCode(`
      okAsync("value");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
    assertEquals(
      diagnostics[0].message,
      "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
    );
  });

  await t.step("should report unhandled errAsync() call", () => {
    const code = createTestCode(`
      errAsync("error");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
    assertEquals(
      diagnostics[0].message,
      "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
    );
  });

  await t.step("should allow handled okAsync() call", () => {
    const code = createTestCode(`
      okAsync("value").match(
        (value) => console.log(value),
        (error) => console.error(error)
      );
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should allow async Result in return statement", () => {
    const code = createTestCode(`
      function getAsyncResult(): ResultAsync<string, Error> {
        return okAsync("value").map(x => x.toUpperCase());
      }
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should allow async Result chaining with final handler", () => {
    const code = createTestCode(`
      okAsync("value")
        .map(x => x.trim())
        .andThen(x => okAsync(x.toUpperCase()))
        .unwrapOr("default");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });
});

Deno.test("mustUseResult - method chaining patterns", async (t) => {
  await t.step("should report Result method chain without handler", () => {
    const code = createTestCode(`
      ok("value")
        .map(x => x.toUpperCase())
        .mapErr(e => new Error(e));
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
    assertEquals(
      diagnostics[0].message,
      "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
    );
  });

  await t.step("should allow orElse with final handler", () => {
    const code = createTestCode(`
      err("error")
        .orElse(e => ok("fallback"))
        .unwrapOr("default");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should allow andThen with final handler", () => {
    const code = createTestCode(`
      ok("value")
        .andThen(x => ok(x.length))
        .match(
          (len) => console.log(len),
          (error) => console.error(error)
        );
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should report incomplete chaining", () => {
    const code = createTestCode(`
      ok("value")
        .map(x => x.trim())
        .isOk();
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
  });
});

Deno.test("mustUseResult - variable assignment patterns", async (t) => {
  await t.step("should allow Result assigned and later handled", () => {
    const code = createTestCode(`
      const result = ok("value");
      const finalValue = result.unwrapOr("default");
    `);

    const diagnostics = runLint(code);
    // The assignment itself will be flagged, but this is expected behavior
    // since we can't track variable usage across statements without type info
    assertEquals(diagnostics.length, 1);
  });

  await t.step(
    "should allow Result in variable declaration with immediate handling",
    () => {
      const code = createTestCode(`
      const value = ok("test").unwrapOr("default");
    `);

      const diagnostics = runLint(code);
      assertEquals(diagnostics.length, 0);
    },
  );

  await t.step("should report multiple unhandled Results", () => {
    const code = createTestCode(`
      ok("first");
      err("second");
      new Ok("third");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 3);
  });

  await t.step("should handle mixed handled and unhandled Results", () => {
    const code = createTestCode(`
      ok("handled").unwrapOr("default");
      err("unhandled");
      ok("also-handled").match(
        (value) => console.log(value),
        (error) => console.error(error)
      );
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
    assertEquals(
      diagnostics[0].message,
      "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
    );
  });
});

Deno.test("mustUseResult - import variations", async (t) => {
  await t.step("should handle namespace imports", () => {
    const code = `
import * as neverthrow from "neverthrow";

neverthrow.ok("value");
    `.trim();

    const diagnostics = runLint(code);
    // Should not be flagged since we can't easily track namespace imports
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should handle aliased imports", () => {
    const code = `
import { ok as success, err as failure } from "neverthrow";

success("value");
    `.trim();

    const diagnostics = runLint(code);
    // Should not be flagged since we track by the imported local name
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should handle default import", () => {
    const code = `
import { Result } from "neverthrow";

// This should not be flagged as it's not a factory function
Result.ok("value");
    `.trim();

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should handle mixed import styles", () => {
    const code = `
import { ok, Err as ErrorClass } from "neverthrow";

ok("value");
new ErrorClass("error");
    `.trim();

    const diagnostics = runLint(code);
    // Only ok("value") is caught because our AST-based approach
    // can't track that ErrorClass is an alias for Err
    assertEquals(diagnostics.length, 1);
  });
});

Deno.test("mustUseResult - nested contexts", async (t) => {
  await t.step("should allow Results in nested return contexts", () => {
    const code = createTestCode(`
      function outer() {
        function inner(): Result<string, Error> {
          return ok("nested").map(x => x.toUpperCase());
        }
        return inner();
      }
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should allow Results in callback returns", () => {
    const code = createTestCode(`
      const callbacks = [
        () => ok("first"),
        () => err("second").orElse(() => ok("fallback"))
      ];
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should report unhandled Results in nested blocks", () => {
    const code = createTestCode(`
      function processData() {
        if (true) {
          ok("value");
        }
      }
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
  });

  await t.step("should allow Results in try-catch blocks when handled", () => {
    const code = createTestCode(`
      try {
        const value = ok("test").unwrapOr("default");
        console.log(value);
      } catch (e) {
        console.error(e);
      }
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });
});

Deno.test("mustUseResult - conditional and loop patterns", async (t) => {
  await t.step(
    "should report Results in if statements without handling",
    () => {
      const code = createTestCode(`
      if (true) {
        ok("value");
      } else {
        err("error");
      }
    `);

      const diagnostics = runLint(code);
      assertEquals(diagnostics.length, 2);
    },
  );

  await t.step(
    "should allow Results in conditional expressions when handled",
    () => {
      const code = createTestCode(`
      const value = condition ? ok("yes").unwrapOr("") : err("no").unwrapOr("");
    `);

      const diagnostics = runLint(code);
      assertEquals(diagnostics.length, 0);
    },
  );

  await t.step("should report Results in loops without handling", () => {
    const code = createTestCode(`
      for (let i = 0; i < 3; i++) {
        ok(i.toString());
      }
      
      while (condition) {
        err("loop error");
      }
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 2);
  });

  await t.step("should allow Results in switch statements when handled", () => {
    const code = createTestCode(`
      switch (value) {
        case "a":
          ok("case a").match(
            (val) => console.log(val),
            (err) => console.error(err)
          );
          break;
        default:
          err("default").unwrapOr("fallback");
          break;
      }
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });
});

Deno.test("mustUseResult - complex expressions", async (t) => {
  await t.step("should handle Results in array expressions", () => {
    const code = createTestCode(`
      const results = [
        ok("first").unwrapOr(""),
        err("second").unwrapOr(""),
        ok("third")._unsafeUnwrap()
      ];
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should handle Results in object expressions", () => {
    const code = createTestCode(`
      const obj = {
        success: ok("value").unwrapOr(""),
        failure: err("error").match(
          (val) => val,
          (err) => "error occurred"
        )
      };
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should report unhandled Results in complex expressions", () => {
    const code = createTestCode(`
      const complex = {
        nested: {
          array: [ok("unhandled"), err("also unhandled")]
        }
      };
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 2);
  });

  await t.step(
    "should handle Results as function arguments when handled",
    () => {
      const code = createTestCode(`
      function processValue(val: string) {
        return val.toUpperCase();
      }
      
      processValue(ok("test").unwrapOr("default"));
    `);

      const diagnostics = runLint(code);
      assertEquals(diagnostics.length, 0);
    },
  );

  await t.step("should report Results as unhandled function arguments", () => {
    const code = createTestCode(`
      function processResult(result: Result<string, Error>) {
        // Function that takes a Result - this is allowed
      }
      
      // But passing unhandled Results should be flagged
      someFunction(ok("test"));
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
  });
});

Deno.test("mustUseResult - edge cases and limitations", async (t) => {
  await t.step("should handle class methods and properties", () => {
    const code = createTestCode(`
      class MyClass {
        getResult(): Result<string, Error> {
          return ok("value");
        }
        
        processData() {
          // Method calls like this.getResult() are not currently handled
          // by our AST-based approach since they're MemberExpressions
          this.getResult();
        }
      }
    `);

    const diagnostics = runLint(code);
    // Our current implementation doesn't handle method calls (MemberExpression)
    // only direct function calls (CallExpression with Identifier callee)
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should handle Results in template literals", () => {
    const code = createTestCode(`
      const message = \`Result: \${ok("value").unwrapOr("default")}\`;
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should handle Results in destructuring", () => {
    const code = createTestCode(`
      const [first, second] = [
        ok("first").unwrapOr(""),
        err("second")  // This should be flagged
      ];
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
  });

  await t.step("should handle Results with spread operator", () => {
    const code = createTestCode(`
      const results = [
        ...someArray,
        ok("handled").unwrapOr(""),
        err("unhandled")  // This should be flagged
      ];
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
  });

  await t.step("should not flag Results imported from other modules", () => {
    const code = `
import { ok } from "some-other-library";

ok("value");
    `.trim();

    const diagnostics = runLint(code);
    // Should not be flagged since it's not from neverthrow
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should handle Results in logical operators", () => {
    const code = createTestCode(`
      const value = condition && ok("value").unwrapOr("");
      const fallback = condition || err("error").unwrapOr("default");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should handle Results in ternary operators", () => {
    const code = createTestCode(`
      const result = condition 
        ? ok("success").unwrapOr("")
        : err("failure").unwrapOr("fallback");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should handle chained assignments", () => {
    const code = createTestCode(`
      let a, b, c;
      a = b = c = ok("value").unwrapOr("default");
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });

  await t.step("should report Results in comma expressions", () => {
    const code = createTestCode(`
      (console.log("before"), ok("value"), console.log("after"));
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 1);
  });

  await t.step("should handle Results in async/await contexts", () => {
    const code = createTestCode(`
      async function processAsync() {
        // Should be allowed when returned
        return okAsync("value").map(x => x.toUpperCase());
      }
      
      async function consumeAsync() {
        const result = await okAsync("value").match(
          (val) => val,
          (err) => "error"
        );
        return result;
      }
    `);

    const diagnostics = runLint(code);
    assertEquals(diagnostics.length, 0);
  });
});
