import React, { useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import {
  Camera,
  useCameraDevices,
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';
import { useApp } from '../context/AppContext';
import { recordingService } from '../services/RecordingService';
import TimestampOverlay from './TimestampOverlay';

interface CameraViewProps {
  isActive: boolean;
}

export default function CameraView({ isActive }: CameraViewProps) {
  const { state } = useApp();
  const cameraRef = useRef<Camera>(null);
  const devices = useCameraDevices();
  const { hasPermission: hasCamPerm, requestPermission: reqCamPerm } =
    useCameraPermission();
  const { hasPermission: hasMicPerm, requestPermission: reqMicPerm } =
    useMicrophonePermission();
  const [permissionsReady, setPermissionsReady] = useState(false);

  const { showTimestamp, showSpeed } = state.settings;

  const device = devices.find(d => d.position === 'back');

  useEffect(() => {
    (async () => {
      if (!hasCamPerm) await reqCamPerm();
      if (!hasMicPerm) await reqMicPerm();
      setPermissionsReady(true);
    })();
  }, [hasCamPerm, hasMicPerm, reqCamPerm, reqMicPerm]);

  useEffect(() => {
    if (cameraRef.current) {
      recordingService.setCameraRef(cameraRef.current);
    }
  }, [device, permissionsReady]);

  if (!permissionsReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF4444" />
        <Text style={styles.statusText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (!hasCamPerm || !hasMicPerm) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>
          Camera and microphone permissions are required
        </Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        video={true}
        audio={true}
        onError={() => {}}
      />

      {(showTimestamp || showSpeed) && (
        <TimestampOverlay showTimestamp={showTimestamp} showSpeed={showSpeed} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
  },
});
