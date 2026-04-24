import sharp from 'sharp';

interface ImageSize {
  width: number;
  height: number;
}

function normalizeFormatForSharp(format: string): string {
  return format.toLowerCase() === 'jpg' ? 'jpeg' : format.toLowerCase();
}

export function toOptionalNumber(value?: string | number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function getImageSize(body: Buffer): Promise<ImageSize> {
  const metadata = await sharp(body).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to determine image size');
  }
  return { width: metadata.width, height: metadata.height };
}

function parseGeometry(geometry: string): ImageSize {
  const match = geometry.match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error(`Invalid thumbnail geometry: ${geometry}. Expected format WxH (for example 500x500).`);
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid thumbnail geometry values: ${geometry}`);
  }

  return { width, height };
}

function computeCropBox(source: ImageSize, target: ImageSize): ImageSize {
  const targetRatio = target.width / target.height;
  const sourceRatio = source.width / source.height;

  if (sourceRatio > targetRatio) {
    return { width: Math.max(1, Math.round(source.height * targetRatio)), height: source.height };
  }

  return { width: source.width, height: Math.max(1, Math.round(source.width / targetRatio)) };
}

export async function toBufferThumbnail(body: Buffer, imageType: string, geometry: string): Promise<Buffer> {
  const target = parseGeometry(geometry);
  const sourceSize = await getImageSize(body);
  const crop = computeCropBox(sourceSize, target);
  const outputFormat = normalizeFormatForSharp(imageType);

  return sharp(body)
    .rotate()
    .extract({
      left: Math.max(0, Math.round((sourceSize.width - crop.width) / 2)),
      top: Math.max(0, Math.round((sourceSize.height - crop.height) / 2)),
      width: crop.width,
      height: crop.height,
    })
    .resize(target.width, target.height, {
      fit: 'cover',
      withoutEnlargement: true,
    })
    .toFormat(outputFormat as keyof sharp.FormatEnum, { quality: 95 })
    .toBuffer();
}

export async function toBufferResize(
  body: Buffer,
  imageType: string,
  width: number | null,
  height: number | null
): Promise<Buffer> {
  const outputFormat = normalizeFormatForSharp(imageType);

  return sharp(body)
    .rotate()
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toFormat(outputFormat as keyof sharp.FormatEnum, { quality: 95 })
    .toBuffer();
}

export async function convertBufferFormat(body: Buffer, outputFormat: string): Promise<Buffer> {
  const pipeline = sharp(body);

  switch (outputFormat.toLowerCase()) {
    case 'webp':
      return pipeline.webp({ quality: 95 }).toBuffer();
    case 'avif':
      return pipeline.avif({ quality: 95 }).toBuffer();
    case 'jpeg':
    case 'jpg':
      return pipeline.jpeg({ quality: 95 }).toBuffer();
    case 'png':
      return pipeline.png().toBuffer();
    default:
      throw new Error(`Unsupported output format: ${outputFormat}`);
  }
}
