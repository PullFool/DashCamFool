import { LogBox } from 'react-native';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Suppress VisionCamera recording retry warnings
LogBox.ignoreLogs([
  'Recording error',
  'Camera error',
  'capture/no-data',
]);

// Also suppress console.warn for these
const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = args[0]?.toString?.() || '';
  if (
    msg.includes('Recording error') ||
    msg.includes('capture/no-data') ||
    msg.includes('Camera error')
  ) {
    return; // Silently ignore
  }
  originalWarn(...args);
};

AppRegistry.registerComponent(appName, () => App);
