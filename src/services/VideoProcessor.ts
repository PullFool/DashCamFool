import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';

// Try to import FFmpeg — might not be available
let FFmpegKit: any = null;
let ReturnCode: any = null;

try {
  const ffmpeg = require('@wokcito/ffmpeg-kit-react-native');
  FFmpegKit = ffmpeg.FFmpegKit;
  ReturnCode = ffmpeg.ReturnCode;
  console.log('FFmpeg LOADED OK');
} catch (e: any) {
  console.log('FFmpeg NOT available:', e?.message || e);
}

interface SpeedEntry {
  time: number;
  speed: number;
}

class VideoProcessor {
  async burnOverlayRealtime(
    inputPath: string,
    speedLog: SpeedEntry[],
    startTimestamp: number,
    gpsAvailable: boolean,
  ): Promise<string> {
    // If FFmpeg is not available, return original
    if (!FFmpegKit) {
      console.log('FFmpeg not loaded, skipping burn-in');
      return inputPath;
    }

    const outputPath = inputPath.replace('.mp4', '_burned.mp4');

    try {
      const startDate = new Date(startTimestamp);

      const dateStr = startDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const timeStr = startDate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // Get speed at end of recording
      const lastSpeed = speedLog.length > 0
        ? speedLog[speedLog.length - 1].speed
        : 0;
      const speedText = gpsAvailable ? `${lastSpeed} km/h` : 'GPS OFF';

      // First try simple static text to verify FFmpeg works
      const command = [
        '-i', inputPath,
        '-vf',
        `drawtext=text='${dateStr}  ${timeStr}':fontsize=20:fontcolor=white:x=20:y=20:shadowcolor=black:shadowx=2:shadowy=2,drawtext=text='${speedText}':fontsize=24:fontcolor=white:x=w-tw-20:y=20:shadowcolor=black:shadowx=2:shadowy=2,drawtext=text='DashCamFool':fontsize=14:fontcolor=white:x=20:y=h-th-20:shadowcolor=black:shadowx=1:shadowy=1`,
        '-c:a', 'copy',
        '-preset', 'ultrafast',
        '-y', outputPath,
      ].join(' ');

      console.log('FFmpeg command:', command);

      const session = await FFmpegKit.execute(command);
      const returnCode = await session.getReturnCode();

      if (ReturnCode.isSuccess(returnCode)) {
        console.log('FFmpeg SUCCESS — overlay burned');
        await RNFS.unlink(inputPath);
        return outputPath;
      } else {
        const output = await session.getOutput();
        console.log('FFmpeg FAILED:', output?.substring(0, 500));
        const exists = await RNFS.exists(outputPath);
        if (exists) await RNFS.unlink(outputPath);
        return inputPath;
      }
    } catch (e: any) {
      console.log('VideoProcessor error:', e?.message || e);
      return inputPath;
    }
  }
}

export const videoProcessor = new VideoProcessor();
