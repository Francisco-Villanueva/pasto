import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "@design/tokens/pasto.css";
import "@/styles/ui.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PASTO", template: "%s · PASTO" },
  description: "Viandas, burritos y complementos hechos en cocina propia.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
