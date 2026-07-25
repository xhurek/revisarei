export enum View {
  DASHBOARD = 'DASHBOARD',
  BANK = 'BANK',
  LANDING = 'LANDING',
  REVIEW = 'REVIEW',
  QUIZ = 'QUIZ',
  RESULTS = 'RESULTS',
  COMMUNITY = 'COMMUNITY',
  FLASHCARDS = 'FLASHCARDS',
  ADMIN = 'ADMIN'
}

export type TitleCriteria = 'correctAnswers' | 'quizzesCompleted' | 'studyHours' | 'daysStreak' | 'total_questions' | 'daily_questions' | 'weekly_questions' | 'flashcards_reviewed' | 'streak_days' | 'daily_goals_met' | 'weekly_goals_met' | 'responses_total' | 'saves_total';

export interface TitleDefinition {
  id?: string;
  name: string;
  icon?: string;
  color?: string;
  criteria: TitleCriteria;
  requirement: number;
}

export interface UserProfile {
  uid?: string;
  name?: string;
  email?: string;
  authorized?: boolean;
  role?: string;
  title?: string;
  earnedTitles?: string[];
  totalCorrectAnswers?: number;
  quizzesCompleted?: number;
  studyHours?: number;
  currentStreak?: number;
  folderColors?: any;
}

export interface Question {
  id: string;
  type: string;
  text: string;
  correctAnswer: string;
  options?: string[];
  explanation?: string;
  category?: string;
}

export interface BankQuestion extends Question {
  bankId?: string;
  mainTag?: string;
  subtag?: string;
  subtags?: string[];
  questionNumber?: number | string;
  hasImageWarning?: boolean;
  ignoreImageWarning?: boolean;
  institution?: string;
  year?: number | string;
  createdAt?: string;
  createdBy?: string;
}

export interface Quiz {
  id?: string;
  title: string;
  mainTag?: string;
  subtags?: string[];
  tag?: string;
  isPublic?: boolean;
  userId?: string;
  likes?: string[];
  knowledgeBase?: any[];
  questions: Question[];
  createdAt?: string;
  createdBy?: string;
}

export interface ErrorReport {
  id?: string;
  message: string;
  createdAt: string;
  userName: string;
  status: string;
}

export interface Flashcard {
  id?: string;
  question: string;
  answer: string;
  explanation: string;
  tag?: string;
  nextReview: string;
  interval: number;
  easeFactor: number;
  userId: string;
  createdAt?: string;
  createdBy?: string;
}

export interface ReviewResult {
  nextReview: string;
  interval: number;
  easeFactor: number;
}
