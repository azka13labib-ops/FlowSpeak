export const API_PORT = 3000;

// Automatic fallback: 127.0.0.1 works over USB (adb reverse), 192.168.1.3 works over Wi-Fi LAN
export const IP_CANDIDATES = ['127.0.0.1', '192.168.1.3'];

export function getTranscribeUrl(ip: string): string {
  return `http://${ip}:${API_PORT}/api/transcribe`;
}

export function getEvaluateUrl(ip: string): string {
  return `http://${ip}:${API_PORT}/api/evaluate`;
}
