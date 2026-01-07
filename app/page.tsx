"use client";

import { useCallback, useMemo, useState } from "react";
import { parseAiken, type Question } from "@/lib/aiken";
import { sample } from "@/lib/random";
import { formatMMSS, useCountdown } from "@/lib/useCountdown";

type Phase = "upload" | "setup" | "exam" | "result";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

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
                      : "bg-white/70 border-slate-200 text-slate-500"
                  )}
                >
                  {i + 1}
                </div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    active ? "text-slate-900" : "text-slate-500"
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
                    : "bg-slate-200"
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
          "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
          "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        )}
      />
    </label>
  );
}

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
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Timer control set in startExam event (no Date.now() in render)
  const [startMs, setStartMs] = useState<number>(0);
  const [deadlineMs, setDeadlineMs] = useState<number>(0);

  const submitExam = useCallback(() => {
    setSubmitted(true);
    setPhase("result");
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

  async function onFileUpload(file: File) {
    setError(null);
    const text = await file.text();
    setRaw(text);

    try {
      const parsed = parseAiken(text);
      setBank(parsed);
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
    const selected = sample(bank, n);

    setExam(selected);
    setIndex(0);
    setAnswers({});
    setSubmitted(false);

    const s = Date.now();
    setStartMs(s);
    setDeadlineMs(s + clamp(minutes, 1, 600) * 60 * 1000);

    setPhase("exam");
  }

  function chooseOption(qid: string, optKey: string) {
    setAnswers((prev) => ({ ...prev, [qid]: optKey }));
  }

  const shell = (
    <div className="min-h-dvh bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Header */}
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

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-900">
            <div className="font-semibold">Ocurrió un problema</div>
            <div className="mt-1 text-sm">{error}</div>
          </div>
        )}

        {/* Content */}
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
                        preguntas aleatorias y tendrás{" "}
                        <b>{clamp(minutes, 1, 600)}</b> minutos para responder.
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
            <Card
              title={`3) Examen (Pregunta ${index + 1} de ${exam.length})`}
              subtitle={`Respondidas: ${answeredCount}/${exam.length}`}
              right={
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Tiempo</div>
                    <div className="text-lg font-extrabold text-slate-900">
                      {formatMMSS(secondsLeft)}
                    </div>
                  </div>
                </div>
              }
            >
              {/* Timer progress */}
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Progreso de tiempo</span>
                  <span>{timeProgress}%</span>
                </div>
                <div className="mt-2 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      timeProgress < 70
                        ? "bg-indigo-500"
                        : timeProgress < 90
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    )}
                    style={{ width: `${timeProgress}%` }}
                  />
                </div>
              </div>

              {/* Question */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="whitespace-pre-wrap text-base font-semibold text-slate-900">
                  {current.stem}
                </div>

                <div className="mt-5 grid gap-3">
                  {current.options.map((o: { key: string; text: string }) => {
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
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 h-7 w-7 rounded-full grid place-items-center text-sm font-bold border",
                              selected
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "bg-white border-slate-300 text-slate-700"
                            )}
                          >
                            {o.key}
                          </div>
                          <div className="text-sm sm:text-base text-slate-900">
                            {o.text}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navigation */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex gap-3">
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

                <div className="flex gap-3">
                  <Button
                    variant="danger"
                    onClick={submitExam}
                    title="Envía el examen y muestra resultados"
                  >
                    Enviar examen
                  </Button>
                </div>
              </div>

              {/* Helper */}
              <div className="mt-4 text-xs text-slate-500">
                Tip: puedes avanzar y volver; tus respuestas quedan guardadas.
                Al llegar a 0, el examen se envía automáticamente.
              </div>
            </Card>
          )}

          {phase === "result" && (
            <Card
              title="4) Resultados"
              subtitle="Revisa tu puntaje y, si deseas, analiza respuestas correctas/incorrectas."
              right={
                <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-2">
                  <div className="text-xs text-indigo-700">Puntaje</div>
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
                    }}
                  >
                    Cargar otro archivo
                  </Button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-800">
                    Resumen
                  </div>
                  <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <div className="text-xs text-slate-500">Correctas</div>
                      <div className="text-lg font-extrabold text-emerald-600">
                        {score.correct}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <div className="text-xs text-slate-500">Incorrectas</div>
                      <div className="text-lg font-extrabold text-rose-600">
                        {score.total - score.correct}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                      <div className="text-xs text-slate-500">Total</div>
                      <div className="text-lg font-extrabold text-slate-900">
                        {score.total}
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
                      const chosen =
                        answers[q.id]?.toUpperCase() ?? "(sin responder)";
                      const ok = chosen === q.answerKey;
                      return (
                        <div
                          key={q.id}
                          className={cn(
                            "rounded-2xl border p-4 bg-white",
                            ok ? "border-emerald-200" : "border-rose-200"
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
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              )}
                            >
                              {ok ? "OK" : "X"}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-col sm:flex-row gap-2 text-sm">
                            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                              Tu respuesta: <b>{chosen}</b>
                            </div>
                            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                              Correcta: <b>{q.answerKey}</b>
                            </div>
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

  return shell;
}
