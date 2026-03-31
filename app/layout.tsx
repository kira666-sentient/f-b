import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Friends & Benefits",
  description: "Shared debt tracking for friends with approvals and simple balances.",
  icons: {
    icon: "/fnb-logo.svg",
  },
};

/* Critical inline CSS to prevent desktop layout flashing on mobile (FOUC).
   This is parsed before globals.css loads, so the wrong layout never renders. */
const criticalCSS = `
@media (min-width: 641px) { .mobile-only { display: none !important; } }
@media (max-width: 640px) { .desktop-only { display: none !important; } }
`;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}

