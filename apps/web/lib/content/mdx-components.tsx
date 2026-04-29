// Provider de componentes MDX — Lote 8.
//
// Este map se le pasa a `<MDXRemote components={...}>` en cada page que
// renderiza un .mdx. Combina dos cosas:
//   1. Estilos para los elementos HTML estándar (h1/h2/h3/p/ul/...) —
//      mismo lenguaje visual que MarkdownContent.tsx (Lote 3) pero con
//      ids slugificados en h2/h3 para que el TOC pueda hacer scroll-spy.
//   2. Los custom components (Lote 7 + Lote 8) listados en
//      `components/mdx/index.ts`.
//
// Devuelve la map ya construida — los pages la importan como const.

import Link from "next/link";
import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";
import {
  CasaCTA,
  CasaReviewCard,
  TablaCasas,
  DisclaimerLudopatia,
  CuotasComparator,
  DisclaimerAfiliacion,
  PronosticoBox,
  RelatedArticles,
  TOC,
} from "@/components/mdx";
import { slugifyHeading } from "@/lib/content/loader";

function childrenToText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children))
    return children.map((c) => childrenToText(c as ReactNode)).join("");
  if (children && typeof children === "object" && "props" in children) {
    const props = (children as { props?: { children?: ReactNode } }).props;
    return childrenToText(props?.children);
  }
  return "";
}

export const MDX_COMPONENTS: MDXComponents = {
  // -----------------------------------------------------------------------
  // Tipografía: réplica del estilo de MarkdownContent.tsx + ids para TOC.
  // -----------------------------------------------------------------------
  h1: ({ children }) => (
    <h1 className="mb-6 mt-2 font-display text-[40px] font-black leading-tight text-dark md:text-[48px]">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const id = slugifyHeading(childrenToText(children));
    return (
      <h2
        id={id}
        className="mb-4 mt-12 scroll-mt-24 font-display text-[28px] font-bold leading-tight text-dark md:text-[32px]"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }) => {
    const id = slugifyHeading(childrenToText(children));
    return (
      <h3
        id={id}
        className="mb-3 mt-8 scroll-mt-24 font-display text-[22px] font-bold leading-tight text-dark md:text-[24px]"
      >
        {children}
      </h3>
    );
  },
  h4: ({ children }) => (
    <h4 className="mb-2 mt-6 font-display text-[18px] font-bold leading-tight text-dark md:text-[20px]">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="my-4 text-[16px] leading-[1.75] text-body">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-4 list-disc space-y-2 pl-6 text-[16px] leading-[1.7] text-body">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-2 pl-6 text-[16px] leading-[1.7] text-body">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-bold text-dark">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-10 border-t border-light" />,
  blockquote: ({ children }) => (
    <blockquote className="my-6 border-l-4 border-brand-blue-main bg-subtle px-5 py-3 italic text-body">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded-sm bg-subtle px-1.5 py-0.5 font-mono text-[14px] text-dark">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-6 overflow-x-auto rounded-md border border-light bg-subtle p-4 text-[13px] leading-relaxed text-dark">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-md border border-light">
      <table className="min-w-full divide-y divide-light text-[15px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-subtle">{children}</thead>,
  tbody: ({ children }) => (
    <tbody className="divide-y divide-light bg-card">{children}</tbody>
  ),
  tr: ({ children }) => <tr className="even:bg-subtle/40">{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-3 text-left font-bold text-dark">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 align-top text-body">{children}</td>
  ),
  a: ({ href, children }) => {
    const hrefStr = typeof href === "string" ? href : "";
    if (!hrefStr) return <>{children}</>;
    const isExternal =
      /^https?:\/\//i.test(hrefStr) || hrefStr.startsWith("mailto:");
    if (isExternal) {
      return (
        <a
          href={hrefStr}
          target={hrefStr.startsWith("mailto:") ? undefined : "_blank"}
          rel="noopener noreferrer"
          className="text-brand-blue-main underline-offset-2 hover:underline"
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        href={hrefStr}
        className="text-brand-blue-main underline-offset-2 hover:underline"
      >
        {children}
      </Link>
    );
  },

  // -----------------------------------------------------------------------
  // Custom components — Lote 7 + Lote 8.
  // -----------------------------------------------------------------------
  CasaCTA: CasaCTA as MDXComponents[string],
  CasaReviewCard: CasaReviewCard as MDXComponents[string],
  TablaCasas: TablaCasas as MDXComponents[string],
  DisclaimerLudopatia: DisclaimerLudopatia as MDXComponents[string],
  CuotasComparator: CuotasComparator as MDXComponents[string],
  DisclaimerAfiliacion: DisclaimerAfiliacion as MDXComponents[string],
  PronosticoBox: PronosticoBox as MDXComponents[string],
  RelatedArticles: RelatedArticles as MDXComponents[string],
  TOC: TOC as MDXComponents[string],
};
