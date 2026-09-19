// FocusList — client-side demo. All data lives in this browser's LocalStorage.
// Do not store sensitive information here; there is no server or encryption.

export type Priority = "high" | "medium" | "low";

export type Task = {
  id: string;
  title: string;
  priority: Priority;
  completed: boolean;
  createdAt: number;
};

const TASKS_KEY = "focuslist.tasks.v1";
const SOUND_KEY = "focuslist.sound.v1";

export function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is Task =>
        !!t && typeof t.id === "string" && typeof t.title === "string",
    );
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    /* storage full or blocked — app keeps working in memory */
  }
}

export function loadSoundPref(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SOUND_KEY) !== "off";
}

export function saveSoundPref(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
}

export function createTask(title: string, priority: Priority): Task {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now() + Math.random()),
    title: title.trim(),
    priority,
    completed: false,
    createdAt: Date.now(),
  };
}

/* ---------- Sound effects (WebAudio, generated — nothing autoplays) ---------- */

type SoundName = "add" | "complete" | "uncomplete" | "edit" | "delete";

const TONES: Record<SoundName, { freqs: number[]; type: OscillatorType; dur: number }> = {
  add: { freqs: [523.25, 784], type: "sine", dur: 0.12 },
  complete: { freqs: [659.25, 987.77], type: "triangle", dur: 0.14 },
  uncomplete: { freqs: [493.88, 392], type: "sine", dur: 0.1 },
  edit: { freqs: [587.33], type: "sine", dur: 0.09 },
  delete: { freqs: [330, 196], type: "sawtooth", dur: 0.13 },
};

let ctx: AudioContext | null = null;

export function playSound(name: SoundName, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    void ctx.resume();
    const { freqs, type, dur } = TONES[name];
    freqs.forEach((f, i) => {
      const start = ctx!.currentTime + i * dur * 0.75;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.07, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  } catch {
    /* audio unavailable — silent fallback */
  }
}
