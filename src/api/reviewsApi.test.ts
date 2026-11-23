import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchEligibility,
  submitReview,
  ReviewApiError,
  isReviewAbortError,
} from "./reviewsApi";

vi.mock("../services/authFetch", () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from "../services/authFetch";

const mockedAuthFetch = vi.mocked(authFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("reviewsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchEligibility", () => {
    it("returns eligible=true on 200 OK", async () => {
      mockedAuthFetch.mockResolvedValueOnce(jsonResponse({ eligible: true }));

      const result = await fetchEligibility("api-123");
      expect(result).toEqual({ eligible: true });
      expect(mockedAuthFetch).toHaveBeenCalledWith(
        "/api/apis/api-123/reviews/eligibility",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("normalizes 401 to not_authenticated", async () => {
      mockedAuthFetch.mockResolvedValueOnce(jsonResponse({}, 401));

      const result = await fetchEligibility("api-123");
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("not_authenticated");
      expect(result.message).toMatch(/sign in/i);
    });

    it("normalizes 403 to not_subscribed", async () => {
      mockedAuthFetch.mockResolvedValueOnce(
        jsonResponse({ message: "Active subscription required." }, 403),
      );

      const result = await fetchEligibility("api-123");
      expect(result).toEqual({
        eligible: false,
        reason: "not_subscribed",
        message: "Active subscription required.",
      });
    });

    it("normalizes 409 to already_reviewed", async () => {
      mockedAuthFetch.mockResolvedValueOnce(jsonResponse({}, 409));

      const result = await fetchEligibility("api-123");
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("already_reviewed");
    });

    it("throws ReviewApiError with code network on fetch failure", async () => {
      mockedAuthFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(fetchEligibility("api-123")).rejects.toMatchObject({
        name: "ReviewApiError",
        code: "network",
      });
    });

    it("re-throws AbortError without wrapping", async () => {
      const abortErr = new DOMException("Aborted", "AbortError");
      mockedAuthFetch.mockRejectedValueOnce(abortErr);

      const err = await fetchEligibility("api-123").catch((e) => e);
      expect(isReviewAbortError(err)).toBe(true);
      expect(err).not.toBeInstanceOf(ReviewApiError);
    });
  });

  describe("submitReview", () => {
    const validReview = {
      id: "rev-99",
      author: "Ada Lovelace",
      rating: 5,
      date: "2026-11-23T00:00:00.000Z",
      body: "Fast and reliable API with great docs.",
      verified: true,
    };

    it("submits review and returns parsed record on 201", async () => {
      mockedAuthFetch.mockResolvedValueOnce(jsonResponse(validReview, 201));

      const result = await submitReview("api-123", {
        rating: 5,
        body: validReview.body,
      });

      expect(result).toEqual(validReview);
      expect(mockedAuthFetch).toHaveBeenCalledWith(
        "/api/apis/api-123/reviews",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: 5, body: validReview.body }),
        }),
      );
    });

    it("supports wrapped { review } response payloads", async () => {
      mockedAuthFetch.mockResolvedValueOnce(
        jsonResponse({ review: validReview }, 201),
      );

      const result = await submitReview("api-123", {
        rating: 5,
        body: validReview.body,
      });
      expect(result).toEqual(validReview);
    });

    it("classifies 403 as not_subscribed", async () => {
      mockedAuthFetch.mockResolvedValueOnce(
        jsonResponse({ message: "Subscribe first." }, 403),
      );

      await expect(
        submitReview("api-123", { rating: 4, body: "Great service overall." }),
      ).rejects.toMatchObject({
        code: "not_subscribed",
        status: 403,
        message: "Subscribe first.",
      });
    });

    it("classifies 409 as already_reviewed", async () => {
      mockedAuthFetch.mockResolvedValueOnce(jsonResponse({}, 409));

      await expect(
        submitReview("api-123", { rating: 4, body: "Great service overall." }),
      ).rejects.toMatchObject({
        code: "already_reviewed",
        status: 409,
      });
    });

    it("classifies 422 as validation with fieldErrors", async () => {
      mockedAuthFetch.mockResolvedValueOnce(
        jsonResponse(
          {
            message: "Validation failed",
            errors: { body: "Review is too short." },
          },
          422,
        ),
      );

      await expect(
        submitReview("api-123", { rating: 4, body: "Short" }),
      ).rejects.toMatchObject({
        code: "validation",
        status: 422,
        fieldErrors: { body: "Review is too short." },
      });
    });

    it("classifies 429 as rate_limited", async () => {
      mockedAuthFetch.mockResolvedValueOnce(jsonResponse({}, 429));

      await expect(
        submitReview("api-123", { rating: 4, body: "Great service overall." }),
      ).rejects.toMatchObject({
        code: "rate_limited",
        status: 429,
      });
    });

    it("classifies network errors as network", async () => {
      mockedAuthFetch.mockRejectedValueOnce(new TypeError("Network down"));

      await expect(
        submitReview("api-123", { rating: 4, body: "Great service overall." }),
      ).rejects.toMatchObject({
        code: "network",
      });
    });

    it("throws invalid_response when server returns malformed review", async () => {
      mockedAuthFetch.mockResolvedValueOnce(jsonResponse({ ok: true }, 200));

      await expect(
        submitReview("api-123", { rating: 4, body: "Great service overall." }),
      ).rejects.toMatchObject({
        code: "invalid_response",
      });
    });
  });
});
