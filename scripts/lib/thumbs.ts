import config from '../../src/config';
import type { ThumbConfig } from '../../src/config.interface';

export function resolveThumbsToProcess(foldersArg?: string): ThumbConfig[] {
  if (!foldersArg) {
    return config.thumbs;
  }

  return foldersArg.split(',').map((folderName) => {
    const trimmed = folderName.trim();
    const thumb = config.thumbs.find((thumbConfig) => thumbConfig.folder === trimmed);

    if (!thumb) {
      const available = config.thumbs.map((thumbConfig) => thumbConfig.folder).join(', ');
      throw new Error(`Unknown folder "${trimmed}". Available: ${available}`);
    }

    return thumb;
  });
}
