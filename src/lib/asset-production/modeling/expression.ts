/**
 * The bounded expression language of a parametric model: numbers, `$parameter` references,
 * `+ - * /`, parentheses, unary minus, `pi`, a closed set of functions, and — inside a
 * `heightfield` only — the coordinates `x` and `y`.
 *
 *   "$width / 2 - $wall"      "max($r, 2) * 1.5"      "3 * sin(x / 8) * cos(y / 8)"
 *
 * A hand-written recursive-descent parser: no `eval`, no `Function`, no property access, no
 * strings, no assignment, no loops. Length, token count and nesting depth are capped
 * (`MODELING_LIMITS`), so parsing and evaluating cost O(length). Parsing happens once per
 * expression; a `heightfield` evaluates the compiled tree per grid point.
 */
import { MODELING_LIMITS } from '#lib/schemas/parametric-model.ts';

/** One-argument and two-argument functions, radians in and out. */
const UNARY: Record<string, (a: number) => number> = {
	abs: Math.abs,
	sqrt: Math.sqrt,
	sin: Math.sin,
	cos: Math.cos,
	tan: Math.tan,
	floor: Math.floor,
	round: Math.round,
};
const BINARY: Record<string, (a: number, b: number) => number> = {
	min: Math.min,
	max: Math.max,
	pow: Math.pow,
};

export type ExpressionVariable = 'x' | 'y';

/** A compiled expression: evaluate with the coordinates it was allowed to read. */
export type CompiledExpression = (variables?: Partial<Record<ExpressionVariable, number>>) => number;

export class ExpressionError extends Error {}

type Token =
	| { kind: 'number'; value: number }
	| { kind: 'parameter'; name: string }
	| { kind: 'identifier'; name: string }
	| { kind: 'symbol'; value: '+' | '-' | '*' | '/' | '(' | ')' | ',' };

function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < source.length) {
		const char = source[i];
		if (char === ' ') {
			i++;
			continue;
		}
		if ('+-*/(),'.includes(char)) {
			tokens.push({ kind: 'symbol', value: char as '+' });
			i++;
		} else if (/[0-9.]/.test(char)) {
			const match = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(source.slice(i));
			if (!match) throw new ExpressionError(`bad number at ${i}`);
			tokens.push({ kind: 'number', value: Number(match[0]) });
			i += match[0].length;
		} else if (char === '$') {
			const match = /^\$([a-z][a-zA-Z0-9_]{0,31})/.exec(source.slice(i));
			if (!match) throw new ExpressionError(`bad parameter reference at ${i}`);
			tokens.push({ kind: 'parameter', name: match[1] });
			i += match[0].length;
		} else if (/[a-z]/.test(char)) {
			const match = /^[a-z][a-z0-9]*/.exec(source.slice(i));
			tokens.push({ kind: 'identifier', name: (match as RegExpExecArray)[0] });
			i += (match as RegExpExecArray)[0].length;
		} else {
			throw new ExpressionError(`unexpected "${char}" at ${i}`);
		}
		if (tokens.length > MODELING_LIMITS.maxExpressionTokens) {
			throw new ExpressionError(`more than ${MODELING_LIMITS.maxExpressionTokens} tokens`);
		}
	}
	return tokens;
}

type Node = (vars: Partial<Record<ExpressionVariable, number>>) => number;

/**
 * Compile `source`. `parameters` are resolved now (an unknown `$name` is an error here, not at
 * evaluation); `variables` lists the coordinates the expression may read.
 */
export function compileExpression(
	source: string,
	parameters: Readonly<Record<string, number>>,
	variables: readonly ExpressionVariable[] = [],
): CompiledExpression {
	if (source.length > MODELING_LIMITS.maxExpressionLength) {
		throw new ExpressionError(`longer than ${MODELING_LIMITS.maxExpressionLength} characters`);
	}
	const tokens = tokenize(source);
	let position = 0;
	let depth = 0;
	const peek = () => tokens[position];
	const isSymbol = (token: Token | undefined, value: string) => token?.kind === 'symbol' && token.value === value;
	const expect = (value: string) => {
		if (!isSymbol(peek(), value)) throw new ExpressionError(`expected "${value}"`);
		position++;
	};
	const nest = <T>(parse: () => T): T => {
		if (++depth > MODELING_LIMITS.maxExpressionDepth) {
			throw new ExpressionError(`nested deeper than ${MODELING_LIMITS.maxExpressionDepth}`);
		}
		const result = parse();
		depth--;
		return result;
	};

	const sum = (): Node => {
		let left = product();
		while (isSymbol(peek(), '+') || isSymbol(peek(), '-')) {
			const plus = isSymbol(tokens[position++], '+');
			const right = product();
			const l = left;
			left = plus ? (vars) => l(vars) + right(vars) : (vars) => l(vars) - right(vars);
		}
		return left;
	};
	const product = (): Node => {
		let left = unary();
		while (isSymbol(peek(), '*') || isSymbol(peek(), '/')) {
			const times = isSymbol(tokens[position++], '*');
			const right = unary();
			const l = left;
			left = times ? (vars) => l(vars) * right(vars) : (vars) => l(vars) / right(vars);
		}
		return left;
	};
	const unary = (): Node => {
		if (isSymbol(peek(), '-')) {
			position++;
			const inner = nest(unary);
			return (vars) => -inner(vars);
		}
		return primary();
	};
	const primary = (): Node => {
		const token = tokens[position++];
		if (!token) throw new ExpressionError('unexpected end');
		if (token.kind === 'number') {
			const value = token.value;
			return () => value;
		}
		if (token.kind === 'parameter') {
			if (!Object.hasOwn(parameters, token.name)) throw new ExpressionError(`unknown parameter $${token.name}`);
			const value = parameters[token.name];
			return () => value;
		}
		if (token.kind === 'identifier') {
			const name = token.name;
			if (name === 'pi') return () => Math.PI;
			if (name === 'x' || name === 'y') {
				if (!variables.includes(name)) throw new ExpressionError(`"${name}" is only available in a heightfield`);
				return (vars) => vars[name] ?? 0;
			}
			const unaryFn = Object.hasOwn(UNARY, name) ? UNARY[name] : undefined;
			const binaryFn = Object.hasOwn(BINARY, name) ? BINARY[name] : undefined;
			if (!unaryFn && !binaryFn) throw new ExpressionError(`unknown function "${name}"`);
			expect('(');
			const first = nest(sum);
			if (unaryFn) {
				expect(')');
				return (vars) => unaryFn(first(vars));
			}
			expect(',');
			const second = nest(sum);
			expect(')');
			const fn = binaryFn as (a: number, b: number) => number;
			return (vars) => fn(first(vars), second(vars));
		}
		if (isSymbol(token, '(')) {
			const inner = nest(sum);
			expect(')');
			return inner;
		}
		throw new ExpressionError(`unexpected "${(token as { value: string }).value}"`);
	};

	const root = sum();
	if (position !== tokens.length) throw new ExpressionError('unexpected trailing input');
	return (vars = {}) => root(vars);
}
