import { FFmpegKit, ReturnCode } from '@wokcito/ffmpeg-kit-react-native';
import RNFS from 'react-native-fs';

class VideoProcessor {
  async burnOverlay(
    inputPath: string,
    speed: number,
    recordedAt: number,
    gpsAvailable: boolean,
  ): Promise<string> {
    const outputPath = inputPath.replace('.mp4', '_burned.mp4');

    try {
      const dateStr = new Date(recordedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const timeStr = new Date(recordedAt).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const speedText = gpsAvailable ? `${speed} km\\/h` : 'GPS OFF';
      const speedColor = gpsAvailable ? '00FF88' : 'FF6666';

      // FFmpeg drawtext filters
      const filters = [
        // Date — top left
        `drawtext=text='${dateStr}':x=20:y=20:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=5`,
        // Time — top left below date
        `drawtext=text='${timeStr}':x=20:y=46:fontsize=24:fontcolor=red:box=1:boxcolor=black@0.5:boxborderw=5`,
        // Speed — top right
        `drawtext=text='${speedText}':x=w-tw-20:y=20:fontsize=28:fontcolor=${speedColor}:box=1:boxcolor=black@0.5:boxborderw=5`,
        // Watermark — bottom left
        `drawtext=text='DashCamFool':x=20:y=h-th-20:fontsize=12:fontcolor=white@0.6:box=1:boxcolor=black@0.3:boxborderw=3`,
      ].join(',');

      const command = `-i "${inputPath}" -vf "${filters}" -c:a copy -preset ultrafast -y "${outputPath}"`;

      const session = await FFmpegKit.execute(command);
      const returnCode = await session.getReturnCode();

      if (ReturnCode.isSuccess(returnCode)) {
        // Replace original with burned version
        await RNFS.unlink(inputPath);
        return outputPath;
      } else {
        // Failed — keep original
        const exists = await RNFS.exists(outputPath);
        if (exists) await RNFS.unlink(outputPath);
        return inputPath;
      }
    } catch {
      return inputPath;
    }
  }
}

export const videoProcessor = new VideoProcessor();
