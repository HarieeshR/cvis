import type { CodeToken } from './types';

export function tokenize(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  if (!code) return tokens;

  const KEYWORDS = new Set([
    "int", "float", "double", "char", "void", "return", "if", "else", "while", "for",
    "do", "switch", "case", "break", "continue", "struct", "typedef", "sizeof", "long", 
    "short", "unsigned", "signed", "const", "static", "NULL"
  ]);

  let lineNo = 1;
  let colNo = 1;
  let i = 0;

  while (i < code.length) {
    const ch = code[i];
    const startCol = colNo;

    // Newline
    if (ch === '\n') {
      lineNo++;
      colNo = 1;
      i++;
      continue;
    }

    // Whitespace (excluding newline)
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      colNo++;
      i++;
      continue;
    }

    // Single-line comment
    if (ch === '/' && code[i + 1] === '/') {
      const start = i;
      while (i < code.length && code[i] !== '\n') {
        i++;
      }
      tokens.push({
        type: 'comment',
        value: code.substring(start, i),
        line: lineNo,
        column: startCol
      });
      continue;
    }

    // Multi-line comment
    if (ch === '/' && code[i + 1] === '*') {
      const start = i;
      const startLine = lineNo;
      i += 2;
      colNo += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') {
          lineNo++;
          colNo = 1;
        } else {
          colNo++;
        }
        i++;
      }
      i += 2;
      colNo += 2;
      tokens.push({
        type: 'comment',
        value: code.substring(start, i),
        line: startLine,
        column: startCol
      });
      continue;
    }

    // String literals
    if (ch === '"') {
      const start = i;
      i++;
      colNo++;
      while (i < code.length && code[i] !== '"') {
        if (code[i] === '\\') {
          i++;
          colNo++;
        }
        if (i < code.length) {
          if (code[i] === '\n') {
            lineNo++;
            colNo = 1;
          } else {
            colNo++;
          }
          i++;
        }
      }
      i++; // closing quote
      colNo++;
      tokens.push({
        type: 'string',
        value: code.substring(start, i),
        line: lineNo,
        column: startCol
      });
      continue;
    }

    // Character literals
    if (ch === "'") {
      const start = i;
      i++;
      colNo++;
      while (i < code.length && code[i] !== "'") {
        if (code[i] === '\\') {
          i++;
          colNo++;
        }
        if (i < code.length) {
          colNo++;
          i++;
        }
      }
      i++; // closing quote
      colNo++;
      tokens.push({
        type: 'string',
        value: code.substring(start, i),
        line: lineNo,
        column: startCol
      });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(code[i + 1] || ''))) {
      const start = i;
      while (i < code.length && /[0-9a-fA-FxX._eE]/.test(code[i])) {
        colNo++;
        i++;
      }
      tokens.push({
        type: 'number',
        value: code.substring(start, i),
        line: lineNo,
        column: startCol
      });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < code.length && /[a-zA-Z0-9_]/.test(code[i])) {
        colNo++;
        i++;
      }
      const value = code.substring(start, i);
      tokens.push({
        type: KEYWORDS.has(value) ? 'keyword' : 'identifier',
        value,
        line: lineNo,
        column: startCol
      });
      continue;
    }

    // Operators and punctuation
    const twoChar = code.substring(i, i + 2);
    const TWO_CHAR_OPS = [
      "==", "!=", "<=", ">=", "&&", "||", "++", "--", 
      "+=", "-=", "*=", "/=", "%=", "->", "<<", ">>"
    ];
    
    if (TWO_CHAR_OPS.includes(twoChar)) {
      tokens.push({
        type: 'operator',
        value: twoChar,
        line: lineNo,
        column: startCol
      });
      i += 2;
      colNo += 2;
      continue;
    }

    // Single character operators
    if ("+-*/%<>=!&|^~?:;,.()[]{}".includes(ch)) {
      tokens.push({
        type: 'operator',
        value: ch,
        line: lineNo,
        column: startCol
      });
      i++;
      colNo++;
      continue;
    }

    // Unknown character
    tokens.push({
      type: 'unknown',
      value: ch,
      line: lineNo,
      column: startCol
    });
    i++;
    colNo++;
  }

  return tokens;
}

// One Dark Pro syntax highlighting colors
const COLORS = {
  comment: '#5c6370',      // Gray (italic)
  preprocessor: '#c678dd', // Purple
  string: '#98c379',       // Green
  number: '#d19a66',       // Orange
  keyword: '#c678dd',      // Purple
  type: '#e5c07b',         // Yellow (for types like int, float)
  function: '#61afef',     // Blue
  stdLib: '#56b6c2',       // Cyan
} as const;

export default function highlight(code: string): string {
  if (!code) return "";
  
  // Escape HTML entities
  let s = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  // Use unique placeholder markers that won't conflict
  const placeholders: Map<string, string> = new Map();
  let placeholderIndex = 0;
  
  const addPlaceholder = (html: string): string => {
    const key = `\x00PH${placeholderIndex++}PH\x00`;
    placeholders.set(key, html);
    return key;
  };

  // Order matters: process tokens that could contain other tokens first
  
  // 1. Comments (must be first - they can contain anything)
  s = s.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, (m) => 
    addPlaceholder(`<span style="color:${COLORS.comment};font-style:italic">${m}</span>`)
  );

  // 2. Preprocessor directives (can contain strings and other tokens)
  s = s.replace(/^(#[^\n]*)/gm, (m) => 
    addPlaceholder(`<span style="color:${COLORS.preprocessor}">${m}</span>`)
  );

  // 3. String literals
  s = s.replace(/("(?:[^"\\]|\\.)*")/g, (m) => 
    addPlaceholder(`<span style="color:${COLORS.string}">${m}</span>`)
  );

  // 4. Character literals
  s = s.replace(/('(?:[^'\\]|\\.)*')/g, (m) => 
    addPlaceholder(`<span style="color:${COLORS.string}">${m}</span>`)
  );

  // 5. Numbers (before keywords to avoid conflicts)
  s = s.replace(/\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFlLuU]*)\b/g, (m) => 
    addPlaceholder(`<span style="color:${COLORS.number}">${m}</span>`)
  );

  // 6. Standard library functions (before generic function calls)
  s = s.replace(
    /\b(printf|scanf|fprintf|putchar|puts|malloc|calloc|realloc|free|abs|sqrt|strlen|pow|rand|srand|atoi|strcmp|strcpy|strcat|memset|memcpy|fopen|fclose|fread|fwrite|getchar|exit)\b/g,
    (m) => addPlaceholder(`<span style="color:${COLORS.stdLib}">${m}</span>`)
  );

  // 7. Type keywords (yellow)
  s = s.replace(
    /\b(int|float|double|char|void|long|short|unsigned|signed|struct|typedef|const|static)\b/g,
    (m) => addPlaceholder(`<span style="color:${COLORS.type}">${m}</span>`)
  );

  // 8. Control flow keywords (purple)
  s = s.replace(
    /\b(return|if|else|while|for|do|switch|case|break|continue|sizeof|NULL|default)\b/g,
    (m) => addPlaceholder(`<span style="color:${COLORS.keyword}">${m}</span>`)
  );

  // 9. Function calls - identifiers followed by ( but not already highlighted
  s = s.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, (match) => {
    // Don't re-highlight if already in a placeholder
    if (match.includes('\x00')) return match;
    return addPlaceholder(`<span style="color:${COLORS.function}">${match}</span>`);
  });

  // Restore all placeholders
  for (const [key, value] of placeholders) {
    s = s.split(key).join(value);
  }

  return s + "\n";
}
