import gm from 'gm';

const imageMagick = gm.subClass({ imageMagick: true });

export function toOptionalNumber(value?: string | number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toBufferThumbnail(body: Buffer, imageType: string, geometry: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    imageMagick(body)
      .autoOrient()
      .noProfile()
      .command('convert')
      .out('-quality', '95')
      .out('-gravity', 'center')
      .out('-resize', `${geometry}^`)
      .out('-crop', `${geometry}+0+0`)
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
    (
      imageMagick(body) as unknown as {
        resize: (
          w: number | null,
          h?: number | null
        ) => {
          toBuffer: (format: string, callback: (err: Error | null, buffer: Buffer) => void) => void;
        };
      }
    )
      .resize(width, height)
      .toBuffer(imageType, (err, buffer) => {
        if (err || !buffer) {
          reject(err ?? new Error('Unable to resize image'));
          return;
        }
        resolve(buffer);
      });
  });
}
