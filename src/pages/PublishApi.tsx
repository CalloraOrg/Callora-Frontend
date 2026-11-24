import SessionExpiryBanner from '../components/SessionExpiryBanner';
import useDocumentTitle from '../hooks/useDocumentTitle';
import useSessionExpiry from '../hooks/useSessionExpiry';
import { BasicsStep } from './publish/BasicsStep';
import { EndpointEditor, OpenApiImportSection } from './publish/EndpointEditor';
import { PricingStep } from './publish/PricingStep';
import { PublishSuccessView, ReviewSummary } from './publish/ReviewSummary';
import { usePublishForm } from './publish/usePublishForm';
import './publish/publish.css';

/**
 * PublishApi — developer publish-flow page for Callora.
 *
 * Provides per-field inline validation (name, base URL, category, price per
 * call) with aria-invalid / aria-describedby wired for screen readers. Errors
 * appear only after a field is blurred or the form is submitted.
 *
 * Submitting actually POSTs the listing: the success screen is shown only
 * after the server accepts it, and the localStorage draft is kept until then
 * so a rejected submission never costs the provider their work.
 */
export default function PublishApi() {
  useDocumentTitle('Publish API');
  const { isExpired, dismiss: dismissExpiry } = useSessionExpiry();
  const {
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
  } = usePublishForm();

  if (submitted) {
    return (
      <PublishSuccessView
        apiName={form.apiName}
        listingId={listingId}
        onPublishAnother={handleResetAfterSubmit}
      />
    );
  }

  return (
    <div className="pa-shell">
      {isExpired && <SessionExpiryBanner onDismiss={dismissExpiry} />}

      <header className="pa-page-header">
        <p className="pa-eyebrow">Developer tools</p>
        <h1 className="pa-title">Publish your API</h1>
        <p className="pa-subtitle">
          List your API on the Callora marketplace with per-request USDC pricing.
          Fill in the details below, optionally import endpoints from an OpenAPI
          spec, then submit for review.
        </p>
      </header>

      <OpenApiImportSection
        importOpen={importOpen}
        onToggle={() => setImportOpen((o) => !o)}
        onImport={handleImport}
        onCancel={() => setImportOpen(false)}
      />

      {isRestored && (
        <div className="pa-draft-banner surface">
          <span aria-hidden="true">💾</span>
          <span>Your previous draft has been restored. Your form data is being saved automatically.</span>
          <button
            type="button"
            className="pa-btn-secondary pa-draft-dismiss"
            onClick={handleClearDraft}
          >
            Clear draft
          </button>
        </div>
      )}

      <form
        className="pa-form surface"
        onSubmit={handleSubmit}
        noValidate
        aria-label="Publish API form"
      >
        <BasicsStep
          form={form}
          errors={errors}
          touched={touched}
          submitAttempted={submitAttempted}
          descriptionLength={descriptionLength}
          descriptionAnnouncement={descriptionAnnouncement}
          onFieldChange={handleField}
          onFieldBlur={handleBlur}
          pricingSlot={
            <PricingStep
              pricePerCall={form.pricePerCall}
              errors={errors}
              touched={touched}
              submitAttempted={submitAttempted}
              onChange={handleField('pricePerCall')}
              onBlur={handleBlur('pricePerCall')}
            />
          }
        />

        <EndpointEditor
          endpoints={form.endpoints}
          submitAttempted={submitAttempted}
          duplicateEndpointIds={duplicateEndpointIds}
          endpointsError={endpointsError}
          endpointsRef={endpointsRef}
          onRemoveEndpoint={handleRemoveEndpoint}
        />

        <ReviewSummary formError={formError} submitting={submitting} />
      </form>
    </div>
  );
}
