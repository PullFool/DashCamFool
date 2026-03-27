export const APP_NAME = 'MotoDashCam';
export const RECORDING_DIR = 'MotoDashCam';
export const THUMBNAIL_DIR = 'MotoDashCam/thumbnails';

export const CHUNK_DURATION_DEFAULT = 180; // 3 minutes in seconds
export const MAX_STORAGE_DEFAULT_MB = 2048; // 2 GB
export const MIN_STORAGE_MB = 256; // 256 MB minimum
export const MAX_STORAGE_LIMIT_MB = 16384; // 16 GB maximum

export const VIDEO_QUALITY_MAP = {
  sd: { width: 640, height: 480, bitrate: 1_000_000 },
  hd: { width: 1280, height: 720, bitrate: 2_500_000 },
  fhd: { width: 1920, height: 1080, bitrate: 5_000_000 },
} as const;

export const STORAGE_PRESETS_MB = [512, 1024, 2048, 4096, 8192];

export const COLORS = {
  dark: {
    background: '#0D0D0D',
    surface: '#1A1A1A',
    surfaceLight: '#2A2A2A',
    primary: '#FF4444',
    primaryDim: '#CC3333',
    accent: '#00CC66',
    text: '#FFFFFF',
    textSecondary: '#999999',
    border: '#333333',
    danger: '#FF3333',
    warning: '#FFAA00',
    success: '#00CC66',
    locked: '#FFD700',
  },
  light: {
    background: '#F5F5F5',
    surface: '#FFFFFF',
    surfaceLight: '#E8E8E8',
    primary: '#DD2222',
    primaryDim: '#BB1111',
    accent: '#009944',
    text: '#111111',
    textSecondary: '#666666',
    border: '#DDDDDD',
    danger: '#DD2222',
    warning: '#CC8800',
    success: '#009944',
    locked: '#DAA520',
  },
};
