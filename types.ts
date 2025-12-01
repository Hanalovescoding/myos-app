
export interface StructuredItem {
  title: string;
  category: string; // e.g., "Food", "Shopping", "Sightseeing"
  description: string;
  location?: string; // For map mode
  rating?: number;
  actionItem?: string; // e.g., "Buy tickets in advance"
  targetDate?: string; // Format: YYYY.MM.DD
  status?: 'pending' | 'completed';
}

export interface Memory {
  id: string;
  originalText: string;
  rootCategory: string; // e.g. "Travel", "Learning", "Inspiration"
  project: string; // e.g., "Tokyo Trip"
  subProject?: string; // e.g., "Shinjuku"
  type: 'note' | 'plan' | 'inspiration';
  structuredContent: StructuredItem[];
  createdAt: number;
  tags: string[];
  attachedImage?: string; // Base64 string (compressed)
}

export interface Task {
  id: string;
  title: string;
  day: number; // Day number relative to start
  status: 'pending' | 'completed';
  feedback?: string; // AI Coach feedback
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum AppTab {
  INPUT = 'input',
  TODAY = 'today',
  MEMORY = 'memory'
}

export interface ProcessingResult {
  rootCategory: string;
  project: string;
  subProject: string;
  type: 'note' | 'plan' | 'inspiration';
  tags: string[];
  items: StructuredItem[];
}

export interface PlanningResult {
  planName: string;
  tasks: { day: number; title: string }[];
}
