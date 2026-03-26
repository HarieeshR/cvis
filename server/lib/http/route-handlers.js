import { getGccHealthDetails } from '../gcc-path.js';
import { compileC } from '../compile-c.js';
import { runBinary } from '../run-binary.js';
import {
  closeRunInput,
  pollRunSession,
  sendRunInput,
  startRunSession,
  stopRunSession
} from '../run-session.js';
import { traceExecution } from '../c-interpreter.js';
import { analyzeProgramIntent } from '../program-intent-ml.js';
import {
  getErrorMessage,
  getLanguageLabel,
  normalizeArgs,
  normalizeBinaryPath,
  normalizeBreakpoints,
  normalizeInput,
  normalizeJsonBody,
  validateCode
} from './request-validation.js';
import {
  analyzeServerErrorResponse,
  analyzeValidationResponse,
  compileServerErrorResponse,
  compileValidationResponse,
  runServerErrorResponse,
  runValidationResponse,
  traceServerErrorResponse,
  traceValidationResponse
} from './route-responses.js';

export async function healthHandler(_req, res) {
  const gcc = await getGccHealthDetails();
  res.json({
    status: 'ok',
    ...gcc,
    environment: process.env.DOCKER_ENV ? 'docker' : 'local',
    timestamp: new Date().toISOString()
  });
}

export async function compileHandler(req, res) {
  const bodyResult = normalizeJsonBody(req.body);
  if (bodyResult.error) {
    return res.status(400).json(compileValidationResponse(bodyResult.error));
  }

  const { code, language } = bodyResult.value;
  const codeError = validateCode(code);

  if (codeError) {
    return res.status(400).json(compileValidationResponse(codeError));
  }

  const languageLabel = getLanguageLabel(language);
  console.log(`Compiling ${Buffer.byteLength(code, 'utf8')} bytes of ${languageLabel} code...`);

  try {
    const result = await compileC(code);

    if (result.success) {
      console.log(`✓ Compilation successful in ${result.compilationTime}ms`);
    } else {
      console.log(`✗ Compilation failed: ${result.errors[0]}`);
    }

    return res.json(result);
  } catch (err) {
    console.error('Compilation error:', err);
    return res.status(500).json(compileServerErrorResponse(getErrorMessage(err)));
  }
}

export async function runHandler(req, res) {
  const bodyResult = normalizeJsonBody(req.body);
  if (bodyResult.error) {
    return res.status(400).json(runValidationResponse(bodyResult.error));
  }

  const { binaryPath, args, input } = bodyResult.value;

  const binaryPathResult = normalizeBinaryPath(binaryPath);
  if (binaryPathResult.error) {
    return res.status(400).json(runValidationResponse(binaryPathResult.error, 'No binary path provided'));
  }

  const argsResult = normalizeArgs(args);
  if (argsResult.error) {
    return res.status(400).json(runValidationResponse(argsResult.error, 'Invalid args'));
  }

  const inputResult = normalizeInput(input);
  if (inputResult.error) {
    return res.status(400).json(runValidationResponse(inputResult.error, 'Invalid input'));
  }

  console.log(`Executing binary: ${binaryPathResult.value}`);

  try {
    const result = await runBinary(binaryPathResult.value, argsResult.value, inputResult.value);

    if (result.exitCode === 0) {
      console.log(`✓ Execution successful in ${result.executionTime}ms`);
    } else {
      console.log(`✗ Execution failed with exit code ${result.exitCode}`);
    }

    return res.json(result);
  } catch (err) {
    console.error('Execution error:', err);
    return res.status(500).json(runServerErrorResponse(getErrorMessage(err)));
  }
}

export async function runStartHandler(req, res) {
  const bodyResult = normalizeJsonBody(req.body);
  if (bodyResult.error) {
    return res.status(400).json({ success: false, error: bodyResult.error });
  }

  const { binaryPath, args } = bodyResult.value;
  const binaryPathResult = normalizeBinaryPath(binaryPath);
  if (binaryPathResult.error) {
    return res.status(400).json({ success: false, error: binaryPathResult.error });
  }

  const argsResult = normalizeArgs(args);
  if (argsResult.error) {
    return res.status(400).json({ success: false, error: argsResult.error });
  }

  try {
    const result = await startRunSession(binaryPathResult.value, argsResult.value);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
}

export function runPollHandler(req, res) {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'sessionId query parameter is required' });
  }

  const result = pollRunSession(sessionId);
  if (!result.found) {
    return res.status(404).json({ success: false, error: result.error });
  }

  return res.json({
    success: true,
    sessionId: result.sessionId,
    status: result.status,
    output: result.output,
    stdout: result.stdout,
    stderr: result.stderr,
    done: result.done,
    exitCode: result.exitCode,
    executionTime: result.executionTime,
    peakMemoryBytes: result.peakMemoryBytes,
    inputClosed: result.inputClosed,
    timedOut: result.timedOut,
    outputLimitHit: result.outputLimitHit,
    stopRequested: result.stopRequested,
    completionReason: result.completionReason,
    exitSignal: result.exitSignal
  });
}

export function runInputHandler(req, res) {
  const bodyResult = normalizeJsonBody(req.body);
  if (bodyResult.error) {
    return res.status(400).json({ success: false, error: bodyResult.error });
  }

  const { sessionId, input } = bodyResult.value;
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return res.status(400).json({ success: false, error: 'sessionId is required' });
  }

  const result = sendRunInput(sessionId, input);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
}

export function runEofHandler(req, res) {
  const bodyResult = normalizeJsonBody(req.body);
  if (bodyResult.error) {
    return res.status(400).json({ success: false, error: bodyResult.error });
  }

  const { sessionId } = bodyResult.value;
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return res.status(400).json({ success: false, error: 'sessionId is required' });
  }

  const result = closeRunInput(sessionId);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
}

export function runStopHandler(req, res) {
  const bodyResult = normalizeJsonBody(req.body);
  if (bodyResult.error) {
    return res.status(400).json({ success: false, error: bodyResult.error });
  }

  const { sessionId } = bodyResult.value;
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    return res.status(400).json({ success: false, error: 'sessionId is required' });
  }

  const result = stopRunSession(sessionId);
  if (!result.success) {
    return res.status(404).json(result);
  }

  return res.json(result);
}

export async function traceHandler(req, res) {
  const bodyResult = normalizeJsonBody(req.body);
  if (bodyResult.error) {
    return res.status(400).json(traceValidationResponse(bodyResult.error));
  }

  const { code, breakpoints, input } = bodyResult.value;
  const codeError = validateCode(code);
  if (codeError) {
    return res.status(400).json(traceValidationResponse(codeError, 'No code provided'));
  }

  const breakpointResult = normalizeBreakpoints(breakpoints);
  if (breakpointResult.error) {
    return res.status(400).json(traceValidationResponse(breakpointResult.error));
  }

  const inputResult = normalizeInput(input);
  if (inputResult.error) {
    return res.status(400).json(traceValidationResponse(inputResult.error, 'Invalid trace input'));
  }

  const maxLine = code.split(/\r?\n/).length;
  const outOfRangeBreakpoint = breakpointResult.value.find((lineNo) => lineNo > maxLine);
  if (outOfRangeBreakpoint) {
    return res.status(400).json(
      traceValidationResponse(`"breakpoints" must be within the source line range 1-${maxLine}`)
    );
  }

  console.log(`Tracing code with ${breakpointResult.value.length} breakpoints...`);

  try {
    const result = await traceExecution(code, breakpointResult.value, inputResult.value);
    console.log(`✓ Trace complete: ${result.totalSteps} steps`);
    return res.json(result);
  } catch (err) {
    console.error('Trace error:', err);
    return res.status(500).json(traceServerErrorResponse(getErrorMessage(err)));
  }
}

export async function analyzeIntentHandler(req, res) {
  const bodyResult = normalizeJsonBody(req.body);
  if (bodyResult.error) {
    return res.status(400).json(analyzeValidationResponse(bodyResult.error));
  }

  const { code } = bodyResult.value;
  const codeError = validateCode(code);
  if (codeError) {
    return res.status(400).json(analyzeValidationResponse(codeError));
  }

  try {
    const result = await analyzeProgramIntent(code);
    return res.json(result);
  } catch (err) {
    console.error('Intent analysis error:', err);
    return res.status(500).json(analyzeServerErrorResponse(err));
  }
}
