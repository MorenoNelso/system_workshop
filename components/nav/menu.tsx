"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  titulo: string;
  items: NavItem[];
}

interface Props {
  esAdmin: boolean;
}

export function NavMenu({ esAdmin }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const grupos: NavGroup[] = [
    {
      titulo: "Taller",
      items: [
        { href: "/", label: "Inicio" },
        { href: "/ordenes", label: "Órdenes de Servicio" },
        { href: "/facturas", label: "Facturación" },
        ...(esAdmin
          ? [
              { href: "/contabilidad", label: "Contabilidad" },
              { href: "/inventario", label: "Kardex / Stock" },
            ]
          : []),
      ],
    },
    {
      titulo: "Catálogo",
      items: [
        ...(esAdmin
          ? [
              { href: "/clientes", label: "Clientes" },
              { href: "/motos", label: "Motos" },
              { href: "/repuestos", label: "Repuestos" },
              { href: "/categorias", label: "Categorías" },
              { href: "/proveedores", label: "Proveedores" },
              { href: "/empleados", label: "Empleados / Mecánicos" },
            ]
          : []),
      ],
    },
    ...(esAdmin
      ? [
          {
            titulo: "Administración",
            items: [
              { href: "/usuarios", label: "Usuarios" },
              { href: "/auditoria", label: "Auditoría" },
              { href: "/tasas", label: "Tasas de Cambio" },
              { href: "/seguridad", label: "Seguridad" },
            ] satisfies NavItem[],
          } satisfies NavGroup,
        ]
      : []),
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
        aria-expanded={open}
      >
        Menú
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          {grupos.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {grupo.titulo}
              </p>
              <div className="pb-2">
                {grupo.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-1.5 text-sm transition ${
                      isActive(item.href)
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
