import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, RefObject } from 'react';
import type { ParsedEndpoint } from '../../components/OpenAPIImport';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import useFormPersistence from '../../hooks/useFormPersistence';
import { generateIdempotencyKey } from '../../services/idempotency';
import { submitPublishApi } from '../../services/publishApi';
import {
  DESCRIPTION_ANNOUNCE_THRESHOLD,
  DESCRIPTION_MAX_LENGTH,
  DRAFT_STORAGE_KEY,
  INITIAL_FORM,
  INITIAL_TOUCHED,
  findDuplicateEndpointIds,
  isPublishFormDraft,
  nextId,
  toPublishPayload,
  toValidationErrors,
  validateForm,
} from './model';
import type {
  EndpointEntry,
  PublishFormState,
  TouchedState,
  ValidatedFields,
  ValidationErrors,
} from './model';

export interface PublishFormApi {
  form: PublishFormState;
  touched: TouchedState;
  submitAttempted: boolean;
  importOpen: boolean;
  setImportOpen: React.Dispatch<React.SetStateAction<boolean>>;
  submitted: boolean;
  submitting: boolean;
  isRestored: boolean;
  errors: ValidationErrors;
  formError: string | null;
  listingId: string | null;
  duplicateEndpointIds: Set<string>;
  endpointsError: string | undefined;
  endpointsRef: RefObject<HTMLFieldSetElement>;
  descriptionLength: number;
  descriptionAnnouncement: string;
  handleField: (
    field: keyof Omit<PublishFormState, 'endpoints'>,
  ) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleBlur: (field: ValidatedFields) => () => void;
  handleImport: (endpoints: ParsedEndpoint[]) => void;
  handleRemoveEndpoint: (id: string) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  handleClearDraft: () => void;
  handleResetAfterSubmit: () => void;
}

export function usePublishForm(): PublishFormApi {
  const { value: form, setValue: setForm, discard: discardDraft, isRestored } =
    useFormPersistence(DRAFT_STORAGE_KEY, INITIAL_FORM, { isValid: isPublishFormDraft });
  const [touched, setTouched] = useState<TouchedState>(INITIAL_TOUCHED);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Per-field messages returned by the server on the last attempt. */
  const [serverErrors, setServerErrors] = useState<ValidationErrors>({});
  /** Form-level failure that belongs to no single input. */
  const [formError, setFormError] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);

  const descriptionLength = form.description.length;
  const descriptionRemaining = DESCRIPTION_MAX_LENGTH - descriptionLength;
  const descriptionOverLimit = descriptionRemaining < 0;
  const descriptionNearLimit =
    !descriptionOverLimit && descriptionRemaining <= DESCRIPTION_ANNOUNCE_THRESHOLD;

  /**
   * Throttled polite announcement of the remaining character count.
   *
   * Only updates when the field is within the near-limit threshold, and only
   * when the remaining count actually changes, so screen readers are not
   * spammed on every keystroke.
   */
  const [descriptionAnnouncement, setDescriptionAnnouncement] = useState('');
  const lastAnnouncedRemainingRef = useRef<number | null>(null);
  useEffect(() => {
    if (!descriptionNearLimit) {
      lastAnnouncedRemainingRef.current = null;
      setDescriptionAnnouncement('');
      return;
    }
    if (lastAnnouncedRemainingRef.current === descriptionRemaining) return;
    lastAnnouncedRemainingRef.current = descriptionRemaining;
    setDescriptionAnnouncement(
      `${descriptionRemaining} character${descriptionRemaining === 1 ? '' : 's'} remaining`,
    );
  }, [descriptionNearLimit, descriptionRemaining]);

  /**
   * Idempotency key for the current logical submission. Reused while the
   * payload is byte-identical, so a retry after a timeout cannot create a
   * second listing; regenerated as soon as the provider edits anything.
   */
  const idempotencyRef = useRef<{ serialized: string; key: string } | null>(null);

  /**
   * Authoritative in-flight flag.
   *
   * The `submitting` state below drives rendering, but state is not yet
   * updated when a second submit arrives in the same tick — two rapid clicks
   * would both read `false` from a stale closure and fire two POSTs. A ref
   * flips synchronously, so the second attempt is always rejected.
   */
  const submittingRef = useRef(false);

  // Never touch state after the page has gone away mid-request.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clientErrors = useMemo(() => validateForm(form), [form]);
  // Server messages take precedence so a field the backend rejected keeps
  // showing why until the provider edits it.
  const errors: ValidationErrors = { ...clientErrors, ...serverErrors };
  const isFormValid = Object.keys(clientErrors).length === 0;
  const duplicateEndpointIds = useMemo(
    () => findDuplicateEndpointIds(form.endpoints),
    [form.endpoints],
  );
  // Rendered errors follow the rest of the form: nothing until a submit.
  const endpointsError = submitAttempted ? errors.endpoints : undefined;

  /** Focus target when a submit fails on the endpoint list alone. */
  const endpointsRef = useRef<HTMLFieldSetElement>(null);
  /** Bumped by a failed submit that should move focus to the endpoint list. */
  const [endpointFocusRequest, setEndpointFocusRequest] = useState(0);

  const hasUnsavedChanges = useMemo(
    () =>
      form.apiName !== '' ||
      form.baseUrl !== '' ||
      form.category !== '' ||
      form.description !== '' ||
      form.pricePerCall !== '' ||
      form.endpoints.length > 0,
    [form],
  );

  useBeforeUnload(hasUnsavedChanges);

  // ── Field change handlers ──────────────────────────────────────────────

  const handleField = useCallback(
    (field: keyof Omit<PublishFormState, 'endpoints'>) =>
      (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        // A server error on this field is now stale — drop it so the message
        // does not outlive the value it referred to.
        setServerErrors((prev) => {
          if (!(field in prev)) return prev;
          const next = { ...prev };
          delete next[field as ValidatedFields];
          return next;
        });
      },
    [setForm],
  );

  const handleBlur = useCallback(
    (field: ValidatedFields) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
    },
    [],
  );

  // ── OpenAPI import handlers ────────────────────────────────────────────

  const handleImport = useCallback(
    (endpoints: ParsedEndpoint[]) => {
      setForm((prev) => {
        // Ids must stay unique: a restored draft can already hold ids that the
        // module-level counter has not reached yet, and duplicate React keys
        // would drop list entries.
        const taken = new Set(prev.endpoints.map((ep) => ep.id));
        const entries: EndpointEntry[] = endpoints.map((ep) => {
          let id = nextId();
          while (taken.has(id)) id = nextId();
          taken.add(id);
          return { ...ep, id };
        });
        return { ...prev, endpoints: [...prev.endpoints, ...entries] };
      });
      setImportOpen(false);
    },
    [setForm],
  );

  const handleRemoveEndpoint = useCallback(
    (id: string) => {
      setForm((prev) => ({
        ...prev,
        endpoints: prev.endpoints.filter((ep) => ep.id !== id),
      }));
    },
    [setForm],
  );

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // Guard against a second POST from a double click, Enter key repeat, or a
      // submit event fired while the first is still in flight.
      if (submittingRef.current) return;

      setSubmitAttempted(true);
      // Touch all validated fields so errors become visible
      setTouched({ apiName: true, baseUrl: true, category: true, description: true, pricePerCall: true });
      setFormError(null);
      setServerErrors({});
      if (!isFormValid) {
        // The detail fields come first on the page. Only take focus to the
        // endpoint list when it is the sole problem, so a provider is never
        // pulled past an earlier error they have not seen yet.
        const onlyEndpointsInvalid =
          clientErrors.endpoints !== undefined && Object.keys(clientErrors).length === 1;
        if (onlyEndpointsInvalid) setEndpointFocusRequest((n) => n + 1);
        return;
      }

      const payload = toPublishPayload(form);
      const serialized = JSON.stringify(payload);
      if (idempotencyRef.current?.serialized !== serialized) {
        idempotencyRef.current = { serialized, key: generateIdempotencyKey() };
      }

      setSubmitting(true);
      submittingRef.current = true;
      try {
        const result = await submitPublishApi(payload, {
          idempotencyKey: idempotencyRef.current.key,
        });
        if (!mountedRef.current) return;

        switch (result.kind) {
          case 'success':
            // The server owns the record now. Drop the stored copy but keep the
            // in-memory form, since the success screen names the listing from
            // it and a reload must start blank rather than resurrect it.
            discardDraft();
            setListingId(result.listingId ?? null);
            setSubmitted(true);
            break;

          case 'fieldErrors': {
            const { mapped, unmapped } = toValidationErrors(result.fields);
            setServerErrors(mapped);
            setFormError(
              unmapped.length > 0
                ? `Please fix the highlighted fields. ${unmapped.join(' ')}`
                : 'Please fix the highlighted fields and submit again.',
            );
            break;
          }

          case 'unauthorized':
            // The service has already raised the session-expiry signal, and
            // the banner carries the explanation. This line is the in-form
            // breadcrumb that survives the banner being dismissed.
            setFormError('Sign in again to submit this listing.');
            break;

          case 'error':
            setFormError(result.message);
            break;
        }
      } finally {
        submittingRef.current = false;
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [clientErrors, discardDraft, form, isFormValid],
  );

  // Runs after the render that fills in the endpoint error, so a screen reader
  // announces the description along with the focus move.
  useEffect(() => {
    if (endpointFocusRequest > 0) endpointsRef.current?.focus();
  }, [endpointFocusRequest]);

  const handleClearDraft = useCallback(() => {
    discardDraft(INITIAL_FORM);
    idempotencyRef.current = null;
    setTouched(INITIAL_TOUCHED);
    setSubmitAttempted(false);
    setServerErrors({});
    setFormError(null);
  }, [discardDraft]);

  const handleResetAfterSubmit = useCallback(() => {
    discardDraft(INITIAL_FORM);
    idempotencyRef.current = null;
    setTouched(INITIAL_TOUCHED);
    setSubmitAttempted(false);
    setSubmitted(false);
    setServerErrors({});
    setFormError(null);
    setListingId(null);
    setImportOpen(false);
  }, [discardDraft]);

  return {
    form,
    touched,
    submitAttempted,
    importOpen,
    setImportOpen,
    submitted,
    submitting,
    isRestored,
    errors,
    formError,
    listingId,
    duplicateEndpointIds,
    endpointsError,
    endpointsRef,
    descriptionLength,
    descriptionAnnouncement,
    handleField,
    handleBlur,
    handleImport,
    handleRemoveEndpoint,
    handleSubmit,
    handleClearDraft,
    handleResetAfterSubmit,
  };
}
