import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import Video from 'react-native-video';
import Share from 'react-native-share';
import { useApp } from '../context/AppContext';
import { storageManager } from '../services/StorageManager';
import { VideoClip } from '../types';
import { COLORS } from '../utils/constants';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function GalleryScreen() {
  const { state, removeClip, toggleLock } = useApp();
  const { settings, clips } = state;
  const colors = settings.darkMode ? COLORS.dark : COLORS.light;
  const [selectedClip, setSelectedClip] = useState<VideoClip | null>(null);
  const [filterLocked, setFilterLocked] = useState(false);

  // Sort clips newest first
  const sortedClips = useMemo(() => {
    let filtered = [...clips].sort((a, b) => b.createdAt - a.createdAt);
    if (filterLocked) {
      filtered = filtered.filter(c => c.isLocked);
    }
    return filtered;
  }, [clips, filterLocked]);

  // Group clips by date
  const groupedClips = useMemo(() => {
    const groups: { date: string; clips: VideoClip[] }[] = [];
    let currentDate = '';

    sortedClips.forEach(clip => {
      const date = new Date(clip.createdAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, clips: [clip] });
      } else {
        groups[groups.length - 1].clips.push(clip);
      }
    });

    return groups;
  }, [sortedClips]);

  const handleDelete = useCallback(
    (clip: VideoClip) => {
      if (clip.isLocked) {
        Alert.alert(
          'Clip is Locked',
          'Unlock this clip first before deleting.',
        );
        return;
      }

      Alert.alert('Delete Clip', 'This recording will be permanently deleted.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await storageManager.deleteClip(clip);
            removeClip(clip.id);
            if (selectedClip?.id === clip.id) {
              setSelectedClip(null);
            }
          },
        },
      ]);
    },
    [removeClip, selectedClip],
  );

  const handleShare = useCallback(async (clip: VideoClip) => {
    try {
      await Share.open({
        url: `file://${clip.filePath}`,
        type: 'video/mp4',
        title: `MotoDashCam - ${clip.fileName}`,
      });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Share Error', 'Failed to share video.');
      }
    }
  }, []);

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const renderClipItem = ({ item: clip }: { item: VideoClip }) => (
    <TouchableOpacity
      style={[styles.clipCard, { backgroundColor: colors.surface }]}
      onPress={() => setSelectedClip(clip)}
      activeOpacity={0.7}>
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {clip.thumbnailPath ? (
          <Image
            source={{ uri: `file://${clip.thumbnailPath}` }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.noThumbnail]}>
            <Text style={styles.noThumbIcon}>🎬</Text>
          </View>
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {formatDuration(clip.duration)}
          </Text>
        </View>
        {clip.isLocked && (
          <View style={[styles.lockBadge, { backgroundColor: colors.locked }]}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.clipInfo}>
        <Text style={[styles.clipTime, { color: colors.text }]}>
          {formatTime(clip.createdAt)}
        </Text>
        <Text style={[styles.clipMeta, { color: colors.textSecondary }]}>
          {clip.camera === 'back' ? 'Rear' : 'Front'} • {formatSize(clip.fileSize)}
        </Text>
        {clip.location && (
          <Text style={[styles.clipSpeed, { color: colors.accent }]}>
            {clip.location.speed} km/h
          </Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.clipActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => toggleLock(clip.id)}>
          <Text style={{ fontSize: 18 }}>
            {clip.isLocked ? '🔓' : '🔒'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleShare(clip)}>
          <Text style={{ fontSize: 18 }}>📤</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleDelete(clip)}>
          <Text style={{ fontSize: 18 }}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderDateHeader = (date: string) => (
    <Text style={[styles.dateHeader, { color: colors.textSecondary }]}>
      {date}
    </Text>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filter bar */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: !filterLocked
                ? colors.primary
                : colors.surfaceLight,
            },
          ]}
          onPress={() => setFilterLocked(false)}>
          <Text
            style={[
              styles.filterText,
              { color: !filterLocked ? '#FFF' : colors.text },
            ]}>
            All ({clips.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: filterLocked
                ? colors.locked
                : colors.surfaceLight,
            },
          ]}
          onPress={() => setFilterLocked(true)}>
          <Text
            style={[
              styles.filterText,
              { color: filterLocked ? '#000' : colors.text },
            ]}>
            🔒 Locked ({clips.filter(c => c.isLocked).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Clip list */}
      {sortedClips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📹</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {filterLocked ? 'No Locked Clips' : 'No Recordings Yet'}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            {filterLocked
              ? 'Lock important clips to protect them from auto-deletion.'
              : 'Start recording from the home screen. Your clips will appear here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedClips}
          keyExtractor={item => item.id}
          renderItem={renderClipItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Video Player Modal */}
      <Modal
        visible={!!selectedClip}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedClip(null)}>
        <View style={styles.playerContainer}>
          {selectedClip && (
            <Video
              source={{ uri: `file://${selectedClip.filePath}` }}
              style={styles.videoPlayer}
              controls={true}
              resizeMode="contain"
              paused={false}
            />
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedClip(null)}>
            <Text style={styles.closeText}>✕ Close</Text>
          </TouchableOpacity>

          {selectedClip && (
            <View style={styles.playerInfo}>
              <Text style={styles.playerInfoText}>
                {new Date(selectedClip.createdAt).toLocaleString()}
              </Text>
              <Text style={styles.playerInfoText}>
                {selectedClip.camera === 'back' ? 'Rear Cam' : 'Front Cam'} •{' '}
                {formatSize(selectedClip.fileSize)} •{' '}
                {formatDuration(selectedClip.duration)}
              </Text>
              {selectedClip.location && (
                <Text style={styles.playerInfoText}>
                  Speed: {selectedClip.location.speed} km/h • GPS:{' '}
                  {selectedClip.location.latitude.toFixed(4)},{' '}
                  {selectedClip.location.longitude.toFixed(4)}
                </Text>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  dateHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
    paddingLeft: 4,
  },
  clipCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    padding: 10,
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 80,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  noThumbnail: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noThumbIcon: {
    fontSize: 24,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  lockBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  lockIcon: {
    fontSize: 10,
  },
  clipInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clipTime: {
    fontSize: 14,
    fontWeight: '700',
  },
  clipMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  clipSpeed: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  clipActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Video player modal
  playerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  videoPlayer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (9 / 16),
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  playerInfo: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 12,
  },
  playerInfoText: {
    color: '#CCC',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});
