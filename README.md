# FlowSpeak — Developer Quick Start

> AI-powered English speaking practice app. Records speech → Whisper.cpp STT → Ollama LLM evaluation → Instant feedback on grammar, vocabulary & fluency.

## Arsitektur

```
Android App (NativeScript)
    ↕ HTTP (LAN Wi-Fi)
Express Backend — port 3000
    ├─ POST /api/transcribe → Whisper.cpp server  (port 8080)
    └─ POST /api/evaluate  → Ollama llama3.2:1b   (port 11434)
```

---

## 1. Persiapan Sekali (One-time Setup)

### Download model Ollama
```powershell
ollama pull llama3.2:1b
```

### Install dependensi backend
```powershell
cd backend
npm install
```

### Install dependensi frontend
```powershell
cd frontend/flowspeak-app
npm install
```

---

## 2. Cara Menjalankan (Setiap Sesi Dev)

Buka **3 terminal** terpisah:

### Terminal 1 — Whisper.cpp STT server
```powershell
cd backend
.\start-whisper.bat
# ATAU
npm run whisper
```
Tunggu sampai muncul: `whisper_init_state: ...` (artinya model loaded)

### Terminal 2 — Express Backend API
```powershell
cd backend
npm run dev
```
Harusnya muncul:
```
🎙️  FlowSpeak API running on http://0.0.0.0:3000
   POST /api/transcribe  →  Whisper.cpp @ http://127.0.0.1:8080
   POST /api/evaluate    →  Ollama      @ http://127.0.0.1:11434
```

### Terminal 3 — Jalankan ke HP Android (USB/WiFi)
```powershell
cd frontend/flowspeak-app
ns run android
```

---

## 3. Konfigurasi IP (WAJIB dicek kalau pindah jaringan)

Edit file [`frontend/flowspeak-app/app/config.ts`](frontend/flowspeak-app/app/config.ts):

```typescript
export const LOCAL_IP = '192.168.1.3'; // ← Ganti dengan IP Wi-Fi laptop kamu
```

Cek IP laptop kamu dengan:
```powershell
ipconfig
```
Cari baris **"IPv4 Address"** di adapter Wi-Fi.

---

## 4. Smoke Test Backend (tanpa HP)

```powershell
# Test transcribe (perlu Whisper jalan di port 8080)
curl.exe -F "audio=@backend/whisper.cpp/samples/jfk.wav" http://localhost:3000/api/transcribe

# Test evaluate (perlu Ollama jalan + model llama3.2:1b sudah di-pull)
Invoke-RestMethod -Uri "http://localhost:3000/api/evaluate" -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"transcript": "I wants to learning English because it very important."}'
```

---

## 5. Troubleshooting

| Masalah | Solusi |
|---|---|
| `Whisper.cpp server is not running` | Jalankan `start-whisper.bat` dulu |
| `Ollama is not running` | Pastikan `ollama serve` aktif & model sudah di-pull |
| App tidak bisa konek ke backend | Cek `LOCAL_IP` di `config.ts` sudah sesuai IP laptop |
| `model 'llama3.2:1b' not found` | Jalankan `ollama pull llama3.2:1b` |
| Gradle download lama | Sekali saja, setelah itu tersimpan cache |

---

## 6. Struktur Project

```
flowSpeak/
├── backend/
│   ├── server.js              # Express API (entry point)
│   ├── start-whisper.bat      # Script starter Whisper server
│   ├── package.json
│   └── whisper.cpp/           # Whisper repo + binary prebuilt
│       ├── ggml-tiny.en.bin   # Model STT (~77 MB)
│       └── prebuilt/Release/
│           └── whisper-server.exe
│
├── frontend/flowspeak-app/
│   ├── app/
│   │   ├── app.ts             # Entry point NativeScript
│   │   ├── app.css            # Design system (Neobrutalism + Glass)
│   │   ├── config.ts          # ← IP backend dikonfigurasi di sini
│   │   ├── main-page.xml      # UI layout
│   │   ├── main-page.ts       # Code-behind
│   │   ├── main-view-model.ts # ViewModel + business logic
│   │   └── types.ts           # TypeScript interfaces
│   ├── webpack.config.js
│   ├── nativescript.config.ts
│   └── package.json
│
└── prd.md                     # Product Requirements Document
```

---

## 7. Tech Stack

| Layer | Teknologi |
|---|---|
| Mobile | NativeScript 9.x (TypeScript) |
| Styling | Neobrutalism + Glassmorphism CSS |
| Backend | Node.js + Express 5 |
| STT | Whisper.cpp `tiny.en` (CPU-only) |
| NLP Eval | Ollama `llama3.2:1b` |
| Database | _(Fase 2 — SQLite belum diimplementasi)_ |
