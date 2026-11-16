import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Client-Side Network Isolation Verification', () => {
  const imageFeatureDir = path.resolve(__dirname, '../../src/features/image-studio');

  function getFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(getFiles(fullPath));
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it('guarantees zero network calls in Image Studio pipeline', () => {
    const files = getFiles(imageFeatureDir);
    expect(files.length).toBeGreaterThan(0);

    const forbiddenPatterns = [
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /\bnew\s+WebSocket\b/,
      /\bnavigator\.sendBeacon\b/,
      /\baxios\b/,
      /\bhttps?:\/\//, // No remote URL hardcoded
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        const match = content.match(pattern);
        expect(match, `Forbidden network request pattern ${pattern} found in ${file}`).toBeNull();
      }
    }
  });

  it('guarantees zero network calls in Conversion Hub pipeline', () => {
    const converterDir = path.resolve(__dirname, '../../src/features/converter');
    const files = getFiles(converterDir);
    expect(files.length).toBeGreaterThan(0);

    const forbiddenPatterns = [
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /\bnew\s+WebSocket\b/,
      /\bnavigator\.sendBeacon\b/,
      /\baxios\b/,
      /\bhttps?:\/\//, // No remote URL hardcoded
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        const match = content.match(pattern);
        expect(match, `Forbidden network request pattern ${pattern} found in ${file}`).toBeNull();
      }
    }
  });
});
