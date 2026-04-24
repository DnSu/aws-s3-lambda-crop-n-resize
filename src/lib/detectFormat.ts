import sharp from 'sharp';

export interface SupportedInputFormatResult {
  format?: string;
  reason?: string;
}

export async function detectFormat(body: Buffer): Promise<string> {
  const metadata = await sharp(body).metadata();
  if (!metadata.format) {
    throw new Error('Unable to detect image format');
  }
  return metadata.format;
}

export function isInputFormatSupportedBySharp(format: string): boolean {
  const normalized = format.toLowerCase();
  const formats = sharp.format as unknown as Record<string, { input?: { buffer?: boolean } } | undefined>;
  return Boolean(formats[normalized]?.input?.buffer);
}

export async function detectSupportedInputFormat(body: Buffer): Promise<SupportedInputFormatResult> {
  try {
    const format = await detectFormat(body);
    if (!isInputFormatSupportedBySharp(format)) {
      return {
        reason: `unsupported input format "${format}" for Sharp`,
      };
    }

    return { format };
  } catch (err) {
    return {
      reason: `unable to detect a Sharp-readable image format (${err instanceof Error ? err.message : String(err)})`,
    };
  }
}
