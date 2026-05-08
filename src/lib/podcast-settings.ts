import { supabase } from "@/integrations/supabase/client";

export type PodcastHost = "rsscom";

export interface PodcastSettings {
  id: string;
  user_id: string;
  host: PodcastHost;
  api_key: string | null;
  show_id: string | null;
  default_author: string | null;
  default_author_email: string | null;
  default_explicit: boolean;
}

export async function loadPodcastSettings(userId: string): Promise<PodcastSettings | null> {
  const { data, error } = await supabase
    .from("podcast_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as PodcastSettings) ?? null;
}

export async function savePodcastSettings(
  userId: string,
  patch: Partial<Omit<PodcastSettings, "id" | "user_id">>,
): Promise<PodcastSettings> {
  const existing = await loadPodcastSettings(userId);
  if (existing) {
    const { data, error } = await supabase
      .from("podcast_settings")
      .update(patch)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return data as PodcastSettings;
  }
  const { data, error } = await supabase
    .from("podcast_settings")
    .insert({
      user_id: userId,
      host: patch.host ?? "rsscom",
      api_key: patch.api_key ?? null,
      show_id: patch.show_id ?? null,
      default_author: patch.default_author ?? null,
      default_author_email: patch.default_author_email ?? null,
      default_explicit: patch.default_explicit ?? false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PodcastSettings;
}

export interface EpisodePublication {
  id: string;
  user_id: string;
  voice_memo_id: string | null;
  script_note_id: string | null;
  host: string;
  remote_episode_id: string | null;
  remote_url: string | null;
  status: "pending" | "uploaded" | "failed";
  title: string;
  description: string | null;
  error: string | null;
  created_at: string;
}

export async function listPublications(userId: string): Promise<EpisodePublication[]> {
  const { data, error } = await supabase
    .from("episode_publications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as EpisodePublication[];
}
