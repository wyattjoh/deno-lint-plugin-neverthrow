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
 * Checks if a node is an identifier that might be a Result by examining if the
 * identifier name contains common neverthrow import patterns.
 *
 * @param node - The AST node to check
 * @returns True if the node is an identifier that might represent a Result
 */
export function isResultIdentifier(node: Deno.lint.Node): boolean {
  return (
    node.type === "Identifier" &&
    NEVERTHROW_IMPORTS.some((name) => node.name?.includes(name))
  );
}

/**
 * Checks if a node is a call expression that creates a Result instance.
 * This includes both constructor calls (new Ok(), new Err()) and factory
 * function calls (ok(), err(), okAsync(), errAsync()).
 *
 * @param node - The AST node to check
 * @returns True if the node creates a Result instance
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
 * Checks if a member expression is calling a method that belongs to the Result type.
 * This includes both handling methods (match, unwrapOr, _unsafeUnwrap) and
 * transformation methods (map, mapErr, andThen, etc.).
 *
 * @param node - The AST node to check
 * @returns True if the node is calling a Result method
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
 * Checks if a method call is a Result handling method that properly consumes
 * the Result (match, unwrapOr, _unsafeUnwrap). These methods indicate that
 * the Result has been properly handled.
 *
 * @param node - The AST node to check
 * @returns True if the node is calling a Result handling method
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
 * Extracts the method name from a member expression node.
 * This utility function safely extracts the property name from expressions
 * like 'obj.methodName'.
 *
 * @param node - The AST node to extract the method name from
 * @returns The method name if it's an identifier, null otherwise
 */
export function getMethodName(node: Deno.lint.Node): string | null {
  if (node.type !== "MemberExpression") {
    return null;
  }

  const property = node.property;
  return property.type === "Identifier" ? property.name : null;
}

/**
 * Checks if a node is likely a Result based on method chaining patterns.
 * This function analyzes method call chains to detect Result-like patterns
 * by counting Result-specific method calls in the chain.
 *
 * @param node - The AST node to analyze
 * @returns True if the node appears to be part of a Result method chain
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
 * Checks if a node is in a return context (return statement or arrow function body).
 * Results that are returned from functions are considered properly handled since
 * they delegate the responsibility to the caller.
 *
 * @param node - The expression node to check
 * @returns True if the node is in a return context
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
 * Tracks imported neverthrow identifiers from import statements.
 * This class maintains a registry of identifiers imported from the neverthrow
 * package to accurately identify neverthrow-specific Result factory functions.
 */
export class ImportTracker {
  private neverthrowImports = new Set<string>();

  /**
   * Tracks import declarations from the neverthrow package.
   * This method analyzes import statements and registers all identifiers
   * imported from 'neverthrow' for later reference.
   *
   * @param node - The import declaration node to process
   */
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

  /**
   * Checks if a given identifier name was imported from neverthrow.
   *
   * @param name - The identifier name to check
   * @returns True if the name was imported from neverthrow
   */
  isNeverthrowImport(name: string): boolean {
    return this.neverthrowImports.has(name);
  }

  /**
   * Clears all tracked neverthrow imports.
   * This method is typically called at the start of processing each file.
   */
  clear(): void {
    this.neverthrowImports.clear();
  }
}
