import gm from 'gm';

const imageMagick = gm.subClass({ imageMagick: true });

interface ImageSize {
  width: number;
  height: number;
}

export function toOptionalNumber(value?: string | number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getImageSize(body: Buffer): Promise<ImageSize> {
  return new Promise((resolve, reject) => {
    imageMagick(body).size((err, size) => {
      if (err || !size || !size.width || !size.height) {
        reject(err ?? new Error('Unable to determine image size'));
        return;
      }

      resolve({ width: size.width, height: size.height });
    });
  });
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

  return new Promise((resolve, reject) => {
    imageMagick(body)
      .autoOrient()
      .noProfile()
      .command('convert')
      .out('-quality', '95')
      .out('-gravity', 'center')
      .out('-crop', `${crop.width}x${crop.height}+0+0`)
      .out('+repage')
      .out('-resize', `${target.width}x${target.height}>`)
      .toBuffer(imageType, (err, buffer) => {
        if (err || !buffer) {
          reject(err ?? new Error('Unable to generate thumbnail'));
          return;
        }
        resolve(buffer);
      });
  });
}

export function toBufferResize(
  body: Buffer,
  imageType: string,
  width: number | null,
  height: number | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const resizeGeometry = `${width ?? ''}x${height ?? ''}>`;
    imageMagick(body)
      .autoOrient()
      .noProfile()
      .command('convert')
      .out('-resize', resizeGeometry)
      .toBuffer(imageType, (err, buffer) => {
        if (err || !buffer) {
          reject(err ?? new Error('Unable to resize image'));
          return;
        }
        resolve(buffer);
      });
  });
}

export function convertBufferFormat(body: Buffer, outputFormat: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    imageMagick(body)
      .command('convert')
      .toBuffer(outputFormat, (err, buffer) => {
        if (err || !buffer) {
          reject(err ?? new Error(`Unable to convert image to ${outputFormat}`));
          return;
        }
        resolve(buffer);
      });
  });
}
