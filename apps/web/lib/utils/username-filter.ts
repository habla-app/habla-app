// Filtro de usernames ofensivos — Abr 2026.
//
// Una lista compacta de ~45 términos obvios en español e inglés. No
// pretende ser exhaustiva: es una barrera de primera línea contra los
// casos más groseros. El matching es:
//   1. Case-insensitive.
//   2. Substring (una palabra ofensiva embebida también cuenta).
//   3. Normaliza leet-speak básico: 4→a, 3→e, 1→i, 0→o, 5→s.
//      `put0`, `put4`, `h1tler`, etc. también se bloquean.
//
// Para casos más sutiles, dejamos que el admin modere manualmente
// desde Prisma Studio si alguien reporta un @handle inapropiado.

const TERMINOS_OFENSIVOS: ReadonlyArray<string> = [
  // Español — insultos / vulgaridades
  "puta",
  "puto",
  "perra",
  "conchudo",
  "conchatu",
  "conchetumare",
  "ctm",
  "mierda",
  "pendejo",
  "pendeja",
  "cabron",
  "cabrona",
  "maricon",
  "marica",
  "malparido",
  "polla",
  "coño",
  "cono",
  "culero",
  "zorra",
  "verga",
  "vergon",
  "chingada",
  "chingar",
  "chinga",
  "culiado",
  "hueco",
  "huecon",
  "puñetero",
  "punetero",
  "cagon",
  "cagar",
  "mojon",

  // Inglés — insultos / vulgaridades
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "asshole",
  "bitch",
  "bastard",
  "cunt",
  "dick",
  "pussy",
  "retard",
  "faggot",
  "fag",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "chink",
  "spic",
  "kike",
  "gook",
  "tranny",
  "wank",
  "wanker",

  // Odio / figuras odiosas
  "hitler",
  "nazi",
  "kkk",
  "isis",
  "pedofilo",
  "pedophile",
  "rapist",
  "violador",
];

// Sustituciones leet-speak ↔ letras. Se aplican al username antes de
// buscar los términos, para que `put4`, `sh1t`, `h1tler` matcheen igual.
const LEET_MAP: Record<string, string> = {
  "4": "a",
  "3": "e",
  "1": "i",
  "0": "o",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
};

function normalizarLeet(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("");
}

/**
 * `true` si el username contiene un término ofensivo conocido,
 * incluyendo variantes leet-speak básicas.
 */
export function esUsernameOfensivo(username: string): boolean {
  if (!username) return false;
  const base = username.toLowerCase();
  const leet = normalizarLeet(username);
  for (const termino of TERMINOS_OFENSIVOS) {
    if (base.includes(termino) || leet.includes(termino)) return true;
  }
  return false;
}
