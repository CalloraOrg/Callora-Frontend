import { useEffect, useRef } from 'react';

export interface DocumentTitleOptions {
  noindex?: boolean;
}

/**
 * useDocumentTitle - Sets the document title, optional meta description, and optional robots meta.
 * Restores the previous title, description, and robots meta when the component unmounts.
 * @param title - The page title to set.
 * @param description - Optional meta description content.
 * @param options - Optional settings such as `{ noindex: true }` for gated or error routes.
 */
export default function useDocumentTitle(
  title?: string,
  description?: string,
  options?: DocumentTitleOptions,
) {
  const prevTitle = useRef(document.title);
  const descriptionMeta = useRef<HTMLMetaElement | null>(null);
  const prevDescription = useRef<string | null>(null);
  const noindex = options?.noindex;

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

    let robotsMeta: HTMLMetaElement | null = null;
    let createdRobotsMeta = false;
    let prevRobotsContent: string | null = null;

    if (noindex) {
      const existing = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
      if (existing) {
        robotsMeta = existing;
        prevRobotsContent = existing.getAttribute('content');
      } else {
        robotsMeta = document.createElement('meta');
        robotsMeta.name = 'robots';
        document.head.appendChild(robotsMeta);
        createdRobotsMeta = true;
      }
      robotsMeta.setAttribute('content', 'noindex, nofollow');
    }

    return () => {
      // Restore previous title
      document.title = prevTitle.current;
      // Restore previous description if we modified it
      if (descriptionMeta.current && prevDescription.current !== null) {
        descriptionMeta.current.setAttribute('content', prevDescription.current);
      }
      // Restore or remove robots meta if we modified it
      if (robotsMeta) {
        if (createdRobotsMeta) {
          robotsMeta.remove();
        } else if (prevRobotsContent !== null) {
          robotsMeta.setAttribute('content', prevRobotsContent);
        } else {
          robotsMeta.removeAttribute('content');
        }
      }
    };
  }, [title, description, noindex]);
}
