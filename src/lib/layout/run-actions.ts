import {
  closeRunInput,
  compileCode,
  pollRunSession,
  sendRunInput,
  startRunSession,
  stopRunSession,
  traceCode
} from '$lib/api';
import {
  currentStepIndex,
  errorMessage,
  isCompiling,
  isPlaying,
  isRunning,
  lastBinaryPath,
  lastCompileResult,
  lastExecutionResult,
  runConsoleTranscript,
  runSessionId,
  selectedLanguage,
  traceSteps
} from '$lib/stores';
import { get } from 'svelte/store';
import { validateCompileRequest, validateTraceRequest } from '$lib/validation';
import type { LanguageId } from '$lib/languages';

interface CompileRunActionParams {
  code: string;
}

interface TraceActionParams {
  code: string;
  breakpoints?: number[];
}

interface TraceActionResult {
  traceErr: string | null;
}

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function hasNonGlobalFrame(step: { stackFrames?: Array<{ name?: unknown }> }): boolean {
  if (!Array.isArray(step.stackFrames)) return false;
  return step.stackFrames.some((frame) => {
    if (!frame || typeof frame !== 'object') return false;
    const name = typeof frame.name === 'string' ? frame.name.trim().toLowerCase() : '';
    return name !== '' && name !== 'global';
  });
}

function getInitialTraceStepIndex(steps: Array<{ stackFrames?: Array<{ name?: unknown }> }>): number {
  const firstExecutableFrame = steps.findIndex((step) => hasNonGlobalFrame(step));
  if (firstExecutableFrame >= 0) {
    return firstExecutableFrame;
  }

  const firstWithFrames = steps.findIndex(
    (step) => Array.isArray(step.stackFrames) && step.stackFrames.length > 0
  );
  return firstWithFrames >= 0 ? firstWithFrames : 0;
}

const RUN_POLL_INTERVAL_MS = 120;
let activeRunSessionId: string | null = null;
let activeRunOutputCursor = '';
let activeRunInputClosed = false;
let lastCompiledSource = '';
let lastCompiledLanguage: LanguageId = 'c';

function getCurrentLanguage(): LanguageId {
  return get(selectedLanguage);
}

function ensureCSupported(actionLabel: 'compile' | 'run' | 'trace'): boolean {
  const language = getCurrentLanguage();
  if (language === 'c') {
    return true;
  }

  errorMessage.set(
    `${language.toUpperCase()} ${actionLabel} is not available yet. Switch language to C for now.`
  );
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runCompileAction({
  code
}: CompileRunActionParams): Promise<void> {
  try {
    if (!ensureCSupported('compile')) {
      return;
    }

    const language = getCurrentLanguage();
    const validationError = validateCompileRequest(code);
    if (validationError) {
      errorMessage.set(validationError);
      return;
    }

    if (activeRunSessionId) {
      await stopRunSession(activeRunSessionId).catch(() => {});
      activeRunSessionId = null;
      runSessionId.set(null);
    }

    errorMessage.set(null);
    runSessionId.set(null);
    lastExecutionResult.set(null);
    runConsoleTranscript.set('');
    activeRunOutputCursor = '';
    activeRunInputClosed = false;

    isCompiling.set(true);
    const compileResult = await compileCode({ code, language });
    lastCompileResult.set(compileResult);
    isCompiling.set(false);

    if (!compileResult.success) {
      lastBinaryPath.set(null);
      lastCompiledSource = '';
      errorMessage.set(compileResult.errors.join('\n'));
      return;
    }

    if (!compileResult.binary) {
      lastBinaryPath.set(null);
      lastCompiledSource = '';
      errorMessage.set('Compilation succeeded, but no executable binary was returned.');
      return;
    }

    lastBinaryPath.set(compileResult.binary);
    lastCompiledSource = code;
    lastCompiledLanguage = language;
  } catch (err) {
    const message = getErrorMessage(err, 'An error occurred');
    errorMessage.set(message);
    console.error('Compile error:', err);
  } finally {
    isCompiling.set(false);
  }
}

export async function runRunAction({
  code
}: CompileRunActionParams): Promise<void> {
  let startedSessionId: string | null = null;

  try {
    if (!ensureCSupported('run')) {
      return;
    }

    const language = getCurrentLanguage();
    const validationError = validateCompileRequest(code);
    if (validationError) {
      errorMessage.set(validationError);
      return;
    }

    if (activeRunSessionId) {
      await stopRunSession(activeRunSessionId).catch(() => {});
      activeRunSessionId = null;
      runSessionId.set(null);
    }

    const compileResult = get(lastCompileResult);
    const binaryPath = get(lastBinaryPath);

    if (!compileResult?.success || !binaryPath) {
      errorMessage.set('Compile first, then run.');
      return;
    }

    if (lastCompiledSource !== code) {
      errorMessage.set('Code changed after the last compile. Compile again before running.');
      return;
    }

    if (lastCompiledLanguage !== language) {
      errorMessage.set('Language changed after compile. Compile again before running.');
      return;
    }

    isRunning.set(true);
    errorMessage.set(null);
    runSessionId.set(null);
    runConsoleTranscript.set('');
    activeRunOutputCursor = '';
    activeRunInputClosed = false;

    const runStart = await startRunSession({
      binaryPath,
      args: []
    });
    if (!runStart.sessionId) {
      throw new Error('Run session failed to start');
    }

    startedSessionId = runStart.sessionId;
    activeRunSessionId = runStart.sessionId;
    activeRunOutputCursor = '';
    activeRunInputClosed = false;
    runSessionId.set(runStart.sessionId);
    lastExecutionResult.set({
      stdout: '',
      stderr: '',
      exitCode: 0,
      executionTime: 0
    });

    while (activeRunSessionId === startedSessionId) {
      const poll = await pollRunSession(startedSessionId);
      const mergedOutput = poll.output ?? `${poll.stdout}${poll.stderr}`;

      if (mergedOutput.startsWith(activeRunOutputCursor)) {
        const delta = mergedOutput.slice(activeRunOutputCursor.length);
        if (delta) {
          runConsoleTranscript.update((prev) => `${prev}${delta}`);
        }
      } else if (mergedOutput !== activeRunOutputCursor) {
        runConsoleTranscript.set(mergedOutput);
      }
      activeRunOutputCursor = mergedOutput;

      lastExecutionResult.set({
        stdout: poll.stdout,
        stderr: poll.stderr,
        exitCode: poll.done ? (poll.exitCode ?? 1) : 0,
        executionTime: poll.executionTime
      });

      if (poll.done) {
        activeRunSessionId = null;
        activeRunInputClosed = false;
        activeRunOutputCursor = '';
        runSessionId.set(null);
        if ((poll.exitCode ?? 1) !== 0 && poll.stderr) {
          errorMessage.set(poll.stderr);
        }
        break;
      }

      await delay(RUN_POLL_INTERVAL_MS);
    }
  } catch (err) {
    const message = getErrorMessage(err, 'An error occurred');
    errorMessage.set(message);
    console.error('Run error:', err);

    if (startedSessionId) {
      await stopRunSession(startedSessionId).catch(() => {});
      if (activeRunSessionId === startedSessionId) {
        activeRunSessionId = null;
      }
      activeRunInputClosed = false;
      activeRunOutputCursor = '';
      runSessionId.set(null);
    }
  } finally {
    isRunning.set(false);
  }
}

export async function runCompileAndRunAction({
  code
}: CompileRunActionParams): Promise<void> {
  await runCompileAction({ code });
  const compileResult = get(lastCompileResult);
  if (compileResult?.success) {
    await runRunAction({ code });
  }
}

export async function sendRuntimeInputLine(line: string): Promise<void> {
  const sessionId = activeRunSessionId;
  if (!sessionId) {
    throw new Error('No active run session');
  }

  if (activeRunInputClosed) {
    throw new Error('Program stdin is closed (EOF already sent)');
  }

  const payload = line.endsWith('\n') ? line : `${line}\n`;
  await sendRunInput({
    sessionId,
    input: payload
  });
}

export async function sendRuntimeEof(): Promise<void> {
  const sessionId = activeRunSessionId;
  if (!sessionId) {
    throw new Error('No active run session');
  }

  if (activeRunInputClosed) {
    return;
  }

  await closeRunInput(sessionId);
  activeRunInputClosed = true;
}

export async function interruptRuntimeSession(): Promise<void> {
  const sessionId = activeRunSessionId;
  if (!sessionId) {
    return;
  }

  activeRunSessionId = null;
  activeRunInputClosed = false;
  activeRunOutputCursor = '';
  runSessionId.set(null);
  runConsoleTranscript.update((prev) => `${prev}^C\n`);

  await stopRunSession(sessionId).catch(() => {});
}

export async function runTraceAction({
  code,
  breakpoints = []
}: TraceActionParams): Promise<TraceActionResult> {
  try {
    if (!ensureCSupported('trace')) {
      return { traceErr: `Trace is currently available only for C.` };
    }

    isPlaying.set(false);

    const validationError = validateTraceRequest(code);
    if (validationError) {
      errorMessage.set(validationError);
      traceSteps.set([]);
      currentStepIndex.set(0);
      return { traceErr: validationError };
    }

    errorMessage.set(null);

    const result = await traceCode({
      code,
      breakpoints
    });

    if (result.success) {
      traceSteps.set(result.steps);
      currentStepIndex.set(getInitialTraceStepIndex(result.steps));
      return { traceErr: null };
    }

    const traceErr = result.errors.join('\n') || 'Trace failed';
    traceSteps.set([]);
    currentStepIndex.set(0);
    errorMessage.set(traceErr);
    return { traceErr };
  } catch (err) {
    const message = getErrorMessage(err, 'An error occurred during tracing');
    console.error('Trace error:', err);
    traceSteps.set([]);
    currentStepIndex.set(0);
    errorMessage.set(message);
    return { traceErr: message };
  }
}
