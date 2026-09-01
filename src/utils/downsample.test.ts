import { describe, it, expect } from "vitest";
import { downsampleLatencyData, type LatencyPoint } from "./downsample";

describe("downsampleLatencyData", () => {
  it("does not downsample if data length is less than or equal to maxPoints", () => {
    const data: LatencyPoint[] = [
      { label: "1", value: 10, timestamp: new Date() },
      { label: "2", value: 20, timestamp: new Date() },
    ];
    expect(downsampleLatencyData(data, 2)).toEqual(data);
    expect(downsampleLatencyData(data, 5)).toEqual(data);
  });

  it("downsamples by taking the max() of the values in each bucket (preserves spikes)", () => {
    const data: LatencyPoint[] = [
      { label: "00:00", value: 100, timestamp: new Date(1000) },
      { label: "01:00", value: 150, timestamp: new Date(2000) },
      { label: "02:00", value: 500, timestamp: new Date(3000) }, // Spike
      { label: "03:00", value: 120, timestamp: new Date(4000) },
      { label: "04:00", value: 130, timestamp: new Date(5000) },
      { label: "05:00", value: 140, timestamp: new Date(6000) },
    ];

    // Downsample to 2 points -> bucket size = 6/2 = 3
    const result = downsampleLatencyData(data, 2);

    expect(result).toHaveLength(2);

    // Bucket 1: 100, 150, 500 -> max is 500
    expect(result[0].value).toBe(500);
    expect(result[0].label).toBe("00:00");

    // Bucket 2: 120, 130, 140 -> max is 140
    expect(result[1].value).toBe(140);
    expect(result[1].label).toBe("03:00");
  });
});
