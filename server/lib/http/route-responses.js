import { getErrorMessage } from './request-validation.js';

export function compileValidationResponse(message) {
  return {
    success: false,
    error: 'Invalid compile request',
    errors: [message],
    warnings: [],
    compilationTime: 0
  };
}

export function compileServerErrorResponse(message) {
  return {
    success: false,
    errors: [message],
    warnings: [],
    compilationTime: 0
  };
}

export function runValidationResponse(message, error = 'Invalid run request') {
  return {
    error,
    stdout: '',
    stderr: message,
    exitCode: 1,
    executionTime: 0,
    peakMemoryBytes: null
  };
}

export function runServerErrorResponse(message) {
  return {
    exitCode: 1,
    stdout: '',
    stderr: message,
    executionTime: 0,
    peakMemoryBytes: null
  };
}

export function traceValidationResponse(message, error = 'Invalid trace request') {
  return {
    error,
    success: false,
    errors: [message],
    steps: [],
    totalSteps: 0
  };
}

export function traceServerErrorResponse(message) {
  return {
    success: false,
    errors: [message],
    steps: [],
    totalSteps: 0
  };
}

export function analyzeValidationResponse(message) {
  return {
    success: false,
    error: 'Invalid analyze request',
    source: 'heuristic',
    primaryIntent: 'generic',
    primaryLabel: 'Generic Algorithm',
    confidence: 0.35,
    matchedSignals: [],
    candidates: [],
    summary: 'The analyzer needs code before it can classify the program shape.',
    explanation: [message],
    sectionPurposes: [],
    optimizationIdeas: [],
    engine: 'validation-error',
    errors: [message]
  };
}

export function analyzeServerErrorResponse(err) {
  return {
    success: false,
    error: getErrorMessage(err),
    source: 'heuristic',
    primaryIntent: 'generic',
    primaryLabel: 'Generic Algorithm',
    confidence: 0.35,
    matchedSignals: [],
    candidates: [],
    summary: 'The analyzer hit a server error before it could classify the code.',
    explanation: [],
    sectionPurposes: [],
    optimizationIdeas: [],
    engine: 'server-error'
  };
}
