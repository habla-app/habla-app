// AdminTable — tabla genérica densa. v3.1 (Lote A, preview). Spec:
// docs/ux-spec/00-design-system/componentes-admin.md §7.
//
// API: tipo genérico T para las filas. El consumer pasa `columns` con
// `key`, `label`, `render` opcional y `width` opcional. Loading muestra
// skeletons. Empty state custom via prop.
//
// El uso completo (sorting server-side, paginación, selección múltiple)
// se cablea en el Lote F. En Lote A queda la estructura básica utilizable
// por componentes que ya quieran adoptar tokens admin-*.
//
// Tipografía: `text-admin-table-cell` para celdas, `text-admin-table-header`
// para headers (ya en `globals.css` Lote A).
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Skeleton } from "@/components/ui/Skeleton";

export interface AdminTableColumn<T> {
  key: string;
  label: string;
  render?: (row: T, index: number) => ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  data: T[];
  /** Función para extraer un id estable por fila (key del React.map). */
  rowKey: (row: T, index: number) => string | number;
  loading?: boolean;
  loadingRows?: number;
  /** UI cuando data.length === 0 y loading === false. */
  empty?: ReactNode;
  /** Stripe filas alternas. Default false. */
  stripe?: boolean;
  /** Click handler en fila completa (cursor pointer + hover). */
  onRowClick?: (row: T, index: number) => void;
  className?: string;
}

const ALIGN: Record<NonNullable<AdminTableColumn<unknown>["align"]>, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function getCellContent<T>(
  column: AdminTableColumn<T>,
  row: T,
  index: number,
): ReactNode {
  if (column.render) return column.render(row, index);
  // Fallback: lookup por key directo en row (asume row es Record<string, unknown>)
  const value = (row as Record<string, unknown>)[column.key];
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AdminTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  loadingRows = 5,
  empty,
  stripe = false,
  onRowClick,
  className,
}: AdminTableProps<T>) {
  const showEmpty = !loading && data.length === 0;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-admin-table-border bg-admin-table-row-stripe">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  "text-admin-table-header text-muted-d px-3 py-2.5",
                  ALIGN[col.align ?? "left"],
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: loadingRows }).map((_, i) => (
              <tr key={`loading-${i}`} className="border-b border-admin-table-border">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2.5">
                    <Skeleton variant="text" />
                  </td>
                ))}
              </tr>
            ))}

          {showEmpty && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-12 text-center text-admin-body text-muted-d"
              >
                {empty ?? "No hay datos para mostrar."}
              </td>
            </tr>
          )}

          {!loading &&
            data.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                className={cn(
                  "border-b border-admin-table-border transition-colors",
                  stripe && i % 2 === 1 && "bg-admin-table-row-stripe",
                  onRowClick &&
                    "cursor-pointer hover:bg-admin-table-row-hover",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "text-admin-table-cell text-dark px-3 py-2.5",
                      ALIGN[col.align ?? "left"],
                    )}
                  >
                    {getCellContent(col, row, i)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
