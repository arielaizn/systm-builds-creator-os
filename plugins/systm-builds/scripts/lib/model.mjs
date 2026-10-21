// Fixed vocabulary of the SYSTM BUILDS format. Everything else derives from this.

export const SIGNATURE = 'אתם מבקשים. אני בונה. כולם מקבלים.';

export const STATUSES = ['BUILT', 'PROTOTYPE', 'DIAGNOSIS'];
export const ORIGINS = ['consented_request', 'observed_need'];
export const EPISODE_ID = /^EP\d{3,4}$/;

export const BEATS = [
  { n: 1, key: 'cold_open', name: 'קליף מושאל', composition: 'ColdOpen', mode: 'SCREEN', target_s: 5 },
  { n: 2, key: 'question', name: 'הופך לשאלה', composition: 'Dilemma', mode: 'A-CAM', target_s: 4 },
  { n: 3, key: 'two_dangers', name: 'שתי סכנות', composition: 'Dilemma', mode: 'MOTION', target_s: 6 },
  { n: 4, key: 'open_question', name: 'שאלה פתוחה', composition: 'Dilemma', mode: 'A-CAM', target_s: 4 },
  { n: 5, key: 'insight', name: 'קודם כל צריך להבין', composition: 'Insight', mode: 'MOTION', target_s: 6 },
  { n: 6, key: 'kill_options', name: 'הורג אפשרויות', composition: 'Insight', mode: 'MOTION', target_s: 6 },
  { n: 7, key: 'source', name: 'מאשר את המקור', composition: 'Reveal', mode: 'A-CAM', target_s: 4 },
  { n: 8, key: 'named_concept', name: 'מושג חדש עם שם', composition: 'Reveal', mode: 'MOTION', target_s: 5 },
  { n: 9, key: 'reopen', name: 'פתיחה מחדש', composition: 'StressTest', mode: 'SCREEN', target_s: 6 },
  { n: 10, key: 'solution', name: 'הפתרון', composition: 'Proof', mode: 'SCREEN', target_s: 9 },
  { n: 11, key: 'proof', name: 'הוכחה שרואים', composition: 'Proof', mode: 'SCREEN', target_s: 6 },
  { n: 12, key: 'condition', name: 'התנאי שבלעדיו זה נופל', composition: 'Caveat', mode: 'A-CAM', target_s: 5 },
  { n: 13, key: 'close', name: 'סגירה', composition: 'Giveaway', mode: 'A-CAM', target_s: 7 },
];

// Beats that show a result and therefore must always point at evidence.
export const RESULT_BEATS = [1, 10, 11];

export const COMPOSITIONS = ['ColdOpen', 'Dilemma', 'Insight', 'Reveal', 'StressTest', 'Proof', 'Caveat', 'Giveaway'];

export const MODES = ['A-CAM', 'SCREEN', 'MOTION'];

export const AXES = [
  { key: 'mechanism', letter: 'מ', name: 'מנגנון' },
  { key: 'edit_camera', letter: 'ע', name: 'עריכה וצילום' },
  { key: 'text', letter: 'ט', name: 'טקסט' },
  { key: 'sound', letter: 'פ', name: 'פסקול' },
  { key: 'hook', letter: 'ה', name: 'הוק' },
];

export const MECHANICS = ['timer', 'audience_request', 'blind_test', 'failed_attempt', 'manual_vs_ai', 'duplicate_lead'];

export const NOVELTY = {
  mechanism: ['timer', 'user_submitted_bug', 'blind_test', 'duplicate_record', 'reverse_reveal', 'failed_attempt', 'before_after'],
  edit_camera: ['split_screen', 'macro_cursor', 'freeze_frame_annotation', 'one_take_screen_capture', 'kinetic_text'],
  text: ['confession', 'contradiction', 'question', 'one_word_interruption'],
  sound: ['silence_at_failure', 'ui_rhythm', 'reveal_impact'],
  hook: ['result_first', 'pain_first', 'constraint_first'],
};

export const HOOK_TYPES = ['result_first', 'pain_first', 'constraint_first', 'contradiction', 'surprising_test', 'owner_pain'];
export const HOOK_DIMS = ['audience_fit', 'curiosity', 'specificity', 'proof', 'visual_strength'];
// proof weighs most: a hook that cannot be shown on screen is a promise, not a hook.
export const HOOK_WEIGHTS = { audience_fit: 1.2, curiosity: 1.2, specificity: 1, proof: 1.5, visual_strength: 0.8 };

export const VIEWER_QUESTION_AT = [3, 15, 35, 55];

export const SOUND_TYPES = ['VO', 'MUSIC', 'SFX', 'UI', 'SILENCE', 'REVEAL_HIT', 'SONIC_LOGO'];

export const EVIDENCE_KINDS = ['screen_recording', 'test_output', 'screenshot', 'url', 'metric', 'user_message', 'document'];
export const EVIDENCE_STATES = ['planned', 'captured', 'verified'];

export const CLAIM_TYPES = ['built', 'result', 'time_saved', 'roi', 'quote', 'customer', 'social_proof', 'availability', 'cost'];

export const PLATFORMS = ['instagram', 'tiktok', 'shorts', 'linkedin'];

export const DEFAULT_CONFIG = {
  schema: 'systm/config@1',
  brand: { signature: SIGNATURE, bg: '#0B0B0C', accent: '#7FD4FF', fg: '#FFFFFF' },
  format: { width: 1080, height: 1920, fps: 30, target_min_s: 60, target_max_s: 75, hard_min_s: 45, hard_max_s: 90 },
  voice: { wps: 2.7, hook_max_words: 9, min_beat_s: 2 },
  captions: { max_chars_per_line: 28, max_lines: 2, min_cue_s: 0.8, rlm: true },
  overlays: { max_words: 7 },
  safe_zone: { top: 220, bottom: 420, side: 60 },
  loudness: { target_lufs: -14, tolerance_lu: 2, peak_ceiling_db: -1 },
  novelty: { no_repeat_window: 3 },
  platform_limits: { instagram_caption: 2200, tiktok_caption: 2200, shorts_title: 100, shorts_description: 5000, linkedin_caption: 3000, thumbnail_words: 5 },
  utm: { source_by_platform: { instagram: 'instagram', tiktok: 'tiktok', shorts: 'youtube', linkedin: 'linkedin' }, medium: 'organic_social' },
};
