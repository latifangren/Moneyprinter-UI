import type { BackendOption, BackendOptionsData } from "./api.ts";
import {
  DEFAULT_VIDEO_LANGUAGE,
  DEFAULT_VOICE_NAME,
  VIDEO_ASPECT_OPTIONS,
  VIDEO_SOURCE_OPTIONS,
  type StudioVideoAspect,
  type StudioVideoSource,
} from "./studioForm.ts";

export type SelectOption = {
  label: string;
  value: string;
};

export type VoiceOptionGroup = {
  id: string;
  label: string;
  voices: string[];
};

export type StudioOptions = {
  languages: SelectOption[];
  voiceGroups: VoiceOptionGroup[];
  videoAspects: StudioVideoAspect[];
  videoSources: StudioVideoSource[];
  metadataSource: "backend" | "fallback";
};

export type StudioOptionSelections = {
  videoAspect: StudioVideoAspect;
  videoSource: StudioVideoSource;
  voiceName: string;
};

const FALLBACK_PROVIDER_ID = "azure-tts-v1";

export function normalizeStudioOptions(data?: BackendOptionsData | null): StudioOptions {
  const languages = normalizeOptions(data?.languages, [
    { label: "Auto Detect", value: "" },
    { label: "English (United States)", value: DEFAULT_VIDEO_LANGUAGE },
  ]);
  const providerLabels = new Map(normalizeOptions(data?.voice_providers, [{ label: "Azure TTS V1", value: FALLBACK_PROVIDER_ID }]).map((option) => [option.value, option.label]));
  const voiceGroups = normalizeVoiceGroups(data?.voices, providerLabels);
  const videoAspects = normalizeStringValues(data?.video_aspects)
    .filter((value): value is StudioVideoAspect => VIDEO_ASPECT_OPTIONS.includes(value as StudioVideoAspect));
  const videoSources = normalizeStringValues(data?.video_sources)
    .filter((value): value is StudioVideoSource => VIDEO_SOURCE_OPTIONS.includes(value as StudioVideoSource));

  return {
    languages: ensureSelectedOption(languages, DEFAULT_VIDEO_LANGUAGE, "Default language"),
    voiceGroups: voiceGroups.length > 0 ? voiceGroups : [{ id: FALLBACK_PROVIDER_ID, label: "Azure TTS V1", voices: [DEFAULT_VOICE_NAME] }],
    videoAspects: videoAspects.length > 0 ? videoAspects : [...VIDEO_ASPECT_OPTIONS],
    videoSources: videoSources.length > 0 ? videoSources : [...VIDEO_SOURCE_OPTIONS],
    metadataSource: data ? "backend" : "fallback",
  };
}

export function ensureSelectedOption(options: SelectOption[], selectedValue: string, labelPrefix: string): SelectOption[] {
  if (options.some((option) => option.value === selectedValue)) {
    return options;
  }
  return [{ label: `${labelPrefix}: ${selectedValue || "Auto Detect"}`, value: selectedValue }, ...options];
}

export function ensureSelectedVoiceGroup(groups: VoiceOptionGroup[], selectedVoice: string): VoiceOptionGroup[] {
  if (groups.some((group) => group.voices.includes(selectedVoice))) {
    return groups;
  }
  return [{ id: "current-custom", label: "Current custom voice", voices: [selectedVoice] }, ...groups];
}

export function getFirstVoice(groups: VoiceOptionGroup[]): string {
  return groups.find((group) => group.voices.length > 0)?.voices[0] ?? DEFAULT_VOICE_NAME;
}

export function getEffectiveStudioOptionSelections(
  options: StudioOptions,
  selections: StudioOptionSelections,
): StudioOptionSelections {
  return {
    videoAspect: options.videoAspects.includes(selections.videoAspect) ? selections.videoAspect : options.videoAspects[0],
    videoSource: options.videoSources.includes(selections.videoSource) ? selections.videoSource : options.videoSources[0],
    voiceName: options.voiceGroups.some((group) => group.voices.includes(selections.voiceName))
      ? selections.voiceName
      : getFirstVoice(options.voiceGroups),
  };
}

function normalizeOptions(options: BackendOption[] | undefined, fallback: SelectOption[]): SelectOption[] {
  const normalizedOptions = (options ?? [])
    .map((option) => normalizeOption(option))
    .filter((option): option is SelectOption => option !== null);
  return normalizedOptions.length > 0 ? normalizedOptions : fallback;
}

function normalizeOption(option: BackendOption): SelectOption | null {
  if (typeof option.value !== "string") {
    return null;
  }
  return {
    value: option.value,
    label: typeof option.label === "string" && option.label.trim() ? option.label.trim() : option.value || "Auto Detect",
  };
}

function normalizeStringValues(options: BackendOption[] | undefined): string[] {
  return normalizeOptions(options, []).map((option) => option.value);
}

function normalizeVoiceGroups(voices: Record<string, string[]> | undefined, providerLabels: Map<string, string>): VoiceOptionGroup[] {
  if (!voices) {
    return [];
  }

  const voiceGroups: VoiceOptionGroup[] = [];

  for (const [id, providerVoices] of Object.entries(voices)) {
    const normalizedVoices = new Set<string>();

    for (const voice of providerVoices) {
      if (typeof voice === "string" && voice.trim()) {
        normalizedVoices.add(voice.trim());
      }
    }

    const group = {
      id,
      label: providerLabels.get(id) ?? id,
      voices: [...normalizedVoices].sort(),
    };

    if (group.voices.length > 0) {
      voiceGroups.push(group);
    }
  }

  return voiceGroups;
}
