import { Observable, ObservableArray, Dialogs }     from '@nativescript/core';
import { TNSRecorder, AudioRecorderOptions }         from 'nativescript-audio';
import { knownFolders, path, Http }                  from '@nativescript/core';
import * as bgHttp                                   from '@nativescript/background-http';
import { TRANSCRIBE, EVALUATE }                      from './config';
import type { EvaluationResult, Correction, Score } from './types';

// ─── State machine ────────────────────────────────────────────────────────────
type RecordState = 'idle' | 'recording' | 'processing';

export class MainViewModel extends Observable {

  // ── Bindable props ─────────────────────────────────────────────────────────
  private _state:          RecordState = 'idle';
  private _transcript:     string      = '';
  private _isAnalyzing:    boolean     = false;
  private _showResults:    boolean     = false;

  private _scoreFluency:    number = 0;
  private _scoreGrammar:    number = 0;
  private _scoreVocabulary: number = 0;
  private _scoreOverall:    number = 0;

  corrections: ObservableArray<Correction> = new ObservableArray([]);
  vocabTips:   ObservableArray<string>     = new ObservableArray([]);

  // ── Internal ───────────────────────────────────────────────────────────────
  private recorder   = new TNSRecorder();
  private recordPath = '';

  constructor() {
    super();
  }

  // ── Computed getters for XML binding ───────────────────────────────────────

  get state(): RecordState       { return this._state; }
  get transcript(): string       { return this._transcript; }
  get isAnalyzing(): boolean     { return this._isAnalyzing; }
  get showResults(): boolean     { return this._showResults; }
  get scoreFluency(): number     { return this._scoreFluency; }
  get scoreGrammar(): number     { return this._scoreGrammar; }
  get scoreVocabulary(): number  { return this._scoreVocabulary; }
  get scoreOverall(): number     { return this._scoreOverall; }
  get isRecording(): boolean     { return this._state === 'recording'; }
  get isProcessing(): boolean    { return this._state === 'processing'; }

  get buttonLabel(): string {
    switch (this._state) {
      case 'idle':       return '🎙 Start Speaking';
      case 'recording':  return '⏹ Stop';
      case 'processing': return '⏳ Processing...';
    }
  }

  get buttonClass(): string {
    return this._state === 'recording' ? 'btn-record btn-stop' : 'btn-record';
  }

  // ── Public action (called from code-behind) ─────────────────────────────

  async onRecordToggle(): Promise<void> {
    if (this._state === 'idle')      return this.startRecording();
    if (this._state === 'recording') return this.stopRecording();
    // 'processing' — ignore
  }

  // ── Recording ──────────────────────────────────────────────────────────────

  private async startRecording(): Promise<void> {
    try {
      // Check permission
      let hasPermission = false;
      if (typeof this.recorder.hasRecordPermission === 'function') {
        hasPermission = this.recorder.hasRecordPermission();
      }
      if (!hasPermission && typeof this.recorder.requestRecordPermission === 'function') {
        await this.recorder.requestRecordPermission();
        hasPermission = typeof this.recorder.hasRecordPermission === 'function' 
          ? this.recorder.hasRecordPermission() 
          : true;
      }
      if (!hasPermission) {
        await Dialogs.alert({
          title:   'Microphone Permission',
          message: 'FlowSpeak needs microphone access to record your speech.',
          okButtonText: 'OK',
        });
        return;
      }

      this.recordPath = path.join(
        knownFolders.temp().path,
        `flowspeak-${Date.now()}.wav`
      );

      const options: AudioRecorderOptions = {
        filename:   this.recordPath,
        format:     0,     // DEFAULT format (cross-platform)
        channels:   1,
        sampleRate: 16000, // Whisper.cpp prefers 16 kHz
        bitRate:    32000,
        metering:   false,
        infoCallback: (info) => console.log('[Record] Info:', JSON.stringify(info)),
        errorCallback: (err) => console.error('[Record] Error:', err),
      };

      await this.recorder.start(options);

      this.setState('recording');
      // Reset previous session
      this._transcript = '';
      this.notifyPropertyChange('transcript', '');
      this.set('_showResults', false);
      this.notifyPropertyChange('showResults', false);
      this.corrections.splice(0);
      this.vocabTips.splice(0);

    } catch (e) {
      console.error('[Record] Start failed:', e);
      await Dialogs.alert({ title: 'Error', message: 'Could not start recording.', okButtonText: 'OK' });
    }
  }

  private async stopRecording(): Promise<void> {
    this.setState('processing');
    try {
      await this.recorder.stop();
    } catch (e) {
      console.warn('[Record] Stop warning:', e);
    }

    const transcript = await this.transcribeAudio(this.recordPath);
    if (!transcript) {
      this.setState('idle');
      return;
    }

    this._transcript = transcript;
    this.notifyPropertyChange('transcript', transcript);
    this.setState('idle');

    // Fire-and-forget evaluate (shows spinner internally)
    this.evaluateTranscript(transcript);
  }

  // ── API: Transcribe ────────────────────────────────────────────────────────

  private transcribeAudio(audioPath: string): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const session = bgHttp.session('flowspeak-transcribe');

        const request: bgHttp.Request = {
          url:         TRANSCRIBE,
          method:      'POST',
          headers:     { 'Content-Type': 'multipart/form-data' },
          description: 'Uploading to Whisper.cpp',
          androidAutoDeleteAfterUpload: false,
          androidNotificationOnProgressTitle: 'FlowSpeak',
          androidNotificationOnErrorTitle:    'FlowSpeak',
          androidRingToneEnabled:             false,
        };

        const params: any[] = [{
          name:          'audio',
          filename:      audioPath,
          mimeType:      'audio/wav',
          parameterName: 'audio',
        }];

        const task = session.multipartUpload(params, request);
        let responseBody = '';

        task.on('progress', (e: bgHttp.ProgressEventData) => {
          console.log(`[Transcribe] Upload: ${e.currentBytes}/${e.totalBytes} bytes`);
        });

        task.on('responded', (e: bgHttp.ResultEventData) => {
          responseBody = e.data as string;
        });

        task.on('complete', () => {
          try {
            const json = JSON.parse(responseBody) as { transcript?: string; error?: string };
            if (json.error) {
              Dialogs.alert({ title: 'Transcription Error', message: json.error, okButtonText: 'OK' });
              resolve(null);
            } else {
              resolve(json.transcript ?? null);
            }
          } catch {
            console.error('[Transcribe] Non-JSON:', responseBody);
            Dialogs.alert({ title: 'Error', message: 'Unexpected response from transcription server.', okButtonText: 'OK' });
            resolve(null);
          }
        });

        task.on('error', (e: bgHttp.ErrorEventData) => {
          console.error('[Transcribe] Network error:', e.error);
          Dialogs.alert({
            title:   'Connection Error',
            message: 'Cannot reach FlowSpeak server.\nCheck that the backend is running and LOCAL_IP is correct in config.ts.',
            okButtonText: 'OK',
          });
          resolve(null);
        });

      } catch (e) {
        console.error('[Transcribe] Exception:', e);
        resolve(null);
      }
    });
  }

  // ── API: Evaluate ──────────────────────────────────────────────────────────

  private async evaluateTranscript(transcript: string): Promise<void> {
    this.set('_isAnalyzing', true);
    this.notifyPropertyChange('isAnalyzing', true);

    try {
      const response = await Http.request({
        url:     EVALUATE,
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        content: JSON.stringify({ transcript }),
        timeout: 180000,
      });

      if (response.statusCode !== 200) {
        const body = response.content.toString();
        console.error('[Evaluate] HTTP', response.statusCode, body);
        await Dialogs.alert({
          title:   'Evaluation Error',
          message: `AI evaluation returned HTTP ${response.statusCode}. Is Ollama running?`,
          okButtonText: 'OK',
        });
        return;
      }

      const result = response.content.toJSON() as EvaluationResult;
      this.applyEvaluation(result);

    } catch (e) {
      console.error('[Evaluate] Exception:', e);
      await Dialogs.alert({
        title:   'AI Error',
        message: 'Could not connect to the AI evaluator. Make sure Ollama is running.',
        okButtonText: 'OK',
      });
    } finally {
      this.set('_isAnalyzing', false);
      this.notifyPropertyChange('isAnalyzing', false);
    }
  }

  // ── Apply evaluation result to UI ──────────────────────────────────────────

  private applyEvaluation(result: EvaluationResult): void {
    const s: Partial<Score> = result?.score ?? {};

    this._scoreFluency    = Math.round(s.fluency    ?? 0);
    this._scoreGrammar    = Math.round(s.grammar    ?? 0);
    this._scoreVocabulary = Math.round(s.vocabulary ?? 0);
    this._scoreOverall    = Math.round(s.overall    ?? 0);

    this.notifyPropertyChange('scoreFluency',    this._scoreFluency);
    this.notifyPropertyChange('scoreGrammar',    this._scoreGrammar);
    this.notifyPropertyChange('scoreVocabulary', this._scoreVocabulary);
    this.notifyPropertyChange('scoreOverall',    this._scoreOverall);

    this.corrections.splice(0);
    (result.corrections ?? []).forEach(c => this.corrections.push(c));

    this.vocabTips.splice(0);
    (result.vocabulary_tips ?? []).forEach(t => this.vocabTips.push(t));

    this.set('_showResults', true);
    this.notifyPropertyChange('showResults', true);
  }

  // ── State helper ───────────────────────────────────────────────────────────

  private setState(state: RecordState): void {
    this._state = state;
    this.notifyPropertyChange('state',        state);
    this.notifyPropertyChange('isRecording',  this.isRecording);
    this.notifyPropertyChange('isProcessing', this.isProcessing);
    this.notifyPropertyChange('buttonLabel',  this.buttonLabel);
    this.notifyPropertyChange('buttonClass',  this.buttonClass);
  }
}
