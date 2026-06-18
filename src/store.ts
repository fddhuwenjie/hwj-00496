import { create } from 'zustand';
import type { User } from './lib/api';

interface AppState {
  user: User | null;
  setUser: (u: User | null) => void;
  logout: () => void;
}

const savedUser = localStorage.getItem('user');
const initialUser = savedUser ? (JSON.parse(savedUser) as User) : null;

export const useStore = create<AppState>((set) => ({
  user: initialUser,
  setUser: (u) => {
    if (u) localStorage.setItem('user', JSON.stringify(u));
    else localStorage.removeItem('user');
    set({ user: u });
  },
  logout: () => {
    localStorage.removeItem('user');
    set({ user: null });
  },
}));

export const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  pending: '待签署',
  signed: '已签署',
  expired: '已过期',
  voided: '已作废',
};

export const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-amber-100 text-amber-700',
  signed: 'bg-green-100 text-green-700',
  expired: 'bg-blue-100 text-blue-700',
  voided: 'bg-red-100 text-red-700',
};
