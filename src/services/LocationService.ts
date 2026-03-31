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

      let lastLat = 0;
      let lastLon = 0;
      let lastTime = 0;

      this.watchId = Geolocation.watchPosition(
        (position: GeolocationResponse) => {
          const { latitude, longitude, speed } = position.coords;
          const now = position.timestamp;

          // Try GPS speed first
          let calculatedSpeed = 0;
          if (speed != null && speed >= 0) {
            calculatedSpeed = Math.round(speed * 3.6);
          } else if (lastLat !== 0 && lastTime !== 0) {
            // Fallback: calculate speed from distance between two GPS points
            const timeDiff = (now - lastTime) / 1000; // seconds
            if (timeDiff > 0 && timeDiff < 10) {
              const dist = this.getDistance(lastLat, lastLon, latitude, longitude);
              calculatedSpeed = Math.round((dist / timeDiff) * 3.6); // m/s to km/h
            }
          }

          lastLat = latitude;
          lastLon = longitude;
          lastTime = now;

          this.currentLocation = {
            latitude,
            longitude,
            speed: calculatedSpeed,
            timestamp: now,
          };

          this.listeners.forEach(cb => cb(this.currentLocation!));
        },
        () => {
          // Silently ignore GPS errors
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 5,
          interval: 1000,
          fastestInterval: 500,
          timeout: 60000,
          maximumAge: 0,
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

  /**
   * Calculate distance between two GPS points in meters (Haversine formula)
   */
  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const locationService = new LocationService();
