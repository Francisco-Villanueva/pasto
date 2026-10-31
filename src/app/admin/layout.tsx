import type { Metadata } from "next";

/** El backoffice nunca se indexa. */
export const metadata: Metadata = {
  title: { default: "Backoffice", template: "%s · Backoffice · PASTO" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
