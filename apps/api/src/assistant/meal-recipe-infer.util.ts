/** Resolve date + meal slot when the user asks how to prepare a planned meal. */
export function inferMealRecipeToolCall(message: string): {
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner';
} | null {
  const lower = message.toLowerCase();
  if (
    !/how (?:do i|to) prepare|how (?:do i|to) cook|prepare|cook tonight|make tonight|prepare tomorrow|make tomorrow|tonight'?s (?:dinner|meal)|tomorrow'?s (?:dinner|meal)|recipe steps|preparation steps/i.test(
      lower,
    )
  ) {
    return null;
  }

  let meal_type: 'breakfast' | 'lunch' | 'dinner' = 'dinner';
  if (/\bbreakfast\b/.test(lower)) meal_type = 'breakfast';
  else if (/\blunch\b/.test(lower)) meal_type = 'lunch';
  else if (/\bdinner\b|\bsupper\b/.test(lower)) meal_type = 'dinner';

  const target = new Date();
  target.setUTCHours(12, 0, 0, 0);
  if (/\btomorrow\b/.test(lower)) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return {
    date: target.toISOString().slice(0, 10),
    meal_type,
  };
}
