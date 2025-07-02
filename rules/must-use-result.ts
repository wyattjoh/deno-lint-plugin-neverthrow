import {
  getMethodName,
  HANDLED_METHODS,
  ImportTracker,
  isInReturnContext,
  isResultConstructorCall,
} from "../utils/ast-helpers.ts";

/**
 * Simplified Result detection and handling logic for Deno lint
 * This focuses on the most obvious patterns without type information
 */

/**
 * Checks if a call expression is immediately followed by a handling method.
 * This function traverses the AST parent chain to determine if a Result-producing
 * call expression is immediately handled by a method like match(), unwrapOr(), or _unsafeUnwrap().
 *
 * @param node - The CallExpression or NewExpression node to check
 * @returns True if the node is immediately followed by a handling method call
 */
function isImmediatelyHandled(
  node: Deno.lint.CallExpression | Deno.lint.NewExpression,
): boolean {
  // Check if this node is part of a method chain that ends with a handler
  let current = node.parent;

  while (current) {
    if (current.type === "MemberExpression") {
      const methodName = getMethodName(current);
      if (methodName && HANDLED_METHODS.includes(methodName)) {
        // Check if this method is actually called
        const callParent = current.parent;
        if (
          callParent &&
          callParent.type === "CallExpression" &&
          callParent.callee === current
        ) {
          return true;
        }
      }
      current = current.parent;
    } else if (current.type === "CallExpression") {
      current = current.parent;
    } else {
      break;
    }
  }

  return false;
}

/**
 * Deno lint rule that enforces proper handling of neverthrow Result types.
 * This rule ensures that Result instances are properly handled using methods like
 * match(), unwrapOr(), or _unsafeUnwrap() to prevent unhandled Results.
 *
 * The rule uses AST-based analysis to detect Result patterns without relying on
 * TypeScript's type checker, making it suitable for Deno's lint system.
 *
 * @example
 * // ❌ Bad - unhandled Result
 * ok("value");
 *
 * @example
 * // ✅ Good - handled Result
 * ok("value").unwrapOr("default");
 *
 * @example
 * // ✅ Good - Result returned from function
 * function getResult() {
 *   return ok("value");
 * }
 */
export const mustUseResult: Deno.lint.Rule = {
  /**
   * Creates the rule implementation with visitor methods for different AST node types.
   *
   * @param context - The lint rule context providing reporting and utility functions
   * @returns Object containing visitor methods for AST nodes
   */
  create(context) {
    const importTracker = new ImportTracker();

    return {
      // Track imports from neverthrow
      ImportDeclaration(node) {
        importTracker.trackImport(node);
      },

      // Check call expressions for Result constructors and factory functions
      CallExpression(node) {
        // Skip if in return context
        if (isInReturnContext(node)) {
          return;
        }

        // Skip if immediately handled
        if (isImmediatelyHandled(node)) {
          return;
        }

        const callee = node.callee;

        // Check for factory function calls: ok(), err(), okAsync(), errAsync()
        if (callee.type === "Identifier") {
          const name = callee.name;
          if (
            ["ok", "err", "okAsync", "errAsync"].includes(name) &&
            importTracker.isNeverthrowImport(name)
          ) {
            context.report({
              node,
              message:
                "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
            });
          }
        }

        // Check for function calls that likely return Results (simple heuristic)
        if (
          callee.type === "Identifier" &&
          callee.name.toLowerCase().includes("result") &&
          // Exclude specific plugin utility functions and common patterns
          callee.name !== "isResultConstructorCall" &&
          callee.name !== "isResultMethodCall" &&
          callee.name !== "isResultIdentifier" &&
          callee.name !== "hasResultMethodChain" &&
          callee.name !== "checkResult" &&
          callee.name !== "hasResult" &&
          callee.name !== "processResult"
        ) {
          context.report({
            node,
            message:
              "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
          });
        }
      },

      // Check new expressions for Result constructors
      NewExpression(node) {
        // Skip if in return context
        if (isInReturnContext(node)) {
          return;
        }

        // Skip if immediately handled
        if (isImmediatelyHandled(node)) {
          return;
        }

        if (isResultConstructorCall(node)) {
          context.report({
            node,
            message:
              "Result must be handled with either match, unwrapOr, or _unsafeUnwrap",
          });
        }
      },

      // Check expression statements for standalone Result calls
      ExpressionStatement(node) {
        const expression = node.expression;

        // Skip if in return context
        if (isInReturnContext(expression)) {
          return;
        }

        // Check for Result constructor calls (only new expressions, but these are already handled by NewExpression visitor)
        // Skip to avoid duplicates - NewExpression handler takes care of this

        // Check for factory function calls (but skip if already handled by CallExpression)
        if (
          expression.type === "CallExpression" &&
          expression.callee?.type === "Identifier"
        ) {
          const name = expression.callee.name;
          if (
            ["ok", "err", "okAsync", "errAsync"].includes(name) &&
            importTracker.isNeverthrowImport(name)
          ) {
            // This is already handled by the CallExpression visitor
            // Don't report it again here to avoid duplicates
            return;
          }
        }
      },

      // Reset tracker for each program
      Program() {
        importTracker.clear();
      },
    };
  },
};
