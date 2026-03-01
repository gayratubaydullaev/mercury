'use client';

function getReviewWord(count: number) {
  if (count === 0) return 'Sharhlar yoʻq';
  if (count === 1) return '1 ta sharh';
  return `${count} ta sharh`;
}

export function ProductRatingLabel({ count }: { count: number }) {
  return <>{getReviewWord(count)}</>;
}
