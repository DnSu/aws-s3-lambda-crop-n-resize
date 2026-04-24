export type ThumbType = 'thumbnail' | 'resize';

export interface ThumbConfig {
  folder: string;
  type: ThumbType;
  geometry?: string;
  width?: string | number;
  height?: string | number;
  webp?: boolean;
  avif?: boolean;
}

export interface AppConfig {
  dstBucket: string;
  thumbs: ThumbConfig[];
}
