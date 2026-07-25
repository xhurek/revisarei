import React from 'react';
import { GraduationCap, Brain, Target, Award, Star, Trophy, Sparkles, Flame, Zap, User, Stethoscope, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

export const DEFAULT_TITLES_REF = [
  { id: 't1', name: 'Estudante de Medicina', icon: 'GraduationCap', color: 'bg-blue-50|text-blue-600|border-blue-100' },
  { id: 't2', name: 'Interno de Medicina', icon: 'Brain', color: 'bg-indigo-50|text-indigo-600|border-indigo-100' },
  { id: 't3', name: 'Residente Especialista', icon: 'Target', color: 'bg-violet-50|text-violet-600|border-violet-100' },
  { id: 't4', name: 'Preceptor Clínico', icon: 'Award', color: 'bg-emerald-50|text-emerald-600|border-emerald-100' },
  { id: 't5', name: 'Mestre da Medicina', icon: 'Star', color: 'bg-amber-50|text-amber-600|border-amber-100' },
  { id: 't6', name: 'Lenda Médica', icon: 'Trophy', color: 'bg-rose-50|text-rose-600|border-rose-100' }
];

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  GraduationCap,
  Brain,
  Target,
  Award,
  Star,
  Trophy,
  Sparkles,
  Flame,
  Zap,
  User,
  Stethoscope,
  Shield
};

interface UserTitleBadgeProps {
  title?: string;
  icon?: string;
  color?: string;
  className?: string;
  showIcon?: boolean;
}

export function UserTitleBadge({ title, icon, color, className, showIcon = true }: UserTitleBadgeProps) {
  if (!title) return null;

  const defaultDef = DEFAULT_TITLES_REF.find(t => t.name === title);
  const iconName = icon || defaultDef?.icon || 'GraduationCap';
  const colorStr = color || defaultDef?.color || 'bg-indigo-50|text-indigo-600|border-indigo-100';

  const parts = colorStr.split('|');
  const bg = parts[0] || 'bg-indigo-50';
  const text = parts[1] || 'text-indigo-600';
  const border = parts[2] || 'border-indigo-100';

  const IconComponent = ICON_MAP[iconName] || GraduationCap;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border shadow-2xs leading-none shrink-0", bg, text, border, className)}>
      {showIcon && <IconComponent className={cn("w-3 h-3 shrink-0", text)} />}
      <span className="truncate max-w-[180px]">{title}</span>
    </span>
  );
}
