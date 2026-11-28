import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "VisualPH Clone",
  description: "A visual Product Hunt explorer with screenshot-backed launch cards."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
