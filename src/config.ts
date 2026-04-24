type ThumbType = 'thumbnail' | 'resize';

export interface ThumbConfig {
  folder: string;
  type: ThumbType;
  geometry?: string;
  width?: string | number;
  height?: string | number;
}

export interface AppConfig {
  dstBucket: string;
  thumbs: ThumbConfig[];
}

const config: AppConfig = {
  dstBucket: 'dslambdaresize',
  thumbs: [
    // Square crop centered on the image using an exact target geometry.
    { folder: 'square', type: 'thumbnail', geometry: '500x500' },

    // Large resize that constrains both width and height.
    { folder: 'large', type: 'resize', width: '900', height: '900' },

    // Medium resize constrained by width only, preserving aspect ratio.
    { folder: 'medium', type: 'resize', width: '600' },

    // Small resize constrained by height only, preserving aspect ratio.
    { folder: 'small', type: 'resize', height: '300' },
  ],
};

export default config;
