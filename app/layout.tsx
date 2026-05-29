import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MovilizaTJ - Mapa Ciudadano",
  description:
    "Plataforma ciudadana para reportar obstáculos de movilidad y generar rutas accesibles.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
