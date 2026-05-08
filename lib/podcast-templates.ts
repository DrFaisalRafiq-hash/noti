import type { PodcastScript, ScriptSegment, ScriptFormat, ScriptTone } from "./podcast-script";
import { newId } from "./podcast-script";

export type PodcastTemplateId = "classic" | "interview" | "monologue" | "story";

export interface PodcastTemplate {
  id: PodcastTemplateId;
  label: string;
  blurb: string;
  format: ScriptFormat;
  tone: ScriptTone;
  speakers: string[];
  lengthMin: number;
  build: () => ScriptSegment[];
}

const seg = (
  kind: ScriptSegment["kind"],
  label: string | undefined,
  text: string,
  durationSec?: number
): ScriptSegment => ({
  id: newId(),
  kind,
  label,
  text,
  ...(durationSec ? { durationSec } : {}),
});

export const PODCAST_TEMPLATES: PodcastTemplate[] = [
  {
    id: "classic",
    label: "Hook · Intro · Body · Outro",
    blurb: "Classic four-part episode skeleton, ready to fill in.",
    format: "segmented",
    tone: "conversational",
    speakers: ["Host"],
    lengthMin: 18,
    build: () => [
      seg("section", "Hook", "A 15–30 second teaser that makes the listener need to keep listening.", 25),
      seg("dialogue", "Host", "[Open with a sharp question, surprising stat, or cold-open quote.]", 25),
      seg("direction", undefined, "Theme music in, then under."),
      seg("section", "Intro", "Welcome, frame the episode, set expectations.", 60),
      seg("dialogue", "Host", "Welcome back to [Show Name]. I'm [Host Name]. Today we're talking about [topic] — and why it matters right now.", 30),
      seg("dialogue", "Host", "Here's what we'll cover: [point 1], [point 2], and [point 3]. Stick around to the end for [payoff].", 30),
      seg("section", "Body", "The substance — break into beats, examples, and turns.", 600),
      seg("dialogue", "Host", "[Beat 1: state the idea, then the example.]", 180),
      seg("dialogue", "Host", "[Beat 2: the contrast or complication.]", 180),
      seg("direction", undefined, "Short music sting, then back."),
      seg("dialogue", "Host", "[Beat 3: the synthesis or the surprise.]", 180),
      seg("section", "Outro", "Recap, call to action, sign off.", 60),
      seg("dialogue", "Host", "So the takeaway: [one-sentence summary].", 20),
      seg("dialogue", "Host", "If this resonated, [CTA — subscribe / share / leave a review]. Next week: [tease].", 25),
      seg("dialogue", "Host", "Thanks for listening. I'll see you then.", 10),
      seg("direction", undefined, "Theme music up and out."),
    ],
  },
  {
    id: "interview",
    label: "Interview",
    blurb: "Host welcomes a guest, asks 3 questions, then wraps.",
    format: "dialogue",
    tone: "interview",
    speakers: ["Host", "Guest"],
    lengthMin: 25,
    build: () => [
      seg("section", "Cold open", "A short hook — tease the most surprising thing the guest will say.", 30),
      seg("dialogue", "Host", "Welcome back to the show. Today I'm joined by [Guest Name], who [one-line credential]. Thanks for being here.", 20),
      seg("dialogue", "Guest", "Thanks so much for having me — excited to dig in.", 8),
      seg("section", "Question 1 — Origin", "Get the guest's backstory.", 0),
      seg("dialogue", "Host", "Let's start at the beginning — how did you get into [field]?", 10),
      seg("dialogue", "Guest", "[Guest answers — keep this tight, ~60 seconds.]", 60),
      seg("section", "Question 2 — Insight", "The meaty question — the thing only this guest can answer.", 0),
      seg("dialogue", "Host", "[Insight question]", 12),
      seg("dialogue", "Guest", "[Guest's most valuable take.]", 90),
      seg("section", "Question 3 — Forward look", "Where is this going next?", 0),
      seg("dialogue", "Host", "Looking ahead — what should listeners be watching for?", 10),
      seg("dialogue", "Guest", "[Forward-looking answer.]", 60),
      seg("section", "Outro", "Thank, plug, sign off.", 20),
      seg("dialogue", "Host", "Where can people find more of your work?", 6),
      seg("dialogue", "Guest", "[Plug — site, book, social.]", 15),
      seg("dialogue", "Host", "Thanks again for joining me. Until next time.", 8),
    ],
  },
  {
    id: "monologue",
    label: "Monologue",
    blurb: "Single host: hook, three points, takeaway.",
    format: "segmented",
    tone: "educational",
    speakers: ["Host"],
    lengthMin: 12,
    build: () => [
      seg("section", "Hook", "One sentence that makes the listener need to keep listening.", 20),
      seg("dialogue", "Host", "[Open with a sharp, surprising claim or question.]", 20),
      seg("section", "Setup", "Why this matters right now.", 45),
      seg("dialogue", "Host", "[Frame the stakes in 2–3 sentences.]", 45),
      seg("section", "Point 1", "First idea, with one example.", 90),
      seg("dialogue", "Host", "[State the point. Then a concrete example.]", 90),
      seg("section", "Point 2", "Second idea — the contrast or complication.", 90),
      seg("dialogue", "Host", "[State the point. Then a concrete example.]", 90),
      seg("section", "Point 3", "Third idea — the synthesis or surprise.", 90),
      seg("dialogue", "Host", "[State the point. Then a concrete example.]", 90),
      seg("direction", undefined, "Music swell, brief pause."),
      seg("section", "Takeaway", "The one thing the listener should remember.", 30),
      seg("dialogue", "Host", "[The one-sentence takeaway, then a soft CTA.]", 30),
    ],
  },
  {
    id: "story",
    label: "Story",
    blurb: "Narrative arc: cold open, setup, conflict, climax, resolution.",
    format: "segmented",
    tone: "narrative",
    speakers: ["Narrator"],
    lengthMin: 20,
    build: () => [
      seg("section", "Cold open", "Drop the listener mid-scene. No context yet.", 45),
      seg("dialogue", "Narrator", "[A vivid, specific moment from late in the story.]", 45),
      seg("direction", undefined, "Theme music in, then under."),
      seg("section", "Setup", "Who, where, when. The world before everything changed.", 90),
      seg("dialogue", "Narrator", "[Introduce the protagonist and their normal life.]", 90),
      seg("section", "Inciting incident", "The thing that breaks the status quo.", 60),
      seg("dialogue", "Narrator", "[The disruption — keep it concrete and small at first.]", 60),
      seg("section", "Rising action", "Complications stack up.", 120),
      seg("dialogue", "Narrator", "[Two or three escalating beats.]", 120),
      seg("section", "Climax", "The turning point. Highest stakes.", 90),
      seg("dialogue", "Narrator", "[The decisive moment — slow down here.]", 90),
      seg("section", "Resolution", "What changed. What it means.", 60),
      seg("dialogue", "Narrator", "[Land the emotional truth, not just the facts.]", 60),
      seg("section", "Outro", "Credits, thanks, what's next.", 20),
      seg("dialogue", "Narrator", "[Sign-off and tease the next episode.]", 20),
    ],
  },
];

export function buildScriptFromTemplate(t: PodcastTemplate): PodcastScript {
  return {
    v: 1,
    kind: "podcast",
    format: t.format,
    brief: {
      topic: "",
      lengthMin: t.lengthMin,
      tone: t.tone,
      speakers: [...t.speakers],
      talkingPoints: [],
      notes: "",
    },
    segments: t.build(),
  };
}
