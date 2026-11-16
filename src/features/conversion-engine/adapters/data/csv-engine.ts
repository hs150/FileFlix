/**
 * RFC 4180 Compliant CSV & TSV Parser and Serializer
 * Features delimiter autodetection, robust quote handling, and formula injection defenses.
 */

export interface CsvParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  trimValues?: boolean;
}

export interface CsvSerializeOptions {
  delimiter?: string;
  sanitizeFormulas?: boolean;
}

const DANGEROUS_FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Autodetects the most likely delimiter (comma, tab, semicolon, pipe) from sample lines.
 */
export function autodetectDelimiter(sample: string): string {
  const delimiters = [',', '\t', ';', '|'];
  const lines = sample.split('\n').slice(0, 10).filter((l) => l.trim().length > 0);

  if (lines.length === 0) return ',';

  let bestDelimiter = ',';
  let bestScore = -1;

  for (const delim of delimiters) {
    const counts = lines.map((line) => {
      let count = 0;
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuote = !inQuote;
        else if (line[i] === delim && !inQuote) count++;
      }
      return count;
    });

    // Check if the delimiter count is consistent across all sample lines and > 0
    const firstCount = counts[0];
    if (firstCount > 0 && counts.every((c) => c === firstCount)) {
      const score = firstCount * lines.length;
      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = delim;
      }
    }
  }

  return bestDelimiter;
}

/**
 * Parses raw CSV/TSV text into a 2D array of string values adhering to RFC 4180.
 */
export function parseCsvToGrid(text: string, options?: CsvParseOptions): string[][] {
  const delim = options?.delimiter || autodetectDelimiter(text);
  const trim = options?.trimValues ?? false;

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  let i = 0;
  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote ("")
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delim) {
        currentRow.push(trim ? currentField.trim() : currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++; // Skip \r in \r\n
        }
        currentRow.push(trim ? currentField.trim() : currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(trim ? currentField.trim() : currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push final field/row if content remains
  if (currentField || currentRow.length > 0) {
    currentRow.push(trim ? currentField.trim() : currentField);
    rows.push(currentRow);
  }

  // Filter out trailing empty rows
  while (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }

  return rows;
}

/**
 * Serializes a 2D array of string values into RFC 4180 CSV/TSV format.
 * Applies CSV formula injection defense.
 */
export function serializeGridToCsv(
  rows: string[][],
  options?: CsvSerializeOptions
): { csvText: string; sanitizedCount: number } {
  const delim = options?.delimiter || ',';
  const sanitize = options?.sanitizeFormulas ?? true;
  let sanitizedCount = 0;

  const lines = rows.map((row) => {
    return row
      .map((val) => {
        let field = String(val ?? '');

        // Formula Injection Defense
        if (sanitize && field.length > 0 && DANGEROUS_FORMULA_PREFIXES.includes(field[0])) {
          field = `'` + field; // Prepend apostrophe to neutralize execution in Excel/Sheets
          sanitizedCount++;
        }

        // Quote if field contains delimiter, quote, or newline
        if (field.includes(delim) || field.includes('"') || field.includes('\n') || field.includes('\r')) {
          field = `"` + field.replace(/"/g, '""') + `"`;
        }

        return field;
      })
      .join(delim);
  });

  return { csvText: lines.join('\r\n'), sanitizedCount };
}
