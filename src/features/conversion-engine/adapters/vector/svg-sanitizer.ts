import { SecurityValidationError } from '../../core/conversion-errors';

/**
 * Strict SVG Security Sanitizer
 * Strips script execution vectors, inline event handlers, external URLs, and malicious XML constructs.
 */
export function sanitizeSvg(svgContent: string): { sanitized: string; wasSanitized: boolean; issues: string[] } {
  const issues: string[] = [];
  let sanitized = svgContent;

  // 1. XXE & DTD Protection
  if (/<!DOCTYPE[^>]*SYSTEM/i.test(sanitized) || /<!ENTITY[^>]*SYSTEM/i.test(sanitized)) {
    throw new SecurityValidationError(
      'SVG document contains forbidden external entity (XXE) definitions.',
      'SVG_XXE_DETECTED'
    );
  }

  // Remove XML doctype with entity declarations
  if (/<!DOCTYPE/i.test(sanitized)) {
    sanitized = sanitized.replace(/<!DOCTYPE[\s\S]*?>/gi, '');
    issues.push('Removed DOCTYPE declaration.');
  }

  // 2. Remove script tags and contents
  if (/<script[\s\S]*?<\/script>/gi.test(sanitized) || /<script[^>]*\/>/gi.test(sanitized)) {
    sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<script[^>]*\/>/gi, '');
    issues.push('Stripped executable <script> tags.');
  }

  // 3. Remove inline event handlers (onload, onclick, onmouseover, onerror, etc.)
  const eventHandlerRegex = /\s+(on\w+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
  if (eventHandlerRegex.test(sanitized)) {
    sanitized = sanitized.replace(eventHandlerRegex, '');
    issues.push('Stripped inline event handler attributes (on*).');
  }

  // 4. Remove javascript: pseudo-protocol in href or xlink:href
  const jsHrefRegex = /(href|xlink:href)\s*=\s*["']\s*javascript:[^"']*["']/gi;
  if (jsHrefRegex.test(sanitized)) {
    sanitized = sanitized.replace(jsHrefRegex, '$1="#"');
    issues.push('Neutralized javascript: URI in hyperlink.');
  }

  // 5. Remove remote external resource references (http://, https://, //) in xlink:href or href
  const remoteRefRegex = /(href|xlink:href)\s*=\s*["']\s*(?:https?:)?\/\/[^"']*["']/gi;
  if (remoteRefRegex.test(sanitized)) {
    sanitized = sanitized.replace(remoteRefRegex, '$1=""');
    issues.push('Neutralized external remote URL references.');
  }

  // 6. Neutralize dangerous foreignObject contents
  if (/<foreignObject[\s\S]*?<\/foreignObject>/gi.test(sanitized)) {
    sanitized = sanitized.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
    issues.push('Neutralized <foreignObject> block.');
  }

  // Ensure svg element is properly present
  if (!/<svg/i.test(sanitized)) {
    throw new SecurityValidationError('Input does not contain a valid <svg> root element.', 'INVALID_SVG');
  }

  return {
    sanitized: sanitized.trim(),
    wasSanitized: issues.length > 0,
    issues,
  };
}
