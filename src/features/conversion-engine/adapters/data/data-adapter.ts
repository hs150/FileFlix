import { ConversionAdapter, ConversionInput, ConversionOutput } from '../../core/conversion-types';
import { ConversionError } from '../../core/conversion-errors';
import { parseCsvToGrid, serializeGridToCsv, autodetectDelimiter } from './csv-engine';
import { gridToJson, jsonToGrid, jsonToJsonl, jsonlToJson } from './json-engine';
import { parseYamlToJson, serializeJsonToYaml } from './yaml-engine';
import { parseXmlToJson, serializeJsonToXml } from './xml-engine';
import { createXlsxFromGrid, parseXlsxToGrid } from './xlsx-engine';

export const dataAdapter: ConversionAdapter = {
  id: 'data-adapter',
  category: 'data',
  supportedPairs: [
    { input: 'csv', output: 'json' },
    { input: 'json', output: 'csv' },
    { input: 'csv', output: 'tsv' },
    { input: 'tsv', output: 'csv' },
    { input: 'csv', output: 'xlsx' },
    { input: 'xlsx', output: 'csv' },
    { input: 'json', output: 'yaml' },
    { input: 'yaml', output: 'json' },
    { input: 'json', output: 'xml' },
    { input: 'xml', output: 'json' },
    { input: 'json', output: 'jsonl' },
    { input: 'jsonl', output: 'json' },
    { input: 'xlsx', output: 'json' },
    { input: 'json', output: 'xlsx' },
  ],

  async execute(input: ConversionInput, options?: Record<string, any>): Promise<ConversionOutput> {
    const inputFormat = input.detectedFormat.formatId;
    const targetFormat = options?.targetFormat;
    const textDecoder = new TextDecoder('utf-8');
    const warnings: string[] = [];

    // Helper to get text content from buffer
    const getInputText = () => textDecoder.decode(input.buffer);

    // 1. CSV -> JSON
    if (inputFormat === 'csv' && targetFormat === 'json') {
      const text = getInputText();
      const delim = options?.delimiter || autodetectDelimiter(text);
      const grid = parseCsvToGrid(text, { delimiter: delim });
      const json = gridToJson(grid, true);
      const outputText = JSON.stringify(json, null, 2);
      const blob = new Blob([outputText], { type: 'application/json' });

      return {
        blob,
        filename: input.name.replace(/\.csv$/i, '.json'),
        mime: 'application/json',
        sizeBytes: blob.size,
        warnings,
        details: { recordCount: Array.isArray(json) ? json.length : 1 },
      };
    }

    // 2. JSON -> CSV
    if (inputFormat === 'json' && targetFormat === 'csv') {
      const text = getInputText();
      const parsed = JSON.parse(text);
      const grid = jsonToGrid(parsed, options?.flattenNested ?? true);
      const { csvText, sanitizedCount } = serializeGridToCsv(grid, {
        delimiter: ',',
        sanitizeFormulas: true,
      });

      if (sanitizedCount > 0) {
        warnings.push(
          `Sanitized ${sanitizedCount} cell(s) starting with formula characters (=, +, -, @) to prevent formula injection.`
        );
      }

      const blob = new Blob([csvText], { type: 'text/csv' });
      return {
        blob,
        filename: input.name.replace(/\.json$/i, '.csv'),
        mime: 'text/csv',
        sizeBytes: blob.size,
        warnings,
        details: { rowCount: grid.length },
      };
    }

    // 3. CSV <-> TSV
    if ((inputFormat === 'csv' && targetFormat === 'tsv') || (inputFormat === 'tsv' && targetFormat === 'csv')) {
      const text = getInputText();
      const srcDelim = inputFormat === 'csv' ? ',' : '\t';
      const targetDelim = targetFormat === 'tsv' ? '\t' : ',';
      const grid = parseCsvToGrid(text, { delimiter: srcDelim });
      const { csvText } = serializeGridToCsv(grid, { delimiter: targetDelim, sanitizeFormulas: true });
      const mime = targetFormat === 'tsv' ? 'text/tab-separated-values' : 'text/csv';
      const ext = targetFormat === 'tsv' ? '.tsv' : '.csv';
      const blob = new Blob([csvText], { type: mime });

      return {
        blob,
        filename: input.name.replace(/\.(csv|tsv)$/i, ext),
        mime,
        sizeBytes: blob.size,
        warnings,
        details: { rowCount: grid.length },
      };
    }

    // 4. CSV -> XLSX
    if (inputFormat === 'csv' && targetFormat === 'xlsx') {
      const text = getInputText();
      const grid = parseCsvToGrid(text);
      const xlsxBytes = createXlsxFromGrid(grid, 'Sheet1');
      const blob = new Blob([xlsxBytes.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      return {
        blob,
        filename: input.name.replace(/\.csv$/i, '.xlsx'),
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: blob.size,
        warnings,
        details: { rowCount: grid.length },
      };
    }

    // 5. XLSX -> CSV
    if (inputFormat === 'xlsx' && targetFormat === 'csv') {
      const grid = parseXlsxToGrid(input.buffer);
      const { csvText, sanitizedCount } = serializeGridToCsv(grid, { delimiter: ',', sanitizeFormulas: true });

      if (sanitizedCount > 0) {
        warnings.push(`Sanitized ${sanitizedCount} cell(s) starting with formula characters.`);
      }

      const blob = new Blob([csvText], { type: 'text/csv' });
      return {
        blob,
        filename: input.name.replace(/\.xlsx$/i, '.csv'),
        mime: 'text/csv',
        sizeBytes: blob.size,
        warnings,
        details: { rowCount: grid.length },
      };
    }

    // 6. JSON <-> YAML
    if (inputFormat === 'json' && targetFormat === 'yaml') {
      const text = getInputText();
      const parsed = JSON.parse(text);
      const yaml = serializeJsonToYaml(parsed);
      const blob = new Blob([yaml], { type: 'application/x-yaml' });

      return {
        blob,
        filename: input.name.replace(/\.json$/i, '.yaml'),
        mime: 'application/x-yaml',
        sizeBytes: blob.size,
        warnings,
        details: {},
      };
    }

    if (inputFormat === 'yaml' && targetFormat === 'json') {
      const text = getInputText();
      const parsed = parseYamlToJson(text);
      const json = JSON.stringify(parsed, null, 2);
      const blob = new Blob([json], { type: 'application/json' });

      return {
        blob,
        filename: input.name.replace(/\.(yaml|yml)$/i, '.json'),
        mime: 'application/json',
        sizeBytes: blob.size,
        warnings,
        details: {},
      };
    }

    // 7. JSON <-> XML
    if (inputFormat === 'json' && targetFormat === 'xml') {
      const text = getInputText();
      const parsed = JSON.parse(text);
      const xml = serializeJsonToXml(parsed, options?.rootTag || 'root');
      const blob = new Blob([xml], { type: 'application/xml' });

      return {
        blob,
        filename: input.name.replace(/\.json$/i, '.xml'),
        mime: 'application/xml',
        sizeBytes: blob.size,
        warnings,
        details: {},
      };
    }

    if (inputFormat === 'xml' && targetFormat === 'json') {
      const text = getInputText();
      const parsed = parseXmlToJson(text);
      const json = JSON.stringify(parsed, null, 2);
      const blob = new Blob([json], { type: 'application/json' });

      return {
        blob,
        filename: input.name.replace(/\.xml$/i, '.json'),
        mime: 'application/json',
        sizeBytes: blob.size,
        warnings,
        details: {},
      };
    }

    // 8. JSON <-> JSONL
    if (inputFormat === 'json' && targetFormat === 'jsonl') {
      const text = getInputText();
      const parsed = JSON.parse(text);
      const jsonl = jsonToJsonl(parsed);
      const blob = new Blob([jsonl], { type: 'application/x-ndjson' });

      return {
        blob,
        filename: input.name.replace(/\.json$/i, '.jsonl'),
        mime: 'application/x-ndjson',
        sizeBytes: blob.size,
        warnings,
        details: {},
      };
    }

    if (inputFormat === 'jsonl' && targetFormat === 'json') {
      const text = getInputText();
      const parsed = jsonlToJson(text);
      const json = JSON.stringify(parsed, null, 2);
      const blob = new Blob([json], { type: 'application/json' });

      return {
        blob,
        filename: input.name.replace(/\.(jsonl|ndjson)$/i, '.json'),
        mime: 'application/json',
        sizeBytes: blob.size,
        warnings,
        details: { lineCount: parsed.length },
      };
    }

    // 9. XLSX -> JSON
    if (inputFormat === 'xlsx' && targetFormat === 'json') {
      const grid = parseXlsxToGrid(input.buffer);
      const json = gridToJson(grid, true);
      const outputText = JSON.stringify(json, null, 2);
      const blob = new Blob([outputText], { type: 'application/json' });

      return {
        blob,
        filename: input.name.replace(/\.xlsx$/i, '.json'),
        mime: 'application/json',
        sizeBytes: blob.size,
        warnings,
        details: { recordCount: Array.isArray(json) ? json.length : 1 },
      };
    }

    // 10. JSON -> XLSX
    if (inputFormat === 'json' && targetFormat === 'xlsx') {
      const text = getInputText();
      const parsed = JSON.parse(text);
      const grid = jsonToGrid(parsed, true);
      const xlsxBytes = createXlsxFromGrid(grid, 'Sheet1');
      const blob = new Blob([xlsxBytes.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      return {
        blob,
        filename: input.name.replace(/\.json$/i, '.xlsx'),
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: blob.size,
        warnings,
        details: { rowCount: grid.length },
      };
    }

    throw new ConversionError(
      `Unsupported data conversion: ${inputFormat} -> ${targetFormat}`,
      'UNSUPPORTED_DATA_CONVERSION'
    );
  },
};
