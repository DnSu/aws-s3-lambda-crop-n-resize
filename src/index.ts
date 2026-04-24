import AWS from 'aws-sdk';
import util from 'util';
import gm from 'gm';
import type { Context, S3Event } from 'aws-lambda';
import config from './config';
import type { ThumbConfig } from './config';
import { detectFormat } from './lib/detectFormat';

const imageMagick = gm.subClass({ imageMagick: true });
const s3 = new AWS.S3();

function toOptionalNumber(value?: string | number): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getObject(bucket: string, key: string): Promise<AWS.S3.GetObjectOutput> {
  return s3.getObject({ Bucket: bucket, Key: key }).promise();
}

function putObject(bucket: string, key: string, data: Buffer, contentType?: string): Promise<AWS.S3.PutObjectOutput> {
  return s3
    .putObject({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
    .promise();
}

function toBufferThumbnail(body: Buffer, imageType: string, geometry: string): Promise<Buffer> {
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

function toBufferResize(body: Buffer, imageType: string, width: number | null, height: number | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    (
      imageMagick(body) as unknown as {
        resize: (
          w: number | null,
          h?: number | null
        ) => {
          toBuffer: (format: string, callback: (err: Error | null, buffer: Buffer) => void) => void;
        };
        toBuffer: (format: string, callback: (err: Error | null, buffer: Buffer) => void) => void;
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

async function processThumb(
  sourceBody: Buffer,
  imageType: string,
  contentType: string | undefined,
  dstBucket: string,
  dstKey: string,
  thumb: ThumbConfig
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

  const targetKey = `${thumb.folder}/${dstKey}`;
  console.log(`Uploading ${targetKey}`);
  await putObject(dstBucket, targetKey, outputBuffer, contentType);
}

export const handler = async (event: S3Event, _context: Context): Promise<void> => {
  console.log('Reading options from event:\n', util.inspect(event, { depth: 5 }));

  const srcBucket = event.Records[0]?.s3.bucket.name;
  const srcKeyEncoded = event.Records[0]?.s3.object.key;

  if (!srcBucket || !srcKeyEncoded) {
    throw new Error('Invalid S3 event payload. Missing bucket name or object key.');
  }

  const srcKey = decodeURIComponent(srcKeyEncoded.replace(/\+/g, ' '));
  const dstBucket = config.dstBucket;
  const dstKey = srcKey;

  // Writing output to the same bucket would re-trigger this Lambda, causing an infinite loop.
  if (srcBucket === dstBucket) {
    throw new Error('Destination bucket must not match source bucket.');
  }

  const response = await getObject(srcBucket, srcKey);
  if (!response.Body) {
    throw new Error(`Source object has no body: ${srcBucket}/${srcKey}`);
  }

  const sourceBody = Buffer.isBuffer(response.Body) ? response.Body : Buffer.from(response.Body as Uint8Array);
  const imageType = await detectFormat(sourceBody);

  await Promise.all(
    config.thumbs.map((thumb) => processThumb(sourceBody, imageType, response.ContentType, dstBucket, dstKey, thumb))
  );

  console.log(`Successfully resized ${srcBucket}/${srcKey} and uploaded to ${dstBucket}/${dstKey}`);
};
