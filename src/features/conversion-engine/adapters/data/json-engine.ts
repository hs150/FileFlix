/**
 * JSON & JSONL Conversion Engine
 * Converts between tabular row grids, JSON structures, and JSONL streams.
 */

export function gridToJson(rows: string[][], hasHeader: boolean = true): any {
  if (rows.length === 0) return [];

  if (hasHeader && rows.length > 1) {
    const headers = rows[0].map((h, i) => h.trim() || `column_${i + 1}`);
    const dataRows = rows.slice(1);

    return dataRows.map((row) => {
      const obj: Record<string, any> = {};
      headers.forEach((key, idx) => {
        const val = row[idx] ?? '';
        // Try parsing numbers and booleans
        if (val === 'true') obj[key] = true;
        else if (val === 'false') obj[key] = false;
        else if (val !== '' && !isNaN(Number(val)) && !val.startsWith('0') || val === '0') {
          obj[key] = Number(val);
        } else {
          obj[key] = val;
        }
      });
      return obj;
    });
  }

  // Without header or single row: return 2D array
  return rows;
}

export function jsonToGrid(jsonData: any, flattenNested: boolean = true): string[][] {
  let items: any[] = [];

  if (Array.isArray(jsonData)) {
    items = jsonData;
  } else if (typeof jsonData === 'object' && jsonData !== null) {
    items = [jsonData];
  } else {
    return [[String(jsonData)]];
  }

  if (items.length === 0) return [];

  // If array of primitives (numbers or strings)
  if (typeof items[0] !== 'object' || items[0] === null) {
    return [['value'], ...items.map((it) => [String(it)])];
  }

  // Collect unique headers across all items
  const headersSet = new Set<string>();
  const preparedItems = items.map((item) => {
    return flattenNested ? flattenObject(item) : item;
  });

  for (const item of preparedItems) {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach((k) => headersSet.add(k));
    }
  }

  const headers = Array.from(headersSet);
  const rows: string[][] = [headers];

  for (const item of preparedItems) {
    const row = headers.map((h) => {
      const val = item[h];
      if (val === undefined || val === null) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    });
    rows.push(row);
  }

  return rows;
}

export function jsonToJsonl(jsonData: any): string {
  if (Array.isArray(jsonData)) {
    return jsonData.map((item) => JSON.stringify(item)).join('\n');
  }
  return JSON.stringify(jsonData);
}

export function jsonlToJson(jsonlText: string): any[] {
  const lines = jsonlText.split('\n').filter((l) => l.trim().length > 0);
  return lines.map((line, idx) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`Invalid JSON on line ${idx + 1}: ${err instanceof Error ? err.message : 'Parse error'}`);
    }
  });
}

function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof val === 'object' && val !== null && !Array.isArray(val) && !(val instanceof Date)) {
      Object.assign(result, flattenObject(val, newKey));
    } else {
      result[newKey] = val;
    }
  }

  return result;
}
