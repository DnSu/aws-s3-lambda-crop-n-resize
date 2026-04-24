import type { ThumbConfig } from '../config';
import { toOptionalNumber, toBufferThumbnail, toBufferResize } from './imageProcessing';

export type UploadFn = (targetKey: string, buffer: Buffer, contentType: string | undefined) => Promise<void>;

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

  await uploadFn(`${thumb.folder}/${dstKey}`, outputBuffer, contentType);
}
