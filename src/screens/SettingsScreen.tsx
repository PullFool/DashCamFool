import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import StorageBar from '../components/StorageBar';
import {
  COLORS,
  STORAGE_PRESETS_MB,
  MIN_STORAGE_MB,
  MAX_STORAGE_LIMIT_MB,
} from '../utils/constants';

export default function SettingsScreen() {
  const { state, updateSettings } = useApp();
  const { settings } = state;
  const colors = settings.darkMode ? COLORS.dark : COLORS.light;

  const formatStorage = (mb: number): string => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
    return `${mb} MB`;
  };

  const chunkOptions = [
    { label: '1 min', value: 60 },
    { label: '3 min', value: 180 },
    { label: '5 min', value: 300 },
    { label: '10 min', value: 600 },
  ];

  const qualityOptions = [
    { label: 'SD (480p)', value: 'sd' as const, desc: '~1 MB/min' },
    { label: 'HD (720p)', value: 'hd' as const, desc: '~2.5 MB/min' },
    { label: 'FHD (1080p)', value: 'fhd' as const, desc: '~5 MB/min' },
  ];

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Recordings',
      'This will delete ALL recordings including locked clips. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => {
            // Will be handled by the context
            state.clips.forEach(clip => {
              // storageManager.deleteClip(clip) would be called here
            });
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>

      {/* Storage Dashboard */}
      <StorageBar />

      {/* Storage Limit */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Storage Limit
        </Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Maximum space for recordings. Old clips auto-delete when full.
        </Text>
        <View style={styles.optionGrid}>
          {STORAGE_PRESETS_MB.map(mb => (
            <TouchableOpacity
              key={mb}
              style={[
                styles.optionChip,
                {
                  backgroundColor:
                    settings.maxStorageMB === mb
                      ? colors.primary
                      : colors.surfaceLight,
                  borderColor:
                    settings.maxStorageMB === mb
                      ? colors.primary
                      : colors.border,
                },
              ]}
              onPress={() => updateSettings({ maxStorageMB: mb })}>
              <Text
                style={[
                  styles.optionChipText,
                  {
                    color:
                      settings.maxStorageMB === mb ? '#FFF' : colors.text,
                  },
                ]}>
                {formatStorage(mb)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Chunk Duration */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Chunk Duration
        </Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Each recording chunk length. Shorter = more granular loop deletion.
        </Text>
        <View style={styles.optionGrid}>
          {chunkOptions.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionChip,
                {
                  backgroundColor:
                    settings.chunkDurationSec === opt.value
                      ? colors.primary
                      : colors.surfaceLight,
                  borderColor:
                    settings.chunkDurationSec === opt.value
                      ? colors.primary
                      : colors.border,
                },
              ]}
              onPress={() =>
                updateSettings({ chunkDurationSec: opt.value })
              }>
              <Text
                style={[
                  styles.optionChipText,
                  {
                    color:
                      settings.chunkDurationSec === opt.value
                        ? '#FFF'
                        : colors.text,
                  },
                ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Video Quality */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Video Quality
        </Text>
        <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
          Higher quality uses more storage per clip.
        </Text>
        {qualityOptions.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.qualityRow,
              {
                backgroundColor:
                  settings.videoQuality === opt.value
                    ? colors.primary + '20'
                    : 'transparent',
                borderColor:
                  settings.videoQuality === opt.value
                    ? colors.primary
                    : colors.border,
              },
            ]}
            onPress={() => updateSettings({ videoQuality: opt.value })}>
            <View>
              <Text
                style={[
                  styles.qualityLabel,
                  {
                    color:
                      settings.videoQuality === opt.value
                        ? colors.primary
                        : colors.text,
                  },
                ]}>
                {opt.label}
              </Text>
              <Text
                style={[styles.qualityDesc, { color: colors.textSecondary }]}>
                {opt.desc}
              </Text>
            </View>
            {settings.videoQuality === opt.value && (
              <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Overlay Settings */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Overlay
        </Text>

        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.switchLabel, { color: colors.text }]}>
              Date / Time Stamp
            </Text>
            <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
              Show date and time on video
            </Text>
          </View>
          <Switch
            value={settings.showTimestamp}
            onValueChange={v => updateSettings({ showTimestamp: v })}
            trackColor={{ false: colors.surfaceLight, true: colors.primary }}
            thumbColor="#FFF"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.switchLabel, { color: colors.text }]}>
              Speed (GPS)
            </Text>
            <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
              Show current speed in km/h
            </Text>
          </View>
          <Switch
            value={settings.showSpeed}
            onValueChange={v => updateSettings({ showSpeed: v })}
            trackColor={{ false: colors.surfaceLight, true: colors.primary }}
            thumbColor="#FFF"
          />
        </View>
      </View>

      {/* App Settings */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          App Settings
        </Text>

        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.switchLabel, { color: colors.text }]}>
              Dark Mode
            </Text>
            <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
              Reduce screen glare for night riding
            </Text>
          </View>
          <Switch
            value={settings.darkMode}
            onValueChange={v => updateSettings({ darkMode: v })}
            trackColor={{ false: colors.surfaceLight, true: colors.primary }}
            thumbColor="#FFF"
          />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.switchLabel, { color: colors.text }]}>
              Auto-start Recording
            </Text>
            <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
              Start recording when app opens
            </Text>
          </View>
          <Switch
            value={settings.autoStartRecording}
            onValueChange={v => updateSettings({ autoStartRecording: v })}
            trackColor={{ false: colors.surfaceLight, true: colors.primary }}
            thumbColor="#FFF"
          />
        </View>
      </View>

      {/* Danger Zone */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.danger }]}>
          Danger Zone
        </Text>
        <TouchableOpacity
          style={[styles.dangerButton, { borderColor: colors.danger }]}
          onPress={handleClearAll}>
          <Text style={[styles.dangerButtonText, { color: colors.danger }]}>
            Clear All Recordings
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
  },
  section: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  optionChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  qualityLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  qualityDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchDesc: {
    fontSize: 11,
    marginTop: 2,
    maxWidth: 240,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  dangerButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
