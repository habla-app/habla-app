// Helper único para fetches client-side al backend de Habla! (`/api/v1/*`).
//
// Hotfix post-Sub-Sprint 5 (Bug #3): los hooks usaban `fetch()` directo
// sin `credentials`. En navegadores modernos el default es `same-origin`
// que SÍ envía cookies en requests del mismo origen, pero ser explícito
// elimina cualquier ambigüedad ante service workers, polyfills o tests
// con mocks que defaulteen distinto. Centralizamos el patrón aquí para
// que un solo lugar dicte la política y los tests puedan asertarlo.
//
// Convención: TODO fetch client-side a `/api/v1/*` (público o privado)
// debe pasar por `authedFetch`. Al revisar PRs si aparece un
// `await fetch("/api/v1/...")` directo, debe migrarse.
//
// La nota original "TODO: Sprint 1 - Configurar cliente con interceptors
// de auth" quedó obsoleta — el flujo de auth es por cookie de NextAuth,
// no por header bearer, así que no hace falta interceptor.

export const AUTHED_FETCH_INIT: Pick<RequestInit, "credentials"> = {
  credentials: "include",
};

export async function authedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: init.credentials ?? AUTHED_FETCH_INIT.credentials,
  });
}
