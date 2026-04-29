"use client";
// AfiliadoForm — form compartido crear/editar afiliado (Lote 7).
//
// Modo `crear`: POST /api/v1/admin/afiliados. Después navega a /admin/afiliados.
// Modo `editar`: PATCH /api/v1/admin/afiliados/[id]. Después router.refresh().
//
// Pros y contras se editan como textareas: una línea por item, separadas
// por enter. Internamente pasamos a array de strings antes del POST.
// Métodos de pago: input de texto separado por comas (ej. "Visa, Yape, Plin").

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, useToast } from "@/components/ui";
import { authedFetch } from "@/lib/api-client";
import {
  MODELOS_COMISION,
  type AfiliadoVista,
  type ModeloComision,
} from "@/lib/services/afiliacion.service";

// Estilos compartidos para inputs/selects/textareas.
const INPUT_CLASS =
  "w-full rounded-sm border-[1.5px] border-light bg-card px-3 py-2 font-body text-[13px] text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10";

interface Props {
  modo: "crear" | "editar";
  /** Afiliado actual cuando `modo=editar`. */
  inicial?: AfiliadoVista;
}

interface FormState {
  slug: string;
  nombre: string;
  logoUrl: string;
  autorizadoMincetur: boolean;
  urlBase: string;
  modeloComision: ModeloComision;
  montoCpa: string;
  porcentajeRevshare: string;
  bonoActual: string;
  metodosPago: string; // CSV
  pros: string; // newline-separated
  contras: string; // newline-separated
  rating: string;
  activo: boolean;
  ordenDestacado: string;
}

function fromAfiliado(a: AfiliadoVista | undefined): FormState {
  return {
    slug: a?.slug ?? "",
    nombre: a?.nombre ?? "",
    logoUrl: a?.logoUrl ?? "",
    autorizadoMincetur: a?.autorizadoMincetur ?? true,
    urlBase: a?.urlBase ?? "",
    modeloComision: ((a?.modeloComision as ModeloComision) ??
      "CPA") as ModeloComision,
    montoCpa: a?.montoCpa != null ? String(a.montoCpa) : "",
    porcentajeRevshare:
      a?.porcentajeRevshare != null ? String(a.porcentajeRevshare) : "",
    bonoActual: a?.bonoActual ?? "",
    metodosPago: (a?.metodosPago ?? []).join(", "),
    pros: (a?.pros ?? []).join("\n"),
    contras: (a?.contras ?? []).join("\n"),
    rating: a?.rating != null ? String(a.rating) : "",
    activo: a?.activo ?? true,
    ordenDestacado: a?.ordenDestacado != null ? String(a.ordenDestacado) : "100",
  };
}

function parseList(s: string, separator: "csv" | "lines"): string[] {
  return s
    .split(separator === "csv" ? /[,\n]/ : "\n")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

export function AfiliadoForm({ modo, inicial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(fromAfiliado(inicial));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Build payload con strings → number/null donde corresponda.
    const payload: Record<string, unknown> = {
      slug: form.slug.trim().toLowerCase(),
      nombre: form.nombre.trim(),
      logoUrl: form.logoUrl.trim() || null,
      autorizadoMincetur: form.autorizadoMincetur,
      urlBase: form.urlBase.trim(),
      modeloComision: form.modeloComision,
      montoCpa: form.montoCpa.trim() === "" ? null : Number(form.montoCpa),
      porcentajeRevshare:
        form.porcentajeRevshare.trim() === ""
          ? null
          : Number(form.porcentajeRevshare),
      bonoActual: form.bonoActual.trim() || null,
      metodosPago: parseList(form.metodosPago, "csv"),
      pros: parseList(form.pros, "lines"),
      contras: parseList(form.contras, "lines"),
      rating: form.rating.trim() === "" ? null : Number(form.rating),
      activo: form.activo,
      ordenDestacado:
        form.ordenDestacado.trim() === ""
          ? 100
          : Number(form.ordenDestacado),
    };

    setEnviando(true);
    try {
      const url =
        modo === "crear"
          ? "/api/v1/admin/afiliados"
          : `/api/v1/admin/afiliados/${inicial!.id}`;
      const method = modo === "crear" ? "POST" : "PATCH";

      const res = await authedFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error al guardar.");
      }

      if (modo === "crear") {
        toast.show(`✅ Afiliado "${payload.nombre}" creado`);
        router.push("/admin/afiliados");
        router.refresh();
      } else {
        toast.show(`✅ Afiliado actualizado`);
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
      toast.show(`❌ ${(err as Error).message}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <div className="rounded-sm border border-urgent-critical/30 bg-urgent-critical-bg/50 px-4 py-3 text-[13px] text-urgent-critical">
          {error}
        </div>
      ) : null}

      <Section titulo="Identidad">
        <Field label="Slug (URL)" hint="kebab-case · ej: te-apuesto. Aparece en /go/{slug}.">
          <input
            type="text"
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="te-apuesto"
            required
            pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Nombre comercial">
          <input
            type="text"
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Te Apuesto"
            required
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Logo URL"
          hint="URL completa al logo en R2 u otro CDN. Opcional."
        >
          <input
            type="url"
            value={form.logoUrl}
            onChange={(e) => set("logoUrl", e.target.value)}
            placeholder="https://r2.hablaplay.com/logos/te-apuesto.png"
            className={INPUT_CLASS}
          />
        </Field>
      </Section>

      <Section titulo="Tracking">
        <Field
          label="URL afiliada (urlBase)"
          hint="A donde redirigimos desde /go/{slug}. Incluí el tracking pixel del partner."
        >
          <input
            type="url"
            value={form.urlBase}
            onChange={(e) => set("urlBase", e.target.value)}
            placeholder="https://teapuesto.com.pe?ref=hablaplay"
            required
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Modelo de comisión"
          hint="CPA = pago por adquisición · REVSHARE = % de pérdida del usuario · HIBRIDO = combinación."
        >
          <select
            value={form.modeloComision}
            onChange={(e) =>
              set("modeloComision", e.target.value as ModeloComision)
            }
            className={INPUT_CLASS}
          >
            {MODELOS_COMISION.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field
            label="Monto CPA (S/)"
            hint="Sólo si CPA o HÍBRIDO. Ej: 100."
          >
            <input
              type="number"
              min={0}
              step={1}
              value={form.montoCpa}
              onChange={(e) => set("montoCpa", e.target.value)}
              placeholder="100"
              className={INPUT_CLASS}
            />
          </Field>
          <Field
            label="Porcentaje Revshare (%)"
            hint="Sólo si REVSHARE o HÍBRIDO. Ej: 25.5."
          >
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.porcentajeRevshare}
              onChange={(e) => set("porcentajeRevshare", e.target.value)}
              placeholder="25.5"
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      </Section>

      <Section titulo="Pitch al usuario">
        <Field
          label="Bono actual"
          hint='Texto corto. Ej: "100% hasta S/ 500".'
        >
          <input
            type="text"
            value={form.bonoActual}
            onChange={(e) => set("bonoActual", e.target.value)}
            placeholder="100% hasta S/ 500"
            maxLength={200}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Métodos de pago"
          hint="Separados por coma. Ej: Visa, Yape, Plin."
        >
          <input
            type="text"
            value={form.metodosPago}
            onChange={(e) => set("metodosPago", e.target.value)}
            placeholder="Visa, Mastercard, Yape, Plin"
            className={INPUT_CLASS}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Pros (1 por línea)">
            <textarea
              value={form.pros}
              onChange={(e) => set("pros", e.target.value)}
              rows={4}
              placeholder={"App muy estable\nBuen soporte 24/7\nRetiros rápidos"}
              className={`${INPUT_CLASS} font-mono text-[12px]`}
            />
          </Field>
          <Field label="Contras (1 por línea)">
            <textarea
              value={form.contras}
              onChange={(e) => set("contras", e.target.value)}
              rows={4}
              placeholder={"Cuotas algo bajas en mercados secundarios"}
              className={`${INPUT_CLASS} font-mono text-[12px]`}
            />
          </Field>
        </div>
        <Field label="Rating (0-5)" hint="Una decimal. Ej: 4.5.">
          <input
            type="number"
            min={0}
            max={5}
            step="0.01"
            value={form.rating}
            onChange={(e) => set("rating", e.target.value)}
            placeholder="4.5"
            className={INPUT_CLASS}
          />
        </Field>
      </Section>

      <Section titulo="Estado">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field
            label="Orden destacado"
            hint="Menor = más arriba en listings. Default 100."
          >
            <input
              type="number"
              min={0}
              max={9999}
              step={1}
              value={form.ordenDestacado}
              onChange={(e) => set("ordenDestacado", e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-[13px] font-semibold text-dark">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => set("activo", e.target.checked)}
              />
              Activo (visible en listings y /go/[slug])
            </label>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-dark">
              <input
                type="checkbox"
                checked={form.autorizadoMincetur}
                onChange={(e) => set("autorizadoMincetur", e.target.checked)}
              />
              Autorizado por MINCETUR
            </label>
          </div>
        </div>
      </Section>

      <div className="flex flex-wrap gap-2 border-t border-light pt-5">
        <Button type="submit" variant="primary" size="lg" disabled={enviando}>
          {enviando
            ? "Guardando…"
            : modo === "crear"
              ? "Crear afiliado"
              : "Guardar cambios"}
        </Button>
        <button
          type="button"
          onClick={() => router.push("/admin/afiliados")}
          className="rounded-md border-[1.5px] border-light bg-card px-5 py-3 text-[13px] font-bold text-muted-d hover:border-strong hover:text-dark"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Section({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-md border border-light bg-card p-5 shadow-sm">
      <legend className="px-2 font-display text-[14px] font-black uppercase tracking-[0.04em] text-brand-blue-main">
        {titulo}
      </legend>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-[11px] leading-relaxed text-muted-d">{hint}</span>
      ) : null}
    </label>
  );
}
