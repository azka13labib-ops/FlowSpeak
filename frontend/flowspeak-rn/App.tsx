import React, { useState, useRef, useEffect } from 'react';
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';

import { IP_CANDIDATES, getTranscribeUrl, getEvaluateUrl } from './src/config';
import type { EvaluationResult, Correction } from './src/types';

// Practice prompts for speech training
const TOPICS = [
  "Tell me about a skill you've been trying to learn and why it matters to you.",
  "Describe your favorite place in your hometown and what makes it special.",
  "What is one challenge you faced recently and how did you overcome it?",
  "If you could travel anywhere in the world tomorrow, where would you go and why?",
  "Explain your favorite hobby and how you first got interested in it."
];

type RecordState = 'idle' | 'recording' | 'processing';

export default function App() {
  const [topicIndex, setTopicIndex]   = useState(0);
  const [state, setState]             = useState<RecordState>('idle');
  const [recordingSeconds, setSeconds]= useState(0);
  const [transcript, setTranscript]   = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult]           = useState<EvaluationResult | null>(null);
  const [showInfoModal, setShowInfo]  = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Recording timer
  useEffect(() => {
    if (state === 'recording') {
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  // Gentle pulse while recording
  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  const ensurePermission = async (): Promise<boolean> => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) {
      Alert.alert(
        'Izin Mikrofon Diperlukan',
        'FlowSpeak membutuhkan akses mikrofon untuk merekam dan mengevaluasi pelafalan bahasa Inggris kamu.'
      );
      return false;
    }
    return true;
  };

  const startRecording = async () => {
    if (!(await ensurePermission())) return;
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setState('recording');
      setTranscript('');
      setResult(null);
      startPulse();
    } catch (e: any) {
      Alert.alert('Gagal Merekam', e.message || 'Tidak dapat memulai rekaman audio.');
    }
  };

  const stopRecording = async () => {
    stopPulse();
    setState('processing');
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error('File rekaman tidak ditemukan.');

      const tx = await transcribeAudio(uri);
      if (!tx) {
        setState('idle');
        return;
      }

      const clean = tx.replace(/\[BLANK_AUDIO\]/gi, '').trim();
      if (!clean) {
        Alert.alert(
          'Tidak Ada Ucapan Terdeteksi',
          'Suara tidak terdengar jelas atau mic terlalu hening. Silakan coba bicara kembali dengan volume wajar.'
        );
        setState('idle');
        return;
      }

      setTranscript(clean);
      setState('idle');
      evaluateTranscript(clean);
    } catch (e: any) {
      Alert.alert('Kesalahan Rekaman', e.message);
      setState('idle');
    }
  };

  const onRecordToggle = () => {
    if (state === 'idle') startRecording();
    else if (state === 'recording') stopRecording();
  };

  const transcribeAudio = async (uri: string): Promise<string | null> => {
    let lastError: any = null;

    for (const ip of IP_CANDIDATES) {
      const url = getTranscribeUrl(ip);
      try {
        console.log(`[Transcribe] Trying ${url}...`);
        const uploadRes = await FileSystem.uploadAsync(url, uri, {
          fieldName:  'audio',
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.MULTIPART,
        });

        const json = JSON.parse(uploadRes.body);
        if (uploadRes.status >= 400 || json.error) {
          throw new Error(json.error || `HTTP ${uploadRes.status}`);
        }
        return json.transcript ?? null;
      } catch (err: any) {
        console.warn(`[Transcribe] Failed via ${ip}:`, err.message);
        lastError = err;
      }
    }

    Alert.alert(
      'Koneksi Server Gagal',
      `Tidak dapat menghubungi server FlowSpeak via USB (127.0.0.1) maupun Wi-Fi (192.168.1.3).\n\nDetail: ${lastError?.message || 'Network request failed'}`
    );
    return null;
  };

  const evaluateTranscript = async (tx: string) => {
    setIsAnalyzing(true);
    let lastError: any = null;

    for (const ip of IP_CANDIDATES) {
      const url = getEvaluateUrl(ip);
      try {
        console.log(`[Evaluate] Trying ${url}...`);
        const res = await fetch(url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body:    JSON.stringify({ transcript: tx }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        setResult(json as EvaluationResult);
        setIsAnalyzing(false);
        return;
      } catch (err: any) {
        console.warn(`[Evaluate] Failed via ${ip}:`, err.message);
        lastError = err;
      }
    }

    setIsAnalyzing(false);
    Alert.alert('Evaluasi AI Gagal', lastError?.message || 'Gagal menerima evaluasi dari model bahasa Ollama.');
  };

  const nextTopic = () => {
    setTopicIndex((prev) => (prev + 1) % TOPICS.length);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getScoreBadge = (score: number) => {
    if (score >= 85) return { label: 'Mahir (Advanced)', bg: '#064e3b', text: '#34d399' };
    if (score >= 70) return { label: 'Lancar (Upper-Intermediate)', bg: '#1e3a8a', text: '#60a5fa' };
    if (score >= 50) return { label: 'Menengah (Intermediate)', bg: '#451a03', text: '#fbbf24' };
    return { label: 'Perlu Latihan (Developing)', bg: '#4c0519', text: '#f87171' };
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" />

        {/* ── Top Bar ────────────────────────────────────────────────────────── */}
        <View style={styles.topNav}>
          <View style={styles.brandGroup}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>FS</Text>
            </View>
            <View>
              <Text style={styles.brandTitle}>FlowSpeak</Text>
              <View style={styles.statusIndicator}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>AI Coach Aktif</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => setShowInfo(true)}
            activeOpacity={0.7}
            accessibilityLabel="Buka Panduan Aplikasi"
          >
            <Text style={styles.infoBtnText}>Bantuan</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Topic Prompt ─────────────────────────────────────────────────── */}
          <View style={styles.topicCard}>
            <View style={styles.topicHeader}>
              <Text style={styles.topicTag}>TOPIK LATIHAN HARI INI</Text>
              <TouchableOpacity
                onPress={nextTopic}
                style={styles.shuffleBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.shuffleBtnText}>Ganti Topik</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.topicPrompt}>{TOPICS[topicIndex]}</Text>
          </View>

          {/* ── Speaking Controller ──────────────────────────────────────────── */}
          <View style={styles.coachController}>
            {state === 'recording' && (
              <View style={styles.timerBadge}>
                <View style={styles.recordingPulseDot} />
                <Text style={styles.timerText}>{formatTime(recordingSeconds)}</Text>
              </View>
            )}

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[
                  styles.recordButtonBase,
                  state === 'idle' && styles.recordButtonIdle,
                  state === 'recording' && styles.recordButtonActive,
                  state === 'processing' && styles.recordButtonProcessing,
                ]}
                onPress={onRecordToggle}
                disabled={state === 'processing'}
                activeOpacity={0.85}
              >
                {state === 'idle' && (
                  <>
                    <Text style={styles.recordActionIcon}>🎙️</Text>
                    <Text style={styles.recordActionTitle}>Mulai Bicara</Text>
                    <Text style={styles.recordActionSubtitle}>Tekan untuk mulai merekam</Text>
                  </>
                )}

                {state === 'recording' && (
                  <>
                    <View style={styles.stopIconSquare} />
                    <Text style={styles.recordActionTitle}>Selesai Bicara</Text>
                    <Text style={styles.recordActionSubtitle}>Tekan untuk kirim audio</Text>
                  </>
                )}

                {state === 'processing' && (
                  <>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={[styles.recordActionTitle, { marginTop: 10 }]}>Memproses Audio</Text>
                    <Text style={styles.recordActionSubtitle}>Mengirim ke Whisper...</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* ── Transcript Section ───────────────────────────────────────────── */}
          {(!!transcript || isAnalyzing) && (
            <View style={styles.cardSection}>
              <View style={styles.cardSectionHeader}>
                <Text style={styles.cardSectionTag}>TRANSKRIP UCAPAN</Text>
                {isAnalyzing && (
                  <View style={styles.evaluatingIndicator}>
                    <ActivityIndicator size="small" color="#38bdf8" />
                    <Text style={styles.evaluatingText}>Menganalisis tata bahasa...</Text>
                  </View>
                )}
              </View>
              <Text style={styles.transcriptQuote}>"{transcript}"</Text>
            </View>
          )}

          {/* ── Evaluation Results ───────────────────────────────────────────── */}
          {!!result && (
            <View style={styles.cardSection}>
              <Text style={styles.cardSectionTag}>HASIL EVALUASI AI</Text>

              {/* Overall Score */}
              <View style={styles.scoreSummaryRow}>
                <View style={styles.scoreMainBlock}>
                  <Text style={styles.scoreNumber}>{result.score.overall}</Text>
                  <Text style={styles.scoreOutOf}>/ 100</Text>
                </View>
                <View style={styles.badgeContainer}>
                  {(() => {
                    const badge = getScoreBadge(result.score.overall);
                    return (
                      <View style={[styles.badgePill, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Breakdown Bars */}
              <View style={styles.breakdownContainer}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Kelancaran (Fluency)</Text>
                  <Text style={styles.metricValue}>{result.score.fluency}%</Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${result.score.fluency}%`, backgroundColor: '#38bdf8' }]} />
                </View>

                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Tata Bahasa (Grammar)</Text>
                  <Text style={styles.metricValue}>{result.score.grammar}%</Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${result.score.grammar}%`, backgroundColor: '#a855f7' }]} />
                </View>

                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Kosa Kata (Vocabulary)</Text>
                  <Text style={styles.metricValue}>{result.score.vocabulary}%</Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${result.score.vocabulary}%`, backgroundColor: '#34d399' }]} />
                </View>
              </View>

              {/* Grammar Corrections */}
              <View style={styles.correctionsHeader}>
                <Text style={styles.subSectionTitle}>Catatan Perbaikan Tata Bahasa</Text>
              </View>

              {result.corrections.length > 0 ? (
                result.corrections.map((c: Correction, idx: number) => (
                  <View key={idx} style={styles.correctionItem}>
                    <View style={styles.diffComparison}>
                      <View style={styles.diffBlockOriginal}>
                        <Text style={styles.diffTagRed}>Asli</Text>
                        <Text style={styles.diffTextOriginal}>{c.original}</Text>
                      </View>
                      <View style={styles.diffBlockFixed}>
                        <Text style={styles.diffTagGreen}>Disarankan</Text>
                        <Text style={styles.diffTextFixed}>{c.fixed}</Text>
                      </View>
                    </View>
                    <Text style={styles.correctionExplanation}>{c.explanation}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.perfectScoreNotice}>
                  <Text style={styles.perfectScoreText}>
                    Bagus sekali. Tidak ditemukan kesalahan tata bahasa pada rekaman ini.
                  </Text>
                </View>
              )}

              {/* Vocabulary Tips */}
              {result.vocabulary_tips && result.vocabulary_tips.length > 0 && (
                <View style={styles.vocabTipsContainer}>
                  <Text style={styles.subSectionTitle}>Saran Pilihan Kata Lebih Baik</Text>
                  {result.vocabulary_tips.map((tip: string, idx: number) => (
                    <View key={idx} style={styles.vocabTipItem}>
                      <Text style={styles.vocabTipBullet}>•</Text>
                      <Text style={styles.vocabTipText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Empty State / Helper Card ────────────────────────────────────── */}
          {!result && !transcript && state === 'idle' && (
            <View style={styles.guideCard}>
              <Text style={styles.guideTitle}>Cara Berlatih:</Text>
              <Text style={styles.guideStep}>1. Baca topik di atas dengan tenang.</Text>
              <Text style={styles.guideStep}>2. Tekan tombol hijau "Mulai Bicara" dan ucapkan 1-3 kalimat dalam bahasa Inggris.</Text>
              <Text style={styles.guideStep}>3. Tekan "Selesai Bicara". AI akan langsung memeriksa skor dan memberikan penjelasan perbaikan.</Text>
            </View>
          )}

          <View style={{ height: 48 }} />
        </ScrollView>

        {/* ── Info & Guide Modal ─────────────────────────────────────────────── */}
        <Modal
          visible={showInfoModal}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setShowInfo(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeading}>Tentang FlowSpeak</Text>
              <Text style={styles.modalParagraph}>
                FlowSpeak adalah asisten latihan percakapan bahasa Inggris interaktif yang memproses audio secara lokal di perangkat Anda.
              </Text>

              <Text style={styles.modalSubheading}>Teknologi yang Digunakan:</Text>
              <Text style={styles.modalBullet}>• Whisper.cpp: Mentranskripsi suara menjadi teks secara akurat.</Text>
              <Text style={styles.modalBullet}>• Ollama Llama 3.2: Menganalisis tata bahasa dan memberikan saran dalam Bahasa Indonesia.</Text>

              <Text style={styles.modalSubheading}>Tips Berlatih:</Text>
              <Text style={styles.modalBullet}>• Gunakan artikulasi yang jelas dan tempo wajar.</Text>
              <Text style={styles.modalBullet}>• Jangan takut salah, tujuan utama adalah melatih kepercayaan diri dalam berbicara.</Text>

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowInfo(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0b0f19',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoBadgeText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: -0.3,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  infoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoBtnText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
  },

  // ── Topic Card ───────────────────────────────────────────────────────────────
  topicCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 18,
    marginBottom: 20,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  topicTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.2,
  },
  shuffleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#1f2937',
  },
  shuffleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38bdf8',
  },
  topicPrompt: {
    fontSize: 16,
    color: '#f8fafc',
    lineHeight: 24,
    fontWeight: '500',
  },

  // ── Speaking Controller ──────────────────────────────────────────────────────
  coachController: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244,63,94,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.3)',
  },
  recordingPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f43f5e',
    marginRight: 8,
  },
  timerText: {
    color: '#f43f5e',
    fontWeight: '700',
    fontSize: 14,
  },
  recordButtonBase: {
    width: 240,
    height: 120,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  recordButtonIdle: {
    backgroundColor: '#10b981',
    borderBottomWidth: 4,
    borderBottomColor: '#059669',
  },
  recordButtonActive: {
    backgroundColor: '#f43f5e',
    borderBottomWidth: 4,
    borderBottomColor: '#e11d48',
  },
  recordButtonProcessing: {
    backgroundColor: '#334155',
    borderBottomWidth: 4,
    borderBottomColor: '#1e293b',
  },
  recordActionIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  stopIconSquare: {
    width: 20,
    height: 20,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    marginBottom: 8,
  },
  recordActionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  recordActionSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    fontWeight: '500',
  },

  // ── Card Section ─────────────────────────────────────────────────────────────
  cardSection: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 18,
    marginBottom: 16,
  },
  cardSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  cardSectionTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  evaluatingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  evaluatingText: {
    fontSize: 12,
    color: '#38bdf8',
    marginLeft: 6,
    fontWeight: '500',
  },
  transcriptQuote: {
    fontSize: 16,
    color: '#f8fafc',
    fontStyle: 'italic',
    lineHeight: 24,
  },

  // ── Score Summary ────────────────────────────────────────────────────────────
  scoreSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  scoreMainBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: -1,
  },
  scoreOutOf: {
    fontSize: 16,
    color: '#64748b',
    marginLeft: 4,
    fontWeight: '600',
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Metrics Breakdown ────────────────────────────────────────────────────────
  breakdownContainer: {
    marginBottom: 18,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },

  // ── Corrections ──────────────────────────────────────────────────────────────
  correctionsHeader: {
    marginTop: 10,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  correctionItem: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    marginBottom: 10,
  },
  diffComparison: {
    marginBottom: 8,
  },
  diffBlockOriginal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  diffTagRed: {
    backgroundColor: '#4c0519',
    color: '#f87171',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    marginTop: 2,
  },
  diffTextOriginal: {
    flex: 1,
    fontSize: 13,
    color: '#fca5a5',
    textDecorationLine: 'line-through',
    lineHeight: 18,
  },
  diffBlockFixed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  diffTagGreen: {
    backgroundColor: '#064e3b',
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    marginTop: 2,
  },
  diffTextFixed: {
    flex: 1,
    fontSize: 13,
    color: '#34d399',
    fontWeight: '600',
    lineHeight: 18,
  },
  correctionExplanation: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 6,
  },
  perfectScoreNotice: {
    padding: 12,
    backgroundColor: '#064e3b',
    borderRadius: 8,
    marginBottom: 12,
  },
  perfectScoreText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Vocabulary Tips ──────────────────────────────────────────────────────────
  vocabTipsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  vocabTipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  vocabTipBullet: {
    color: '#38bdf8',
    fontSize: 16,
    marginRight: 8,
    lineHeight: 20,
  },
  vocabTipText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 20,
  },

  // ── Guide Card ───────────────────────────────────────────────────────────────
  guideCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 18,
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  guideStep: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 4,
  },

  // ── Modal ────────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 22,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 10,
  },
  modalParagraph: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 14,
  },
  modalSubheading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 6,
    marginTop: 6,
  },
  modalBullet: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
    marginBottom: 4,
  },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 14,
  },
});
