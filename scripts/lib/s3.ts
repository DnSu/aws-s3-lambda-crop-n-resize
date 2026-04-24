import type AWS from 'aws-sdk';

export async function objectExists(s3: AWS.S3, bucket: string, key: string): Promise<boolean> {
  try {
    await s3.headObject({ Bucket: bucket, Key: key }).promise();
    return true;
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'NotFound') {
      return false;
    }
    throw err;
  }
}

export async function* listObjects(s3: AWS.S3, bucket: string, keyPrefix: string): AsyncGenerator<string> {
  let continuationToken: string | undefined;
  do {
    const response = await s3
      .listObjectsV2({ Bucket: bucket, Prefix: keyPrefix, ContinuationToken: continuationToken })
      .promise();

    for (const obj of response.Contents ?? []) {
      if (obj.Key) {
        yield obj.Key;
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
}
