import Geolocation, {
  GeolocationResponse,
} from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import { LocationData } from '../types';

type LocationCallback = (location: LocationData) => void;

class LocationService {
  private watchId: number | null = null;
  private currentLocation: LocationData | null = null;
  private listeners: LocationCallback[] = [];

  /**
   * Start tracking GPS location and speed — silently fails if GPS unavailable
   */
  async start(): Promise<void> {
    if (this.watchId !== null) return;

    try {
      // Request location permission first
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'DashCamFool needs GPS to track your speed.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          // No permission — silently skip GPS
          return;
        }
      }

      Geolocation.requestAuthorization();

      this.watchId = Geolocation.watchPosition(
        (position: GeolocationResponse) => {
          const { latitude, longitude, speed } = position.coords;

          this.currentLocation = {
            latitude,
            longitude,
            speed: speed != null && speed >= 0 ? Math.round(speed * 3.6) : 0,
            timestamp: position.timestamp,
          };

          this.listeners.forEach(cb => cb(this.currentLocation!));
        },
        () => {
          // Silently ignore GPS errors — recording works without it
        },
        {
          enableHighAccuracy: false,
          distanceFilter: 10,
          interval: 2000,
          fastestInterval: 1000,
          timeout: 30000,
        },
      );
    } catch {
      // GPS unavailable — silently continue without it
    }
  }

  /**
   * Stop tracking location
   */
  stop(): void {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.currentLocation = null;
  }

  /**
   * Get current location snapshot
   */
  getCurrentLocation(): LocationData | null {
    return this.currentLocation;
  }

  /**
   * Get current speed in km/h
   */
  getCurrentSpeed(): number {
    return this.currentLocation?.speed ?? 0;
  }

  /**
   * Subscribe to location updates
   */
  addListener(callback: LocationCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Check if location tracking is active
   */
  isTracking(): boolean {
    return this.watchId !== null;
  }
}

export const locationService = new LocationService();
