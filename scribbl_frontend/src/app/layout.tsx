import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SocketInitializer from "@/components/SocketInitializer";
import OrientationLock from "@/components/OrientationLock";

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

// Determine if we are running in the production environment. The variable is populated
// via `next.config.ts` which copies Vercel's `VERCEL_ENV` value ("development", "preview", "production")
// into `NEXT_PUBLIC_VERCEL_ENV` so that it is available on the client.
const isProd = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

export const metadata: Metadata = {
  title: {
    default: "Scribbl - The Ultimate Online Drawing & Guessing Game",
    template: "%s | Scribbl"
  },
  description:
    "Play Scribbl, the fun multiplayer drawing game! Draw, guess, and compete with friends online. Create private rooms or join public games. Free to play!",
  keywords: [
    "drawing game",
    "multiplayer game",
    "online game",
    "pictionary",
    "guess the drawing",
    "scribble",
    "scribbl",
    "multiplayer drawing",
    "online pictionary",
    "drawing competition",
    "free online games",
    "party games",
    "browser games",
    "real-time multiplayer"
  ],
  authors: [{ name: "Prateek and Karun" }],
  creator: "Prateek and Karun",
  publisher: "Scribbl",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Scribbl - The Ultimate Online Drawing & Guessing Game",
    description:
      "Join the fun! Draw, guess, and compete with friends in this exciting multiplayer drawing game. Create private rooms or join public games instantly.",
    url: "https://scribbl.club",
    siteName: "Scribbl",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/survey.png", // Using the existing survey.png as a preview image
        width: 1200,
        height: 630,
        alt: "Scribbl - Online Drawing Game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scribbl - The Ultimate Online Drawing & Guessing Game",
    description:
      "Draw, guess, and compete with friends online! Join Scribbl for multiplayer drawing fun.",
    images: ["/survey.png"],
    creator: "@scribbl_game", // You can update this with your actual Twitter handle
  },
  alternates: {
    canonical: "https://scribbl.club",
  },
  category: "Games",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Scribbl",
    "application-name": "Scribbl",
    "mobile-web-app-capable": "yes",
    "theme-color": "#6366f1", // Indigo color matching your design
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
        
        {/* Structured Data for SEO */}
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
        >
          {`
            {
              "@context": "https://schema.org",
              "@type": "VideoGame",
              "name": "Scribbl",
              "description": "A multiplayer online drawing and guessing game where players draw pictures and others try to guess what they're drawing.",
              "url": "https://scribbl.club",
              "applicationCategory": "Game",
              "operatingSystem": "Web Browser",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "1250"
              },
              "genre": ["Drawing", "Guessing", "Multiplayer", "Party"],
              "playMode": "MultiPlayer",
              "numberOfPlayers": "2-8",
              "gamePlatform": "Web Browser",
              "author": {
                "@type": "Organization",
                "name": "Prateek and Karun"
              },
              "publisher": {
                "@type": "Organization",
                "name": "Scribbl"
              }
            }
          `}
        </Script>
        
        {isProd && (
          <>
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
            
            {/* Hotjar Tracking Code */}
            <Script id="hotjar-tracking" strategy="afterInteractive">
              {`
                (function(h,o,t,j,a,r){
                    h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                    h._hjSettings={hjid:6434778,hjsv:6};
                    a=o.getElementsByTagName('head')[0];
                    r=o.createElement('script');r.async=1;
                    r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                    a.appendChild(r);
                })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
              `}
            </Script>
          </>
        )}
      </head>
      <body className="antialiased">
        <SocketInitializer />
        <OrientationLock />
        {children}
      </body>
    </html>
  );
}
