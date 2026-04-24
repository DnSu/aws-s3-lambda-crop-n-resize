import type { ThumbConfig } from '../config';
import { toOptionalNumber, toBufferThumbnail, toBufferResize, convertBufferFormat } from './imageProcessing';

export type UploadFn = (targetKey: string, buffer: Buffer, contentType: string | undefined) => Promise<void>;

export interface OutputTarget {
  targetKey: string;
  format: string;
}

function swapExtension(key: string, extension: string): string {
  const slash = key.lastIndexOf('/');
  const dot = key.lastIndexOf('.');

  if (dot > slash) {
    return `${key.slice(0, dot)}.${extension}`;
  }

  return `${key}.${extension}`;
}

export function buildOutputTargets(baseKey: string, thumb: ThumbConfig): OutputTarget[] {
  const targets: OutputTarget[] = [
    {
      targetKey: `${thumb.folder}/${baseKey}`,
      format: 'source',
    },
  ];

  if (thumb.webp !== false) {
    targets.push({
      targetKey: `${thumb.folder}/${swapExtension(baseKey, 'webp')}`,
      format: 'webp',
    });
  }

  if (thumb.avif !== false) {
    targets.push({
      targetKey: `${thumb.folder}/${swapExtension(baseKey, 'avif')}`,
      format: 'avif',
    });
  }

  return targets;
}

export async function processThumb(
  sourceBody: Buffer,
  imageType: string,
  contentType: string | undefined,
  dstKey: string,
  thumb: ThumbConfig,
  uploadFn: UploadFn
): Promise<void> {
  let outputBuffer: Buffer;

  if (thumb.type === 'thumbnail') {
    const geometry = thumb.geometry ?? '960x540';
    console.log(`Thumbnail ${geometry}`);
    outputBuffer = await toBufferThumbnail(sourceBody, imageType, geometry);
  } else {
    const width = toOptionalNumber(thumb.width) ?? null;
    const height = toOptionalNumber(thumb.height) ?? null;
    console.log(`Resize ${width ?? ''}x${height ?? ''}`);
    outputBuffer = await toBufferResize(sourceBody, imageType, width, height);
  }

  const outputTargets = buildOutputTargets(dstKey, thumb);
  const baseTarget = outputTargets[0];

  await uploadFn(baseTarget.targetKey, outputBuffer, contentType);

  for (const target of outputTargets.slice(1)) {
    if (target.targetKey === baseTarget.targetKey) {
      continue;
    }

    const converted = await convertBufferFormat(outputBuffer, target.format);
    const targetContentType = target.format === 'webp' ? 'image/webp' : 'image/avif';
    await uploadFn(target.targetKey, converted, targetContentType);
  }
}
