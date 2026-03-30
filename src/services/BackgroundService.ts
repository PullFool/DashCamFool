import BackgroundService from 'react-native-background-actions';

export interface BackgroundTaskOptions {
  onTick: () => Promise<void>;
  intervalMs?: number;
}

const NOTIFICATION_CONFIG = {
  taskName: 'DashCamFool',
  taskTitle: 'DashCamFool Recording',
  taskDesc: 'Recording in background...',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#FF4444',
  linkingURI: 'motodashcam://',
  parameters: {
    delay: 1000,
  },
};

class BackgroundRecordingService {
  private isRunning = false;
  private onTickCallback: (() => Promise<void>) | null = null;

  /**
   * Start background service to keep recording alive when screen is off.
   * Uses Android foreground service with persistent notification.
   */
  async start(options: BackgroundTaskOptions): Promise<void> {
    if (this.isRunning) return;

    this.onTickCallback = options.onTick;
    const intervalMs = options.intervalMs ?? 1000;

    const backgroundTask = async (taskData: any) => {
      const delay = taskData?.delay ?? intervalMs;

      // Keep the service alive with a loop
      while (BackgroundService.isRunning()) {
        if (this.onTickCallback) {
          try {
            await this.onTickCallback();
          } catch (error) {
            console.warn('Background tick error:', error);
          }
        }
        await this.sleep(delay);
      }
    };

    try {
      await BackgroundService.start(backgroundTask, {
        ...NOTIFICATION_CONFIG,
        parameters: { delay: intervalMs },
      });
      this.isRunning = true;
    } catch (error) {
      console.error('Failed to start background service:', error);
      throw error;
    }
  }

  /**
   * Stop the background service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await BackgroundService.stop();
    } catch (error) {
      console.warn('Error stopping background service:', error);
    } finally {
      this.isRunning = false;
      this.onTickCallback = null;
    }
  }

  /**
   * Update the notification text (e.g., show elapsed time)
   */
  async updateNotification(title: string, description: string): Promise<void> {
    if (!this.isRunning) return;

    try {
      await BackgroundService.updateNotification({
        taskTitle: title,
        taskDesc: description,
      });
    } catch {
      // Notification update is non-critical
    }
  }

  /**
   * Check if background service is running
   */
  getIsRunning(): boolean {
    return this.isRunning && BackgroundService.isRunning();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const backgroundService = new BackgroundRecordingService();
