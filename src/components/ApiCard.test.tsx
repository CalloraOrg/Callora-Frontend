import { render, screen, fireEvent } from "@testing-library/react";
import ApiCard from "./ApiCard";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import type { APIItem } from "../data/mockApis";

vi.mock("../state/collectionsStore", () => ({
  useCollections: () => ({
    collections: [],
    isEndpointSaved: () => false,
    addEndpointToCollection: vi.fn(),
    removeEndpointFromCollection: vi.fn(),
    collectionIdsForEndpoint: () => new Set(),
    createCollection: vi.fn(),
  }),
}));

describe("ApiCard Accessibility and Context Layouts", () => {
  const mockApi: APIItem = {
    id: "api-1",
    name: "Stellar Metering API",
    endpoint: "/api/v1/meter",
    description: "A mock API for testing.",
    tags: ["mock"],
    pricePerRequest: 0.01,
  };

  it("opens context menu correctly on right click invocation", () => {
    render(
      <ApiCard api={mockApi} onViewDetails={() => {}} />
    );

    const card = screen.getByText("Stellar Metering API");
    fireEvent.contextMenu(card);

    expect(screen.getByRole("menu")).toBeDefined();
    expect(screen.getByText("Copy Endpoint URL")).toBeDefined();
  });
});