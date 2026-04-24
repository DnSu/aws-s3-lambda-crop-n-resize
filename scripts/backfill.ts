/**
 * One-time backfill script — regenerates thumb variants for existing source objects.
 *
 * Use this after adding new rows to config.thumbs to populate those folders
 * for images that were uploaded before the config change.
 *
 * Usage:
 *   npx ts-node scripts/backfill.ts \
 *     --src-bucket <source-bucket> \
 *     [--folders <folder1,folder2>]   # defaults to all thumbs in config
 *     [--prefix <s3-key-prefix>]      # e.g. "uploads/" to narrow the scan
 *     [--concurrency <n>]             # parallel image downloads (default: 5)
 *     [--dry-run]                     # list what would be processed, no uploads
 */

import AWS from 'aws-sdk';
import config from '../src/config';
import { detectFormat } from '../src/lib/detectFormat';
import { processThumb } from '../src/lib/processThumb';
import type { ThumbConfig } from '../src/config';
import { getBackfillArgs } from './lib/args';
import { withConcurrency } from './lib/concurrency';
import { listObjects, objectExists } from './lib/s3';
import { resolveThumbsToProcess } from './lib/thumbs';

const s3 = new AWS.S3();

// --- CLI args -----------------------------------------------------------------

const args = process.argv.slice(2);
const { srcBucket, foldersArg, prefix, concurrency, dryRun } = getBackfillArgs(args);

if (!srcBucket) {
  console.error(
    'Usage: npx ts-node scripts/backfill.ts --src-bucket <bucket> ' +
      '[--folders <f1,f2>] [--prefix <prefix>] [--concurrency <n>] [--dry-run]'
  );
  process.exit(1);
}

const thumbsToProcess: ThumbConfig[] = (() => {
  try {
    return resolveThumbsToProcess(foldersArg);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
})();

const dstBucket = config.dstBucket;

// --- Main --------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`Source bucket : ${srcBucket}`);
  console.log(`Dest bucket   : ${dstBucket}`);
  console.log(`Folders       : ${thumbsToProcess.map((t) => t.folder).join(', ')}`);
  console.log(`Prefix filter : ${prefix || '(none)'}`);
  console.log(`Concurrency   : ${concurrency}`);
  if (dryRun) console.log('DRY RUN — no uploads will be made');
  console.log('');

  const keys: string[] = [];
  for await (const key of listObjects(s3, srcBucket, prefix)) {
    keys.push(key);
  }

  console.log(`Found ${keys.length} object(s) in s3://${srcBucket}/${prefix || '*'}\n`);

  let done = 0;
  let failed = 0;

  await withConcurrency(keys, concurrency, async (key) => {
    const n = ++done;
    console.log(`[${n}/${keys.length}] ${key}`);
    try {
      const thumbChecks = await Promise.all(
        thumbsToProcess.map(async (thumb) => ({
          thumb,
          targetKey: `${thumb.folder}/${key}`,
          exists: await objectExists(s3, dstBucket, `${thumb.folder}/${key}`),
        }))
      );

      const missingThumbs = thumbChecks.filter((item) => !item.exists);

      if (missingThumbs.length === 0) {
        console.log('  skipped — all destination variants already exist');
        return;
      }

      const response = await s3.getObject({ Bucket: srcBucket, Key: key }).promise();

      if (!response.Body) {
        console.warn('  skipped — no body');
        return;
      }

      const sourceBody = Buffer.isBuffer(response.Body) ? response.Body : Buffer.from(response.Body as Uint8Array);

      const imageType = await detectFormat(sourceBody);

      await Promise.all(
        missingThumbs.map(({ thumb }) =>
          processThumb(sourceBody, imageType, response.ContentType, key, thumb, async (targetKey, buffer, ct) => {
            if (dryRun) {
              console.log(`    [dry-run] → ${dstBucket}/${targetKey}`);
              return;
            }
            await s3.putObject({ Bucket: dstBucket, Key: targetKey, Body: buffer, ContentType: ct }).promise();
            console.log(`    uploaded → ${dstBucket}/${targetKey}`);
          })
        )
      );

      for (const existing of thumbChecks.filter((item) => item.exists)) {
        console.log(`    skipped existing → ${dstBucket}/${existing.targetKey}`);
      }
    } catch (err) {
      failed++;
      console.error(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  console.log(`\nDone. ${done - failed} succeeded, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
