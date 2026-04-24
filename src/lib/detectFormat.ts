import gm from 'gm';

const imageMagick = gm.subClass({ imageMagick: true });

export function detectFormat(body: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    imageMagick(body).format((err, format) => {
      if (err || !format) {
        reject(err ?? new Error('Unable to detect image format'));
        return;
      }

      resolve(format);
    });
  });
}
