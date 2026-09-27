export type Emotion = {
  id: string;
  label: string;
  group: string;
  emoji?: string;
  imageId?: string;
  color: string;
  isDefault: boolean;
  archived: boolean;
  order: number;
};

export type RegionId = string;

export type Entry = {
  id: string;
  sessionId: string;
  regionId: RegionId;
  emotionIds: string[];
  sensations: string[];
  intensity: number;
  note?: string;
  createdAt: string;
};

export type Session = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  overallMood?: number;
  reflection?: string;
};

export type ImageRecord = { id: string; blob: Blob; createdAt: string };
