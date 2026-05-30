export type AntioxidantProfile = {
  polyphenols: 'low' | 'medium' | 'high';
  flavonoids: 'low' | 'medium' | 'high';
  carotenoids: 'low' | 'medium' | 'high';
};

export type EnvironmentalImpact = {
  carbon_footprint: 'low' | 'medium' | 'high';
  water_usage: 'low' | 'medium' | 'high';
};

export type EnhancedRecipeNutrition = {
  glycemic_index: number;
  antioxidant_profile: AntioxidantProfile;
  nutrient_density_score: number;
  processing_level: string;
  environmental_impact: EnvironmentalImpact;
  satiety_index: number;
};

export type MicronutrientCoverage = {
  percentage: number;
  deficiencies: string[];
  excess: string[];
};

export type WeeklyTrends = {
  protein_consistency: 'low' | 'medium' | 'high';
  fiber_trend: 'increasing' | 'stable' | 'decreasing';
  sugar_trend: 'increasing' | 'stable' | 'decreasing';
};

export type SustainabilityMetrics = {
  plant_to_animal_ratio: number;
  seasonal_ingredient_percentage: number;
};

export type EnhancedMealPlanAnalytics = {
  nutritional_balance_score: number;
  diversity_index: number;
  micronutrient_coverage: MicronutrientCoverage;
  weekly_trends: WeeklyTrends;
  sustainability_metrics: SustainabilityMetrics;
};
