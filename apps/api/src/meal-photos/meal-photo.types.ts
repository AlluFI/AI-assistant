export type DetectedFoodItem = {
  name: string;
  quantityGrams: number;
  confidence?: number;
};

export type MealPhotoNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servings: number;
  perServing: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
};

export type MealPhotoScanResult = {
  id: string;
  status: string;
  date: string;
  mealType: string | null;
  description: string | null;
  foods: DetectedFoodItem[];
  nutrition: MealPhotoNutrition | null;
  unmatchedFoods: string[];
  matchedCount: number;
  disclaimer: string;
  createdAt: string;
};
