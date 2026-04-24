import AWS from 'aws-sdk';
import util from 'util';
import type { Context, S3Event } from 'aws-lambda';
import config from './config';
import { detectSupportedInputFormat } from './lib/detectFormat';
import { processThumb } from './lib/processThumb';

const s3 = new AWS.S3();

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
  const supportedFormat = await detectSupportedInputFormat(sourceBody);
  if (!supportedFormat.format) {
    console.warn(`Skipping ${srcBucket}/${srcKey}: ${supportedFormat.reason}.`);
    return;
  }
  const imageType = supportedFormat.format;

  await Promise.all(
    config.thumbs.map((thumb) =>
      processThumb(sourceBody, imageType, response.ContentType, dstKey, thumb, async (targetKey, buffer, ct) => {
        console.log(`Uploading ${targetKey}`);
        await putObject(dstBucket, targetKey, buffer, ct);
      })
    )
  );

  console.log(`Successfully resized ${srcBucket}/${srcKey} and uploaded to ${dstBucket}/${dstKey}`);
};
