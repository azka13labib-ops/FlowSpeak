import { Platform } from 'react-native';

// For Android emulator (like Caspian), 10.0.2.2 points to host machine
// For physical devices on Wi-Fi, use your PC's LAN IP: 192.168.1.10
export const LOCAL_IP   = Platform.OS === 'android' ? '10.0.2.2' : '192.168.1.10';
export const API_PORT   = 3000;
export const BASE_URL   = `http://${LOCAL_IP}:${API_PORT}`;
export const TRANSCRIBE = `${BASE_URL}/api/transcribe`;
export const EVALUATE   = `${BASE_URL}/api/evaluate`;

