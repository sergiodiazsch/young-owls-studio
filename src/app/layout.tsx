import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  Figtree,
  JetBrains_Mono,
  IBM_Plex_Sans,
  Space_Grotesk,
  Libre_Baskerville,
  Syne,
} from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/theme/context";
import { ClientProviders } from "@/components/client-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a0a14" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a14" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Young Owls Studio",
    template: "%s | Young Owls Studio",
  },
  description:
    "AI-powered screenplay production platform. Upload scripts, parse them with Claude, then use AI tools for visual development, breakdowns, audio, and video.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://young-owls-studio.netlify.app"
  ),
  openGraph: {
    title: "Young Owls Studio",
    description:
      "AI-powered screenplay production — parse, analyze, and bring your scripts to life.",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Young Owls Studio",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var fontMap = {
                  figtree: 'var(--font-figtree), system-ui, sans-serif',
                  geist: 'var(--font-geist-sans), system-ui, sans-serif',
                  inter: 'var(--font-inter), system-ui, sans-serif',
                  jetbrains: 'var(--font-jetbrains-mono), monospace',
                  'ibm-plex': 'var(--font-ibm-plex-sans), system-ui, sans-serif',
                  'space-grotesk': 'var(--font-space-grotesk), system-ui, sans-serif',
                  'libre-baskerville': 'var(--font-libre-baskerville), Georgia, serif',
                  syne: 'var(--font-syne), system-ui, sans-serif'
                };
                try {
                  var stored = localStorage.getItem('yos-theme');
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    var mode = parsed.mode;
                    if (mode === 'light') {
                      document.documentElement.classList.add('light');
                    }
                    var font = parsed.appearance && parsed.appearance.font;
                    if (font && fontMap[font]) {
                      document.documentElement.dataset.font = font;
                      document.addEventListener('DOMContentLoaded', function() {
                        document.body.style.setProperty('font-family', fontMap[font], 'important');
                      });
                    }
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${figtree.variable} ${jetbrainsMono.variable} ${ibmPlexSans.variable} ${spaceGrotesk.variable} ${libreBaskerville.variable} ${syne.variable} antialiased`}>
        <ThemeProvider>
          <ClientProviders>
          {children}
          </ClientProviders>
          <Toaster
            richColors
            position="bottom-right"
            offset={80}
            toastOptions={{
              className: "dark:bg-card dark:border-white/[0.08]",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
