import { Camera } from 'react-native-vision-camera';
import { VideoClip, AppSettings } from '../types';
import { storageManager } from './StorageManager';
import { locationService } from './LocationService';
import { backgroundService } from './BackgroundService';

type ClipCallback = (clip: VideoClip) => void;
type StateCallback = (state: { isRecording: boolean; elapsed: number }) => void;
type ErrorCallback = (error: string) => void;
type DeleteCallback = (deletedIds: string[]) => void;

class RecordingService {
  private cameraRef: Camera | null = null;
  private isRecording = false;
  private lockNextClip = false;
  private elapsedInterval: ReturnType<typeof setInterval> | null = null;
  private chunkTimeout: ReturnType<typeof setTimeout> | null = null;
  private elapsedSeconds = 0;
  private totalSeconds = 0;
  private currentSettings: AppSettings | null = null;
  private currentClips: VideoClip[] = [];
  private waitingForNextChunk = false;

  private onClipSaved: ClipCallback | null = null;
  private onStateChange: StateCallback | null = null;
  private onError: ErrorCallback | null = null;
  private onClipsDeleted: DeleteCallback | null = null;

  setCameraRef(ref: Camera | null): void {
    this.cameraRef = ref;
  }

  setCameraReset(_fn: any): void {}

  setCallbacks(callbacks: {
    onClipSaved?: ClipCallback;
    onStateChange?: StateCallback;
    onError?: ErrorCallback;
    onClipsDeleted?: DeleteCallback;
  }): void {
    if (callbacks.onClipSaved) this.onClipSaved = callbacks.onClipSaved;
    if (callbacks.onStateChange) this.onStateChange = callbacks.onStateChange;
    if (callbacks.onError) this.onError = callbacks.onError;
    if (callbacks.onClipsDeleted) this.onClipsDeleted = callbacks.onClipsDeleted;
  }

  updateState(settings: AppSettings, clips: VideoClip[]): void {
    this.currentSettings = settings;
    this.currentClips = clips;
  }

  async startRecording(settings: AppSettings, clips: VideoClip[]): Promise<void> {
    if (!this.cameraRef) {
      this.onError?.('Camera not ready');
      return;
    }

    this.currentSettings = settings;
    this.currentClips = clips;
    this.totalSeconds = 0;

    await storageManager.ensureDirectories();

    const deletedIds = await storageManager.enforceStorageLimit(clips, settings.maxStorageMB);
    if (deletedIds.length > 0) {
      this.onClipsDeleted?.(deletedIds);
      this.currentClips = clips.filter(c => !deletedIds.includes(c.id));
    }

    const { canRecord, reason } = await storageManager.canRecord(
      this.currentClips, settings.maxStorageMB,
    );
    if (!canRecord) {
      this.onError?.(reason || 'Storage full — unlock some clips to continue');
      return;
    }

    locationService.start();

    await backgroundService.start({
      onTick: async () => {
        const mins = Math.floor(this.totalSeconds / 60);
        const secs = this.totalSeconds % 60;
        await backgroundService.updateNotification(
          'DashCamFool Recording',
          `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
        );
      },
      intervalMs: 1000,
    });

    this.isRecording = true;
    this.notifyState();
    this.startChunk();
  }

  private startChunk(): void {
    if (!this.cameraRef || !this.currentSettings || !this.isRecording) return;

    this.clearTimers();

    const camera = this.cameraRef;
    const chunkSec = this.currentSettings.chunkDurationSec;
    this.elapsedSeconds = 0;
    this.waitingForNextChunk = false;
    this.notifyState();

    camera.startRecording({
      onRecordingFinished: (video) => {
        this.clearTimers();
        this.saveClip(video.path, video.duration);
      },
      onRecordingError: () => {
        this.clearTimers();
        if (this.isRecording) {
          this.waitingForNextChunk = true;
          setTimeout(() => {
            if (this.isRecording) this.startChunk();
          }, 5000);
        }
      },
      fileType: 'mp4',
    });

    this.elapsedInterval = setInterval(() => {
      this.elapsedSeconds++;
      this.totalSeconds++;
      this.notifyState();
    }, 1000);

    this.chunkTimeout = setTimeout(() => {
      if (this.isRecording) {
        this.clearTimers();
        try { camera.stopRecording(); } catch {}
      }
    }, chunkSec * 1000);
  }

  private async saveClip(filePath: string, duration: number): Promise<void> {
    try {
      const settings = this.currentSettings;
      if (!settings) return;

      const location = locationService.getCurrentLocation();
      const fileSize = await storageManager.getFileSize(filePath);
      const shouldLock = this.lockNextClip;
      this.lockNextClip = false;

      const clip: VideoClip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 4)}`,
        filePath,
        fileName: filePath.split('/').pop() || 'unknown.mp4',
        duration: Math.round(duration),
        fileSize,
        createdAt: Date.now(),
        isLocked: shouldLock,
        camera: 'back',
        thumbnailPath: undefined,
        location: location || undefined,
      };

      const deletedIds = await storageManager.enforceStorageLimit(
        [...this.currentClips, clip],
        settings.maxStorageMB,
      );
      if (deletedIds.length > 0) {
        this.onClipsDeleted?.(deletedIds);
        this.currentClips = this.currentClips.filter(c => !deletedIds.includes(c.id));
      }

      this.currentClips.push(clip);
      if (this.onClipSaved) {
        this.onClipSaved(clip);
      }
    } catch {}

    if (this.isRecording) {
      this.waitingForNextChunk = true;
      this.notifyState();
      setTimeout(() => {
        if (this.isRecording) this.startChunk();
      }, 3000);
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.isRecording) return;
    this.isRecording = false;
    this.clearTimers();

    if (!this.waitingForNextChunk) {
      try {
        if (this.cameraRef) await this.cameraRef.stopRecording();
      } catch {}
    }

    await backgroundService.stop();
    locationService.stop();
    this.notifyState();
  }

  async emergencyLock(): Promise<string | null> {
    if (!this.isRecording) return null;
    this.lockNextClip = true;
    return 'locked';
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  private notifyState(): void {
    this.onStateChange?.({
      isRecording: this.isRecording,
      elapsed: this.elapsedSeconds,
    });
  }

  private clearTimers(): void {
    if (this.elapsedInterval) {
      clearInterval(this.elapsedInterval);
      this.elapsedInterval = null;
    }
    if (this.chunkTimeout) {
      clearTimeout(this.chunkTimeout);
      this.chunkTimeout = null;
    }
  }
}

export const recordingService = new RecordingService();
