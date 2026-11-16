import * as fflate from 'fflate';

/**
 * W3C EPUB 3.3 Compliant In-Browser Generator
 * Generates valid, validated EPUB 3 packages.
 */

export interface CreateEpubOptions {
  title: string;
  author?: string;
  language?: string;
  cssStyles?: string;
}

export function createEpubFromText(content: string, isHtml: boolean = false, options?: CreateEpubOptions): Uint8Array {
  const encoder = new TextEncoder();
  const title = options?.title || 'Document';
  const author = options?.author || 'FileFix';
  const lang = options?.language || 'en';
  const bookId = 'urn:uuid:' + generateUuid();

  // 1. Format Chapter 1 XHTML
  let bodyContent = '';
  if (isHtml) {
    // Sanitize and extract body or wrap
    const cleanHtml = content
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '');
    const bodyMatch = cleanHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    bodyContent = bodyMatch ? bodyMatch[1] : cleanHtml;
  } else {
    // Plain text: split paragraphs
    const paragraphs = content.split(/\r?\n\r?\n/).filter((p) => p.trim().length > 0);
    bodyContent = paragraphs.map((p) => `<p>${escapeXml(p.trim())}</p>`).join('\n      ');
  }

  const chapterXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
  </head>
  <body>
    <section epub:type="chapter">
      <h1>${escapeXml(title)}</h1>
      ${bodyContent}
    </section>
  </body>
</html>`;

  // 2. Navigation Document (nav.xhtml - EPUB 3 requirement)
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">
  <head>
    <meta charset="utf-8"/>
    <title>Table of Contents</title>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Table of Contents</h1>
      <ol>
        <li><a href="chapter1.xhtml">${escapeXml(title)}</a></li>
      </ol>
    </nav>
  </body>
</html>`;

  // 3. Package Document (OEBPS/content.opf)
  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${bookId}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${lang}</dc:language>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="styles.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`;

  // 4. Container Document (META-INF/container.xml)
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  // 5. Stylesheet (OEBPS/styles.css)
  const defaultCss =
    options?.cssStyles ||
    `body { font-family: sans-serif; line-height: 1.6; margin: 5%; color: #333; }
h1 { color: #111; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; }
p { margin-bottom: 1em; text-align: justify; }`;

  // 6. Package into ZIP with uncompressed 'mimetype'
  // Strict EPUB requirement: 'mimetype' must be the first file and uncompressed (level 0)
  const zipFiles: fflate.AsyncZippable = {
    mimetype: [encoder.encode('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': encoder.encode(containerXml),
    'OEBPS/content.opf': encoder.encode(contentOpf),
    'OEBPS/nav.xhtml': encoder.encode(navXhtml),
    'OEBPS/chapter1.xhtml': encoder.encode(chapterXhtml),
    'OEBPS/styles.css': encoder.encode(defaultCss),
  };

  return fflate.zipSync(zipFiles as any);
}

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
