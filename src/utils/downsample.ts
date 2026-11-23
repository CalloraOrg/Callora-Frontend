export type LatencyPoint = {
  label: string;
  value: number;
  timestamp: Date;
};

/**
 * Downsamples latency data by grouping into buckets and returning the maximum
 * value (P95) from each bucket. We do not average percentiles because they are
 * non-additive and averaging smooths away latency spikes.
 */
export function downsampleLatencyData(data: LatencyPoint[], maxPoints: number): LatencyPoint[] {
  if (data.length <= maxPoints || maxPoints <= 0) {
    return data;
  }

  const bucketSize = Math.ceil(data.length / maxPoints);
  const downsampled: LatencyPoint[] = [];

  for (let i = 0; i < data.length; i += bucketSize) {
    const chunk = data.slice(i, i + bucketSize);
    const first = chunk[0];
    if (!first) continue;

    // Compute max value in the chunk
    const maxValue = Math.max(...chunk.map((p) => p.value));

    // We use the timestamp and label of the first element in the bucket
    downsampled.push({
      label: first.label,
      timestamp: first.timestamp,
      value: maxValue,
    });
  }

  return downsampled;
}
