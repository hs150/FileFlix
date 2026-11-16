import * as fflate from 'fflate';

/**
 * Pure Browser-Local OpenXML (.xlsx) Spreadsheet Engine
 * Implements ECMA-376 compliant workbook generation and reading using fflate.
 * 100% client-side, zero remote dependencies, zero macros.
 */

/**
 * Generates an .xlsx file binary buffer from a 2D array of rows.
 */
export function createXlsxFromGrid(rows: string[][], sheetName: string = 'Sheet1'): Uint8Array {
  const encoder = new TextEncoder();

  // 1. Build sheet1.xml
  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;
  sheetXml += `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n`;
  sheetXml += `  <sheetData>\n`;

  for (let r = 0; r < rows.length; r++) {
    const rowNum = r + 1;
    const row = rows[r];
    sheetXml += `    <row r="${rowNum}">\n`;

    for (let c = 0; c < row.length; c++) {
      const colLetter = getColumnLetter(c + 1);
      const cellRef = `${colLetter}${rowNum}`;
      const rawVal = row[c] ?? '';

      // Check if pure numeric
      if (rawVal !== '' && !isNaN(Number(rawVal)) && !rawVal.startsWith('0') || rawVal === '0') {
        sheetXml += `      <c r="${cellRef}"><v>${rawVal}</v></c>\n`;
      } else {
        // String value using ECMA-376 inlineStr
        const escaped = escapeXml(rawVal);
        sheetXml += `      <c r="${cellRef}" t="inlineStr"><is><t>${escaped}</t></is></c>\n`;
      }
    }

    sheetXml += `    </row>\n`;
  }

  sheetXml += `  </sheetData>\n`;
  sheetXml += `</worksheet>`;

  // 2. Build workbook.xml
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  // 3. Build workbook relationships
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  // 4. Build package relationships
  const packageRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // 5. Build [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  // Package into standard ZIP archive
  const zipFiles: Record<string, Uint8Array> = {
    '[Content_Types].xml': encoder.encode(contentTypesXml),
    '_rels/.rels': encoder.encode(packageRelsXml),
    'xl/workbook.xml': encoder.encode(workbookXml),
    'xl/_rels/workbook.xml.rels': encoder.encode(workbookRelsXml),
    'xl/worksheets/sheet1.xml': encoder.encode(sheetXml),
  };

  return fflate.zipSync(zipFiles, { level: 6 });
}

/**
 * Extracts cell grid from an .xlsx buffer.
 */
export function parseXlsxToGrid(xlsxBuffer: ArrayBuffer | Uint8Array): string[][] {
  const u8 = xlsxBuffer instanceof Uint8Array ? xlsxBuffer : new Uint8Array(xlsxBuffer);
  const unzipped = fflate.unzipSync(u8);
  const decoder = new TextDecoder('utf-8');

  // 1. Parse Shared Strings if present
  const sharedStrings: string[] = [];
  if (unzipped['xl/sharedStrings.xml']) {
    const sstXml = decoder.decode(unzipped['xl/sharedStrings.xml']);
    const siMatches = sstXml.match(/<si>[\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      // Extract all <t> tags within <si>
      const tMatches = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      const text = tMatches
        .map((t) => unescapeXml(t.replace(/<t[^>]*>|<\/t>/g, '')))
        .join('');
      sharedStrings.push(text);
    }
  }

  // 2. Parse sheet1.xml
  const sheetKey =
    Object.keys(unzipped).find((k) => k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml')) ||
    'xl/worksheets/sheet1.xml';

  if (!unzipped[sheetKey]) {
    throw new Error('Workbook contains no valid worksheet data.');
  }

  const sheetXml = decoder.decode(unzipped[sheetKey]);
  const rows: string[][] = [];

  const rowMatches = sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];

  for (const rowTag of rowMatches) {
    const cellMatches = rowTag.match(/<c\s+[^>]*>[\s\S]*?<\/c>|<c\s+[^>]*\/>/g) || [];
    const rowValues: string[] = [];

    for (const cellTag of cellMatches) {
      // Determine column index from cell reference e.g. r="C4"
      const rMatch = cellTag.match(/r="([A-Z]+)(\d+)"/);
      let targetColIdx = rowValues.length;
      if (rMatch) {
        targetColIdx = getColumnIndex(rMatch[1]) - 1;
      }

      // Fill in empty skipped columns
      while (rowValues.length < targetColIdx) {
        rowValues.push('');
      }

      // Check cell type: t="s" (shared string), t="inlineStr", or numeric/default
      const tMatch = cellTag.match(/t="([^"]+)"/);
      const cellType = tMatch ? tMatch[1] : '';

      let value = '';

      if (cellType === 's') {
        const vMatch = cellTag.match(/<v>(\d+)<\/v>/);
        if (vMatch) {
          const idx = parseInt(vMatch[1], 10);
          value = sharedStrings[idx] ?? '';
        }
      } else if (cellType === 'inlineStr') {
        const tMatch = cellTag.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        if (tMatch) {
          value = unescapeXml(tMatch[1]);
        }
      } else {
        const vMatch = cellTag.match(/<v>([\s\S]*?)<\/v>/);
        if (vMatch) {
          value = unescapeXml(vMatch[1]);
        }
      }

      rowValues.push(value);
    }

    rows.push(rowValues);
  }

  return rows;
}

function getColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

function getColumnIndex(colLetter: string): number {
  let index = 0;
  for (let i = 0; i < colLetter.length; i++) {
    index = index * 26 + (colLetter.charCodeAt(i) - 64);
  }
  return index;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}
