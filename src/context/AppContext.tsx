import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppSettings,
  VideoClip,
  RecordingState,
  StorageInfo,
  DEFAULT_SETTINGS,
} from '../types';

interface AppState {
  settings: AppSettings;
  clips: VideoClip[];
  recording: RecordingState;
  storage: StorageInfo;
  isLoading: boolean;
}

type Action =
  | { type: 'SET_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_CLIPS'; payload: VideoClip[] }
  | { type: 'ADD_CLIP'; payload: VideoClip }
  | { type: 'REMOVE_CLIP'; payload: string }
  | { type: 'TOGGLE_LOCK'; payload: string }
  | { type: 'SET_RECORDING'; payload: Partial<RecordingState> }
  | { type: 'SET_STORAGE'; payload: StorageInfo }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> };

const initialState: AppState = {
  settings: DEFAULT_SETTINGS,
  clips: [],
  recording: {
    isRecording: false,
    isPaused: false,
    currentChunkStart: null,
    elapsedSeconds: 0,
    currentCamera: 'back',
  },
  storage: {
    usedMB: 0,
    maxMB: DEFAULT_SETTINGS.maxStorageMB,
    clipCount: 0,
    lockedClipCount: 0,
  },
  isLoading: true,
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_CLIPS':
      return { ...state, clips: action.payload };
    case 'ADD_CLIP':
      // Prevent duplicate clips
      if (state.clips.some(c => c.id === action.payload.id)) {
        return state;
      }
      return { ...state, clips: [...state.clips, action.payload] };
    case 'REMOVE_CLIP':
      return {
        ...state,
        clips: state.clips.filter(c => c.id !== action.payload),
      };
    case 'TOGGLE_LOCK': {
      const updated = state.clips.map(c =>
        c.id === action.payload ? { ...c, isLocked: !c.isLocked } : c,
      );
      return { ...state, clips: updated };
    }
    case 'SET_RECORDING':
      return {
        ...state,
        recording: { ...state.recording, ...action.payload },
      };
    case 'SET_STORAGE':
      return { ...state, storage: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOAD_STATE':
      return { ...state, ...action.payload, isLoading: false };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addClip: (clip: VideoClip) => void;
  removeClip: (id: string) => void;
  toggleLock: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const SETTINGS_KEY = '@motodashcam_settings';
const CLIPS_KEY = '@motodashcam_clips';

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load persisted state on mount
  useEffect(() => {
    loadPersistedState();
  }, []);

  // Persist settings when they change
  useEffect(() => {
    if (!state.isLoading) {
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    }
  }, [state.settings, state.isLoading]);

  // Persist clips metadata when they change
  useEffect(() => {
    if (!state.isLoading) {
      AsyncStorage.setItem(CLIPS_KEY, JSON.stringify(state.clips));
    }
  }, [state.clips, state.isLoading]);

  async function loadPersistedState() {
    try {
      const [settingsJson, clipsJson] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEY),
        AsyncStorage.getItem(CLIPS_KEY),
      ]);

      const settings = settingsJson
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) }
        : DEFAULT_SETTINGS;
      const rawClips: VideoClip[] = clipsJson ? JSON.parse(clipsJson) : [];
      // Deduplicate clips by ID
      const seen = new Set<string>();
      const clips = rawClips.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      const usedMB = clips.reduce((sum, c) => sum + c.fileSize / (1024 * 1024), 0);

      dispatch({
        type: 'LOAD_STATE',
        payload: {
          settings,
          clips,
          storage: {
            usedMB,
            maxMB: settings.maxStorageMB,
            clipCount: clips.length,
            lockedClipCount: clips.filter(c => c.isLocked).length,
          },
        },
      });
    } catch {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  function updateSettings(newSettings: Partial<AppSettings>) {
    dispatch({ type: 'SET_SETTINGS', payload: newSettings });
  }

  function addClip(clip: VideoClip) {
    dispatch({ type: 'ADD_CLIP', payload: clip });
  }

  function removeClip(id: string) {
    dispatch({ type: 'REMOVE_CLIP', payload: id });
  }

  function toggleLock(id: string) {
    dispatch({ type: 'TOGGLE_LOCK', payload: id });
  }

  return (
    <AppContext.Provider
      value={{ state, dispatch, updateSettings, addClip, removeClip, toggleLock }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
