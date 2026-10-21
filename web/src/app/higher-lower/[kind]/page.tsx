import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HigherLowerGame } from "@/components/higher-lower/HigherLowerGame";
import type { HigherLowerKind } from "@/config/game";

const KINDS: HigherLowerKind[] = ["anime", "character"];
const NAMES: Record<HigherLowerKind, string> = { anime: "anime", character: "characters" };

type Params = Promise<{ kind: string }>;

function parse({ kind }: { kind: string }) {
  if (!KINDS.includes(kind as HigherLowerKind)) notFound();
  return kind as HigherLowerKind;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const kind = parse(await params);
  return { title: `Higher or lower, ${NAMES[kind]} | Animdle` };
}

export default async function HigherLowerPage({ params }: { params: Params }) {
  const kind = parse(await params);
  return <HigherLowerGame kind={kind} />;
}
