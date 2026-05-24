import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegistration } from "@/components/PwaRegistration";

export const metadata: Metadata = {
  title: "Su Presencia Volunteer Check-In",
  description: "Mobile volunteer check-in and supervisor dashboard for Su Presencia Church.",
  manifest: "/manifest.webmanifest",
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
