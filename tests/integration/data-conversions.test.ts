import { describe, it, expect } from 'vitest';
import * as fflate from 'fflate';
import { executeConversion } from '@/features/conversion-engine/core/conversion-executor';
import { ConversionInput } from '@/features/conversion-engine/core/conversion-types';
import { parseXmlToJson } from '@/features/conversion-engine/adapters/data/xml-engine';

describe('Data & Spreadsheet Conversions Integration', () => {
  const encoder = new TextEncoder();

  it('converts CSV to JSON and round-trips back to CSV', async () => {
    const csvContent = 'id,name,department\n101,John Doe,Engineering\n102,Jane Smith,Design\n';
    const csvBuffer = encoder.encode(csvContent).buffer;

    const input: ConversionInput = {
      file: new Blob([csvBuffer], { type: 'text/csv' }),
      name: 'staff.csv',
      sizeBytes: csvBuffer.byteLength,
      detectedFormat: {
        formatId: 'csv',
        mime: 'text/csv',
        extension: 'csv',
        name: 'Comma-Separated Values',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      },
      buffer: csvBuffer,
    };

    // CSV -> JSON
    const jsonResult = await executeConversion(input, 'json');
    expect(jsonResult.mime).toBe('application/json');
    expect(jsonResult.filename).toBe('staff.json');

    const jsonText = await jsonResult.blob.text();
    const parsed = JSON.parse(jsonText);
    expect(parsed.length).toBe(2);
    expect(parsed[0].name).toBe('John Doe');
    expect(parsed[0].department).toBe('Engineering');
    expect(parsed[1].name).toBe('Jane Smith');

    // JSON -> CSV
    const jsonInput: ConversionInput = {
      file: jsonResult.blob,
      name: 'staff.json',
      sizeBytes: jsonResult.blob.size,
      detectedFormat: {
        formatId: 'json',
        mime: 'application/json',
        extension: 'json',
        name: 'JSON Data',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      },
      buffer: await jsonResult.blob.arrayBuffer(),
    };

    const csvResult = await executeConversion(jsonInput, 'csv');
    const returnedCsv = await csvResult.blob.text();
    expect(returnedCsv).toContain('John Doe');
    expect(returnedCsv).toContain('Engineering');
  });

  it('converts CSV to valid OpenXML Excel workbook (.xlsx) and parses back to CSV', async () => {
    const csvContent = 'Product,Quantity,Price\nLaptop,5,999.99\nMonitor,12,249.50\n';
    const csvBuffer = encoder.encode(csvContent).buffer;

    const input: ConversionInput = {
      file: new Blob([csvBuffer], { type: 'text/csv' }),
      name: 'inventory.csv',
      sizeBytes: csvBuffer.byteLength,
      detectedFormat: {
        formatId: 'csv',
        mime: 'text/csv',
        extension: 'csv',
        name: 'Comma-Separated Values',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      },
      buffer: csvBuffer,
    };

    // CSV -> XLSX
    const xlsxResult = await executeConversion(input, 'xlsx');
    expect(xlsxResult.mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(xlsxResult.filename).toBe('inventory.xlsx');

    // Unzip XLSX to inspect authentic OpenXML parts
    const xlsxBuf = await xlsxResult.blob.arrayBuffer();
    const unzipped = fflate.unzipSync(new Uint8Array(xlsxBuf));

    expect(unzipped['[Content_Types].xml']).toBeDefined();
    expect(unzipped['xl/workbook.xml']).toBeDefined();
    expect(unzipped['xl/worksheets/sheet1.xml']).toBeDefined();

    // XLSX -> CSV
    const xlsxInput: ConversionInput = {
      file: xlsxResult.blob,
      name: 'inventory.xlsx',
      sizeBytes: xlsxResult.blob.size,
      detectedFormat: {
        formatId: 'xlsx',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
        name: 'Microsoft Excel Spreadsheet',
        category: 'data',
        isTextBased: false,
        confidence: 'magic_bytes',
      },
      buffer: xlsxBuf,
    };

    const csvBackResult = await executeConversion(xlsxInput, 'csv');
    const csvText = await csvBackResult.blob.text();
    expect(csvText).toContain('Laptop');
    expect(csvText).toContain('999.99');
    expect(csvText).toContain('Monitor');
  });

  it('converts JSON to YAML and back losslessly', async () => {
    const obj = { server: { host: '127.0.0.1', port: 3099, secure: false }, tags: ['local', 'fast'] };
    const jsonStr = JSON.stringify(obj);
    const jsonBuffer = encoder.encode(jsonStr).buffer;

    const input: ConversionInput = {
      file: new Blob([jsonBuffer], { type: 'application/json' }),
      name: 'config.json',
      sizeBytes: jsonBuffer.byteLength,
      detectedFormat: {
        formatId: 'json',
        mime: 'application/json',
        extension: 'json',
        name: 'JSON Data',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      },
      buffer: jsonBuffer,
    };

    // JSON -> YAML
    const yamlResult = await executeConversion(input, 'yaml');
    expect(yamlResult.mime).toBe('application/x-yaml');
    const yamlText = await yamlResult.blob.text();
    expect(yamlText).toContain('server:');
    expect(yamlText).toContain('port: 3099');

    // YAML -> JSON
    const yamlInput: ConversionInput = {
      file: yamlResult.blob,
      name: 'config.yaml',
      sizeBytes: yamlResult.blob.size,
      detectedFormat: {
        formatId: 'yaml',
        mime: 'application/x-yaml',
        extension: 'yaml',
        name: 'YAML Data',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      },
      buffer: await yamlResult.blob.arrayBuffer(),
    };

    const jsonBackResult = await executeConversion(yamlInput, 'json');
    const roundTripped = JSON.parse(await jsonBackResult.blob.text());
    expect(roundTripped.server.port).toBe(3099);
    expect(roundTripped.tags).toEqual(['local', 'fast']);
  });

  it('converts JSON to XML and back with hierarchical element structure', async () => {
    const data = { title: 'FileFix Engine', status: 'ready', version: '2.0.0' };
    const jsonBuf = encoder.encode(JSON.stringify(data)).buffer;

    const input: ConversionInput = {
      file: new Blob([jsonBuf], { type: 'application/json' }),
      name: 'meta.json',
      sizeBytes: jsonBuf.byteLength,
      detectedFormat: {
        formatId: 'json',
        mime: 'application/json',
        extension: 'json',
        name: 'JSON Data',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      },
      buffer: jsonBuf,
    };

    const xmlResult = await executeConversion(input, 'xml');
    const xmlText = await xmlResult.blob.text();
    expect(xmlText).toContain('<title>FileFix Engine</title>');
    expect(xmlText).toContain('<status>ready</status>');
  });

  it('converts JSON to streaming JSONL and back', async () => {
    const records = [{ id: 1, user: 'alice' }, { id: 2, user: 'bob' }];
    const jsonBuf = encoder.encode(JSON.stringify(records)).buffer;

    const input: ConversionInput = {
      file: new Blob([jsonBuf], { type: 'application/json' }),
      name: 'users.json',
      sizeBytes: jsonBuf.byteLength,
      detectedFormat: {
        formatId: 'json',
        mime: 'application/json',
        extension: 'json',
        name: 'JSON Data',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      },
      buffer: jsonBuf,
    };

    const jsonlResult = await executeConversion(input, 'jsonl');
    const lines = (await jsonlResult.blob.text()).split('\n').filter(Boolean);
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).user).toBe('alice');
    expect(JSON.parse(lines[1]).user).toBe('bob');
  });

  it('neutralizes formula injection characters when exporting untrusted JSON to CSV', async () => {
    const untrusted = [
      { name: 'Normal Entry', calculation: '100' },
      { name: '=1+1', calculation: '@SUM(A1:A10)' },
      { name: '+cmd|"/c calc"!A0', calculation: '-50' },
    ];
    const jsonBuf = encoder.encode(JSON.stringify(untrusted)).buffer;

    const input: ConversionInput = {
      file: new Blob([jsonBuf], { type: 'application/json' }),
      name: 'untrusted.json',
      sizeBytes: jsonBuf.byteLength,
      detectedFormat: {
        formatId: 'json',
        mime: 'application/json',
        extension: 'json',
        name: 'JSON Data',
        category: 'data',
        isTextBased: true,
        confidence: 'syntax_valid',
      },
      buffer: jsonBuf,
    };

    const result = await executeConversion(input, 'csv');
    const csv = await result.blob.text();

    // Verify formula characters are preceded by neutralizing apostrophe
    expect(csv).toContain("`'=1+1`".replace(/`/g, ''));
    expect(csv).toContain("`'@SUM(A1:A10)`".replace(/`/g, ''));
    expect(csv).toContain("`'+cmd`".replace(/`/g, ''));
    expect(result.warnings.some((w) => w.includes('formula characters'))).toBe(true);
  });

  it('rejects XML documents containing external entity (XXE) definitions', () => {
    const maliciousXml = `<?xml version="1.0"?>
    <!DOCTYPE root [
      <!ENTITY xxe SYSTEM "http://malicious-external-host.com/leak">
    ]>
    <root>&xxe;</root>`;

    expect(() => parseXmlToJson(maliciousXml)).toThrow(/forbidden external entity/i);
  });
});
