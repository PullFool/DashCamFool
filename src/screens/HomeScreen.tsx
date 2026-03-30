import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Vibration,
  StatusBar,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { recordingService } from '../services/RecordingService';
import CameraView from '../components/CameraView';
import StorageBar from '../components/StorageBar';
import { COLORS } from '../utils/constants';

export default function HomeScreen() {
  const { state, dispatch, addClip, updateSettings } = useApp();
  const { settings, clips, recording } = state;
  const [elapsed, setElapsed] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const colors = settings.darkMode ? COLORS.dark : COLORS.light;

  // Setup recording callbacks
  useEffect(() => {
    recordingService.setCallbacks({
      onClipSaved: (clip) => {
        addClip(clip);
      },
      onStateChange: ({ isRecording: rec, elapsed: el }) => {
        setIsRecording(rec);
        setElapsed(el);
      },
      onError: (error) => {
        Alert.alert('Recording Error', error);
      },
      onClipsDeleted: (deletedIds) => {
        deletedIds.forEach(id => dispatch({ type: 'REMOVE_CLIP', payload: id }));
      },
    });
  }, [addClip, dispatch]);

  // Keep recording service in sync with state
  useEffect(() => {
    recordingService.updateState(settings, clips);
  }, [settings, clips]);

  // Auto-start recording if enabled
  useEffect(() => {
    if (settings.autoStartRecording && !isRecording && !state.isLoading) {
      // Delay to ensure camera is ready
      const timer = setTimeout(() => {
        recordingService.startRecording(settings, clips);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [settings.autoStartRecording, state.isLoading]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      await recordingService.stopRecording();
      Vibration.vibrate(200);
    } else {
      await recordingService.startRecording(settings, clips);
      Vibration.vibrate(100);
    }
  }, [isRecording, settings, clips]);

  const handleEmergencyLock = useCallback(async () => {
    if (!isRecording) return;

    Vibration.vibrate([0, 100, 50, 100]); // Double vibration
    const clipId = await recordingService.emergencyLock();
    if (clipId) {
      Alert.alert('Clip Locked', 'Current clip has been saved and protected.');
    }
  }, [isRecording]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const chunkProgress = settings.chunkDurationSec > 0
    ? (elapsed / settings.chunkDurationSec) * 100
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#000"
        translucent={false}
      />

      {/* Camera preview */}
      <View style={styles.cameraContainer}>
        <CameraView isActive={true} />

        {/* Recording indicator */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
            <Text style={styles.recTime}>{formatTime(elapsed)}</Text>
          </View>
        )}

        {/* Chunk progress bar */}
        {isRecording && (
          <View style={styles.chunkProgressTrack}>
            <View
              style={[styles.chunkProgressFill, { width: `${chunkProgress}%` }]}
            />
          </View>
        )}
      </View>

      {/* Controls overlay at bottom */}
      {showControls ? (
        <View style={[styles.controlsContainer, { backgroundColor: colors.surface }]}>
          {/* Toggle arrow - top right of controls */}
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowControls(false)}>
            <Text style={styles.toggleArrow}>▼</Text>
          </TouchableOpacity>

          {/* Storage bar */}
          <StorageBar compact />

          {/* Buttons row */}
          <View style={styles.buttonsRow}>
            {/* Record button */}
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
              ]}
              onPress={handleToggleRecording}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.recordButtonInner,
                  isRecording
                    ? styles.recordButtonInnerStop
                    : styles.recordButtonInnerStart,
                ]}
              />
            </TouchableOpacity>

            {/* Emergency lock */}
            <TouchableOpacity
              style={[
                styles.sideButton,
                {
                  backgroundColor: isRecording
                    ? colors.locked
                    : colors.surfaceLight,
                },
              ]}
              onPress={handleEmergencyLock}
              disabled={!isRecording}>
              <Text style={styles.sideButtonIcon}>🔒</Text>
              <Text
                style={[
                  styles.sideButtonLabel,
                  {
                    color: isRecording ? '#000' : colors.textSecondary,
                  },
                ]}>
                Lock
              </Text>
            </TouchableOpacity>
          </View>

          {/* Status info */}
          <View style={styles.statusRow}>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {isRecording
                ? `Chunk: ${formatTime(elapsed)} / ${formatTime(settings.chunkDurationSec)}`
                : 'Ready to record'}
            </Text>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {settings.videoQuality.toUpperCase()} • Rear Cam
            </Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.showButton, { backgroundColor: colors.surface }]}
          onPress={() => setShowControls(true)}>
          <Text style={styles.toggleArrow}>▲</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF0000',
  },
  recText: {
    color: '#FF0000',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  recTime: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  chunkProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  chunkProgressFill: {
    height: '100%',
    backgroundColor: '#FF4444',
  },
  toggleButton: {
    position: 'absolute',
    right: 10,
    top: -20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopLeftRadius: 12,
  },
  toggleArrow: {
    fontSize: 18,
    color: '#FFF',
  },
  controlsContainer: {
    paddingTop: 8,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginVertical: 16,
  },
  recordButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  recordButtonActive: {
    borderColor: '#FF0000',
  },
  recordButtonInner: {
    borderRadius: 100,
  },
  recordButtonInnerStart: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: '#FF4444',
  },
  recordButtonInnerStop: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#FF0000',
  },
  sideButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideButtonIcon: {
    fontSize: 22,
  },
  sideButtonLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
