export interface BufferedInputResult {
  lines: string[];
  remainder: string;
}

export function normalizeTerminalText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function consumeBufferedLines(buffer: string): BufferedInputResult {
  if (!buffer.includes('\n')) {
    return {
      lines: [],
      remainder: buffer
    };
  }

  const parts = buffer.split('\n');
  const remainder = parts.pop() ?? '';

  return {
    lines: parts,
    remainder
  };
}
