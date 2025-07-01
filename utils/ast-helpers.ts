/**
 * AST utilities for detecting neverthrow Result types and usage patterns
 * without TypeScript's TypeChecker
 */

// Method names that indicate Result handling
export const HANDLED_METHODS = ["match", "unwrapOr", "_unsafeUnwrap"];

// Method names that are Result methods but don't handle the Result
export const RESULT_METHODS = [
  "map",
  "mapErr",
  "andThen",
  "orElse",
  "asyncAndThen",
  "asyncMap",
  "isOk",
  "isErr",
];

// All Result methods combined
export const ALL_RESULT_METHODS = [...HANDLED_METHODS, ...RESULT_METHODS];

// Common neverthrow import patterns
export const NEVERTHROW_IMPORTS = [
  "Result",
  "Ok",
  "Err",
  "ok",
  "err",
  "ResultAsync",
  "okAsync",
  "errAsync",
];

/**
 * Checks if a node is an identifier that might be a Result
 */
export function isResultIdentifier(node: Deno.lint.Node): boolean {
  return (
    node.type === "Identifier" &&
    NEVERTHROW_IMPORTS.some((name) => node.name?.includes(name))
  );
}

/**
 * Checks if a node is a call expression that might create a Result
 */
export function isResultConstructorCall(node: Deno.lint.Node): boolean {
  if (node.type !== "CallExpression" && node.type !== "NewExpression") {
    return false;
  }

  const callee = node.callee;

  // Direct constructor calls: new Ok(), new Err()
  if (node.type === "NewExpression") {
    return (
      callee.type === "Identifier" &&
      (callee.name === "Ok" || callee.name === "Err")
    );
  }

  // Factory function calls: ok(), err(), okAsync(), errAsync()
  if (callee.type === "Identifier") {
    return ["ok", "err", "okAsync", "errAsync"].includes(callee.name);
  }

  return false;
}

/**
 * Checks if a member expression is calling a Result method
 */
export function isResultMethodCall(node: Deno.lint.Node): boolean {
  if (node.type !== "MemberExpression") {
    return false;
  }

  const property = node.property;
  return (
    property.type === "Identifier" && ALL_RESULT_METHODS.includes(property.name)
  );
}

/**
 * Checks if a method call is a Result handling method
 */
export function isHandledMethodCall(node: Deno.lint.Node): boolean {
  if (node.type !== "MemberExpression") {
    return false;
  }

  const property = node.property;
  return (
    property.type === "Identifier" && HANDLED_METHODS.includes(property.name)
  );
}

/**
 * Gets the method name from a member expression
 */
export function getMethodName(node: Deno.lint.Node): string | null {
  if (node.type !== "MemberExpression") {
    return null;
  }

  const property = node.property;
  return property.type === "Identifier" ? property.name : null;
}

/**
 * Checks if a node is likely a Result based on method chaining patterns
 */
export function hasResultMethodChain(node: Deno.lint.Node): boolean {
  // Look for method chains like: something.map().andThen()
  let current = node;
  let resultMethodCount = 0;

  while (current) {
    if (
      current.type === "CallExpression" &&
      current.callee?.type === "MemberExpression"
    ) {
      const methodName = getMethodName(current.callee);
      if (methodName && ALL_RESULT_METHODS.includes(methodName)) {
        resultMethodCount++;
      }
      current = current.callee.object;
    } else if (current.type === "MemberExpression") {
      const methodName = getMethodName(current);
      if (methodName && ALL_RESULT_METHODS.includes(methodName)) {
        resultMethodCount++;
      }
      current = current.object;
    } else {
      break;
    }
  }

  return resultMethodCount >= 1;
}

/**
 * Checks if a node is in a return statement or arrow function body
 */
export function isInReturnContext(
  node:
    | Deno.lint.CallExpression
    | Deno.lint.NewExpression
    | Deno.lint.Expression,
): boolean {
  let current: Deno.lint.Node | null = node.parent;

  while (current) {
    if (current.type === "ReturnStatement") {
      return true;
    }

    // Check if we're in an arrow function body (direct or nested)
    if (current.type === "ArrowFunctionExpression") {
      // Check if this node is part of the arrow function's body expression
      const bodyNode = current.body as Deno.lint.Node;
      let checkNode: Deno.lint.Node | null = node;

      // Walk up from our node to see if we reach the arrow function body
      while (checkNode && checkNode !== bodyNode) {
        if ("parent" in checkNode && checkNode.parent === bodyNode) {
          return true;
        }
        checkNode = "parent" in checkNode
          ? (checkNode.parent as Deno.lint.Node)
          : null;
      }

      // Direct body match
      if (bodyNode === node) {
        return true;
      }
    }

    // Stop at function boundaries or block statements
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "BlockStatement"
    ) {
      break;
    }

    current = "parent" in current ? (current.parent as Deno.lint.Node) : null;
  }

  return false;
}

/**
 * Tracks imported neverthrow identifiers from import statements
 */
export class ImportTracker {
  private neverthrowImports = new Set<string>();

  trackImport(node: Deno.lint.Node): void {
    if (node.type !== "ImportDeclaration") {
      return;
    }

    const source = node.source;
    if (source.type === "Literal" && source.value === "neverthrow") {
      // Track all imported identifiers
      for (const specifier of node.specifiers) {
        if (specifier.type === "ImportSpecifier") {
          this.neverthrowImports.add(specifier.local.name);
        } else if (specifier.type === "ImportDefaultSpecifier") {
          this.neverthrowImports.add(specifier.local.name);
        } else if (specifier.type === "ImportNamespaceSpecifier") {
          this.neverthrowImports.add(specifier.local.name);
        }
      }
    }
  }

  isNeverthrowImport(name: string): boolean {
    return this.neverthrowImports.has(name);
  }

  clear(): void {
    this.neverthrowImports.clear();
  }
}
