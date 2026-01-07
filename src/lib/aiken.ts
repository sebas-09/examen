// src/lib/aiken.ts
export type Question = {
  id: string;
  stem: string;
  options: { key: string; text: string }[];
  answerKey: string;
};

const optionRe = /^([A-Z])[\.\)]\s*(.+)\s*$/i;
const answerRe = /^ANSWER\s*:\s*([A-Z])\s*$/i;

export function parseAiken(input: string): Question[] {
  const lines = input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd());

  const questions: Question[] = [];
  let stemLines: string[] = [];
  let options: { key: string; text: string }[] = [];
  let answerKey: string | null = null;

  const flush = () => {
    if (stemLines.length === 0 && options.length === 0 && !answerKey) return;

    const stem = stemLines.join("\n").trim();
    if (!stem) throw new Error("Pregunta sin enunciado.");
    if (options.length < 2) throw new Error(`"${stemLines[0]}" tiene menos de 2 opciones.`);
    if (!answerKey) throw new Error(`"${stemLines[0]}" no tiene ANSWER:.`);

    const keys = new Set(options.map((o) => o.key.toUpperCase()));
    if (!keys.has(answerKey.toUpperCase())) {
      throw new Error(`ANSWER: ${answerKey} no coincide con opciones en "${stemLines[0]}".`);
    }

    questions.push({
      id: globalThis.crypto?.randomUUID?.() ?? String(Math.random()),
      stem,
      options: options.map((o) => ({ key: o.key.toUpperCase(), text: o.text.trim() })),
      answerKey: answerKey.toUpperCase(),
    });

    stemLines = [];
    options = [];
    answerKey = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    // Separador por línea en blanco: cierra pregunta si ya hay estructura
    if (line === "") {
      if (answerKey || options.length > 0) flush();
      continue;
    }

    const ans = line.match(answerRe);
    if (ans) {
      answerKey = ans[1].toUpperCase();
      continue;
    }

    const opt = line.match(optionRe);
    if (opt) {
      options.push({ key: opt[1].toUpperCase(), text: opt[2] });
      continue;
    }

    // Parte del enunciado
    stemLines.push(raw);
  }

  flush();
  return questions;
}
