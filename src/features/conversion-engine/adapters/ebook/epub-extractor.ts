import * as fflate from 'fflate';
import { ConversionError } from '../../core/conversion-errors';

/**
 * Extracts plain text or chapters from an EPUB publication.
 * Discloses DRM restrictions honestly.
 */
export function extractTextFromEpub(epubBuffer: ArrayBuffer | Uint8Array): {
  text: string;
  title: string;
  chapterCount: number;
} {
  const u8 = epubBuffer instanceof Uint8Array ? epubBuffer : new Uint8Array(epubBuffer);
  const unzipped = fflate.unzipSync(u8);
  const decoder = new TextDecoder('utf-8');

  // 1. DRM Protection Check
  if (unzipped['META-INF/encryption.xml'] || unzipped['META-INF/rights.xml']) {
    throw new ConversionError(
      'This EPUB publication is encrypted with Digital Rights Management (DRM). FileFix does not circumvent DRM protections.',
      'DRM_PROTECTED_EPUB'
    );
  }

  // 2. Read META-INF/container.xml
  if (!unzipped['META-INF/container.xml']) {
    throw new ConversionError('Invalid EPUB: missing META-INF/container.xml.', 'INVALID_EPUB_CONTAINER');
  }

  const containerXml = decoder.decode(unzipped['META-INF/container.xml']);
  const opfMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfMatch) {
    throw new ConversionError('Invalid EPUB: container.xml does not declare package full-path.', 'NO_OPF_DECLARED');
  }

  const opfPath = opfMatch[1];
  if (!unzipped[opfPath]) {
    throw new ConversionError(`Invalid EPUB: package document "${opfPath}" not found in archive.`, 'OPF_NOT_FOUND');
  }

  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfXml = decoder.decode(unzipped[opfPath]);

  // Extract Title
  const titleMatch = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
  const title = titleMatch ? unescapeXml(titleMatch[1].trim()) : 'eBook Document';

  // 3. Parse Manifest (id -> href)
  const manifest: Record<string, string> = {};
  const itemMatches = opfXml.match(/<item\s+[^>]*\/>|<item\s+[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const itemTag of itemMatches) {
    const idMatch = itemTag.match(/id="([^"]+)"/);
    const hrefMatch = itemTag.match(/href="([^"]+)"/);
    if (idMatch && hrefMatch) {
      manifest[idMatch[1]] = hrefMatch[1];
    }
  }

  // 4. Parse Spine (reading order)
  const itemrefs = opfXml.match(/<itemref\s+[^>]*\/>/gi) || [];
  const textParts: string[] = [];

  for (const itemref of itemrefs) {
    const idrefMatch = itemref.match(/idref="([^"]+)"/);
    if (!idrefMatch) continue;
    const id = idrefMatch[1];
    const relHref = manifest[id];
    if (!relHref) continue;

    // Resolve path relative to OPF location
    const docPath = opfDir + relHref;
    if (unzipped[docPath]) {
      const docXml = decoder.decode(unzipped[docPath]);
      const chapterText = stripHtmlToText(docXml);
      if (chapterText.trim()) {
        textParts.push(chapterText.trim());
      }
    }
  }

  return {
    text: textParts.join('\n\n--- \n\n'),
    title,
    chapterCount: textParts.length,
  };
}

function stripHtmlToText(html: string): string {
  // Extract body if present
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : html;

  // Replace block elements with newlines
  content = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(?:p|div|h[1-6]|li|blockquote|section|article)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  // Decode XML/HTML entities
  content = unescapeXml(content);

  // Normalize multiple spaces and newlines
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n\n');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&nbsp;/g, ' ');
}
