import type { Metadata } from "next";

/** Pantallas internas de verificación y referencia: no se indexan. */
export const metadata: Metadata = {
  title: "Sistema",
  robots: { index: false, follow: false },
};

export default function SistemaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
