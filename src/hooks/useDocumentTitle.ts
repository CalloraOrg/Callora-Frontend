import { useEffect, useRef } from 'react';

/**
 * useDocumentTitle - Sets the document title and optional meta description.
 * Restores the previous title and description when the component unmounts.
 * @param title - The page title to set.
 * @param description - Optional meta description content.
 */
export default function useDocumentTitle(title?: string, description?: string) {
  const prevTitle = useRef(document.title);
  const descriptionMeta = useRef<HTMLMetaElement | null>(null);
  const prevDescription = useRef<string | null>(null);

  useEffect(() => {
    // Set new title
    document.title = title ?? 'Callora';

    if (description !== undefined) {
      // Find existing meta description tag
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      descriptionMeta.current = meta;
      prevDescription.current = meta.getAttribute('content');
      meta.setAttribute('content', description);
    }

    return () => {
      // Restore previous title
      document.title = prevTitle.current;
      // Restore previous description if we modified it
      if (descriptionMeta.current && prevDescription.current !== null) {
        descriptionMeta.current.setAttribute('content', prevDescription.current);
      }
    };
  }, [title, description]);
}
