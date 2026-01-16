"use client";

import { useCallback, useMemo, useState } from "react";
import { parseAiken, type Question } from "@/lib/aiken";
import { sample, shuffle } from "@/lib/random";
import { formatMMSS, useCountdown } from "@/lib/useCountdown";

type Phase = "upload" | "setup" | "exam" | "result";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* -------------------- NEW: no repeat until exhaustion -------------------- */

function sampleNoRepeat<T extends { id: string }>(
  bank: T[],
  n: number,
  used: Set<string>,
): { picked: T[]; usedNext: Set<string> } {
  const available = bank.filter((q) => !used.has(q.id));
  const take = Math.min(n, available.length);

  const first = sample(available, take);
  const usedAfterFirst = new Set<string>([...used, ...first.map((q) => q.id)]);

  // Si no alcanzan preguntas nuevas (banco agotado), reinicio ciclo
  if (take < n) {
    const remaining = n - take;
    const second = sample(bank, remaining);
    const usedNext = new Set<string>(second.map((q) => q.id)); // reinicio
    return { picked: [...first, ...second], usedNext };
  }

  return { picked: first, usedNext: usedAfterFirst };
}

/* -------------------- NEW: shuffle options + rekey A,B,C -------------------- */

function shuffleAndRekey(q: Question): Question {
  const shuffledOptions = shuffle(q.options);

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const oldCorrect = q.answerKey.toUpperCase();

  const correctIndex = shuffledOptions.findIndex(
    (o) => o.key.toUpperCase() === oldCorrect,
  );

  // Reasignar keys a A,B,C,... para que el UI siempre se vea ordenado
  const rekeyed = shuffledOptions.map((o, i) => ({
    key: letters[i],
    text: o.text,
  }));

  const newAnswerKey =
    correctIndex >= 0 ? letters[correctIndex] : q.answerKey.toUpperCase();

  return {
    ...q,
    options: rekeyed,
    answerKey: newAnswerKey,
  };
}

/* ----------------------------- UI Components ----------------------------- */

function Stepper({ phase }: { phase: Phase }) {
  const steps: Array<{ key: Phase; label: string }> = [
    { key: "upload", label: "Cargar" },
    { key: "setup", label: "Configurar" },
    { key: "exam", label: "Examen" },
    { key: "result", label: "Resultados" },
  ];
  const idx = steps.findIndex((s) => s.key === phase);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2">
        {steps.map((s, i) => {
          const active = i === idx;
          const done = i < idx;
          return (
            <div key={s.key} className="flex-1">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-full grid place-items-center text-sm font-semibold border",
                    done
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : active
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white/70 border-slate-200 text-slate-500",
                  )}
                >
                  {i + 1}
                </div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    active ? "text-slate-900" : "text-slate-500",
                  )}
                >
                  {s.label}
                </div>
              </div>
              <div
                className={cn(
                  "mt-2 h-1 rounded-full",
                  done
                    ? "bg-emerald-400"
                    : active
                      ? "bg-indigo-400"
                      : "bg-slate-200",
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-white/60 shadow-xl shadow-indigo-900/10 overflow-hidden">
      <div className="px-6 py-5 flex items-start justify-between gap-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          )}
        </div>
        {right}
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}

function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500",
    secondary:
      "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-700",
    ghost:
      "bg-white/70 text-slate-900 hover:bg-white focus:ring-slate-300 border border-slate-200",
    danger: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500",
  }[variant];

  return <button className={cn(base, styles, className)} {...props} />;
}

function Input({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-end justify-between">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
      <input
        {...props}
        className={cn(
          "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900",
          "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
        )}
      />
    </label>
  );
}

function TextArea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-slate-800">{label}</div>
      <textarea
        {...props}
        className={cn(
          "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900",
          "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
        )}
      />
    </label>
  );
}

function optionText(q: Question, key: string | undefined) {
  if (!key) return null;
  const k = key.toUpperCase();
  const found = q.options.find((o) => o.key.toUpperCase() === k);
  return found?.text ?? null;
}

function OptionBadge({ k, active }: { k: string; active?: boolean }) {
  return (
    <div
      className={cn(
        "mt-0.5 h-7 w-7 rounded-full grid place-items-center text-sm font-bold border",
        active
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "bg-white border-slate-300 text-slate-700",
      )}
    >
      {k}
    </div>
  );
}

function NavPanel({
  compact,
  exam,
  index,
  answers,
  flagged,
  answeredCount,
  flaggedCount,
  onGoTo,
  onToggleFlagCurrent,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onCloseMobile,
  currentId,
}: {
  compact?: boolean;
  exam: Question[];
  index: number;
  answers: Record<string, string>;
  flagged: Record<string, boolean>;
  answeredCount: number;
  flaggedCount: number;
  onGoTo: (i: number) => void;
  onToggleFlagCurrent: () => void;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onCloseMobile?: () => void;
  currentId?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4",
        compact && "border-0 bg-transparent p-0",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900">Navegación</div>
          <div className="text-xs text-slate-500 mt-1">
            Respondidas: <b>{answeredCount}</b> / {exam.length} · Marcadas:{" "}
            <b>{flaggedCount}</b>
          </div>
        </div>

        {!compact && onCloseMobile && (
          <Button variant="ghost" className="sm:hidden" onClick={onCloseMobile}>
            Cerrar
          </Button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-6 sm:grid-cols-5 lg:grid-cols-6 gap-2">
        {exam.map((q, i) => {
          const isCurrent = i === index;
          const isAnswered = !!answers[q.id];
          const isFlagged = !!flagged[q.id];

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onGoTo(i)}
              className={cn(
                "h-10 rounded-xl border text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-indigo-500",
                isCurrent
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : isFlagged
                    ? "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100"
                    : isAnswered
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                      : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50",
              )}
              title={[
                `Pregunta ${i + 1}`,
                isAnswered ? "Respondida" : "Sin responder",
                isFlagged ? "Marcada para revisar" : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Button
          variant="ghost"
          onClick={onToggleFlagCurrent}
          disabled={!currentId}
          title="Marcar/Desmarcar para revisar"
        >
          {currentId && flagged[currentId]
            ? "Desmarcar revisión"
            : "Marcar para revisar"}
        </Button>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="flex-1"
            disabled={!canPrev}
            onClick={onPrev}
          >
            Anterior
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            disabled={!canNext}
            onClick={onNext}
          >
            Siguiente
          </Button>
        </div>

        <div className="text-xs text-slate-500">
          Tip: marca preguntas para revisar, navega con la paleta y tus
          respuestas quedan guardadas.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function Page() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState<string | null>(null);

  const [raw, setRaw] = useState<string>("");
  const [bank, setBank] = useState<Question[]>([]);

  const [nQuestions, setNQuestions] = useState<number>(10);
  const [minutes, setMinutes] = useState<number>(10);

  const [exam, setExam] = useState<Question[]>([]);
  const [index, setIndex] = useState<number>(0);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  const [submitted, setSubmitted] = useState<boolean>(false);

  const [startMs, setStartMs] = useState<number>(0);
  const [deadlineMs, setDeadlineMs] = useState<number>(0);

  const [navOpen, setNavOpen] = useState<boolean>(false);

  // Result grading scale
  const [scaleOver, setScaleOver] = useState<number>(10);

  // NEW: used question ids to avoid repetition across retries
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());

  const submitExam = useCallback(() => {
    setSubmitted(true);
    setPhase("result");
    setNavOpen(false);
  }, []);

  const isRunning = phase === "exam" && !submitted;

  const { secondsLeft } = useCountdown(isRunning, startMs, deadlineMs, () => {
    if (phase === "exam" && !submitted) submitExam();
  });

  const current: Question | undefined = exam[index];

  const totalSeconds = useMemo(() => minutes * 60, [minutes]);

  const timeProgress = useMemo(() => {
    if (!isRunning) return 0;
    const left = clamp(secondsLeft, 0, totalSeconds);
    const used = totalSeconds - left;
    if (totalSeconds <= 0) return 0;
    return clamp(Math.round((used / totalSeconds) * 100), 0, 100);
  }, [isRunning, secondsLeft, totalSeconds]);

  const answeredCount = useMemo(() => {
    return exam.reduce((acc, q) => acc + (answers[q.id] ? 1 : 0), 0);
  }, [exam, answers]);

  const flaggedCount = useMemo(() => {
    return exam.reduce((acc, q) => acc + (flagged[q.id] ? 1 : 0), 0);
  }, [exam, flagged]);

  const score = useMemo(() => {
    if (exam.length === 0) return { correct: 0, total: 0 };
    let correct = 0;
    for (const q of exam) {
      const chosen = answers[q.id];
      if (chosen && chosen.toUpperCase() === q.answerKey.toUpperCase())
        correct++;
    }
    return { correct, total: exam.length };
  }, [answers, exam]);

  const finalGrade = useMemo(() => {
    const total = score.total || 1;
    const over = clamp(Number(scaleOver || 0), 1, 1000);
    return (score.correct / total) * over;
  }, [score.correct, score.total, scaleOver]);

  async function onFileUpload(file: File) {
    setError(null);
    const text = await file.text();
    setRaw(text);

    try {
      const parsed = parseAiken(text);
      setBank(parsed);

      // NEW: reset usedIds when loading a new bank
      setUsedIds(new Set());

      setPhase("setup");
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "No se pudo parsear el archivo AIKEN.";
      setError(msg);
    }
  }

  function startExam() {
    setError(null);

    if (bank.length === 0) {
      setError("Primero carga un cuestionario AIKEN.");
      return;
    }

    const n = clamp(nQuestions, 1, bank.length);

    // NEW: no repeat until exhaustion
    const { picked, usedNext } = sampleNoRepeat(bank, n, usedIds);

    // NEW: shuffle options + rekey A,B,C
    const selected = picked.map(shuffleAndRekey);

    setExam(selected);
    setUsedIds(usedNext);

    setIndex(0);
    setAnswers({});
    setFlagged({});
    setSubmitted(false);

    const s = Date.now();
    setStartMs(s);
    setDeadlineMs(s + clamp(minutes, 1, 600) * 60 * 1000);

    setPhase("exam");
    setNavOpen(false);
  }

  function chooseOption(qid: string, optKey: string) {
    setAnswers((prev) => ({ ...prev, [qid]: optKey }));
  }

  function toggleFlag(qid: string) {
    setFlagged((prev) => ({ ...prev, [qid]: !prev[qid] }));
  }

  function goToQuestion(i: number) {
    setIndex(clamp(i, 0, Math.max(0, exam.length - 1)));
    setNavOpen(false);
  }

  const ExamTopBar =
    phase === "exam" && current ? (
      <div className="sticky top-0 z-30 -mx-4 sm:mx-0 mb-4">
        <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur shadow-lg shadow-indigo-900/10 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="text-sm font-bold text-slate-900">
                Pregunta {index + 1}/{exam.length}
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-1 rounded-full border",
                    answers[current.id]
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-slate-50 border-slate-200 text-slate-600",
                  )}
                >
                  {answers[current.id] ? "Respondida" : "Sin responder"}
                </span>

                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-1 rounded-full border",
                    flagged[current.id]
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-slate-50 border-slate-200 text-slate-600",
                  )}
                >
                  {flagged[current.id] ? "Marcada" : "No marcada"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                className="sm:hidden"
                onClick={() => setNavOpen(true)}
                title="Abrir navegación de preguntas"
              >
                Preguntas
              </Button>

              <div className="text-right">
                <div className="text-xs text-slate-500">Tiempo</div>
                <div className="text-lg font-extrabold text-slate-900">
                  {formatMMSS(secondsLeft)}
                </div>
              </div>

              <div className="hidden sm:block w-44">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Tiempo</span>
                  <span>{timeProgress}%</span>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      timeProgress < 70
                        ? "bg-indigo-500"
                        : timeProgress < 90
                          ? "bg-amber-500"
                          : "bg-rose-500",
                    )}
                    style={{ width: `${timeProgress}%` }}
                  />
                </div>
              </div>

              <Button
                variant="danger"
                onClick={submitExam}
                title="Enviar examen"
              >
                Enviar
              </Button>
            </div>
          </div>

          <div className="sm:hidden mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Tiempo</span>
              <span>{timeProgress}%</span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  timeProgress < 70
                    ? "bg-indigo-500"
                    : timeProgress < 90
                      ? "bg-amber-500"
                      : "bg-rose-500",
                )}
                style={{ width: `${timeProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="min-h-dvh bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              AIKEN Quiz
            </h1>
            <p className="mt-1 text-sm sm:text-base text-slate-600">
              Carga tu cuestionario, genera preguntas aleatorias y ejecuta el
              examen con temporizador.
            </p>
          </div>
          <div className="sm:w-80">
            <Stepper phase={phase} />
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-900">
            <div className="font-semibold">Ocurrió un problema</div>
            <div className="mt-1 text-sm">{error}</div>
          </div>
        )}

        <div className="mt-6">
          {phase === "upload" && (
            <Card
              title="1) Cargar cuestionario AIKEN"
              subtitle="Sube un .txt o pega el contenido. Validamos y preparamos el banco de preguntas."
              right={
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    AIKEN
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    .txt
                  </span>
                </div>
              }
            >
              <div className="grid gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        Subir archivo
                      </div>
                      <div className="text-xs text-slate-500">
                        Selecciona tu cuestionario en formato AIKEN.
                      </div>
                    </div>
                    <label className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 cursor-pointer">
                      Elegir archivo
                      <input
                        type="file"
                        accept=".txt"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void onFileUpload(f);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid gap-3">
                  <TextArea
                    label="Pegar texto AIKEN"
                    value={raw}
                    rows={10}
                    placeholder="Pega aquí tu cuestionario en formato AIKEN..."
                    onChange={(e) => setRaw(e.target.value)}
                  />
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div className="text-xs text-slate-500">
                      Consejo: si el archivo es grande, es mejor subir el .txt.
                    </div>
                    <Button
                      onClick={() => {
                        setError(null);
                        try {
                          const parsed = parseAiken(raw);
                          setBank(parsed);

                          // NEW: reset usedIds when loading a new bank
                          setUsedIds(new Set());

                          setPhase("setup");
                        } catch (e: unknown) {
                          const msg =
                            e instanceof Error
                              ? e.message
                              : "No se pudo parsear el texto AIKEN.";
                          setError(msg);
                        }
                      }}
                    >
                      Validar y continuar
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {phase === "setup" && (
            <Card
              title="2) Configurar examen"
              subtitle="Define cuántas preguntas aleatorias y el tiempo total. Luego inicia."
              right={
                <div className="text-sm font-semibold text-slate-900">
                  Banco: <span className="text-indigo-700">{bank.length}</span>
                </div>
              }
            >
              <div className="grid gap-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Número de preguntas"
                    hint={`Máximo: ${bank.length}`}
                    type="number"
                    min={1}
                    max={bank.length || 1}
                    value={nQuestions}
                    onChange={(e) => setNQuestions(Number(e.target.value))}
                  />
                  <Input
                    label="Duración (minutos)"
                    hint="Recomendado: 5–30"
                    type="number"
                    min={1}
                    max={600}
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        Vista previa
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        Se seleccionarán{" "}
                        <b>{clamp(nQuestions, 1, bank.length || 1)}</b>{" "}
                        preguntas y tendrás <b>{clamp(minutes, 1, 600)}</b>{" "}
                        minutos.
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Nota: el sistema evita repetir preguntas entre
                        reintentos hasta agotar el banco.
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        onClick={() => setPhase("upload")}
                      >
                        Volver
                      </Button>
                      <Button onClick={startExam}>Iniciar examen</Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {phase === "exam" && current && (
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <div>
                {ExamTopBar}

                <Card
                  title="Examen"
                  subtitle={`Respondidas: ${answeredCount}/${exam.length} · Marcadas: ${flaggedCount}`}
                >
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="whitespace-pre-wrap text-base font-semibold text-slate-900">
                      {current.stem}
                    </div>

                    <div className="mt-5 grid gap-3">
                      {current.options.map((o) => {
                        const selected = answers[current.id] === o.key;
                        return (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => chooseOption(current.id, o.key)}
                            className={cn(
                              "w-full text-left rounded-2xl border px-4 py-3 transition",
                              "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                              selected
                                ? "border-indigo-300 bg-indigo-50"
                                : "border-slate-200 bg-white hover:bg-slate-50",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <OptionBadge k={o.key} active={selected} />
                              <div className="text-sm sm:text-base text-slate-900">
                                {o.text}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                      <Button
                        variant="ghost"
                        onClick={() => toggleFlag(current.id)}
                      >
                        {flagged[current.id]
                          ? "Desmarcar revisión"
                          : "Marcar para revisar"}
                      </Button>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          disabled={index === 0}
                          onClick={() => setIndex((i) => Math.max(0, i - 1))}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={index >= exam.length - 1}
                          onClick={() =>
                            setIndex((i) => Math.min(exam.length - 1, i + 1))
                          }
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    Al llegar a 0, el examen se envía automáticamente.
                  </div>
                </Card>
              </div>

              <div className="hidden lg:block">
                <NavPanel
                  compact
                  exam={exam}
                  index={index}
                  answers={answers}
                  flagged={flagged}
                  answeredCount={answeredCount}
                  flaggedCount={flaggedCount}
                  currentId={current?.id}
                  onGoTo={(i) => goToQuestion(i)}
                  onToggleFlagCurrent={() => current && toggleFlag(current.id)}
                  canPrev={index > 0}
                  canNext={index < exam.length - 1}
                  onPrev={() => setIndex((i) => Math.max(0, i - 1))}
                  onNext={() =>
                    setIndex((i) => Math.min(exam.length - 1, i + 1))
                  }
                />
              </div>

              {navOpen && (
                <div className="lg:hidden fixed inset-0 z-40">
                  <div
                    className="absolute inset-0 bg-slate-900/30"
                    onClick={() => setNavOpen(false)}
                  />
                  <div className="absolute right-0 top-0 h-full w-[92%] max-w-sm bg-white shadow-2xl p-4">
                    <NavPanel
                      exam={exam}
                      index={index}
                      answers={answers}
                      flagged={flagged}
                      answeredCount={answeredCount}
                      flaggedCount={flaggedCount}
                      currentId={current?.id}
                      onGoTo={(i) => goToQuestion(i)}
                      onToggleFlagCurrent={() =>
                        current && toggleFlag(current.id)
                      }
                      canPrev={index > 0}
                      canNext={index < exam.length - 1}
                      onPrev={() => setIndex((i) => Math.max(0, i - 1))}
                      onNext={() =>
                        setIndex((i) => Math.min(exam.length - 1, i + 1))
                      }
                      onCloseMobile={() => setNavOpen(false)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === "result" && (
            <Card
              title="4) Resultados"
              subtitle="Revisa tu puntaje y analiza respuestas correctas/incorrectas."
              right={
                <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-2">
                  <div className="text-xs text-indigo-700">Correctas</div>
                  <div className="text-xl font-extrabold text-indigo-900">
                    {score.correct}/{score.total}
                  </div>
                </div>
              }
            >
              <div className="grid gap-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={startExam}>
                    Reintentar (nuevas aleatorias)
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPhase("setup");
                      setSubmitted(false);
                    }}
                  >
                    Cambiar configuración
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPhase("upload");
                      setBank([]);
                      setRaw("");
                      setSubmitted(false);
                      setUsedIds(new Set());
                    }}
                  >
                    Cargar otro archivo
                  </Button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
                    <Input
                      label="Calificar sobre"
                      hint="Ej: 10, 20, 100"
                      type="number"
                      min={1}
                      max={1000}
                      value={scaleOver}
                      onChange={(e) => setScaleOver(Number(e.target.value))}
                    />

                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                      <div className="text-xs text-slate-500">Nota final</div>
                      <div className="text-2xl font-extrabold text-slate-900">
                        {finalGrade.toFixed(2)} /{" "}
                        {clamp(Number(scaleOver || 0), 1, 1000)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        (correctas/total) × sobre
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                      <div className="text-xs text-slate-500">Resumen</div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-lg bg-white p-3 border border-slate-100">
                          <div className="text-xs text-slate-500">
                            Correctas
                          </div>
                          <div className="text-lg font-extrabold text-emerald-600">
                            {score.correct}
                          </div>
                        </div>
                        <div className="rounded-lg bg-white p-3 border border-slate-100">
                          <div className="text-xs text-slate-500">
                            Incorrectas
                          </div>
                          <div className="text-lg font-extrabold text-rose-600">
                            {score.total - score.correct}
                          </div>
                        </div>
                        <div className="rounded-lg bg-white p-3 border border-slate-100">
                          <div className="text-xs text-slate-500">Total</div>
                          <div className="text-lg font-extrabold text-slate-900">
                            {score.total}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="text-sm font-semibold text-slate-800">
                    Revisión
                  </div>

                  <div className="grid gap-3">
                    {exam.map((q, i) => {
                      const chosenKey = answers[q.id]?.toUpperCase();
                      const ok = chosenKey && chosenKey === q.answerKey;

                      const chosenText = chosenKey
                        ? optionText(q, chosenKey)
                        : null;
                      const correctText = optionText(q, q.answerKey);

                      return (
                        <div
                          key={q.id}
                          className={cn(
                            "rounded-2xl border p-4 bg-white",
                            ok ? "border-emerald-200" : "border-rose-200",
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-bold text-slate-900">
                                {i + 1}. {ok ? "Correcta" : "Incorrecta"}
                              </div>
                              <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                                {q.stem}
                              </div>
                            </div>
                            <div
                              className={cn(
                                "shrink-0 rounded-xl px-3 py-2 text-xs font-bold border",
                                ok
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200",
                              )}
                            >
                              {ok ? "OK" : "X"}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2">
                            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                              <div className="text-xs text-slate-500">
                                Tu respuesta
                              </div>
                              <div className="mt-1 flex items-start gap-3">
                                <OptionBadge
                                  k={chosenKey ?? "-"}
                                  active={!!chosenKey}
                                />
                                <div className="text-sm text-slate-900">
                                  {chosenKey
                                    ? (chosenText ?? "(texto no encontrado)")
                                    : "(sin responder)"}
                                </div>
                              </div>
                            </div>

                            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                              <div className="text-xs text-slate-500">
                                Respuesta correcta
                              </div>
                              <div className="mt-1 flex items-start gap-3">
                                <OptionBadge k={q.answerKey} active />
                                <div className="text-sm text-slate-900">
                                  {correctText ?? "(texto no encontrado)"}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setPhase("exam");
                                setSubmitted(false);
                                goToQuestion(i);
                              }}
                            >
                              Volver a esta pregunta
                            </Button>

                            <Button
                              variant="ghost"
                              onClick={() => toggleFlag(q.id)}
                            >
                              {flagged[q.id]
                                ? "Desmarcar revisión"
                                : "Marcar revisión"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="mt-8 text-center text-xs text-slate-500">
          Hecho con Next.js + Tailwind. Listo para desplegar en Vercel.
        </div>
      </div>
    </div>
  );
}
