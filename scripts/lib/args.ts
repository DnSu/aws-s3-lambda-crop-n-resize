export function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

export function getBackfillArgs(args: string[]): {
  srcBucket?: string;
  foldersArg?: string;
  prefix: string;
  concurrency: number;
  dryRun: boolean;
} {
  const srcBucket = getArg(args, '--src-bucket');
  const foldersArg = getArg(args, '--folders');
  const prefix = getArg(args, '--prefix') ?? '';
  const concurrency = Number(getArg(args, '--concurrency') ?? '5');
  const dryRun = args.includes('--dry-run');

  return { srcBucket, foldersArg, prefix, concurrency, dryRun };
}
