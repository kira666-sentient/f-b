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
    @media (min-width: 641px) { html:not([data-force-mobile="true"]) .mobile-only { display: none !important; } }
    @media (max-width: 640px) { html:not([data-force-mobile="true"]) .desktop-only { display: none !important; } }
    html[data-force-mobile="true"] .desktop-only { display: none !important; }
    html[data-force-mobile="true"] .mobile-only { display: block !important; }
    
    /* Orientation Lock Overlay */
    #orientation-lock {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: var(--bg, #f4efe6);
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
    }
    html[data-landscape-lock="true"] #orientation-lock {
      display: flex;
    }
  `;

const detectionScript = `
    (function() {
      function check() {
        var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        var smallestDim = Math.min(window.screen.width, window.screen.height);
        var isPhone = isTouch && smallestDim < 600;
        
        if (isPhone) {
          document.documentElement.setAttribute('data-force-mobile', 'true');
          var isLandscape = window.innerWidth > window.innerHeight;
          if (isLandscape) {
            document.documentElement.setAttribute('data-landscape-lock', 'true');
          } else {
            document.documentElement.removeAttribute('data-landscape-lock');
          }
        }
      }
      check();
      window.addEventListener('resize', check);
      window.addEventListener('orientationchange', check);
    })();
  `;

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
        <script dangerouslySetInnerHTML={{ __html: detectionScript }} />
        <link rel="icon" href="/fnb-logo.svg" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div id="orientation-lock">
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📱🔄</div>
          <h2 style={{ margin: '0 0 8px' }}>Please rotate your device</h2>
          <p style={{ color: '#8b5a44', margin: 0 }}>This app is optimized for portrait mode on mobile devices.</p>
        </div>
        {children}
      </body>
    </html>
  );
}
