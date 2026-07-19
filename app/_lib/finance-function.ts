import {
  CellError,
  ErrorType,
  FunctionArgumentType,
  FunctionPlugin,
  HyperFormula,
  type FunctionPluginDefinition,
} from 'hyperformula';

/**
 * FINANCE(base, quote) — the GOOGLEFINANCE-alternative (currency conversion
 * only in MVP; see SPEC.md's "The FINANCE() function"). HyperFormula custom
 * functions are synchronous, so the actual Frankfurter fetch happens outside
 * the engine (a server action) and this plugin just reads from a
 * module-level cache populated ahead of time — see
 * `WorkbookView`'s `resolveFinanceFormulas`.
 */

const rateStore = new Map<string, number>();

export function pairKey(base: string, quote: string): string {
  return `${base.trim().toUpperCase()}/${quote.trim().toUpperCase()}`;
}

export function setCachedRate(base: string, quote: string, rate: number): void {
  rateStore.set(pairKey(base, quote), rate);
}

export function getCachedRate(base: string, quote: string): number | undefined {
  return rateStore.get(pairKey(base, quote));
}

/** Extracts distinct (base, quote) pairs referenced by `FINANCE(...)` in a raw formula string. */
export function extractFinancePairs(formula: string): { base: string; quote: string }[] {
  const pairs: { base: string; quote: string }[] = [];
  const re = /FINANCE\(\s*"([A-Za-z]{3})"\s*,\s*"([A-Za-z]{3})"\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(formula)) !== null) {
    const base = match[1];
    const quote = match[2];
    if (base && quote) pairs.push({ base, quote });
  }
  return pairs;
}

// HyperFormula doesn't export ProcedureAst/InterpreterState from its package root.
class FinanceFunctionPlugin extends FunctionPlugin {
  static override implementedFunctions = {
    FINANCE: {
      method: 'finance',
      parameters: [
        { argumentType: FunctionArgumentType.STRING },
        { argumentType: FunctionArgumentType.STRING },
      ],
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see class comment
  finance(ast: any, state: any) {
    return this.runFunction(ast.args, state, this.metadata('FINANCE'), (base: string, quote: string) => {
      if (base.trim().toUpperCase() === quote.trim().toUpperCase()) return 1;
      const rate = getCachedRate(base, quote);
      return rate ?? new CellError(ErrorType.NA, 'Rate not loaded yet');
    });
  }
}

let registered = false;

/** Registers the FINANCE() function once, globally, ahead of building any engine instance. */
export function ensureFinanceFunctionRegistered(): void {
  if (registered) return;
  HyperFormula.registerFunctionPlugin(FinanceFunctionPlugin as unknown as FunctionPluginDefinition, {
    // Config default language (see Config.d.ts) — custom functions need an
    // explicit translation entry even for their own canonical name, or the
    // parser won't resolve them and every call reports #NAME?.
    enGB: { FINANCE: 'FINANCE' },
  });
  registered = true;
}
