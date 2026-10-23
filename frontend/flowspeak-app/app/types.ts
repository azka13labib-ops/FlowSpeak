/** Mirrors the JSON returned by POST /api/evaluate */

export interface Score {
  fluency:    number;
  grammar:    number;
  vocabulary: number;
  overall:    number;
}

export interface Correction {
  original:    string;
  fixed:       string;
  explanation: string;
}

export interface EvaluationResult {
  score:           Score;
  corrections:     Correction[];
  vocabulary_tips: string[];
}
