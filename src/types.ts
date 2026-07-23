export interface Question {
  id: string;
  type?: 'multiple_choice' | 'discursive';
  text: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  category?: string;
}

export interface KnowledgeFile {
  name: string;
  uri: string;
  mimeType: string;
  displayName: string;
  expiresAt: number;
}

export interface Quiz {
  id?: string;
  title: string;
  tag?: string; // used as folder
  mainTag?: string; // e.g. Neurologia, Pediatria
  subtag?: string; // (deprecated)
  subtags?: string[]; // Multiple subtags
  isPublic?: boolean;
  questions: Question[];
  userId: string;
  createdAt: string;
  knowledgeBase?: KnowledgeFile[];
}

export interface BankQuestion {
  id?: string;
  type: 'multiple_choice' | 'discursive';
  text: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  mainTag: string;
  subtag?: string;
  subtags?: string[];
  institution?: string;
  year?: string;
  images?: string[];
  hasImageWarning?: boolean;
  createdAt: string;
  createdBy: string;
}

export interface UserStats {
  questionsAnswered: number;
  questionsCorrect: number;
  flashcardsReviewed: number;
}

export interface Flashcard {
  id?: string;
  question: string;
  answer: string;
  explanation?: string;
  category?: string;
  nextReview: string; // ISO string
  interval: number; // in days
  easeFactor: number;
  userId: string;
  createdAt: string;
  tag?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  authorized: boolean;
  title?: string;
  earnedTitles?: string[];
  folderColors?: Record<string, string>;
}

export interface Comment {
  id?: string;
  quizId: string;
  questionId: string;
  quizTitle: string;
  text: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userTitle?: string;
  createdAt: string;
}

export interface ErrorReport {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  page: string;
  createdAt: string;
  status: 'pending' | 'resolved';
}

export type TitleCriteria = 
  | 'total_questions' 
  | 'daily_questions' 
  | 'weekly_questions' 
  | 'flashcards_reviewed' 
  | 'streak_days' 
  | 'daily_goals_met' 
  | 'weekly_goals_met'
  | 'responses_total'
  | 'saves_total';

export interface TitleDefinition {
  id?: string;
  name: string;
  requirement: number;
  criteria: TitleCriteria;
  icon?: string;
  color?: string;
}

export enum View {
  DASHBOARD = 'dashboard',
  LANDING = 'landing',
  REVIEW = 'review',
  QUIZ = 'quiz',
  RESULTS = 'results',
  FLASHCARDS = 'flashcards',
  COMMUNITY = 'community',
  ADMIN = 'admin',
  BANK = 'bank',
}
