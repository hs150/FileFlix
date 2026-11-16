import {
  ConversionAdapter,
  ConversionInput,
  ConversionOutput,
} from './conversion-types';
import {
  ConversionError,
  UnsupportedConversionError,
  ResourceLimitError,
} from './conversion-errors';
import { findConversionDefinition } from './conversion-registry';
import { archiveAdapter } from '../adapters/archive/archive-adapter';
import { dataAdapter } from '../adapters/data/data-adapter';
import { vectorAdapter } from '../adapters/vector/vector-adapter';
import { ebookAdapter } from '../adapters/ebook/ebook-adapter';
import { imagePdfAdapter } from '../adapters/image-pdf-adapter';

// Registered Adapters Array
const REGISTERED_ADAPTERS: ConversionAdapter[] = [
  archiveAdapter,
  dataAdapter,
  vectorAdapter,
  ebookAdapter,
  imagePdfAdapter,
];

/**
 * Universal Conversion Execution Engine
 * Validates, orchestrates, executes, and verifies conversions browser-locally.
 */
export async function executeConversion(
  input: ConversionInput,
  targetFormatId: string,
  options?: Record<string, any>
): Promise<ConversionOutput> {
  const inputFormatId = input.detectedFormat.formatId;

  // 1. Verify Definition in Registry
  const def = findConversionDefinition(inputFormatId, targetFormatId);
  if (!def) {
    throw new UnsupportedConversionError(inputFormatId, targetFormatId);
  }

  // 2. Resource Limit Check
  if (def.maxInputBytes && input.sizeBytes > def.maxInputBytes) {
    throw new ResourceLimitError(
      `File exceeds maximum allowed size for ${def.inputExtension.toUpperCase()} to ${def.outputExtension.toUpperCase()} conversion (${(def.maxInputBytes / (1024 * 1024)).toFixed(0)} MB limit).`,
      'MAX_INPUT_BYTES_EXCEEDED'
    );
  }

  // 3. Find Matching Adapter
  const adapter = REGISTERED_ADAPTERS.find(
    (a) =>
      a.id === def.engineId ||
      a.supportedPairs.some(
        (pair) =>
          (pair.input === inputFormatId || pair.input === def.inputExtension) &&
          (pair.output === targetFormatId || pair.output === def.outputExtension)
      )
  );

  if (!adapter) {
    throw new ConversionError(
      `No internal adapter registered for engine "${def.engineId}".`,
      'ADAPTER_NOT_FOUND'
    );
  }

  // 4. Pre-Conversion Validation
  if (adapter.validateInput) {
    await adapter.validateInput(input);
  }

  // 5. Execute Conversion
  const output = await adapter.execute(input, {
    ...options,
    targetFormat: targetFormatId,
    conversionDef: def,
  });

  // 6. Verify Output Integrity
  if (!output.blob || output.blob.size === 0) {
    throw new ConversionError('Conversion produced an empty output file.', 'EMPTY_OUTPUT');
  }

  return output;
}
