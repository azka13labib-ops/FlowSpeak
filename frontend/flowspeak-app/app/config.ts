/**
 * FlowSpeak — app/config.ts
 *
 * ⚠️  Change LOCAL_IP to the LAN IP of the machine running the backend
 *     (e.g. "192.168.1.42").  Find it with `ipconfig` on Windows.
 *     Do NOT use "localhost" or "127.0.0.1" on a real device — those
 *     resolve to the phone itself, not your laptop.
 */
export const LOCAL_IP   = '192.168.1.3'; // ← CHANGE THIS
export const API_PORT   = 3000;
export const BASE_URL   = `http://${LOCAL_IP}:${API_PORT}`;
export const TRANSCRIBE = `${BASE_URL}/api/transcribe`;
export const EVALUATE   = `${BASE_URL}/api/evaluate`;
