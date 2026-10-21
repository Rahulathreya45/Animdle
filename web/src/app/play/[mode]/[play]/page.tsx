import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Game } from "@/components/game/Game";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { GuessMode, PlayType } from "@/config/game";
import styles from "./page.module.css";

const MODES: GuessMode[] = ["franchise", "anime", "character"];
const PLAYS: PlayType[] = ["daily", "random"];
const NAMES: Record<GuessMode, string> = { franchise: "anime", anime: "anime, hard mode", character: "character" };

type Params = Promise<{ mode: string; play: string }>;

function parse({ mode, play }: { mode: string; play: string }) {
  if (!MODES.includes(mode as GuessMode) || !PLAYS.includes(play as PlayType)) notFound();
  return { mode: mode as GuessMode, play: play as PlayType };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { mode, play } = parse(await params);
  return { title: `Guess the ${NAMES[mode]}, ${play} | Animdle` };
}

export default async function PlayPage({ params }: { params: Params }) {
  const { mode, play } = parse(await params);

  return (
    <div className={styles.page}>
      <a href="#guess-box" className={styles.skip}>Skip to guess box</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>Animdle</Link>
        <ThemeToggle />
      </header>
      <main>
        <Game key={`${mode}-${play}`} mode={mode} play={play} />
      </main>
    </div>
  );
}
