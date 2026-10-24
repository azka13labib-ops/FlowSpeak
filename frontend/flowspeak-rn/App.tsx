// FlowSpeak — App.tsx
// Root component: single-screen React Native app using Expo
// Design: Neobrutalism + Glassmorphism on dark background

import React, { useState, useRef } from 'react';
import {
  Alert,
  Animated,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';

import { TRANSCRIBE, EVALUATE } from './src/config';
import type { EvaluationResult, Correction } from './src/types';

// ─── State machine types ───────────────────────────────────────────────────────
type RecordState = 'idle' | 'recording' | 'processing';

const PROMPT = "Tell me about a skill you've been trying to learn and why it matters to you.";

// ─── Score Bar Component ──────────────────────────────────────────────────────
function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.trackOuter}>
        <View style={[styles.trackFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.scoreNum, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Correction Card Component ────────────────────────────────────────────────
function CorrectionCard({ c }: { c: Correction }) {
  return (
    <View style={styles.correctionCard}>
      <Text style={styles.corrOriginal}>{c.original}</Text>
      <Text style={styles.corrArrow}>↓</Text>
      <Text style={styles.corrFixed}>{c.fixed}</Text>
      <Text style={styles.corrExplanation}>{c.explanation}</Text>
    </View>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState]             = useState<RecordState>('idle');
  const [transcript, setTranscript]   = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult]           = useState<EvaluationResult | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Pulse animation while recording ────────────────────────────────────────
  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  };
  const stopPulse = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  // ── Request mic permission ─────────────────────────────────────────────────
  const ensurePermission = async (): Promise<boolean> => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) {
      Alert.alert(
        'Microphone Permission',
        'FlowSpeak needs microphone access to record your speech.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  // ── Start recording ────────────────────────────────────────────────────────
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
      Alert.alert('Error', 'Could not start recording: ' + e.message);
    }
  };

  // ── Stop recording and process ─────────────────────────────────────────────
  const stopRecording = async () => {
    stopPulse();
    setState('processing');
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) throw new Error('No recording URI');

      const tx = await transcribeAudio(uri);
      if (!tx) { setState('idle'); return; }

      const clean = tx.replace(/\[BLANK_AUDIO\]/gi, '').trim();
      if (!clean) {
        Alert.alert(
          'Tidak Ada Ucapan',
          'Tidak ada suara atau percakapan yang terdeteksi. Pastikan kamu berbicara dengan jelas ke mikrofon lalu tekan Stop.'
        );
        setState('idle');
        return;
      }

      setTranscript(clean);
      setState('idle');
      evaluateTranscript(clean);   // fire-and-forget — shows its own spinner
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setState('idle');
    }
  };

  // ── Toggle record button ───────────────────────────────────────────────────
  const onRecordToggle = () => {
    if (state === 'idle')      startRecording();
    else if (state === 'recording') stopRecording();
    // 'processing' → ignore
  };

  // ── API: Transcribe ────────────────────────────────────────────────────────
  const transcribeAudio = async (uri: string): Promise<string | null> => {
    try {
      console.log('Transcribing audio from:', uri, 'to:', TRANSCRIBE);
      const uploadRes = await FileSystem.uploadAsync(TRANSCRIBE, uri, {
        fieldName:  'audio',
        httpMethod: 'POST',
        uploadType: FileSystemUploadType.MULTIPART,
      });

      console.log('Upload response status:', uploadRes.status, 'body:', uploadRes.body);
      const json = JSON.parse(uploadRes.body);

      if (uploadRes.status >= 400 || json.error) {
        Alert.alert('Transcription Error', json.error ?? `HTTP ${uploadRes.status}`);
        return null;
      }
      return json.transcript ?? null;
    } catch (e: any) {
      console.error('Transcribe upload error:', e);
      Alert.alert('Connection Error', `Cannot connect to server at ${TRANSCRIBE}.\nDetails: ${e.message}`);
      return null;
    }
  };

  // ── API: Evaluate ──────────────────────────────────────────────────────────
  const evaluateTranscript = async (tx: string) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(EVALUATE, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify({ transcript: tx }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setResult(json as EvaluationResult);
    } catch (e: any) {
      Alert.alert('AI Error', e.message || 'Could not reach the evaluator. Make sure Ollama is running.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const btnLabel =
    state === 'idle'       ? '🎙 Start Speaking' :
    state === 'recording'  ? '⏹ Stop'            :
                             '⏳ Processing...';

  const btnStyle = [
    styles.recordBtn,
    state === 'recording' && styles.recordBtnStop,
    state === 'processing' && styles.recordBtnDisabled,
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerFlow}>Flow</Text>
        <Text style={styles.headerSpeak}>Speak</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Prompt Card ──────────────────────────────────────────────────── */}
        <View style={styles.promptCard}>
          <Text style={styles.promptLabel}>TODAY'S TOPIC</Text>
          <Text style={styles.promptText}>{PROMPT}</Text>
        </View>

        {/* ── Record Button ────────────────────────────────────────────────── */}
        <View style={styles.recordWrapper}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={btnStyle}
              onPress={onRecordToggle}
              disabled={state === 'processing'}
              activeOpacity={0.8}
            >
              <Text style={styles.recordBtnText}>{btnLabel}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* ── Processing indicator ──────────────────────────────────────────── */}
        {state === 'processing' && (
          <View style={styles.processingRow}>
            <ActivityIndicator color="#7c3aed" size="small" />
            <Text style={styles.processingText}>Sending audio to Whisper...</Text>
          </View>
        )}

        {/* ── Transcript Card ──────────────────────────────────────────────── */}
        {(!!transcript || state === 'processing') && (
          <View style={styles.glassCard}>
            <Text style={styles.sectionTitle}>TRANSCRIPT</Text>
            <View style={styles.divider} />
            {!!transcript && <Text style={styles.transcriptText}>{transcript}</Text>}
            {isAnalyzing && (
              <View style={styles.analyzingPill}>
                <ActivityIndicator color="#06b6d4" size="small" />
                <Text style={styles.analyzingText}>  AI is analyzing grammar...</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Results Card ─────────────────────────────────────────────────── */}
        {!!result && (
          <View style={styles.glassCard}>

            {/* Overall badge */}
            <View style={styles.overallBadge}>
              <Text style={styles.overallNum}>{result.score.overall}</Text>
              <Text style={styles.overallLabel}>OVERALL SCORE</Text>
            </View>

            <Text style={styles.sectionTitle}>BREAKDOWN</Text>
            <View style={styles.divider} />
            <ScoreBar label="Fluency"    value={result.score.fluency}    color="#06b6d4" />
            <ScoreBar label="Grammar"    value={result.score.grammar}    color="#7c3aed" />
            <ScoreBar label="Vocabulary" value={result.score.vocabulary} color="#10b981" />

            {/* Corrections */}
            {result.corrections.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>CORRECTIONS</Text>
                <View style={styles.divider} />
                {result.corrections.map((c, i) => <CorrectionCard key={i} c={c} />)}
              </>
            )}
            {result.corrections.length === 0 && (
              <Text style={styles.noCorrections}>✅ No corrections — great job!</Text>
            )}

            {/* Vocabulary tips */}
            {result.vocabulary_tips.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>VOCABULARY TIPS</Text>
                <View style={styles.divider} />
                {result.vocabulary_tips.map((t, i) => (
                  <Text key={i} style={styles.vocabTip}>• {t}</Text>
                ))}
              </>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerFlow: {
    fontSize:   22,
    fontWeight: '900',
    color:      '#7c3aed',
  },
  headerSpeak: {
    fontSize:   22,
    fontWeight: '900',
    color:      '#06b6d4',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop:        20,
  },

  // ── Prompt card ─────────────────────────────────────────────────────────────
  promptCard: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     'rgba(124,58,237,0.35)',
    padding:         20,
    marginBottom:    24,
  },
  promptLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         '#94a3b8',
    letterSpacing: 2,
    marginBottom:  8,
  },
  promptText: {
    fontSize:   16,
    color:      '#f8fafc',
    lineHeight: 24,
  },

  // ── Record button ────────────────────────────────────────────────────────────
  recordWrapper: {
    alignItems:    'center',
    marginBottom:  24,
  },
  recordBtn: {
    width:           210,
    height:          210,
    borderRadius:    105,
    backgroundColor: '#7c3aed',
    borderWidth:     4,
    borderColor:     '#ffffff',
    alignItems:      'center',
    justifyContent:  'center',
    elevation:       14,
    shadowColor:     '#7c3aed',
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.55,
    shadowRadius:    12,
  },
  recordBtnStop: {
    backgroundColor: '#ef4444',
    shadowColor:     '#ef4444',
  },
  recordBtnDisabled: {
    backgroundColor: '#374151',
    borderColor:     '#6b7280',
    shadowOpacity:   0,
  },
  recordBtnText: {
    fontSize:   17,
    fontWeight: '800',
    color:      '#ffffff',
    textAlign:  'center',
  },

  // ── Processing row ───────────────────────────────────────────────────────────
  processingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   16,
  },
  processingText: {
    marginLeft: 8,
    color:      '#94a3b8',
    fontSize:   13,
  },

  // ── Glass card ───────────────────────────────────────────────────────────────
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius:    20,
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.18)',
    padding:         20,
    marginBottom:    16,
  },
  sectionTitle: {
    fontSize:      11,
    fontWeight:    '700',
    color:         '#94a3b8',
    letterSpacing: 2,
    marginBottom:  8,
  },
  divider: {
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginBottom:    12,
  },
  transcriptText: {
    fontSize:   16,
    color:      '#f8fafc',
    lineHeight: 24,
  },
  analyzingPill: {
    flexDirection:    'row',
    alignItems:       'center',
    alignSelf:        'flex-start',
    backgroundColor:  'rgba(6,182,212,0.15)',
    borderRadius:     50,
    borderWidth:      1,
    borderColor:      '#06b6d4',
    paddingVertical:  8,
    paddingHorizontal:16,
    marginTop:        10,
  },
  analyzingText: {
    color:      '#06b6d4',
    fontSize:   13,
    fontWeight: '600',
  },

  // ── Overall badge ────────────────────────────────────────────────────────────
  overallBadge: {
    alignItems:      'center',
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     'rgba(124,58,237,0.4)',
    paddingVertical: 16,
    marginBottom:    20,
  },
  overallNum: {
    fontSize:   48,
    fontWeight: '900',
    color:      '#7c3aed',
    lineHeight: 56,
  },
  overallLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         '#94a3b8',
    letterSpacing: 2,
  },

  // ── Score bars ───────────────────────────────────────────────────────────────
  scoreRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   12,
  },
  scoreLabel: {
    width:      80,
    fontSize:   13,
    color:      '#f8fafc',
  },
  trackOuter: {
    flex:            1,
    height:          8,
    borderRadius:    4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal:12,
    overflow:        'hidden',
  },
  trackFill: {
    height:       8,
    borderRadius: 4,
  },
  scoreNum: {
    width:      28,
    fontSize:   13,
    fontWeight: '700',
    textAlign:  'right',
  },

  // ── Correction cards ──────────────────────────────────────────────────────────
  correctionCard: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     'rgba(239,68,68,0.25)',
    padding:         14,
    marginBottom:    10,
  },
  corrOriginal: {
    fontSize:          14,
    color:             '#fca5a5',
    textDecorationLine:'line-through',
    marginBottom:      4,
  },
  corrArrow: {
    fontSize:    16,
    color:       '#94a3b8',
    textAlign:   'center',
    marginBottom:4,
  },
  corrFixed: {
    fontSize:    14,
    color:       '#6ee7b7',
    fontWeight:  '600',
    marginBottom:6,
  },
  corrExplanation: {
    fontSize:   13,
    color:      '#cbd5e1',
    lineHeight: 20,
  },
  noCorrections: {
    fontSize:   14,
    color:      '#6ee7b7',
    textAlign:  'center',
    marginVertical: 8,
  },

  // ── Vocab tips ───────────────────────────────────────────────────────────────
  vocabTip: {
    fontSize:    14,
    color:       '#f8fafc',
    lineHeight:  22,
    marginBottom:6,
  },
});
