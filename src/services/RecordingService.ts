import { Camera } from 'react-native-vision-camera';
import { createThumbnail } from 'react-native-create-thumbnail';
import { VideoClip, LocationData, AppSettings } from '../types';
import { storageManager } from './StorageManager';
import { locationService } from './LocationService';
import { backgroundService } from './BackgroundService';
import { VIDEO_QUALITY_MAP } from '../utils/constants';

type ClipCallback = (clip: VideoClip) => void;
type StateCallback = (state: { isRecording: boolean; elapsed: number }) => void;
type ErrorCallback = (error: string) => void;
type DeleteCallback = (deletedIds: string[]) => void;

class RecordingService {
  private cameraRef: Camera | null = null;
  private isRecording = false;
  private chunkTimer: ReturnType<typeof setTimeout> | null = null;
  private elapsedInterval: ReturnType<typeof setInterval> | null = null;
  private elapsedSeconds = 0;
  private currentSettings: AppSettings | null = null;
  private currentClips: VideoClip[] = [];

  // Callbacks
  private onClipSaved: ClipCallback | null = null;
  private onStateChange: StateCallback | null = null;
  private onError: ErrorCallback | null = null;
  private onClipsDeleted: DeleteCallback | null = null;

  /**
   * Set the camera reference for recording
   */
  setCameraRef(ref: Camera | null): void {
    this.cameraRef = ref;
  }

  /**
   * Register callbacks
   */
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

  /**
   * Update current settings and clips list
   */
  updateState(settings: AppSettings, clips: VideoClip[]): void {
    this.currentSettings = settings;
    this.currentClips = clips;
  }

  /**
   * Start recording with automatic chunking
   */
  async startRecording(settings: AppSettings, clips: VideoClip[]): Promise<void> {
    if (!this.cameraRef) {
      this.onError?.('Camera not ready');
      return;
    }

    this.currentSettings = settings;
    this.currentClips = clips;

    // Ensure storage directories exist
    await storageManager.ensureDirectories();

    // Check if we can record
    const { canRecord, reason } = await storageManager.canRecord(
      clips,
      settings.maxStorageMB,
    );

    if (!canRecord) {
      // Try to free space first
      const deletedIds = await storageManager.enforceStorageLimit(
        clips,
        settings.maxStorageMB,
      );
      if (deletedIds.length > 0) {
        this.onClipsDeleted?.(deletedIds);
        this.currentClips = clips.filter(c => !deletedIds.includes(c.id));
      } else {
        this.onError?.(reason || 'Cannot record');
        return;
      }
    }

    // Start location tracking
    locationService.start();

    // Start background service for screen-off recording
    await backgroundService.start({
      onTick: async () => {
        // Update notification with elapsed time
        const mins = Math.floor(this.elapsedSeconds / 60);
        const secs = this.elapsedSeconds % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        await backgroundService.updateNotification(
          'MotoDashCam Recording',
          `Recording chunk... ${timeStr}`,
        );
      },
      intervalMs: 1000,
    });

    // Start the first chunk
    await this.startChunk();
  }

  /**
   * Start recording a single chunk
   */
  private async startChunk(): Promise<void> {
    if (!this.cameraRef || !this.currentSettings) return;

    try {
      this.isRecording = true;
      this.elapsedSeconds = 0;
      this.notifyState();

      // Start elapsed timer
      this.elapsedInterval = setInterval(() => {
        this.elapsedSeconds++;
        this.notifyState();
      }, 1000);

      // Set chunk duration timer
      const chunkMs = this.currentSettings.chunkDurationSec * 1000;
      this.chunkTimer = setTimeout(() => {
        this.rotateChunk();
      }, chunkMs);

      // Start the actual camera recording
      this.cameraRef.startRecording({
        onRecordingFinished: async (video) => {
          await this.handleChunkFinished(video.path);
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          this.onError?.(error.message);
          this.cleanup();
        },
        fileType: 'mp4',
        videoBitRate: this.getBitRate(),
      });
    } catch (error: any) {
      this.onError?.(error.message || 'Failed to start recording');
      this.cleanup();
    }
  }

  /**
   * Handle rotation between chunks — stop current, process, start next
   */
  private async rotateChunk(): Promise<void> {
    if (!this.cameraRef || !this.isRecording) return;

    // Clear timers
    this.clearTimers();

    try {
      // Stop current recording — this triggers onRecordingFinished
      await this.cameraRef.stopRecording();

      // Start the next chunk after a brief delay
      setTimeout(() => {
        if (this.isRecording) {
          this.startChunk();
        }
      }, 500);
    } catch (error: any) {
      console.error('Chunk rotation error:', error);
      // Try to continue recording
      if (this.isRecording) {
        this.startChunk();
      }
    }
  }

  /**
   * Process a finished chunk: move file, create thumbnail, save metadata
   */
  private async handleChunkFinished(tempPath: string): Promise<void> {
    try {
      const settings = this.currentSettings;
      if (!settings) return;

      const camera = settings.activeCamera;
      const destPath = storageManager.generateFilePath(camera);
      const fileSize = await storageManager.getFileSize(tempPath);
      const location = locationService.getCurrentLocation();

      // Generate thumbnail
      let thumbnailPath: string | undefined;
      try {
        const thumb = await createThumbnail({
          url: tempPath,
          timeStamp: 1000, // 1 second in
        });
        thumbnailPath = thumb.path;
      } catch {
        // Thumbnail generation is non-critical
      }

      const clip: VideoClip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        filePath: tempPath, // VisionCamera saves to its own path
        fileName: destPath.split('/').pop() || 'unknown.mp4',
        duration: settings.chunkDurationSec,
        fileSize,
        createdAt: Date.now(),
        isLocked: false,
        camera,
        thumbnailPath,
        location: location || undefined,
      };

      // Enforce storage limit before saving
      const deletedIds = await storageManager.enforceStorageLimit(
        [...this.currentClips, clip],
        settings.maxStorageMB,
      );
      if (deletedIds.length > 0) {
        this.onClipsDeleted?.(deletedIds);
        this.currentClips = this.currentClips.filter(
          c => !deletedIds.includes(c.id),
        );
      }

      this.currentClips.push(clip);
      this.onClipSaved?.(clip);
    } catch (error: any) {
      console.error('Failed to process chunk:', error);
    }
  }

  /**
   * Stop recording completely
   */
  async stopRecording(): Promise<void> {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.clearTimers();

    try {
      if (this.cameraRef) {
        await this.cameraRef.stopRecording();
      }
    } catch {
      // Camera might already be stopped
    }

    // Stop background service
    await backgroundService.stop();

    // Stop location tracking
    locationService.stop();

    this.notifyState();
  }

  /**
   * Emergency lock: mark current chunk as important
   * Stops current chunk, saves it as locked, then continues recording
   */
  async emergencyLock(): Promise<string | null> {
    if (!this.isRecording || !this.cameraRef) return null;

    // We'll set a flag so when the current chunk finishes, it's marked as locked
    this.clearTimers();

    try {
      // Stop current recording to save it immediately
      await this.cameraRef.stopRecording();
      // The onRecordingFinished callback will handle saving

      // Return a promise that resolves with the clip ID
      return new Promise(resolve => {
        const origCallback = this.onClipSaved;
        this.onClipSaved = (clip) => {
          clip.isLocked = true; // Mark as locked
          origCallback?.(clip);
          this.onClipSaved = origCallback; // Restore original
          resolve(clip.id);

          // Resume recording
          setTimeout(() => this.startChunk(), 500);
        };
      });
    } catch {
      return null;
    }
  }

  /**
   * Get recording status
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  private getBitRate(): number {
    const quality = this.currentSettings?.videoQuality ?? 'hd';
    return VIDEO_QUALITY_MAP[quality].bitrate;
  }

  private notifyState(): void {
    this.onStateChange?.({
      isRecording: this.isRecording,
      elapsed: this.elapsedSeconds,
    });
  }

  private clearTimers(): void {
    if (this.chunkTimer) {
      clearTimeout(this.chunkTimer);
      this.chunkTimer = null;
    }
    if (this.elapsedInterval) {
      clearInterval(this.elapsedInterval);
      this.elapsedInterval = null;
    }
  }

  private cleanup(): void {
    this.isRecording = false;
    this.clearTimers();
    this.notifyState();
  }
}

export const recordingService = new RecordingService();
