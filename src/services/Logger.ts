import RNFS from 'react-native-fs';

const LOG_FILE = `${RNFS.ExternalDirectoryPath}/DashCamFool/debug.log`;

class Logger {
  async log(message: string): Promise<void> {
    const timestamp = new Date().toLocaleString();
    const line = `[${timestamp}] ${message}\n`;

    try {
      const exists = await RNFS.exists(LOG_FILE);
      if (exists) {
        await RNFS.appendFile(LOG_FILE, line, 'utf8');
      } else {
        await RNFS.writeFile(LOG_FILE, line, 'utf8');
      }
    } catch {}

    // Also console.log for Metro
    console.log(message);
  }

  async getLogPath(): Promise<string> {
    return LOG_FILE;
  }

  async clearLogs(): Promise<void> {
    try {
      await RNFS.writeFile(LOG_FILE, '', 'utf8');
    } catch {}
  }
}

export const logger = new Logger();
