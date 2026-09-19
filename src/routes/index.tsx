import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createTask,
  loadSoundPref,
  loadTasks,
  playSound,
  saveSoundPref,
  saveTasks,
  type Priority,
  type Task,
} from "@/lib/focuslist";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FocusList — Stay focused. Get things done." },
      {
        name: "description",
        content:
          "FocusList is a fast, private to-do app with priorities, filters, live stats and sound feedback. Everything stays in your browser.",
      },
      { property: "og:title", content: "FocusList — Stay focused. Get things done." },
      {
        property: "og:description",
        content:
          "Add, prioritise and track tasks with live stats, search and filters. Private by design — nothing leaves your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FocusList,
});

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const priorityClasses: Record<Priority, string> = {
  high: "bg-priority-high-soft text-priority-high border-priority-high/40",
  medium: "bg-priority-medium-soft text-priority-medium border-priority-medium/40",
  low: "bg-priority-low-soft text-priority-low border-priority-low/40",
};

const priorityDot: Record<Priority, string> = {
  high: "bg-priority-high",
  medium: "bg-priority-medium",
  low: "bg-priority-low",
};

type StatusFilter = "all" | "active" | "completed";

function FocusList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sound, setSound] = useState(true);

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  // Load persisted state once on the client.
  useEffect(() => {
    setTasks(loadTasks());
    setSound(loadSoundPref());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveTasks(tasks);
  }, [tasks, hydrated]);

  const stats = useMemo(() => {
    const completed = tasks.filter((t) => t.completed).length;
    return { total: tasks.length, completed, pending: tasks.length - completed };
  }, [tasks]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((t) => (q ? t.title.toLowerCase().includes(q) : true))
      .filter((t) =>
        status === "all" ? true : status === "active" ? !t.completed : t.completed,
      )
      .filter((t) => (priorityFilter === "all" ? true : t.priority === priorityFilter))
      .sort((a, b) => Number(a.completed) - Number(b.completed) || b.createdAt - a.createdAt);
  }, [tasks, query, status, priorityFilter]);

  function toggleSound() {
    const next = !sound;
    setSound(next);
    saveSoundPref(next);
    playSound("edit", next);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please write something to do first.");
      return;
    }
    setError("");
    setTasks((prev) => [createTask(title, priority), ...prev]);
    setTitle("");
    playSound("add", sound);
  }

  function toggleComplete(task: Task) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)),
    );
    playSound(task.completed ? "uncomplete" : "complete", sound);
  }

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditValue(task.title);
  }

  function commitEdit(id: string) {
    const value = editValue.trim();
    if (!value) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title: value } : t)));
    setEditingId(null);
    playSound("edit", sound);
  }

  function changePriority(id: string, value: Priority) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, priority: value } : t)));
    playSound("edit", sound);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    setTasks((prev) => prev.filter((t) => t.id !== pendingDelete.id));
    setPendingDelete(null);
    playSound("delete", sound);
  }

  return (
    <main className="min-h-screen">
      <Hero sound={sound} onToggleSound={toggleSound} />

      <section
        id="tasks"
        className="mx-auto w-full max-w-3xl scroll-mt-8 px-4 pb-24 sm:px-6"
      >
        <Reveal className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard label="Total" value={stats.total} accent="text-foreground" />
          <StatCard label="Completed" value={stats.completed} accent="text-priority-low" />
          <StatCard label="Pending" value={stats.pending} accent="text-priority-medium" />
        </Reveal>

        <Reveal className="surface-card mt-6 p-4 sm:p-6">
          <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="new-task" className="sr-only">
                Task title
              </label>
              <input
                id="new-task"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError("");
                }}
                placeholder="What needs your focus?"
                className="w-full rounded-lg border border-input bg-secondary/60 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground transition-colors hover:border-primary/50 focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="new-priority" className="sr-only">
                Priority
              </label>
              <select
                id="new-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full rounded-lg border border-input bg-secondary/60 px-3 py-3 text-base text-foreground transition-colors hover:border-primary/50 focus:border-primary focus:outline-none sm:w-36"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value} className="bg-card">
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0"
            >
              Add task
            </button>
          </form>
          {error ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </Reveal>

        <Reveal className="surface-card mt-4 flex flex-col gap-4 p-4 sm:p-5">
          <div>
            <label htmlFor="search" className="sr-only">
              Search tasks
            </label>
            <input
              id="search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              className="w-full rounded-lg border border-input bg-secondary/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {(["all", "active", "completed"] as StatusFilter[]).map((s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                {s === "all" ? "All" : s === "active" ? "Active" : "Completed"}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by priority">
            <Chip active={priorityFilter === "all"} onClick={() => setPriorityFilter("all")}>
              All priorities
            </Chip>
            {PRIORITIES.map((p) => (
              <Chip
                key={p.value}
                active={priorityFilter === p.value}
                onClick={() => setPriorityFilter(p.value)}
              >
                <span className={`mr-2 inline-block size-2 rounded-full ${priorityDot[p.value]}`} />
                {p.label}
              </Chip>
            ))}
          </div>
        </Reveal>

        <ul className="mt-5 space-y-3">
          {visible.map((task) => (
            <li
              key={task.id}
              className="surface-card animate-rise-in p-4 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleComplete(task)}
                  aria-label={`Mark "${task.title}" as ${task.completed ? "not completed" : "completed"}`}
                  className="mt-1 size-5 shrink-0 cursor-pointer accent-[var(--primary)]"
                />

                <div className="min-w-0 flex-1">
                  {editingId === task.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <label htmlFor={`edit-${task.id}`} className="sr-only">
                        Edit task title
                      </label>
                      <input
                        id={`edit-${task.id}`}
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(task.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 rounded-lg border border-input bg-secondary/60 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => commitEdit(task.id)}
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className={`break-words text-base ${
                        task.completed
                          ? "text-muted-foreground line-through opacity-70"
                          : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${priorityClasses[task.priority]}`}
                    >
                      <span className={`size-1.5 rounded-full ${priorityDot[task.priority]}`} />
                      {task.priority}
                    </span>
                    <label htmlFor={`prio-${task.id}`} className="sr-only">
                      Change priority
                    </label>
                    <select
                      id={`prio-${task.id}`}
                      value={task.priority}
                      onChange={(e) => changePriority(task.id, e.target.value as Priority)}
                      className="rounded-md border border-input bg-secondary/60 px-2 py-1 text-xs text-muted-foreground hover:border-primary/50 focus:border-primary focus:outline-none"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value} className="bg-card">
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => startEdit(task)}
                    className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={`Edit "${task.title}"`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setPendingDelete(task)}
                    className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    aria-label={`Delete "${task.title}"`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {hydrated && visible.length === 0 ? (
          <p className="surface-card mt-5 p-8 text-center text-sm text-muted-foreground">
            {tasks.length === 0
              ? "No tasks yet. Add your first one above and get moving."
              : "Nothing matches these filters."}
          </p>
        ) : null}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Client-side demo — tasks are saved only in this browser. Not suitable for sensitive data.
        </p>
      </section>

      {pendingDelete ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="surface-card w-full max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Delete this task?</h2>
            <p className="mt-2 break-words text-sm text-muted-foreground">
              “{pendingDelete.title}”
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                autoFocus
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                Keep it
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Hero({ sound, onToggleSound }: { sound: boolean; onToggleSound: () => void }) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setOffset(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const fade = Math.max(0, 1 - offset / 480);

  return (
    <header
      className="relative flex min-h-[88vh] items-center justify-center overflow-hidden px-4 text-center"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-float-slow absolute left-[12%] top-[22%] size-40 rounded-3xl bg-primary/25 blur-2xl" />
        <div
          className="animate-float-slow absolute right-[14%] top-[30%] size-52 rounded-full bg-accent/25 blur-3xl"
          style={{ animationDelay: "1.4s" }}
        />
      </div>

      <button
        onClick={onToggleSound}
        aria-pressed={sound}
        className="absolute right-4 top-4 z-10 rounded-full border border-border bg-card/70 px-4 py-2 text-sm text-foreground backdrop-blur transition-colors hover:bg-card"
      >
        {sound ? "🔊 Sound on" : "🔇 Sound off"}
      </button>

      <div
        className="relative z-10 max-w-2xl"
        style={{
          opacity: fade,
          transform: `perspective(1000px) translate3d(0, ${offset * 0.28}px, 0) rotateX(${Math.min(offset * 0.02, 8)}deg) scale(${1 - Math.min(offset / 4000, 0.08)})`,
        }}
      >
        <span className="animate-rise-in inline-block rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
          Private · Offline · Instant
        </span>
        <h1
          className="animate-rise-in text-gradient mt-6 text-6xl font-extrabold tracking-tight sm:text-8xl"
          style={{ animationDelay: "0.08s" }}
        >
          FocusList
        </h1>
        <p
          className="animate-rise-in mt-5 text-lg text-muted-foreground sm:text-xl"
          style={{ animationDelay: "0.16s" }}
        >
          Stay focused. Get things done.
        </p>
        <a
          href="#tasks"
          className="animate-rise-in mt-9 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:-translate-y-1"
          style={{ animationDelay: "0.24s" }}
        >
          Start focusing →
        </a>
      </div>
    </header>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="surface-card p-4 text-center sm:p-5">
      <p className={`text-3xl font-bold tabular-nums sm:text-4xl ${accent}`}>{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary/60 bg-primary/20 text-foreground"
          : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}
