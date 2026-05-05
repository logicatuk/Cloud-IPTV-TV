import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
type FavoriteType = "channel" | "movie" | "series";

interface FavoriteItem {
  id: string;
  type: FavoriteType;
  name: string;
  poster: string;
  meta?: string;
}

interface FavoritesContextType {
  favorites: FavoriteItem[];
  isFavorite: (id: string | number, type: FavoriteType) => boolean;
  addFavorite: (item: FavoriteItem) => void;
  removeFavorite: (id: string | number, type: FavoriteType) => void;
  toggleFavorite: (item: FavoriteItem) => void;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);
const STORAGE_KEY = "maxplayer_favorites_v1";

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setFavorites(JSON.parse(raw) as FavoriteItem[]);
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((items: FavoriteItem[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, []);

  const isFavorite = useCallback(
    (id: string | number, type: FavoriteType) =>
      favorites.some((f) => f.id === String(id) && f.type === type),
    [favorites]
  );

  const addFavorite = useCallback(
    (item: FavoriteItem) => {
      setFavorites((prev) => {
        if (prev.some((f) => f.id === item.id && f.type === item.type)) return prev;
        const next = [item, ...prev];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeFavorite = useCallback(
    (id: string | number, type: FavoriteType) => {
      setFavorites((prev) => {
        const next = prev.filter((f) => !(f.id === String(id) && f.type === type));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const toggleFavorite = useCallback(
    (item: FavoriteItem) => {
      if (isFavorite(item.id, item.type)) {
        removeFavorite(item.id, item.type);
      } else {
        addFavorite(item);
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return (
    <FavoritesContext.Provider
      value={{ favorites, isFavorite, addFavorite, removeFavorite, toggleFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}

