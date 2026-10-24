import { Platform } from 'react-native';

// PC Wi-Fi LAN IP (works for physical phones on same Wi-Fi as well as emulators)
export const LOCAL_IP   = '192.168.1.3';
export const API_PORT   = 3000;
export const BASE_URL   = `http://${LOCAL_IP}:${API_PORT}`;
export const TRANSCRIBE = `${BASE_URL}/api/transcribe`;
export const EVALUATE   = `${BASE_URL}/api/evaluate`;

