import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS } from '../utils/constants';

interface StorageBarProps {
  compact?: boolean;
}

export default function StorageBar({ compact = false }: StorageBarProps) {
  const { state } = useApp();
  const { clips, settings } = state;

  const usedMB = clips.reduce((sum, c) => sum + c.fileSize / (1024 * 1024), 0);
  const maxMB = settings.maxStorageMB;
  const percentage = Math.min((usedMB / maxMB) * 100, 100);
  const lockedCount = clips.filter(c => c.isLocked).length;

  const colors = settings.darkMode ? COLORS.dark : COLORS.light;

  // Calculate locked vs unlocked portions
  const lockedMB = clips
    .filter(c => c.isLocked)
    .reduce((sum, c) => sum + c.fileSize / (1024 * 1024), 0);
  const lockedPercent = (lockedMB / maxMB) * 100;
  const unlockedPercent = percentage - lockedPercent;

  const getBarColor = () => {
    if (percentage >= 90) return colors.danger;
    if (percentage >= 70) return colors.warning;
    return colors.accent;
  };

  const formatSize = (mb: number): string => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${Math.round(mb)} MB`;
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.surface }]}>
        <View
          style={[styles.compactBar, { backgroundColor: colors.surfaceLight }]}>
          {lockedPercent > 0 && (
            <View
              style={[
                styles.compactFill,
                {
                  width: `${lockedPercent}%`,
                  backgroundColor: colors.locked,
                },
              ]}
            />
          )}
          <View
            style={[
              styles.compactFill,
              {
                width: `${unlockedPercent}%`,
                backgroundColor: getBarColor(),
                left: `${lockedPercent}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.compactText, { color: colors.textSecondary }]}>
          {formatSize(usedMB)} / {formatSize(maxMB)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Storage</Text>
        <Text style={[styles.percentage, { color: colors.textSecondary }]}>
          {percentage.toFixed(1)}%
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.barTrack, { backgroundColor: colors.surfaceLight }]}>
        {lockedPercent > 0 && (
          <View
            style={[
              styles.barFill,
              {
                width: `${lockedPercent}%`,
                backgroundColor: colors.locked,
                borderTopLeftRadius: 4,
                borderBottomLeftRadius: 4,
              },
            ]}
          />
        )}
        <View
          style={[
            styles.barFill,
            {
              width: `${unlockedPercent}%`,
              backgroundColor: getBarColor(),
              left: `${lockedPercent}%`,
              borderTopRightRadius: percentage >= 99 ? 4 : 0,
              borderBottomRightRadius: percentage >= 99 ? 4 : 0,
            },
          ]}
        />
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatSize(usedMB)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Used
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatSize(maxMB - usedMB)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Free
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {clips.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Clips
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.locked }]}>
            {lockedCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Locked
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {lockedPercent > 0 && (
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: colors.locked }]}
            />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>
              Locked ({formatSize(lockedMB)})
            </Text>
          </View>
        )}
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: getBarColor() }]}
          />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            Unlocked ({formatSize(usedMB - lockedMB)})
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  percentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  compactBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  compactFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  compactText: {
    fontSize: 11,
    fontFamily: 'monospace',
    minWidth: 90,
    textAlign: 'right',
  },
});
