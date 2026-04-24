## aws-s3-lambda-crop-n-resize

Lambda function when triggered by an S3 PUT (configured in lambda triggers in AWS) automatically resizes images to "standar sizes" and place them in destination bucket (dsBucket).

Why? Cause S3 + lambda is cheaper than image processor like imgix. Best for small projects that don't really generate revenue.

### Dependencies

```bash
$ npm install
```

This package is now written in TypeScript.

### Build

```bash
$ npm run build
```

Compiled output is emitted to `dist/`.

### Run Backfill From CLI

Use `scripts/backfill.ts` to regenerate variants for objects already in your source bucket.

1. Install runtime tooling for direct TypeScript execution:

```bash
$ npm install --save-dev ts-node
```

2. Run a dry run first:

```bash
$ npx ts-node scripts/backfill.ts --src-bucket <source-bucket> --dry-run
```

3. Run the actual backfill:

```bash
$ npx ts-node scripts/backfill.ts --src-bucket <source-bucket>
```

Optional flags:

```bash
# Limit to specific output folders from src/config.ts
$ npx ts-node scripts/backfill.ts --src-bucket <source-bucket> --folders square,large

# Limit scan to a prefix
$ npx ts-node scripts/backfill.ts --src-bucket <source-bucket> --prefix uploads/

# Tune parallelism (default: 5)
$ npx ts-node scripts/backfill.ts --src-bucket <source-bucket> --concurrency 10
```

### Configure

Edit `src/config.ts` and set your destination bucket and generated sizes.

Sample config.ts

```ts
const config = {
  dstBucket: 'dslambdaresize',
  thumbs: [
    // Square crop centered on image subject.
    { folder: 'square', type: 'thumbnail', geometry: '500x500' },
    // Large resize bounded by width and height.
    { folder: 'large', type: 'resize', width: '900', height: '900' },
    // Medium resize bounded by width only.
    { folder: 'medium', type: 'resize', width: '600' },
    // Small resize bounded by height only.
    { folder: 'small', type: 'resize', height: '300' },
  ],
};
```

- `dstBucket`: destination bucket (source bucket is determined by trigger in lambda)
- `thumbs`: various size and shares
  - `folder`: each entry must be unique, or you'll be overwriting the files
  - `type`: processing mode
    - `thumbnail`: resize and center-crops the image
    - `resize`: simple reduce in size preserving aspect ratio of original
  - `geometry`: required for `thumbnail` mode
  - `height` and `width`: at least one is required for `resize` mode

### Deploy

1. build the project with `npm run build`
2. zip content of the folder (including `dist/`)
3. upload as lambda function
   - Lambda Config
     - Runtime: modern Node.js runtime (for example Node.js 20.x)
     - Handler: dist/index.handler
     - Memory: 1024MB
     - Timeout: 3 min
4. make sure dstBucket exists

### Permissions

Your Lambda execution role needs read access to the source bucket and write access to the destination bucket.

Example IAM policy for the Lambda role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadSourceObject",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::<SOURCE_BUCKET>/*"
    },
    {
      "Sid": "WriteDestinationObject",
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::<DEST_BUCKET>/*"
    }
  ]
}
```

If you configure S3 PUT triggers through Serverless on an existing bucket, the deployment identity also needs permission to manage bucket notifications and Lambda invoke permissions.

Typical deployment permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetBucketNotification", "s3:PutBucketNotification"],
      "Resource": "arn:aws:s3:::<SOURCE_BUCKET>"
    },
    {
      "Effect": "Allow",
      "Action": ["lambda:AddPermission", "lambda:RemovePermission"],
      "Resource": "arn:aws:lambda:<REGION>:<ACCOUNT_ID>:function:<FUNCTION_NAME>"
    }
  ]
}
```

### Notes

- Large files (3+ MB) might cause problems. Try allocating more memory in Lambda.
- Start with 1024mb of ram and 2 minutes timeout, and read log to adjust
- Code based on [AWS tutorial](http://docs.aws.amazon.com/lambda/latest/dg/with-s3-example-deployment-pkg.html)
- Only handles jpg and png
