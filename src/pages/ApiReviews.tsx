import React from 'react';
import EmptyState from '../components/EmptyState';

// Assuming you have a hook or state: const { reviews, loading } = useReviews(id);

export const ApiReviews: React.FC = () => {
  // ... existing logic ...

  if (!loading && reviews.length === 0) {
    return (
      <EmptyState 
        title="No reviews yet" 
        description="Be the first to share your experience with this API." 
        actionLabel="Write a review"
        onAction={() => {/* Open review modal */}}
      />
    );
  }

  return (
    <div>
      {/* Existing review list rendering */}
    </div>
  );
};
