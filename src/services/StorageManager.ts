import RNFS from 'react-native-fs';
import { VideoClip } from '../types';
import { RECORDING_DIR, THUMBNAIL_DIR } from '../utils/constants';

const BASE_PATH = `${RNFS.ExternalDirectoryPath}/${RECORDING_DIR}`;
const THUMB_PATH = `${RNFS.ExternalDirectoryPath}/${THUMBNAIL_DIR}`;

class StorageManager {
  /**
   * Ensure recording and thumbnail directories exist
   */
  async ensureDirectories(): Promise<void> {
    const baseExists = await RNFS.exists(BASE_PATH);
    if (!baseExists) {
      await RNFS.mkdir(BASE_PATH);
    }
    const thumbExists = await RNFS.exists(THUMB_PATH);
    if (!thumbExists) {
      await RNFS.mkdir(THUMB_PATH);
    }
  }

  /**
   * Get the base recording directory path
   */
  getRecordingDir(): string {
    return BASE_PATH;
  }

  /**
   * Get the thumbnail directory path
   */
  getThumbnailDir(): string {
    return THUMB_PATH;
  }

  /**
   * Generate a unique file path for a new recording
   */
  generateFilePath(camera: 'front' | 'back'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `moto_${camera}_${timestamp}.mp4`;
    return `${BASE_PATH}/${fileName}`;
  }

  /**
   * Calculate total storage used by all clips in MB
   */
  async calculateUsedStorage(clips: VideoClip[]): Promise<number> {
    let totalBytes = 0;
    for (const clip of clips) {
      try {
        const exists = await RNFS.exists(clip.filePath);
        if (exists) {
          const stat = await RNFS.stat(clip.filePath);
          totalBytes += Number(stat.size);
        }
      } catch {
        // File may have been deleted externally
      }
    }
    return totalBytes / (1024 * 1024);
  }

  /**
   * Get file size in bytes
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stat = await RNFS.stat(filePath);
      return Number(stat.size);
    } catch {
      return 0;
    }
  }

  /**
   * Delete a video clip and its thumbnail
   */
  async deleteClip(clip: VideoClip): Promise<boolean> {
    try {
      const exists = await RNFS.exists(clip.filePath);
      if (exists) {
        await RNFS.unlink(clip.filePath);
      }
      if (clip.thumbnailPath) {
        const thumbExists = await RNFS.exists(clip.thumbnailPath);
        if (thumbExists) {
          await RNFS.unlink(clip.thumbnailPath);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Enforce storage limit by deleting oldest unlocked clips
   * Returns the IDs of deleted clips
   */
  async enforceStorageLimit(
    clips: VideoClip[],
    maxStorageMB: number,
  ): Promise<string[]> {
    const currentUsageMB = await this.calculateUsedStorage(clips);
    if (currentUsageMB <= maxStorageMB) {
      return [];
    }

    // Sort unlocked clips by creation date (oldest first)
    const unlocked = clips
      .filter(c => !c.isLocked)
      .sort((a, b) => a.createdAt - b.createdAt);

    const deletedIds: string[] = [];
    let freedMB = 0;
    const excessMB = currentUsageMB - maxStorageMB;

    for (const clip of unlocked) {
      if (freedMB >= excessMB) break;

      const clipSizeMB = clip.fileSize / (1024 * 1024);
      const deleted = await this.deleteClip(clip);
      if (deleted) {
        deletedIds.push(clip.id);
        freedMB += clipSizeMB;
      }
    }

    return deletedIds;
  }

  /**
   * Check if there's enough space to record a new chunk
   * Considers both app limit and device free space
   */
  async canRecord(
    clips: VideoClip[],
    maxStorageMB: number,
    estimatedChunkMB: number = 50,
  ): Promise<{ canRecord: boolean; reason?: string }> {
    // Check device free space
    const freeSpace = await RNFS.getFSInfo();
    const freeDeviceMB = freeSpace.freeSpace / (1024 * 1024);

    if (freeDeviceMB < estimatedChunkMB + 100) {
      return {
        canRecord: false,
        reason: 'Device storage is almost full',
      };
    }

    // Check app storage limit — but we'll handle this by auto-deleting
    const usedMB = await this.calculateUsedStorage(clips);
    const unlockedMB = clips
      .filter(c => !c.isLocked)
      .reduce((sum, c) => sum + c.fileSize / (1024 * 1024), 0);

    if (usedMB >= maxStorageMB && unlockedMB < estimatedChunkMB) {
      return {
        canRecord: false,
        reason: 'Storage full — all clips are locked. Unlock some clips to continue.',
      };
    }

    return { canRecord: true };
  }

  /**
   * Get storage summary info
   */
  async getStorageInfo(
    clips: VideoClip[],
    maxStorageMB: number,
  ): Promise<{
    usedMB: number;
    maxMB: number;
    clipCount: number;
    lockedClipCount: number;
    deviceFreeMB: number;
  }> {
    const usedMB = await this.calculateUsedStorage(clips);
    const freeSpace = await RNFS.getFSInfo();
    const deviceFreeMB = freeSpace.freeSpace / (1024 * 1024);

    return {
      usedMB: Math.round(usedMB * 10) / 10,
      maxMB: maxStorageMB,
      clipCount: clips.length,
      lockedClipCount: clips.filter(c => c.isLocked).length,
      deviceFreeMB: Math.round(deviceFreeMB),
    };
  }
}

export const storageManager = new StorageManager();
