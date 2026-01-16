// src/lib/aiken.ts
export type Question = {
  id: string;
  stem: string;
  options: { key: string; text: string }[];
  answerKey: string;
};

/** Hash FNV-1a (rápido, suficiente para IDs estables) */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // unsigned + base36
  return (h >>> 0).toString(36);
}

function stableQuestionId(
  stem: string,
  options: { key: string; text: string }[],
  answerKey: string,
) {
  const normalized = [
    stem.trim(),
    answerKey.trim().toUpperCase(),
    ...options.map((o) => `${o.key.trim().toUpperCase()}=${o.text.trim()}`),
  ].join("|");
  return `q_${fnv1a(normalized)}`;
}

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
    if (options.length < 2)
      throw new Error(`"${stemLines[0]}" tiene menos de 2 opciones.`);
    if (!answerKey) throw new Error(`"${stemLines[0]}" no tiene ANSWER:.`);

    const keys = new Set(options.map((o) => o.key.toUpperCase()));
    if (!keys.has(answerKey.toUpperCase())) {
      throw new Error(
        `ANSWER: ${answerKey} no coincide con opciones en "${stemLines[0]}".`,
      );
    }

    const normalizedOptions = options.map((o) => ({
      key: o.key.toUpperCase(),
      text: o.text.trim(),
    }));

    const id = stableQuestionId(stem, normalizedOptions, answerKey);

    questions.push({
      id,
      stem,
      options: normalizedOptions,
      answerKey: answerKey.toUpperCase(),
    });

    stemLines = [];
    options = [];
    answerKey = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

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

    stemLines.push(raw);
  }

  flush();
  return questions;
}
