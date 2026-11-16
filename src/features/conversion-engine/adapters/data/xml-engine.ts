import { SecurityValidationError } from '../../core/conversion-errors';

/**
 * Universal XML <-> JSON Conversion Engine with XXE Defense
 */

export function parseXmlToJson(xmlText: string): any {
  // 1. XXE Defense: Reject external entities, DTDs with SYSTEM, or parameter entities
  if (/<!DOCTYPE[^>]*SYSTEM/i.test(xmlText) || /<!ENTITY[^>]*SYSTEM/i.test(xmlText)) {
    throw new SecurityValidationError(
      'XML document contains forbidden external entity (XXE) definitions.',
      'XXE_DETECTED'
    );
  }

  // Strip XML declaration and comments
  const cleanXml = xmlText
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  return parseXmlElement(cleanXml);
}

function parseXmlElement(xml: string): any {
  xml = xml.trim();
  if (!xml.startsWith('<')) {
    return unescapeXml(xml);
  }

  // Match root element: <tag attrs>content</tag> or <tag attrs/>
  const tagMatch = xml.match(/^<([\w:-]+)((?:\s+[\w:-]+="[^"]*")*)\s*(?:\/>|>([\s\S]*)<\/\1>)$/);
  if (!tagMatch) {
    // Might be multiple adjacent elements or text
    return parseMultipleElements(xml);
  }

  const tagName = tagMatch[1];
  const attrsStr = tagMatch[2];
  const innerContent = tagMatch[3] !== undefined ? tagMatch[3].trim() : '';

  const result: Record<string, any> = {};

  // Parse attributes
  if (attrsStr) {
    const attrRegex = /([\w:-]+)="([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
      result[`@${attrMatch[1]}`] = unescapeXml(attrMatch[2]);
    }
  }

  // Parse inner content
  if (innerContent) {
    if (innerContent.startsWith('<')) {
      const children = parseMultipleElements(innerContent);
      Object.assign(result, children);
    } else {
      const textVal = unescapeXml(innerContent);
      if (Object.keys(result).length === 0) {
        return { [tagName]: textVal };
      }
      result['#text'] = textVal;
    }
  }

  return { [tagName]: Object.keys(result).length > 0 ? result : '' };
}

function parseMultipleElements(xml: string): Record<string, any> {
  const result: Record<string, any> = {};
  // Regular expression to match each child tag
  const childRegex = /<([\w:-]+)([^>]*)>(?:([\s\S]*?)<\/\1>|)/g;
  let match;
  let lastIndex = 0;

  while ((match = childRegex.exec(xml)) !== null) {
    const tagName = match[1];
    const fullMatch = match[0];
    const childObj = parseXmlElement(fullMatch);
    const value = childObj[tagName];

    if (result[tagName]) {
      if (!Array.isArray(result[tagName])) {
        result[tagName] = [result[tagName]];
      }
      result[tagName].push(value);
    } else {
      result[tagName] = value;
    }
    lastIndex = childRegex.lastIndex;
  }

  // If no child tags matched, treat as text
  if (Object.keys(result).length === 0 && xml.trim()) {
    return { value: unescapeXml(xml.trim()) };
  }

  return result;
}

export function serializeJsonToXml(obj: any, rootTag: string = 'root'): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<${rootTag}>\n`;
  xml += jsonToXmlNodes(obj, '  ');
  xml += `</${rootTag}>\n`;
  return xml;
}

function jsonToXmlNodes(data: any, indent: string): string {
  if (data === null || data === undefined) return '';

  let out = '';

  if (Array.isArray(data)) {
    for (const item of data) {
      out += `${indent}<item>\n`;
      out += jsonToXmlNodes(item, indent + '  ');
      out += `${indent}</item>\n`;
    }
  } else if (typeof data === 'object') {
    for (const key of Object.keys(data)) {
      if (key.startsWith('@')) continue; // Skip attribute in generic node formatting
      const val = data[key];
      const safeKey = key.replace(/[^\w:-]/g, '_');

      if (Array.isArray(val)) {
        for (const subItem of val) {
          out += `${indent}<${safeKey}>\n`;
          out += jsonToXmlNodes(subItem, indent + '  ');
          out += `${indent}</${safeKey}>\n`;
        }
      } else if (typeof val === 'object' && val !== null) {
        out += `${indent}<${safeKey}>\n`;
        out += jsonToXmlNodes(val, indent + '  ');
        out += `${indent}</${safeKey}>\n`;
      } else {
        out += `${indent}<${safeKey}>${escapeXml(String(val ?? ''))}</${safeKey}>\n`;
      }
    }
  } else {
    out += `${indent}${escapeXml(String(data))}\n`;
  }

  return out;
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
