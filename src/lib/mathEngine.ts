export type UnitMap = Record<string, number>;

export type Quantity = {
  value: number;
  units: UnitMap;
};

type BinaryOp = '+' | '-' | '*' | '/' | '^';

type ExprNode =
  | { type: 'number'; value: number }
  | { type: 'identifier'; name: string }
  | { type: 'unary'; op: '-'; child: ExprNode }
  | { type: 'binary'; op: BinaryOp; left: ExprNode; right: ExprNode }
  | { type: 'call'; name: string; args: ExprNode[] };

export type WorksheetRow = {
  id: string;
  assign: string;
  expr: string;
  outUnits: string;
};

export type RowEvaluation = {
  ok: boolean;
  valueText: string;
  error?: string;
};

type FunctionDef = {
  params: string[];
  body: ExprNode;
};

type EvalContext = {
  vars: Map<string, Quantity>;
  funcs: Map<string, FunctionDef>;
};

type UnitDef = {
  name: string;
  symbol: string;
  factor: number;
  result: UnitMap;
};

const SI_BASE = new Set(['m', 'kg', 's', 'A', 'K', 'mol', 'cd']);

const NON_SI_UNITS: UnitDef[] = [
  { name: 'feet', symbol: 'ft', factor: 0.3048, result: { m: 1 } },
  { name: 'newton', symbol: 'N', factor: 1, result: { kg: 1, m: 1, s: -2 } },
  { name: 'hertz', symbol: 'Hz', factor: 1, result: { s: -1 } },
  { name: 'pascal', symbol: 'Pa', factor: 1, result: { N: 1, m: -2 } },
  { name: 'joule', symbol: 'J', factor: 1, result: { N: 1, m: 1 } },
  { name: 'watt', symbol: 'W', factor: 1, result: { J: 1, s: -1 } },
  { name: 'coulomb', symbol: 'C', factor: 1, result: { s: 1, A: 1 } },
  { name: 'volt', symbol: 'V', factor: 1, result: { W: 1, A: -1 } },
  { name: 'ohm', symbol: 'ohm', factor: 1, result: { V: 1, A: -1 } },
  { name: 'inch', symbol: 'in', factor: 0.0254, result: { m: 1 } },
  { name: 'yard', symbol: 'yd', factor: 0.9144, result: { m: 1 } },
  { name: 'mile', symbol: 'mi', factor: 1609.344, result: { m: 1 } },
  { name: 'liter', symbol: 'L', factor: 0.001, result: { m: 3 } },
  { name: 'kilometer', symbol: 'km', factor: 1000, result: { m: 1 } },
  { name: 'bar', symbol: 'bar', factor: 100000, result: { Pa: 1 } },
  { name: 'standard atmosphere', symbol: 'atm', factor: 101325, result: { Pa: 1 } },
  { name: 'kilopascal', symbol: 'kPa', factor: 1000, result: { Pa: 1 } },
  { name: 'megapascal', symbol: 'MPa', factor: 1000000, result: { Pa: 1 } },
  { name: 'pound per square inch', symbol: 'psi', factor: 6894.757, result: { Pa: 1 } },
  { name: 'hectare', symbol: 'ha', factor: 10000, result: { m: 2 } },
  { name: 'acre', symbol: 'acre', factor: 4046.873, result: { m: 2 } },
  { name: 'electronvolt', symbol: 'eV', factor: 1.602177e-19, result: { J: 1 } },
  { name: 'calorie', symbol: 'cal', factor: 4.19002, result: { J: 1 } },
  { name: 'kilocalorie', symbol: 'kcal', factor: 4190.02, result: { J: 1 } },
  { name: 'gram', symbol: 'g', factor: 0.001, result: { kg: 1 } },
  { name: 'pound', symbol: 'lb', factor: 0.4535924, result: { kg: 1 } },
  { name: 'slug', symbol: 'slug', factor: 14.5939, result: { kg: 1 } },
  { name: 'kilowatt', symbol: 'kW', factor: 1000, result: { W: 1 } },
  { name: 'minute', symbol: 'min', factor: 60, result: { s: 1 } },
  { name: 'hour', symbol: 'hr', factor: 3600, result: { s: 1 } },
  { name: 'day', symbol: 'day', factor: 86400, result: { s: 1 } },
  { name: 'year', symbol: 'yr', factor: 31557600, result: { s: 1 } }
];

const UNIT_LOOKUP = new Map<string, UnitDef>(NON_SI_UNITS.map((u) => [u.symbol, u]));

export type PredefinedUnit = {
  name: string;
  symbol: string;
  category: 'SI' | 'Derived';
};

export const PREDEFINED_UNITS: PredefinedUnit[] = [
  ...Array.from(SI_BASE).map((symbol) => ({
    name: symbol,
    symbol,
    category: 'SI' as const
  })),
  ...NON_SI_UNITS.map((u) => ({
    name: u.name,
    symbol: u.symbol,
    category: 'Derived' as const
  }))
].sort((a, b) => a.symbol.localeCompare(b.symbol));

const BUILTIN_FUNCS = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sqrt',
  'log',
  'ln',
  'exp',
  'abs',
  'floor',
  'ceil',
  'round'
]);

class Parser {
  private text: string;
  private i = 0;

  constructor(text: string) {
    this.text = text.replace(/\s+/g, '');
  }

  parseExpression(): ExprNode {
    const node = this.parseAddSub();
    if (!this.atEnd()) {
      throw new Error(`Unexpected token near "${this.text.slice(this.i)}"`);
    }
    return node;
  }

  private parseAddSub(): ExprNode {
    let left = this.parseMulDiv();
    while (true) {
      if (this.match('+')) {
        left = { type: 'binary', op: '+', left, right: this.parseMulDiv() };
      } else if (this.match('-')) {
        left = { type: 'binary', op: '-', left, right: this.parseMulDiv() };
      } else {
        return left;
      }
    }
  }

  private parseMulDiv(): ExprNode {
    let left = this.parsePow();
    while (true) {
      if (this.match('*')) {
        left = { type: 'binary', op: '*', left, right: this.parsePow() };
        continue;
      }
      if (this.match('/')) {
        left = { type: 'binary', op: '/', left, right: this.parsePow() };
        continue;
      }
      if (this.shouldImplicitMultiply()) {
        left = { type: 'binary', op: '*', left, right: this.parsePow() };
        continue;
      }
      return left;
    }
  }

  private parsePow(): ExprNode {
    let left = this.parseUnary();
    while (this.match('^')) {
      left = { type: 'binary', op: '^', left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): ExprNode {
    if (this.match('-')) {
      return { type: 'unary', op: '-', child: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExprNode {
    if (this.match('(')) {
      const expr = this.parseAddSub();
      this.expect(')');
      return expr;
    }

    const number = this.parseNumber();
    if (number !== null) {
      return { type: 'number', value: number };
    }

    const ident = this.parseIdentifier();
    if (ident) {
      if (this.match('(')) {
        const args: ExprNode[] = [];
        if (!this.peek(')')) {
          while (true) {
            args.push(this.parseAddSub());
            if (!this.match(',')) {
              break;
            }
          }
        }
        this.expect(')');
        return { type: 'call', name: ident, args };
      }
      return { type: 'identifier', name: ident };
    }

    throw new Error(`Expected value near "${this.text.slice(this.i)}"`);
  }

  private parseNumber(): number | null {
    const start = this.i;
    let sawDigit = false;

    while (this.i < this.text.length) {
      const ch = this.text[this.i];
      if (ch >= '0' && ch <= '9') {
        sawDigit = true;
        this.i += 1;
        continue;
      }
      if (ch === '.') {
        this.i += 1;
        continue;
      }
      break;
    }

    if (!sawDigit) {
      this.i = start;
      return null;
    }

    const raw = this.text.slice(start, this.i);
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid number "${raw}"`);
    }
    return value;
  }

  private parseIdentifier(): string | null {
    const start = this.i;
    if (start >= this.text.length) {
      return null;
    }

    const first = this.text[start];
    if (!/[A-Za-z_]/.test(first)) {
      return null;
    }

    this.i += 1;
    while (this.i < this.text.length && /[A-Za-z0-9_]/.test(this.text[this.i])) {
      this.i += 1;
    }

    return this.text.slice(start, this.i);
  }

  private shouldImplicitMultiply(): boolean {
    if (this.i >= this.text.length) {
      return false;
    }
    const ch = this.text[this.i];
    return ch === '(' || /[A-Za-z0-9_]/.test(ch);
  }

  private match(token: string): boolean {
    if (this.text.startsWith(token, this.i)) {
      this.i += token.length;
      return true;
    }
    return false;
  }

  private expect(token: string): void {
    if (!this.match(token)) {
      throw new Error(`Expected "${token}"`);
    }
  }

  private peek(token: string): boolean {
    return this.text.startsWith(token, this.i);
  }

  private atEnd(): boolean {
    return this.i >= this.text.length;
  }
}

function cloneUnits(units: UnitMap): UnitMap {
  return { ...units };
}

function sameUnits(a: UnitMap, b: UnitMap): boolean {
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? 0) !== (b[key] ?? 0)) {
      return false;
    }
  }
  return true;
}

function normalizeUnits(units: UnitMap): UnitMap {
  const out: UnitMap = {};
  for (const [k, v] of Object.entries(units)) {
    if (v !== 0) {
      out[k] = v;
    }
  }
  return out;
}

function combineUnits(a: UnitMap, b: UnitMap, sign: 1 | -1): UnitMap {
  const out = cloneUnits(a);
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] ?? 0) + sign * v;
  }
  return normalizeUnits(out);
}

function mulUnitScalar(units: UnitMap, scalar: number): UnitMap {
  const out: UnitMap = {};
  for (const [k, v] of Object.entries(units)) {
    out[k] = v * scalar;
  }
  return normalizeUnits(out);
}

function quantity(value: number, units: UnitMap = {}): Quantity {
  return { value, units: normalizeUnits(units) };
}

function resolveUnitSymbol(symbol: string): Quantity | null {
  if (SI_BASE.has(symbol)) {
    return quantity(1, { [symbol]: 1 });
  }

  const def = UNIT_LOOKUP.get(symbol);
  if (!def) {
    return null;
  }

  let result = quantity(def.factor);
  for (const [sym, count] of Object.entries(def.result)) {
    const q = resolveUnitSymbol(sym);
    if (!q) {
      throw new Error(`Unknown base unit "${sym}" in unit definition`);
    }
    const powered = quantity(Math.pow(q.value, count), mulUnitScalar(q.units, count));
    result = mul(result, powered);
  }

  return result;
}

function add(a: Quantity, b: Quantity): Quantity {
  if (!sameUnits(a.units, b.units)) {
    throw new Error('Addition/subtraction requires matching units');
  }
  return quantity(a.value + b.value, a.units);
}

function sub(a: Quantity, b: Quantity): Quantity {
  if (!sameUnits(a.units, b.units)) {
    throw new Error('Addition/subtraction requires matching units');
  }
  return quantity(a.value - b.value, a.units);
}

function mul(a: Quantity, b: Quantity): Quantity {
  return quantity(a.value * b.value, combineUnits(a.units, b.units, 1));
}

function div(a: Quantity, b: Quantity): Quantity {
  return quantity(a.value / b.value, combineUnits(a.units, b.units, -1));
}

function pow(a: Quantity, b: Quantity): Quantity {
  if (Object.keys(b.units).length > 0) {
    throw new Error('Exponent must be unitless');
  }
  return quantity(Math.pow(a.value, b.value), mulUnitScalar(a.units, b.value));
}

function evalBuiltin(name: string, args: Quantity[]): Quantity {
  if (!BUILTIN_FUNCS.has(name)) {
    throw new Error(`Unknown function "${name}"`);
  }
  if (args.length !== 1) {
    throw new Error(`Function "${name}" expects exactly one argument`);
  }

  const arg = args[0];
  if (Object.keys(arg.units).length > 0) {
    throw new Error(`Function "${name}" cannot accept units`);
  }

  const fnName = name === 'ln' ? 'log' : name;
  const fn = (Math as unknown as Record<string, (x: number) => number>)[fnName];
  if (typeof fn !== 'function') {
    throw new Error(`Missing Math.${fnName}`);
  }
  return quantity(fn(arg.value));
}

function evaluate(node: ExprNode, ctx: EvalContext, locals?: Map<string, Quantity>): Quantity {
  switch (node.type) {
    case 'number':
      return quantity(node.value);
    case 'identifier': {
      const local = locals?.get(node.name);
      if (local) {
        return quantity(local.value, local.units);
      }
      const variable = ctx.vars.get(node.name);
      if (variable) {
        return quantity(variable.value, variable.units);
      }
      const unit = resolveUnitSymbol(node.name);
      if (unit) {
        return unit;
      }
      throw new Error(`Unknown symbol "${node.name}"`);
    }
    case 'unary': {
      const child = evaluate(node.child, ctx, locals);
      return quantity(-child.value, child.units);
    }
    case 'binary': {
      const left = evaluate(node.left, ctx, locals);
      const right = evaluate(node.right, ctx, locals);
      switch (node.op) {
        case '+':
          return add(left, right);
        case '-':
          return sub(left, right);
        case '*':
          return mul(left, right);
        case '/':
          return div(left, right);
        case '^':
          return pow(left, right);
      }
    }
    case 'call': {
      const args = node.args.map((a) => evaluate(a, ctx, locals));
      const func = ctx.funcs.get(node.name);
      if (!func) {
        return evalBuiltin(node.name, args);
      }
      if (func.params.length !== args.length) {
        throw new Error(`Function "${node.name}" expects ${func.params.length} arguments`);
      }
      const scopedLocals = new Map<string, Quantity>(locals);
      for (let i = 0; i < func.params.length; i += 1) {
        scopedLocals.set(func.params[i], args[i]);
      }
      return evaluate(func.body, ctx, scopedLocals);
    }
  }
}

function formatUnits(units: UnitMap): string {
  const parts = Object.entries(units)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sym, power]) => (power === 1 ? sym : `${sym}${round(power, 4)}`));

  return parts.join(' ');
}

export function formatQuantity(q: Quantity): string {
  const rounded = round(q.value, 6);
  const unitText = formatUnits(q.units);
  return unitText ? `${rounded} ${unitText}` : `${rounded}`;
}

export function parseAssign(assign: string):
  | { kind: 'none' }
  | { kind: 'var'; name: string }
  | { kind: 'func'; name: string; params: string[] } {
  const trimmed = assign.trim();
  if (!trimmed) {
    return { kind: 'none' };
  }

  const funcMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)$/);
  if (funcMatch) {
    const paramsRaw = funcMatch[2].trim();
    const params = paramsRaw
      ? paramsRaw.split(',').map((p) => p.trim()).filter(Boolean)
      : [];
    for (const p of params) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(p)) {
        throw new Error(`Invalid function parameter "${p}"`);
      }
    }
    return { kind: 'func', name: funcMatch[1], params };
  }

  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    return { kind: 'var', name: trimmed };
  }

  throw new Error('Assignment must be a variable name or function signature (e.g. f(x))');
}

function parseExpr(text: string): ExprNode {
  return new Parser(text).parseExpression();
}

export function evaluateWorksheet(rows: WorksheetRow[]): RowEvaluation[] {
  const ctx: EvalContext = {
    vars: new Map<string, Quantity>(),
    funcs: new Map<string, FunctionDef>()
  };

  return rows.map((row) => {
    const expression = row.expr.trim();
    if (!expression) {
      return { ok: true, valueText: '' };
    }

    try {
      const assignment = parseAssign(row.assign);
      const exprAst = parseExpr(expression);
      if (assignment.kind === 'func') {
        ctx.funcs.set(assignment.name, {
          params: assignment.params,
          body: exprAst
        });
        return { ok: true, valueText: '' };
      }

      const value = evaluate(exprAst, ctx);

      if (assignment.kind === 'var') {
        ctx.vars.set(assignment.name, value);
      }

      let shown = value;
      const outUnits = row.outUnits.trim();
      if (outUnits) {
        const outAst = parseExpr(outUnits);
        const desired = evaluate(outAst, ctx);
        shown = quantity(value.value / desired.value, combineUnits(value.units, desired.units, -1));
      }

      return { ok: true, valueText: formatQuantity(shown) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Evaluation failed';
      return { ok: false, valueText: '', error: message };
    }
  });
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
