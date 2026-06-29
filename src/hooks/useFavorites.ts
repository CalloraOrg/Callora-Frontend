import { useLocalStorage } from "./useLocalStorage";

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<string[]>("callora.favorites", []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      if (prev.includes(id)) {
        return prev.filter((favId) => favId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const isFavorite = (id: string) => favorites.includes(id);

  return { favorites, toggleFavorite, isFavorite };
}
