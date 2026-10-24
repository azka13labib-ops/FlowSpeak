// FlowSpeak — src/config.ts
// Change LOCAL_IP to the LAN IP of the machine running the backend
// Find it with `ipconfig` on Windows. Do NOT use localhost on a real device.

export const LOCAL_IP   = '192.168.1.3'; // ← CHANGE THIS
export const API_PORT   = 3000;
export const BASE_URL   = `http://${LOCAL_IP}:${API_PORT}`;
export const TRANSCRIBE = `${BASE_URL}/api/transcribe`;
export const EVALUATE   = `${BASE_URL}/api/evaluate`;
