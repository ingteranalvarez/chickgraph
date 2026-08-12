import { parse, type MathNode } from "mathjs";

import { MAX_ABSOLUTE_VALUE, MAX_EXPRESSION_LENGTH } from "./constants";

const unaryOperators: Record<string, (value: number) => number> = {
  "+": (value) => value,
  "-": (value) => -value,
};

const binaryOperators: Record<string, (left: number, right: number) => number> = {
  "+": (left, right) => left + right,
  "-": (left, right) => left - right,
  "*": (left, right) => left * right,
  "/": (left, right) => left / right,
  "^": (left, right) => left ** right,
};

const functions: Record<string, (value: number) => number> = {
  abs: Math.abs,
  cos: Math.cos,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
};

interface ConstantLike extends MathNode {
  value: unknown;
}

interface OperatorLike extends MathNode {
  op: string;
  args: MathNode[];
}

interface ParenthesisLike extends MathNode {
  content: MathNode;
}

interface SymbolLike extends MathNode {
  name: string;
}

interface FunctionLike extends MathNode {
  fn: SymbolLike;
  args: MathNode[];
}

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

function finiteResult(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_ABSOLUTE_VALUE) {
    return Number.NaN;
  }

  return value;
}

function validateNode(node: MathNode): void {
  switch (node.type) {
    case "ConstantNode": {
      const value = Number((node as ConstantLike).value);
      if (!Number.isFinite(value)) {
        throw new ExpressionError("Only finite numeric constants are allowed.");
      }
      return;
    }
    case "SymbolNode": {
      if ((node as SymbolLike).name !== "x") {
        throw new ExpressionError("The only variable you can use is x.");
      }
      return;
    }
    case "ParenthesisNode":
      validateNode((node as ParenthesisLike).content);
      return;
    case "OperatorNode": {
      const operator = node as OperatorLike;
      const allowed =
        (operator.args.length === 1 && operator.op in unaryOperators) ||
        (operator.args.length === 2 && operator.op in binaryOperators);
      if (!allowed) {
        throw new ExpressionError(`Operator ${operator.op} is not allowed.`);
      }
      operator.args.forEach(validateNode);
      return;
    }
    case "FunctionNode": {
      const functionNode = node as FunctionLike;
      const name = functionNode.fn.name;
      if (!(name in functions) || functionNode.args.length !== 1) {
        throw new ExpressionError(`Function ${name} is not allowed.`);
      }
      functionNode.args.forEach(validateNode);
      return;
    }
    default:
      throw new ExpressionError(`${node.type} is not allowed.`);
  }
}

function evaluateNode(node: MathNode, x: number): number {
  switch (node.type) {
    case "ConstantNode":
      return Number((node as ConstantLike).value);
    case "SymbolNode":
      return x;
    case "ParenthesisNode":
      return evaluateNode((node as ParenthesisLike).content, x);
    case "OperatorNode": {
      const operator = node as OperatorLike;
      const values = operator.args.map((argument) => evaluateNode(argument, x));
      if (values.some((value) => !Number.isFinite(value))) {
        return Number.NaN;
      }
      const operation =
        values.length === 1
          ? unaryOperators[operator.op]
          : binaryOperators[operator.op];
      return finiteResult(operation(...(values as [number, number])));
    }
    case "FunctionNode": {
      const functionNode = node as FunctionLike;
      return finiteResult(
        functions[functionNode.fn.name](evaluateNode(functionNode.args[0], x)),
      );
    }
    default:
      return Number.NaN;
  }
}

export interface ParsedExpression {
  source: string;
  evaluate: (x: number) => number;
}

export function parseExpression(source: string): ParsedExpression {
  const normalized = source.trim();
  if (!normalized) {
    throw new ExpressionError("Enter a function before firing.");
  }
  if (normalized.length > MAX_EXPRESSION_LENGTH) {
    throw new ExpressionError(
      `Functions are limited to ${MAX_EXPRESSION_LENGTH} characters.`,
    );
  }

  let root: MathNode;
  try {
    root = parse(normalized);
  } catch {
    throw new ExpressionError("That function could not be parsed.");
  }

  validateNode(root);

  return {
    source: normalized,
    evaluate: (x) => finiteResult(evaluateNode(root, x)),
  };
}
