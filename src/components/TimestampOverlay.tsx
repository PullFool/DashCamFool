import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { locationService } from '../services/LocationService';

interface TimestampOverlayProps {
  showTimestamp: boolean;
  showSpeed: boolean;
}

export default function TimestampOverlay({
  showTimestamp,
  showSpeed,
}: TimestampOverlayProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    // Update clock every second
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }),
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showSpeed) return;

    const unsubscribe = locationService.addListener(location => {
      setSpeed(location.speed);
    });

    return unsubscribe;
  }, [showSpeed]);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Top-left: date and time */}
      {showTimestamp && (
        <View style={styles.timestampContainer}>
          <Text style={styles.dateText}>{currentDate}</Text>
          <Text style={styles.timeText}>{currentTime}</Text>
        </View>
      )}

      {/* Top-right: speed */}
      {showSpeed && (
        <View style={styles.speedContainer}>
          <Text style={styles.speedValue}>{speed}</Text>
          <Text style={styles.speedUnit}>km/h</Text>
        </View>
      )}

      {/* Bottom-left: app watermark */}
      <View style={styles.watermark}>
        <Text style={styles.watermarkText}>MotoDashCam</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    padding: 12,
  },
  timestampContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dateText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  timeText: {
    color: '#FF4444',
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  speedContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  speedValue: {
    color: '#00FF88',
    fontSize: 28,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  speedUnit: {
    color: '#AAA',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  watermark: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  watermarkText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
