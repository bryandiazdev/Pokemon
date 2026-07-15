export const DISCLAIMER_VERSION = '1.0';

export const GRADE_DISCLAIMER = `This is a computer-vision estimate, not a grade. Professional grading is subjective and performed in person; cameras can miss microscopic or hidden defects, and lighting, focus, glare, sleeves, and image quality affect results. Pokémon Stock Radar is not affiliated with PSA or any grading company, and a grading company may return a different result. This is not financial advice.`;

/** Approved / forbidden grading language, enforced by a lint test. */
export const APPROVED_GRADE_TERMS = [
  'Grade Potential',
  'Estimated PSA Range',
  'Estimated Grade Ceiling',
  'Computer-Vision Condition Analysis',
  'Possible PSA 10 Candidate',
  'Submission Candidate',
  'Estimated Maximum Grade',
  'Confidence Level',
] as const;

export const FORBIDDEN_GRADE_TERMS = [
  'Guaranteed PSA 10',
  'Official PSA Grade',
  'PSA Approved',
  'Guaranteed Grade',
  'Guaranteed Gem Mint',
] as const;
