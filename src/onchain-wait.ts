export const TERMINAL_TRANSACTION_STATES = ['COMPLETE', 'FAILED', 'DENIED', 'CANCELLED'] as const;

export const INTERMEDIATE_TRANSACTION_STATES = [
  'INITIATED',
  'WAITING',
  'QUEUED',
  'CLEARED',
  'SENT',
  'STUCK',
  'CONFIRMED',
] as const;

export const SUCCESSFUL_TRANSACTION_STATE = 'COMPLETE';

export type TerminalTransactionState = (typeof TERMINAL_TRANSACTION_STATES)[number];

export type IntermediateTransactionState = (typeof INTERMEDIATE_TRANSACTION_STATES)[number];

export type TransactionState = TerminalTransactionState | IntermediateTransactionState;

export const DEFAULT_POLL_INTERVAL_MS = 2_000;

export const DEFAULT_POLL_TIMEOUT_MS = 180_000;

const TERMINAL_SET: ReadonlySet<string> = new Set(TERMINAL_TRANSACTION_STATES);

const INTERMEDIATE_SET: ReadonlySet<string> = new Set(INTERMEDIATE_TRANSACTION_STATES);

export function isTerminalTransactionState(state: string | undefined | null): state is TerminalTransactionState {
  return typeof state === 'string' && TERMINAL_SET.has(state);
}

export function isKnownTransactionState(state: string | undefined | null): state is TransactionState {
  return isTerminalTransactionState(state) || (typeof state === 'string' && INTERMEDIATE_SET.has(state));
}

export function isSuccessfulTransactionState(state: string | undefined | null): boolean {
  return state === SUCCESSFUL_TRANSACTION_STATE;
}

export class TransactionTimeoutError extends Error {
  readonly lastState: string | undefined;
  readonly timeoutMs: number;

  constructor(lastState: string | undefined, timeoutMs: number) {
    super(
      `Transaction did not reach a terminal state within ${Math.round(timeoutMs / 1000)}s ` +
        `(last state: ${lastState ?? 'unknown'}). Terminal states are ${TERMINAL_TRANSACTION_STATES.join(', ')}.`,
    );
    this.name = 'TransactionTimeoutError';
    this.lastState = lastState;
    this.timeoutMs = timeoutMs;
  }
}

export class TransactionFailedError extends Error {
  readonly state: TerminalTransactionState;

  constructor(state: TerminalTransactionState, label?: string) {
    super(`${label ?? 'Transaction'} reached terminal state ${state} instead of ${SUCCESSFUL_TRANSACTION_STATE}`);
    this.name = 'TransactionFailedError';
    this.state = state;
  }
}

export interface WaitForTerminalOptions {
  intervalMs?: number;
  timeoutMs?: number;

  onState?: (state: string | undefined, attempt: number) => void;

  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function pollUntilTerminal<T>(
  poll: () => Promise<T>,
  readState: (value: T) => string | undefined,
  options: WaitForTerminalOptions,
): Promise<{ value: T; state: TerminalTransactionState }> {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error(`Poll interval must be a positive number of milliseconds, got ${intervalMs}`);
  }

  const startedAt = now();
  let attempt = 0;
  let lastState: string | undefined;

  for (;;) {
    const value = await poll();
    lastState = readState(value);
    attempt += 1;
    options.onState?.(lastState, attempt);

    if (isTerminalTransactionState(lastState)) {
      return { value, state: lastState };
    }

    if (now() - startedAt >= timeoutMs) {
      throw new TransactionTimeoutError(lastState, timeoutMs);
    }

    await sleep(intervalMs);
  }
}

export async function waitForTerminal<T>(
  poll: () => Promise<T>,
  readState: (value: T) => string | undefined,
  options: WaitForTerminalOptions = {},
): Promise<T> {
  return (await pollUntilTerminal(poll, readState, options)).value;
}

export async function waitForTerminalState(
  poll: () => Promise<string | undefined>,
  options: WaitForTerminalOptions = {},
): Promise<TerminalTransactionState> {
  return (await pollUntilTerminal(poll, (value) => value, options)).state;
}

export function assertTransactionSucceeded(state: TerminalTransactionState, label?: string): void {
  if (!isSuccessfulTransactionState(state)) {
    throw new TransactionFailedError(state, label);
  }
}

export async function waitForSuccessfulTransaction<T>(
  poll: () => Promise<T>,
  readState: (value: T) => string | undefined,
  options: WaitForTerminalOptions & { label?: string } = {},
): Promise<T> {
  const { value, state } = await pollUntilTerminal(poll, readState, options);

  assertTransactionSucceeded(state, options.label);

  return value;
}
