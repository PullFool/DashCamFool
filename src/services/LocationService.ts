import Geolocation, {
  GeolocationResponse,
} from '@react-native-community/geolocation';
import { LocationData } from '../types';

type LocationCallback = (location: LocationData) => void;

class LocationService {
  private watchId: number | null = null;
  private currentLocation: LocationData | null = null;
  private listeners: LocationCallback[] = [];

  /**
   * Start tracking GPS location and speed
   */
  start(): void {
    if (this.watchId !== null) return;

    Geolocation.requestAuthorization();

    this.watchId = Geolocation.watchPosition(
      (position: GeolocationResponse) => {
        const { latitude, longitude, speed } = position.coords;

        this.currentLocation = {
          latitude,
          longitude,
          // speed comes in m/s, convert to km/h. Null/negative means no reading.
          speed: speed != null && speed >= 0 ? Math.round(speed * 3.6) : 0,
          timestamp: position.timestamp,
        };

        this.listeners.forEach(cb => cb(this.currentLocation!));
      },
      (error) => {
        console.warn('Location error:', error.message);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5, // update every 5 meters
        interval: 1000, // 1 second
        fastestInterval: 500,
      },
    );
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
