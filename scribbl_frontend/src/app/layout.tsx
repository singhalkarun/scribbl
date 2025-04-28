import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SocketInitializer from "@/components/SocketInitializer";

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
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <SocketInitializer />
        {children}
      </body>
    </html>
  );
}
