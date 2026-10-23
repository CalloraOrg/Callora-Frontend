import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface FetchTrackerContextValue {
  isFetching: boolean;
  trackFetch: <T>(promise: Promise<T>) => Promise<T>;
}

const FetchTrackerContext = createContext<FetchTrackerContextValue>({
  isFetching: false,
  trackFetch: ((promise: Promise<unknown>) => promise) as <T>(promise: Promise<T>) => Promise<T>,
});

export function FetchTrackerProvider({ children }: { children: ReactNode }) {
  const [isFetching, setIsFetching] = useState(false);
  const counterRef = useRef(0);

  const trackFetch = useCallback(
    async function <T>(promise: Promise<T>): Promise<T> {
      counterRef.current += 1;
      setIsFetching(true);
      try {
        const result = await promise;
        return result;
      } finally {
        counterRef.current -= 1;
        if (counterRef.current === 0) {
          setIsFetching(false);
        }
      }
    },
    [],
  );

  return (
    <FetchTrackerContext.Provider value={{ isFetching, trackFetch }}>
      {children}
    </FetchTrackerContext.Provider>
  );
}

export function useFetchTracker(): FetchTrackerContextValue {
  return useContext(FetchTrackerContext);
}
