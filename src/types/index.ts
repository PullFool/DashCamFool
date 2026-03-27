export interface VideoClip {
  id: string;
  filePath: string;
  fileName: string;
  duration: number; // seconds
  fileSize: number; // bytes
  createdAt: number; // timestamp
  isLocked: boolean; // protected from auto-deletion
  camera: 'front' | 'back';
  thumbnailPath?: string;
  location?: LocationData;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number; // km/h
  timestamp: number;
}

export interface AppSettings {
  maxStorageMB: number; // max storage in megabytes
  chunkDurationSec: number; // recording chunk duration (default 180 = 3 min)
  activeCamera: 'front' | 'back';
  showTimestamp: boolean;
  showSpeed: boolean;
  darkMode: boolean;
  videoQuality: 'sd' | 'hd' | 'fhd'; // 480p, 720p, 1080p
  autoStartRecording: boolean;
}

export interface StorageInfo {
  usedMB: number;
  maxMB: number;
  clipCount: number;
  lockedClipCount: number;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  currentChunkStart: number | null;
  elapsedSeconds: number;
  currentCamera: 'front' | 'back';
}

export const DEFAULT_SETTINGS: AppSettings = {
  maxStorageMB: 2048, // 2GB default
  chunkDurationSec: 180, // 3 minutes
  activeCamera: 'back',
  showTimestamp: true,
  showSpeed: true,
  darkMode: true,
  videoQuality: 'hd',
  autoStartRecording: false,
};
