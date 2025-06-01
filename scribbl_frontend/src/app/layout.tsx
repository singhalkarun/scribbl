import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SocketInitializer from "@/components/SocketInitializer";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scribbl",
  description:
    "A multiplayer drawing game where players guess words based on drawings.",
  keywords: [
    "drawing game",
    "multiplayer game",
    "online game",
    "pictionary",
    "guess the drawing",
    "scribble",
    "scribbl",
  ],
  openGraph: {
    title: "Scribbl - Play the Ultimate Online Drawing Game!",
    description:
      "Draw, guess, and laugh! Join Scribbl for real-time multiplayer drawing fun.",
    url: "https://scribbl.club",
    siteName: "Scribbl",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      style={{ fontFamily: "var(--font-outfit)" }}
    >
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-1YN078DXYJ"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-1YN078DXYJ');
          `}
        </Script>
      </head>
      <body className="antialiased">
        <SocketInitializer />
        {children}
      </body>
    </html>
  );
}
