# counting-calories

## The Situation 👀

Imagine transforming your wellness platform into a personalized nutrition companion that truly understands each user. In this project, you'll expand your wellness platform with AI-powered meal planning and recipe generation. Your app will take user dietary preferences, restrictions, and health goals (established in Project 1) and create customized meal plans, recipes and help the user plan and manage their nutrition. You will learn how to structure prompts for content generation, manage complex data relationships and further refine your AI integration skills. Furthermore, you will learn useful techniques to compensate for the problems commonly associated with LLM's.

## Functional Requirements 📋

The first step to planning nutrition is to understand the user - their personal data, goals, constraints and preferences. You'll expand on and confirm the information already gathered in the previous project in order to create a system that generates daily or weekly meal plans, with accompanying recipes and nutritional values, based on user-provided data and preferences.

### User Preference

Collect and utilize the following information:

- Dietary preferences (vegetarian, keto, etc.)
- Allergies and intolerances
- Disliked ingredients
- Cuisine preferences
- Calorie and macronutrient targets
- Meal frequency and timing

Your nutritional planning must support at least 15 different dietary preferences and 10 food allergies/intolerances.

All dates and times throughout the application are required to use ISO 8601 standard.

This means that users will also need to be able to specify their timezone.

Don't request information already collected in Project 1. Use AI to suggest defaults when users are uncertain.

### Meal Planning

Create an AI system that generates and manages meal plans that feel like they were crafted by a personal nutritionist. Created AI system must have these functionalities:

**AI-Powered Generation:**

- Daily and weekly meal plans with nutritional balance
- Flexible meal structures (e.g., 3 meals + 2 snacks)
- Meal details including names, default time (e.g. breakfast, lunch, dinner, snack), and nutritional information
- Alternative meal suggestions

**Customization Tools:**

- Swap generated meals in a plan
- Manual meal additions
- Regeneration options for whole meal plan or individual meals

**Shopping List:**

- Automated generation from meal plans
- Ingredient categorization (at least 5 meaningful categories)
- Ingredient quantity adjustments
- Option to remove ingredients from shopping list

#### Example Meal Plan Input Structure

```json
{
    "user_preferences": {
        "dietary_restrictions": ["vegetarian", "gluten-free"],
        "cuisine_preferences": ["Italian", "Mexican"],
        "disliked_ingredients": ["mushrooms", "tofu"],
        "calorie_target": 2000,
        "macronutrient_targets": {"protein": 100, "carbs": 200, "fats": 60},
        "meals_per_day": 3,
        "preferred_meal_times": {"breakfast": "2024-01-01T08:00:00Z", "lunch": "2024-01-01T12:30:00Z", "dinner": "2024-01-01T19:00:00Z"}
    },
    "meal_plan_request": {
        "duration": "daily", 
        "date": "2024-07-29",
        "version": "1.0",
        "created_at": "2024-07-28T14:30:00Z"
    }
}
```

### GenAI Techniques

#### Sequential Prompting

Creating comprehensive meal plans often requires multiple steps that are difficult to accomplish in a single prompt. Sequential prompting allows you to break down complex meal planning into a series of focused steps:

1. **Initial Assessment:** Analyze user profile to define meal plan strategy
2. **Meal Structure:** Design specific meals and timing
3. **Recipe Generation:** Creates detailed recipes
4. **Nutritional Analysis:** Evaluate nutritional balance
5. **Refinement:** Adjust to address nutritional gaps

Your prompt sequence must have at least 3 steps.

Example flow:

```
PROMPT 1: "Analyze this user profile and recommend a meal strategy..."
RESPONSE: [Strategy with macronutrient targets and meal timing]

PROMPT 2: "Based on this strategy, create a meal structure..."
RESPONSE: [Structured meal plan with specific meal types]

PROMPT 3: "Generate a recipe for Monday's dinner..."
RESPONSE: [Detailed recipe]
```

#### Function Calling

Think of function calling as giving your AI assistant access to specialized tools – like a nutritional calculator that knows the exact calorie content of every ingredient. Function calling allows your AI to work with specific tools and APIs in a structured way, making it perfect for nutritional analysis. Instead of expecting the AI to perform complex nutritional calculations (or generate recipes from scratch!), you can define specific functions that the AI will recognize and request when appropriate.

1. **Define Functions:** Create function definitions
2. **Expose to AI:** Make function definitions available during interactions
3. **Handle Calls:** Execute functions when requested by AI
4. **Process Results:** Incorporate results into AI context

Example function definition:

```json
{
    "type": "function",
    "function": {
        "name": "calculate_nutrition",
        "description": "Calculates nutritional information for a recipe or ingredient list",
        "parameters": {
            "type": "object",
            "properties": {
                "ingredients": {
                    "type": "array",
                    "description": "List of ingredients with quantities",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "quantity": {"type": "number"},
                            "unit": {"type": "string"}
                        }
                    }
                },
                "servings": {
                    "type": "number",
                    "description": "Amount of servings in the recipe."
                }
            },
            "required": ["ingredients", "servings"]
        }
    }
}
```

Example function calling flow:

```
AI OUTPUT: "[Recipe for Mediterranean Quinoa Bowl]"
AI FUNCTION CALL: calculate_nutrition(ingredients=[...], servings=2)
FUNCTION EXECUTION: Querying nutrition database for ingredients and calculating nutritional sum
FUNCTION RESULT: {"calories": 425, "protein": 12.5, "carbs": 48.3, "fats": 22.7}
AI PROCESSING: Evaluating nutritional values and comparing against user's nutritional targets
AI OUTPUT: [Recipe for Mediterranean Quinoa Bowl with complete nutritional information]
```

Your application is required to perform all nutritional analysis using Function Calling.

#### Retrieval-Augmented Generation (RAG)

Imagine combining the creativity of AI with the reliability of tested recipes. RAG can significantly improve your recipe recommendations by combining the power of AI with a knowledge base of existing recipes. Instead of generating recipes from scratch (which may lead to hallucinations), RAG allows your system to:

- Retrieve relevant recipes from a database based on user preferences
- Augment the AI prompt with this retrieved information
- Generate customized recipes that are grounded in real, tested recipes

Improve recipe quality by combining AI with a knowledge base of recipes:

1. **Document Storage:** Create a database with at least 500 recipes and 500 ingredients
2. **Embedding Creation:** Convert recipes to vector embeddings
3. **Retrieval Strategy:** Implement relevance-based search
4. **Augmentation Technique:** Incorporate retrieved recipes into prompts

Example RAG flow:

```json
{
    "user_query": "high-protein vegetarian dinner",
    "retrieved_recipes": [
        {"id": "r123", "title": "Lentil Bolognese", "relevance_score": 0.89},
        {"id": "r456", "title": "Tofu Stir-Fry", "relevance_score": 0.76}
    ],
    "augmented_prompt": "Generate a high-protein vegetarian dinner recipe similar to these examples but customized for user who prefers Italian cuisine: [recipe_data_here]",
    "generated_result": "..."
}
```

Scrape recipe data from public datasets, APIs with appropriate licensing, or generate with AI.

### Feature Requirements

#### Recipe management

Transform your app into a smart cookbook that knows exactly what each user wants and needs. Your recipe management functionality must include:

**Search and Filtering:**

- Search by name, ingredients, or cuisine
- Filter by dietary restrictions, allergies, ingredients
- Filter by calories, macros, preparation time

**Recipe Details:**

- Display ingredients, instructions, nutritional info
- Visual representation of nutritional info

**AI Recipe Generation:**

- Custom recipes based on preferences
- Step-by-step instructions
- Nutritional information
- Recipe variations

**Ingredient Substitution:**

- AI-driven alternatives can be based on ingredient availability and user preferences

**Portion Adjustment:**

- Serving size modifications
- Ingredient quantity recalculation
- Automatic nutrition updates

### Data Structures

To ensure accurate nutritional calculations and consistent recipe scaling, all measurements must be standardized to common units: solids in grams (g), liquids in milliliters (ml), energy in kilocalories (kcal), and time (duration) in minutes. This standardization is crucial for:

- Precise nutritional analysis across recipes
- Accurate portion scaling and serving size adjustments
- Consistent ingredient measurements for shopping lists
- Reliable function calling for AI calculations

While recipes may display friendly measurements for users (cups, tablespoons, etc.), the underlying data structure must maintain these standardized units.

At minimum, your Recipe and Nutritional Information JSON objects must include the following fields:

**Recipe:**

```json
{
    "id": "r789",
    "title": "Mediterranean Quinoa Bowl", 
    "cuisine": "Mediterranean",
    "meal": "lunch",
    "servings": 2,
    "ingredients": [
        {"id":"ing123", "name": "quinoa", "quantity": 180},
        {"id":"ing124", "name": "cherry tomatoes", "quantity": 200},
        {"id":"ing125", "name": "cucumber", "quantity": 150},
        {"id":"ing126", "name": "olive oil", "quantity": 15},
        {"id":"ing127", "name": "lemon juice", "quantity": 30},
        {"id":"ing128", "name": "feta cheese", "quantity": 60}
    ],
    "summary": "A refreshing Mediterranean-style quinoa bowl packed with vegetables and protein",
    "time": 25,
    "difficulty_level": "easy",
    "dietary_tags": ["vegetarian", "gluten-free", "high-protein"],
    "source": "my-rag-database",
    "img": "/images/med-quinoa-bowl.jpg",
    "preparation": [
        {
          "step":"Cook quinoa", 
          "description": "Rinse quinoa thoroughly and cook in water according to package instructions.", 
          "ingredients": ["ing123"]
        },
        {
          "step":"Chop and dice", 
          "description": "While quinoa cooks, halve cherry tomatoes and dice cucumber.", 
          "ingredients": ["ing124", "ing125"]
        },
        {
          "step":"The dressing", 
          "description": "Whisk together olive oil and lemon juice to make dressing.", 
          "ingredients": ["ing126", "ing127"]
        },
        {
          "step":"Combine and enjoy!", 
          "description": "Combine cooked quinoa with vegetables, drizzle with dressing, and top with crumbled feta.", 
          "ingredients": ["ing123", "ing124", "ing125", "ing126", "ing127", "ing128"]
        }
    ]
}
```

**Nutrient Information:**

```json
{
    "id": "ing321", 
    "label": "white rice",
    "unit": "gram",
    "quantity": 100,
    "nutrition": {
        "calories":370,
        "carbs": 81,
        "protein":6.2,
        "fats": 0.6
    }
}
```

### Nutritional Analysis

Effective nutritional analysis is fundamental to any successful meal planning application and for achieving set health goals. By providing clear feedback on nutritional intake with visualizations, you help users make informed decisions about their food choices and adjust their meals so they could achieve their goals.

At minimum, your nutritional analysis must include the following features:

**Macro Tracking:**

- Display calories (kcal) and macros (in grams and % of daily target) per meal/day.
- Visualize macronutrient breakdown:
  - Interactive pie charts for nutrient breakdown per meal/day.
  - Progress bars for each macronutrient.

**Goal Tracking:**

- Compare nutritional intake against goals:
  - Daily progress towards calorie targets
  - Weekly averages vs. targets
  - Deficit/surplus calculations
- Visualize progress indicators:
  - Progress bar toward calorie targets
  - Color-coded deficit/surplus indicators (red/yellow/green)
  - Trend lines showing daily caloric deficit/surplus during a week/month

**AI-Driven Analysis:**

- Nutritional highlights summary:
  - Key achievements according to users health goals ("Remained in caloric deficit for 5 days in a row!")
  - Potential concerns ("Caloric deficit was more than 500kcal 3 days out of 5!")
  - Macronutrient balance analysis
- Improvement suggestions:
  - Specific food recommendations
  - Meal timing adjustments
  - Portion size modifications
  - Alternative ingredients for better macronutrient balance
  - Weekly meal plan optimizations

### Cross-Feature Integration

Cross-Feature integration is important for cohesive and seamless user experience. Data should be asked only once and flow seamlessly between different features of the application.

Your nutritional analysis features have to be integrated to relevant features already created:

- Daily progress tracking is accessible from the Health Dashboard
- Detailed historical analysis is available in the Progress Charts section
- AI-powered suggestions appear alongside other health insights
- All visualizations follow the established design system for consistency and familiarity

You are required to make use of minimally these previously created features to further personalize the users meal planning experience:

- Use BMI and weight goals to calculate calorie targets
- Apply activity level to adjust portions and macros
- Filter recipes based on health data
- Update wellness score based on nutritional intake
- Use nutrition data to refine health insights

## Important Considerations ❗

**AI Model Selection:** You might consider the following aspects:

- Nutritional Accuracy
- Format Consistency
- Context length
- Cost and latency
- Customization needs

You may find that different models excel at different tasks within your application. For example, you might use one model for creative recipe generation and another for precise nutritional analysis.

Your meal planning features must integrate:

**Prompt Engineering:**

- Use few-shot examples
- Apply iterative refinement
- Use sequential prompting

**Parameter Optimization:**

- Temperature (creativity vs. predictability)
- Top-p (diversity control)
- Max tokens (response length)

**Error Handling and API Reliability:**

- Implement graceful handling for API issues
- Create clear user-facing error messages
- Build recovery mechanisms for failed requests

**Content Management:**

- Implement version control for meal plans
- Consider collecting user feedback for personalization

## Useful links 🔗

- Sequential prompting
- Retrieval-Augmented Generation (RAG) Overview
- SentenceTransformers for vector embeddings
- Using vector embeddings for search
- Function Calling in LLM
- The Complete Guide to LLM Parameters: How to Control AI Text Generation
- Output parsers for structured data
- Few-shot prompting techniques
- Schema validation for JSON outputs
- Designing a Relational Database for a Cookbook
- Docker

## Extra requirements 📚

### Dockerization

Containerize the project: use Docker to simplify setup and execution:

- Provide a Dockerfile (or multiple, if the project includes separate frontend and backend components)
- Include a simple startup command or script that builds and runs the entire application with one step
- Docker should be the only requirement, no manual setup, dependency installation, or external tools

### Micronutrients

Take your nutritional analysis to the next level by looking beyond just calories and macros:

- Track key micronutrients (Vitamin D, B12, Iron, etc.)
- Visualize intake vs. recommended values
- Generate deficiency recommendations
- Suggest foods to improve specific micronutrients
- Add micronutrient-based search filters

### Community-driven RAG

Harness the wisdom of your user community to make your recipe recommendations even better:

- Implement user rating and review system
- Use high-rated recipes as priority RAG examples
- Create vector database that improves with community preferences
- Build recommendation system highlighting verified recipes
- Add moderation workflow for quality control

### Enhanced Nutritional Data

Extend your data models with additional nutritional fields:

**Recipe Schema Additions:**

```json
{
    "glycemic_index": 45,
    "antioxidant_profile": {
        "polyphenols": "high",
        "flavonoids": "medium",
        "carotenoids": "low"
    },
    "nutrient_density_score": 8.5,
    "processing_level": "minimally processed",
    "environmental_impact": {
        "carbon_footprint": "medium",
        "water_usage": "low"
    },
    "satiety_index": 76
}
```

**Meal Plan Additions:**

```json
{
    "nutritional_balance_score": 8.7,
    "diversity_index": 9.2,
    "micronutrient_coverage": {
        "percentage": 83,
        "deficiencies": ["vitamin D", "magnesium"],
        "excess": ["sodium"]
    },
    "weekly_trends": {
        "protein_consistency": "high",
        "fiber_trend": "increasing",
        "sugar_trend": "decreasing"
    },
    "sustainability_metrics": {
        "plant_to_animal_ratio": 4.5,
        "seasonal_ingredient_percentage": 72
    }
}
```

## Bonus functionality 🎁

You're welcome to implement other bonuses as you see fit. But anything you implement must not change the default functional behavior of your project.

You may use additional feature flags, command line arguments or separate builds to switch your bonus functionality on.

## What you'll learn 🧠

- Structured content generation with AI
- Managing complex data relationships
- Parameter-based AI output control
- Iterative prompt refinement methodology
- Retrieval-augmented generation implementation
- Function calling for specialized tasks
- Sequential prompting for complex workflows
- Advanced AI integration strategies

## Deliverables and Review Requirements 📁

- Complete source code and configuration files
- Project documentation including:
  - Overview and architecture
  - Setup instructions
  - Usage guide
  - Prompt engineering strategy
  - Model selection rationale
  - Data model documentation
  - Error handling approach
  - Bonus functionality (if any)

Be prepared to:

- Demonstrate full system functionality
- Explain design choices and data models
- Discuss integration with Project 1
- Share challenges and solutions
- Evaluate model performance and tradeoffs

---

# Testing

Ensures that software works as expected by validating features against requirements. It helps catch bugs early, improves reliability, and maintains high-quality standards in development.

## How to do testing?

1. Clone the repository, then build and run the submitted code.
2. Agree on your teamwork: how do you divide testing between reviewers?
3. Test functionality and check compliance with the requirements.
4. Provide feedback in the group chat and request fixes if necessary.
5. Clearly state what changes are mandatory and what are optional fixes.
6. Repeat the testing cycle after submitters make the requested changes for as many times as is needed.

## Mandatory

- The README file contains a clear project overview, setup instructions, and usage guide.

- Documentation includes:
  - Overview of prompt engineering strategy
  - AI model selection rationale
  - Data model decisions
  - Error handling methods used in the project.

- Nutritional planning functionality supports at least 15 different dietary preferences and 10 food allergies/intolerances.

- The platform collects and utilizes user preferences:
  - Dietary preferences, allergies and intolerances, disliked ingredients, cuisine preferences, calorie and macronutrient targets, meal frequency and timing

- System reuses information from Project 1 without requiring duplicate input.

- Input fields are pre-filled for information that has already been provided. Only confirmation should be asked.

- All dates and times follow the ISO 8601 standard format.

- System generates complete daily and weekly meal plans based on user preferences.

- Both daily and weekly meal plan durations are supported.

- System allows customizing meal structures.
  - e.g. number of meals and snacks per day

- Each meal has basic information.
  - Name, meal type (e.g. breakfast/lunch/dinner/snack or similar), nutritional value.

- System provides alternative meal options and allows users to select replacements.

- System allows reordering meals within a day or swapping meals between different days.
  - It is possible to change dinner to lunch and Mondays dinner for Tuesdays dinner.

- System allows users to manually add custom meals.

- System allows regenerating individual meals or entire meal plans while preserving preferences.

- Shopping list can be generated from a specific meal or meal plan.

- Shopping list items are automatically categorized by food group to at least 5 meaningful categories.
  - e.g. cheese and milk are categorized under dairy.

- Shopping list allows both quantity adjustments and item exclusions.
  - Users can modify amounts and completely remove ingredients from generated shopping lists.

- Sequential prompting with at least 3 distinct steps is used for meal plan generation.
  - Verify that at least 3 distinct prompts are used in sequence and each next prompt uses results from previous step. The student can explain and conceptualize the logical progression of each step and how breaking down the process improves the quality of generated meal plans compared to a single-prompt approach.

- Retrieval-Augmented Generation is used to generate recipes and nutritional values.
  - The student can explain the function of all the components in their RAG implementation, their importance in the RAG pipeline (database -> embedding -> retrieval -> augmentation -> generation) and how RAG improves the quality of generated recipes compared to generation from scratch.

- Recipe and ingredient databases have at least 500 entries each.

- RAG implementation includes (at least rudimentary) vector embeddings and relevance-based search.

- Recipe and ingredient databases utilize vector similarity for retrieval.

- Response to the user is generated from an augmented prompt.

- System uses clearly defined functions to provide accurate nutritional calculations.

- All nutritional calculations are done by function calling.

- Function calling implementation includes proper error handling.
  - Error handling covers parsing errors, missing parameters, invalid values, execution errors, timeout errors, rate limits and connectivity issues.

- Recipes can be searched by name, ingredients, or cuisine.

- Recipes can be filtered.
  - Filters include dietary restrictions, allergies, ingredients, calorie and macronutrient amounts, and preparation time.

- Recipes display ingredients, step-by-step instructions and nutritional information summarized from used ingredients.

- Nutritional information is also visualized (e.g. chart, graph)

- Variety of custom recipes can be generated with AI based on user preferences.
  - Generated recipes are varied, include instructions and nutritional information.

- Ingredients in a recipe can be substituted with AI.
  - Option to base alternatives on food item availability and user preferences.

- Portions can be adjusted by modifying serving size.
  - Ingredient quantity is automatically recalculated. Function calling is used for meal nutritional value recalculation.

- All measurements are standardized to common units in data structures.
  - Solids are in grams, liquids in milliliters, energy in kilocalories and time in minutes.

- Recipe data structure has all required fields.
  - Verify that the recipe data structure includes all of these required fields:
    - id
    - title
    - cuisine
    - meal
    - servings
    - ingredients (array with id, name, quantity)
    - summary
    - time
    - difficulty_level
    - dietary_tags
    - source
    - img
    - preparation (array with step, description, ingredients)

- Ingredient data structure has all required fields.
  - Verify that the ingredient data structure includes all of these required fields:
    - id
    - label
    - unit
    - quantity
    - nutrition (object containing):
      - calories
      - carbs
      - protein
      - fats

- Nutritional analysis includes calorie (kcal) and macronutrient (grams and % of daily target) tracking per meal/day.

- Macronutrient breakdown is meaningfully visualized (e.g. graph, chart).

- Nutritional analysis tracks users nutritional intake and compares it to nutritional intake goals.
  - Comparisons are available on daily and weekly basis with accurate deficit/surplus calculations.

- Nutritional intake tracking is visualized informatively and intuitively.
  - Progress towards calorie targets is visualized with a progress bar and is color-coded to indicate caloric surplus or deficit.

- Nutritional intake tracking includes visualized trend lines
  - Trend line visualizes daily caloric deficit/surplus on a weekly and monthly basis.

- AI-driven nutritional analysis offers regular summaries.
  - Summaries include key achievements in terms of users goals, potential concerns and macronutrient balance analysis.

- AI-driven nutritional analysis provides users improvement suggestions
  - Improvement suggestions include food recommendations, meal timing adjustments, portion size modifications, alternative ingredients and possible meal plan optimizations.

- Nutritional analysis features are seamlessly integrated.
  - Daily tracking is available on dashboard. Historical analysis is available in the Progress Charts section. AI-driven nutritional insights are grouped together with other insights.

- Meal planner uses relevant user data to improve performance and personalization.
  - BMI and weight goals are used to calculate calorie targets. Activity level is used to adjust portions and macros Wellness score is updated based on nutrition.

- Student can explain and justify their AI model choices for recipe generation vs. nutritional analysis

- Few-shot examples are used in prompts.
  - Student can explain their example selection strategy.

- Parameter adjustments are used for AI-generated outputs.
  - Student can explain temperature and top-p usage decisions.

- System handles API errors gracefully with clear user-friendly error messages.
  - Rate limits, timeouts, and malformed responses are handled with meaningful user feedback.

- System implements recovery mechanisms for failed AI requests.
  - At least one fallback strategy should be present (caching, retry logic, alternative models, etc.).

- Content versioning allows restoring previous meal plans.
  - User can access and restore earlier meal plan versions.

## Extra

- Project runs entirely through Docker with a single command
  - The project includes a Dockerfile or script that builds and runs the app with one command. Docker is the only requirement, no manual setup or dependency installation is required.

- System maintains user preference history to inform future recommendations.
  - Tracks user decisions and feedback to improve personalization over time.

- Nutritional analysis includes micronutrients.
  - One point should be given for each implemented improvement in project "Micronutrients" section.

- System includes a mechanism for user feedback to improve RAG database quality and size.
  - One point should be given for each implemented improvement mechanism outlined in project "Community-driven RAG" section

- Nutritional data has been extended with additional fields (in addition to micronutrients).
  - Up to two points can be given for an enhanced data schema (recipe/meal plan). Award two points if the schemas are significantly improved.

- Student has implemented additional technologies, security enhancements and/or features beyond the core requirements.

- Overall implementation quality demonstrates exceptional attention to detail and thoroughness beyond minimum requirements.
  - Evaluate the following aspects of overall implementation quality:
    - Code quality and organization
    - Documentation completeness and clarity
    - Consistency in error handling and user experience
    - Testing coverage and quality
    - Implementation of best practices throughout
  - Award full points for implementations that go significantly beyond minimum requirements and demonstrate professional-grade quality.
