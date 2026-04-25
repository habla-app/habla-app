// faq-content.ts — parser del FAQ.md a estructura tipada para el acordeón.
//
// El archivo tiene la forma:
//   # Preguntas Frecuentes — Habla!
//   <intro>
//   ## A. Sobre Habla! y cómo funciona
//   ### 1. ¿Pregunta?
//   <respuesta md (puede tener tablas, listas, etc.)>
//   ### 2. ¿Otra?
//   ...
//   ## B. Lukas y pagos
//   ...
//
// Devolvemos un array de categorías con sus preguntas. La respuesta queda
// como string md para renderizarse con react-markdown en el cliente.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface FaqQuestion {
  id: string;
  number: string;
  question: string;
  answerMd: string;
}

export interface FaqCategory {
  id: string;
  label: string;
  letter: string;
  questions: FaqQuestion[];
}

export interface FaqContent {
  intro: string;
  categories: FaqCategory[];
}

export function loadFaq(): FaqContent {
  const path = join(process.cwd(), "content/legal/faq.md");
  const raw = readFileSync(path, "utf-8");
  return parseFaq(raw);
}

export function parseFaq(raw: string): FaqContent {
  const lines = raw.split("\n");
  const categories: FaqCategory[] = [];
  let introLines: string[] = [];
  let inIntro = true;
  let currentCat: FaqCategory | null = null;
  let currentQ: FaqQuestion | null = null;
  let answerLines: string[] = [];

  function flushQuestion(): void {
    if (currentQ && currentCat) {
      currentQ.answerMd = answerLines.join("\n").trim();
      currentCat.questions.push(currentQ);
    }
    currentQ = null;
    answerLines = [];
  }

  for (const line of lines) {
    // Header H2 — categoría: "## A. Sobre Habla! y cómo funciona"
    const catMatch = line.match(/^##\s+([A-Z])\.\s+(.+?)\s*$/);
    if (catMatch) {
      flushQuestion();
      inIntro = false;
      const letter = catMatch[1];
      const label = catMatch[2];
      currentCat = {
        id: `categoria-${slugify(label)}`,
        label,
        letter,
        questions: [],
      };
      categories.push(currentCat);
      continue;
    }

    // Header H3 — pregunta: "### 1. ¿Texto?"
    const qMatch = line.match(/^###\s+(\d+)\.\s+(.+?)\s*$/);
    if (qMatch && currentCat) {
      flushQuestion();
      const number = qMatch[1];
      const question = qMatch[2];
      currentQ = {
        id: `pregunta-${number}`,
        number,
        question,
        answerMd: "",
      };
      continue;
    }

    // Separador horizontal entre categorías — descartamos
    if (line.trim() === "---") continue;

    // Header H1 — descartamos (es solo el título)
    if (/^#\s+/.test(line)) continue;

    if (inIntro) {
      introLines.push(line);
    } else if (currentQ) {
      answerLines.push(line);
    }
  }

  flushQuestion();

  return {
    intro: introLines.join("\n").trim(),
    categories,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
