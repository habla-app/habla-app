// MarkdownContent — render seguro y consistente para los .md legales y FAQ.
//
// react-markdown sanitiza por default (no eval, no scripts). Le sumamos
// remark-gfm para tablas/listas/strikethrough. Los enlaces internos
// (/legal/*, /matches, etc.) se navegan via <Link> de Next; los externos
// abren en nueva pestaña con rel="noopener noreferrer".
//
// Estilos via clases Tailwind aplicadas a cada elemento (no usamos un
// plugin tipo `@tailwindcss/typography` para mantener cero deps nuevas
// más allá de react-markdown + remark-gfm). El layout legal aplica
// padding y el wrapper de ancho — este componente solo se ocupa del
// estilo intra-elemento.

import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  /** Contenido markdown ya con placeholders resueltos. */
  content: string;
}

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mb-6 mt-2 font-display text-[40px] font-black leading-tight text-dark md:text-[48px]">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const text = childrenToText(children);
    const id = slugify(text);
    return (
      <h2
        id={id}
        className="mb-4 mt-12 scroll-mt-24 font-display text-[28px] font-bold leading-tight text-dark md:text-[32px]"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }) => (
    <h3 className="mb-3 mt-8 font-display text-[22px] font-bold leading-tight text-dark md:text-[24px]">
      {children}
    </h3>
  ),
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
    if (!href) return <>{children}</>;
    const isExternal = /^https?:\/\//i.test(href) || href.startsWith("mailto:");
    if (isExternal) {
      return (
        <a
          href={href}
          target={href.startsWith("mailto:") ? undefined : "_blank"}
          rel="noopener noreferrer"
          className="text-brand-blue-main underline-offset-2 hover:underline"
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        href={href}
        className="text-brand-blue-main underline-offset-2 hover:underline"
      >
        {children}
      </Link>
    );
  },
};

export function MarkdownContent({ content }: Props) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {content}
    </ReactMarkdown>
  );
}

function childrenToText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  if (children && typeof children === "object" && "props" in children) {
    const props = (children as { props?: { children?: React.ReactNode } })
      .props;
    return childrenToText(props?.children);
  }
  return "";
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
