import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SocketInitializer from "@/components/SocketInitializer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SocketInitializer />
        {children}
      </body>
    </html>
  );
}
