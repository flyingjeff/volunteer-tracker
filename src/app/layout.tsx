import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistration } from "@/components/PwaRegistration";

export const metadata: Metadata = {
  title: "Su Presencia Volunteer Dashboard",
  description: "Mobile volunteer dashboard and supervisor workspace for Su Presencia Church.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png"
  },
  appleWebApp: {
    capable: true,
    title: "Su Presencia Volunteers",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#315542",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
