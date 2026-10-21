import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import { MenaceSfx } from "@/components/MenaceSfx";
import { AnimeGuessPanel } from "@/components/home/AnimeGuessPanel";
import { GuessPanel, type ExampleClue } from "@/components/home/GuessPanel";
import { HigherLowerPanel } from "@/components/home/HigherLowerPanel";
import { HIGHER_LOWER_WIN_STREAK, HINT_AFTER_GUESSES, MAX_GUESSES } from "@/config/game";
import styles from "./page.module.css";

const CHARACTER_EXAMPLE: ExampleClue[] = [
  { label: "Gender", value: "Female", status: "match" },
  { label: "Role", value: "Main", status: "match" },
  { label: "Anime", value: "Steins;Gate", status: "miss" },
  { label: "Year", value: "2011", status: "close", direction: "down" },
];

export default function Home() {
  const [firstHint, secondHint] = HINT_AFTER_GUESSES;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>Animdle</Link>
        <nav aria-label="Site" className={styles.nav}>
          <a href="#guess">How to play</a>
          <ThemeToggle />
        </nav>
      </header>

      <main>
        {/* opening panel: speed lines radiate from behind the sound effect */}
        <section className={styles.hero} aria-labelledby="hero-title">
          <span className={styles.speedlines} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <Wordmark id="hero-title" />
            <p className={styles.tagline}>One secret anime. Fifteen guesses. Every wrong answer gives you a clue.</p>
          </div>
          <MenaceSfx className={styles.sfx} />
        </section>

        <section id="guess" className={styles.section} aria-labelledby="guess-title">
          <div className={styles.sectionHead}>
            <h2 id="guess-title" className={styles.sectionTitle}>Guess</h2>
            <p className={styles.sectionText}>
              {MAX_GUESSES} tries. After guesses {firstHint} and {secondHint} you can reveal one clue. Miss all{" "}
              {MAX_GUESSES} and the answer is shown.
            </p>
          </div>

          <div className={styles.guessGrid}>
            <AnimeGuessPanel />
            <GuessPanel
              id="guess-character"
              title="Guess the character"
              description="Track down the character from their gender, role, the anime they belong to and when it aired."
              example={CHARACTER_EXAMPLE}
              exampleLabel="Example guess Kurisu Makise: gender and role match, wrong anime, the answer's anime aired earlier than 2011"
              revealStart={0.75}
              mode="character"
              dailyLabel="Play today's character"
              tone="left"
            >
              <div className={styles.legend}>
                <span className={styles.legendSwatches} aria-hidden="true">
                  <span data-status="match" />
                  <span data-status="close" />
                  <span data-status="miss" />
                </span>
                <span>Green is a match, amber is close, grey is a miss.</span>
              </div>
            </GuessPanel>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="hl-title">
          <div className={styles.sectionHead}>
            <h2 id="hl-title" className={styles.sectionTitle}>Higher or lower</h2>
            <p className={styles.sectionText}>
              Two cards, one question. Get {HIGHER_LOWER_WIN_STREAK} right in a row to win.
            </p>
          </div>

          <div className={styles.split}>
            <HigherLowerPanel
              kind="anime"
              side="ink"
              title="Anime popularity"
              question="Which of the two is more popular? Seasons and movies each count on their own."
              source="Popularity is the number of AniList users who have the show on their list."
              playLabel="Play anime"
            />
            <HigherLowerPanel
              kind="character"
              side="paper"
              title="Character popularity"
              question="Which of the two characters do more fans love?"
              source="Popularity is the number of AniList users who marked the character as a favourite."
              playLabel="Play characters"
            />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>Anime data from AniList, Shikimori and Kitsu. A fan-made project, not affiliated with any of them.</p>
        <div className={styles.footerEnd}>
          <a href="https://github.com/Rahulathreya45/Animdle">Source on GitHub</a>
          <span className={styles.toBeContinued} aria-hidden="true">To be continued</span>
        </div>
      </footer>
    </div>
  );
}
