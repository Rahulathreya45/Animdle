import type { Metadata } from "next";
import { Dela_Gothic_One, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

// Dela Gothic One also draws the JoJo ゴ, so it loads every glyph range (no preload of a latin-only subset).
const display = Dela_Gothic_One({
  weight: "400",
  variable: "--font-display",
  display: "swap",
  preload: false,
});

const body = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Animdle",
  description: "Guess the anime or the character from its clues. Fifteen guesses, a new puzzle every day.",
};

// Runs before first paint so a saved day/night choice never flashes the wrong theme. Night is the default.
const themeScript = `try{var t=localStorage.getItem("animdle:theme");if(t==="day")document.documentElement.dataset.theme="day"}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
