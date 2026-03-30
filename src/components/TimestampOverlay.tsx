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
  const [gpsAvailable, setGpsAvailable] = useState(false);

  useEffect(() => {
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
      setGpsAvailable(true);
    });

    // If no GPS update after 5 seconds, mark as unavailable
    const timeout = setTimeout(() => {
      if (!locationService.getCurrentLocation()) {
        setGpsAvailable(false);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [showSpeed]);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Top-right: timestamp + speed */}
      <View style={styles.topRightContainer}>
        {showTimestamp && (
          <>
            <Text style={styles.dateText}>{currentDate}</Text>
            <Text style={styles.timeText}>{currentTime}</Text>
          </>
        )}
        {showSpeed && (
          gpsAvailable ? (
            <Text style={styles.speedValue}>{speed} km/h</Text>
          ) : (
            <Text style={styles.gpsOff}>GPS OFF</Text>
          )
        )}
      </View>

      {/* Bottom-left: app watermark */}
      <View style={styles.watermark}>
        <Text style={styles.watermarkText}>DashCamFool</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    padding: 12,
  },
  topRightContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    alignItems: 'flex-start',
  },
  dateText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  speedContainer: {
    alignItems: 'flex-end',
  },
  speedValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  speedUnit: {
    color: '#AAA',
    fontSize: 11,
    fontFamily: 'monospace',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  gpsOff: {
    color: '#FF6666',
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
  },
  watermark: {
    position: 'absolute',
    bottom: 12,
    left: 12,
  },
  watermarkText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontFamily: 'monospace',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
