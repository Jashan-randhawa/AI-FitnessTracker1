import type { Core } from '@strapi/strapi';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      await setAuthenticatedPermissions(strapi);
    } catch (err) {
      strapi.log.error('Bootstrap: failed to set permissions', err);
    }
    try {
      await seedBlogPosts(strapi);
    } catch (err) {
      strapi.log.error('Bootstrap: failed to seed blog posts', err);
    }
  },
};

async function setAuthenticatedPermissions(strapi: Core.Strapi) {
  const actionsToEnable = [
    'plugin::users-permissions.user.update',
    'plugin::users-permissions.user.me',
    'api::foodlog.foodlog.find',
    'api::foodlog.foodlog.create',
    'api::foodlog.foodlog.update',
    'api::foodlog.foodlog.delete',
    'api::activitylog.activitylog.find',
    'api::activitylog.activitylog.create',
    'api::activitylog.activitylog.update',
    'api::activitylog.activitylog.delete',
    'api::image-analysis.image-analysis.analyze',
    'api::ai-assistant.ai-assistant.chat',
    'api::calorie-estimate.calorie-estimate.estimate',
    'api::blog.blog.find',
    'api::blog.blog.findOne',
    // Water log
    'api::waterlog.waterlog.find',
    'api::waterlog.waterlog.create',
    'api::waterlog.waterlog.delete',
    // Chat history (FitBot memory)
    'api::chathistory.chathistory.find',
    'api::chathistory.chathistory.create',
    'api::chathistory.chathistory.deleteAll',
  ];

  const publicActionsToEnable = [
    'api::blog.blog.find',
    'api::blog.blog.findOne',
  ];

  const newsActionsToEnable = [
    'api::news.news.getHeadlines',
  ];

  const authenticatedRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' } });

  if (authenticatedRole) {
    await enablePermissions(strapi, authenticatedRole.id, [...actionsToEnable, ...newsActionsToEnable]);
  }

  const publicRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (publicRole) {
    await enablePermissions(strapi, publicRole.id, publicActionsToEnable);
  }
}

async function enablePermissions(strapi: Core.Strapi, roleId: number, actions: string[]) {
  for (const action of actions) {
    try {
      const existing = await strapi
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action, role: roleId } });

      if (existing) {
        // Always force-enable — Strapi Cloud admin resets can flip this to false
        await strapi
          .query('plugin::users-permissions.permission')
          .update({ where: { id: existing.id }, data: { enabled: true } });
        strapi.log.info(`Bootstrap: ensured permission enabled — ${action}`);
      } else {
        await strapi
          .query('plugin::users-permissions.permission')
          .create({ data: { action, role: roleId, enabled: true } });
        strapi.log.info(`Bootstrap: created permission — ${action}`);
      }
    } catch (err) {
      strapi.log.error(`Bootstrap: failed to enable permission ${action}`, err);
    }
  }
}

const SAMPLE_POSTS = [
  {
    title: '10 Science-Backed Tips to Boost Your Metabolism',
    excerpt: 'Discover how small daily habits can dramatically increase your metabolic rate and help you burn more calories throughout the day.',
    content: `## What Is Metabolism?

Your metabolism is the complex set of chemical processes your body uses to convert food into energy. A faster metabolism means your body burns more calories at rest, making weight management easier.

## 1. Build Muscle Mass

Muscle tissue burns more calories than fat tissue, even at rest. Incorporating strength training 2–3 times per week can significantly increase your resting metabolic rate (RMR).

## 2. Stay Hydrated

Drinking water temporarily boosts metabolism by 10–30% for about an hour. Cold water may be even more effective, as your body uses energy to heat it to body temperature.

## 3. Eat Enough Protein

Protein has a high thermic effect — your body burns 20–30% of protein calories just digesting it. Aim for 0.8–1.2g of protein per kg of body weight daily.

## 4. Don't Skip Breakfast

Starting the day with a nutritious meal signals your body to rev up metabolism. High-protein breakfasts like eggs or Greek yogurt are particularly effective.

## 5. Get Quality Sleep

Sleep deprivation slows metabolism and increases hunger hormones. Aim for 7–9 hours of quality sleep per night.

## 6. Try HIIT Workouts

High-Intensity Interval Training (HIIT) keeps your metabolism elevated for hours after the workout — an effect called Excess Post-Exercise Oxygen Consumption (EPOC).

## 7. Drink Green Tea or Coffee

Both contain compounds that can temporarily boost metabolism. Green tea contains catechins and caffeine; coffee contains caffeine, which can boost metabolism by 3–11%.

## 8. Eat Small, Frequent Meals

Eating every 3–4 hours keeps your digestive system active and prevents the metabolic slowdown that can come from long fasting periods.

## 9. Reduce Stress

Chronic stress raises cortisol levels, which can slow metabolism and increase fat storage, especially around the abdomen. Practice yoga, meditation, or deep breathing daily.

## 10. Stand More, Sit Less

Standing burns more calories than sitting. Consider a standing desk or set reminders to move every hour. Even fidgeting can add up to 350 extra calories burned per day.

## The Bottom Line

No single habit will transform your metabolism overnight. But combining these evidence-based strategies creates a powerful compound effect over time. Start with 2–3 changes and build from there.`,
    category: 'fitness',
    coverEmoji: '⚡',
    author: 'FitTrack Team',
    readTime: 6,
    tags: 'metabolism,weight loss,exercise,nutrition',
  },
  {
    title: 'The Ultimate Guide to Macro Counting for Fat Loss',
    excerpt: 'Learn how to track your macronutrients — protein, carbs, and fats — to achieve sustainable fat loss without feeling deprived.',
    content: `## What Are Macronutrients?

Macronutrients are the three main categories of nutrients your body needs in large amounts: **protein**, **carbohydrates**, and **fats**. Each plays a unique role and contains a different calorie density.

- **Protein**: 4 calories per gram
- **Carbohydrates**: 4 calories per gram
- **Fat**: 9 calories per gram

## Why Count Macros Instead of Just Calories?

While calorie balance is the primary driver of weight change, *where* those calories come from affects body composition, energy levels, hormones, and muscle retention during a diet.

## Step 1: Calculate Your TDEE

Your Total Daily Energy Expenditure (TDEE) is the total calories you burn in a day. Use the Mifflin-St Jeor equation as a starting point, then multiply by your activity factor.

## Step 2: Set a Calorie Deficit

For fat loss, aim for a 300–500 calorie deficit per day. This creates a pace of approximately 0.3–0.5 kg of fat loss per week — sustainable and effective.

## Step 3: Set Your Protein Target

Protein is the most important macro during fat loss. It preserves muscle and keeps you full. Target: **1.6–2.2g per kg of body weight**.

## Step 4: Set Your Fat Target

Fats are essential for hormone production and vitamin absorption. Minimum recommended: **0.8–1g per kg of body weight**. Don't go lower.

## Step 5: Fill the Rest with Carbohydrates

After setting protein and fat, allocate the remaining calories to carbohydrates. Carbs fuel workouts and provide energy throughout the day.

## Sample Macro Split for Fat Loss

For a 75kg person with a 1,800 calorie target:
- Protein: 150g (600 cal, 33%)
- Fat: 65g (585 cal, 33%)
- Carbs: 154g (615 cal, 34%)

## Tips for Success

1. Weigh food raw and use a digital kitchen scale
2. Log everything honestly — even cooking oils and sauces
3. Prep meals in advance to hit your targets consistently
4. Allow 10–15% flexibility for whole-food tracking inaccuracies

## Common Mistakes

- Cutting carbs too low and feeling lethargic
- Not eating enough protein and losing muscle
- Eating too few calories and tanking your metabolism

Macro counting is a skill that gets easier with practice. Give it 4–6 weeks before judging the results.`,
    category: 'nutrition',
    coverEmoji: '🥗',
    author: 'FitTrack Team',
    readTime: 8,
    tags: 'macros,nutrition,fat loss,protein,diet',
  },
  {
    title: 'Why Sleep Is the Most Underrated Recovery Tool',
    excerpt: 'Most people focus on workouts and nutrition but neglect sleep — the single most powerful recovery and performance enhancer available.',
    content: `## Sleep: The Foundation of Health

While diet and exercise get all the headlines, sleep is the quiet pillar that holds everything else together. Research consistently shows that inadequate sleep undermines even the most disciplined fitness routine.

## What Happens During Sleep

During deep sleep, your body releases **Growth Hormone (GH)** — critical for muscle repair, fat metabolism, and cell regeneration. The majority of GH is secreted in the first 90 minutes of sleep.

REM sleep, which occurs in later sleep cycles, consolidates motor learning and skill acquisition — meaning you literally get better at exercise while you sleep.

## The Performance Impact of Sleep Deprivation

Studies on athletes show that even one night of poor sleep can:
- Reduce reaction time by up to 300%
- Decrease strength by 8–10%
- Increase perceived effort by 20%
- Lower motivation significantly

## Sleep and Fat Loss

Sleep deprivation disrupts two critical hunger hormones:
- **Ghrelin** (increases appetite) goes UP
- **Leptin** (signals fullness) goes DOWN

This leads to an average of 300–500 extra calories consumed the next day — almost completely wiping out a calorie deficit.

## How to Optimize Your Sleep

### Consistent Schedule
Go to bed and wake at the same time every day, including weekends. This anchors your circadian rhythm.

### Create a Wind-Down Routine
60–90 minutes before bed, dim lights, put away screens, and do calming activities like reading or light stretching.

### Optimize Your Environment
- Keep your bedroom cool (16–19°C / 60–67°F)
- Use blackout curtains or a sleep mask
- Consider white noise if you're a light sleeper

### Nutrition for Sleep
- Avoid caffeine after 2pm
- Don't eat large meals within 2–3 hours of bedtime
- Magnesium-rich foods (nuts, leafy greens) may improve sleep quality

### Exercise Timing
Morning or afternoon workouts promote better sleep. Late evening intense workouts can delay sleep onset in some people.

## The 7–9 Hour Rule

Most adults need 7–9 hours. Athletes and those in heavy training phases often need 9–10 hours. There's no hacking this number — the research is clear.

Start treating sleep as a non-negotiable part of your fitness plan. It's the free performance enhancer your body has been waiting for.`,
    category: 'health',
    coverEmoji: '😴',
    author: 'FitTrack Team',
    readTime: 7,
    tags: 'sleep,recovery,performance,health,hormones',
  },
  {
    title: 'A Beginner\'s Guide to Strength Training',
    excerpt: 'Starting strength training can feel overwhelming. This practical guide gives you everything you need to begin safely and effectively.',
    content: `## Why Strength Training?

Strength training isn't just for bodybuilders. It improves body composition, bone density, insulin sensitivity, mental health, and longevity. It's one of the most evidence-backed interventions for long-term health.

## The Fundamental Movement Patterns

Every effective strength program is built around these core movement patterns:

1. **Squat** – Develops legs and glutes (e.g., back squat, goblet squat)
2. **Hinge** – Targets the posterior chain (e.g., deadlift, Romanian deadlift)
3. **Push** – Chest, shoulders, triceps (e.g., bench press, overhead press, push-up)
4. **Pull** – Back and biceps (e.g., pull-up, row, lat pulldown)
5. **Carry** – Core stability (e.g., farmer's carry)

Master these before adding complexity.

## Progressive Overload: The Key Principle

Progressive overload means gradually increasing the stress on your muscles over time. This is the mechanism behind all strength gains. Do this by:
- Adding weight (most common)
- Adding reps at the same weight
- Adding sets
- Reducing rest time

Aim to progress at least every 1–2 weeks when starting out.

## A Simple Beginner Routine (3 Days/Week)

**Monday / Wednesday / Friday:**
1. Goblet Squat – 3×10
2. Romanian Deadlift – 3×10
3. Push-Up or Bench Press – 3×10
4. Dumbbell Row – 3×10 each side
5. Plank – 3×30 seconds

Rest 60–90 seconds between sets. This full-body routine hits every major muscle group each session.

## Form Over Everything

Bad form leads to injury. When learning new exercises:
- Start with very light weight or bodyweight
- Record yourself to check form
- Slow down the eccentric (lowering) phase
- Focus on the muscle you're working

## Nutrition for Strength Gains

- Eat at or slightly above maintenance calories
- Prioritize protein: 1.6–2.2g per kg of body weight
- Don't neglect carbohydrates — they fuel your workouts

## How Long Until Results?

- **2–4 weeks**: Improved neurological efficiency (you'll get stronger without visible muscle change)
- **6–8 weeks**: Noticeable strength gains
- **3–6 months**: Visible muscle changes

Consistency over months beats perfection over weeks. Show up, lift, eat well, sleep — repeat.`,
    category: 'fitness',
    coverEmoji: '🏋️',
    author: 'FitTrack Team',
    readTime: 9,
    tags: 'strength training,beginners,exercise,muscle building',
  },
  {
    title: 'Mindful Eating: How to Stop Overeating for Good',
    excerpt: 'Mindful eating is a simple but powerful practice that helps you reconnect with your body\'s hunger signals and develop a healthier relationship with food.',
    content: `## What Is Mindful Eating?

Mindful eating is the practice of paying full attention to the experience of eating — the taste, texture, smell, and how your body responds — without judgment. It's rooted in mindfulness meditation and has strong research support for reducing overeating and emotional eating.

## Why We Overeat

Modern food environments are engineered to make us eat more: hyper-palatable foods, massive portions, distracted eating, and emotional triggers all bypass our natural satiety signals.

The result? We eat past fullness without realizing it — often while watching TV, scrolling phones, or working.

## The Hunger-Fullness Scale

A key tool in mindful eating is rating your hunger and fullness on a 1–10 scale:

- **1–2**: Ravenous, dizzy, irritable
- **3–4**: Hungry, stomach growling
- **5–6**: Satisfied, comfortable
- **7–8**: Full, slight discomfort
- **9–10**: Overfull, sick

The goal is to eat when you're at 3–4 and stop at 5–6. This simple awareness can reduce calorie intake by 200–400 calories per day.

## Core Mindful Eating Practices

### 1. Eliminate Distractions
Eat without screens, books, or work. Your brain needs to register the meal to process satiety signals properly.

### 2. Slow Down
It takes 20 minutes for satiety signals to reach your brain. Put your fork down between bites. Chew thoroughly.

### 3. Engage Your Senses
Notice the colors, aromas, textures, and flavors of your food. This enhances satisfaction and slows eating pace naturally.

### 4. Serve Appropriate Portions
Plate your food in the kitchen rather than eating from packages or serving bowls. You'll eat less without trying.

### 5. Check In During the Meal
Pause halfway through and rate your fullness. Ask: am I still hungry, or just eating out of habit?

### 6. Identify Emotional Triggers
Keep a brief food journal noting your mood when eating. Many people discover patterns: stress-eating, boredom-eating, or celebration-eating that aren't driven by physical hunger.

## Mindful Eating vs. Dieting

Mindful eating isn't a diet. You don't count calories or eliminate foods. Instead, you build awareness that naturally guides better choices. Research shows it's as effective as structured diets for weight management, with dramatically better long-term adherence.

Start with just one mindful meal per day. That's enough to begin shifting your relationship with food.`,
    category: 'wellness',
    coverEmoji: '🧘',
    author: 'FitTrack Team',
    readTime: 7,
    tags: 'mindful eating,wellness,overeating,mental health,habits',
  },
  {
    title: 'Hydration 101: How Much Water Do You Actually Need?',
    excerpt: 'The "8 glasses a day" rule is outdated. Here\'s what the science actually says about optimal hydration for health and performance.',
    content: `## The Hydration Myth

You've heard "drink 8 glasses of water a day." But this one-size-fits-all advice ignores body size, activity level, climate, and diet. Here's what actually matters.

## Why Hydration Matters

Water makes up 60% of your body weight and is involved in nearly every bodily function: temperature regulation, joint lubrication, nutrient transport, digestion, and cognitive function.

Even mild dehydration (1–2% of body weight) can impair:
- Physical performance by up to 10%
- Cognitive function and concentration
- Mood and energy levels
- Kidney function

## How Much Do You Actually Need?

A practical formula: **35ml × body weight in kg per day** as a baseline.

So for a 70kg person: 70 × 35 = 2,450ml (about 2.5L per day).

**Add more for:**
- Exercise: 500–1000ml per hour of moderate exercise
- Hot climate: additional 500–1000ml
- High protein diet: extra fluid helps process protein

## Signs You're Dehydrated

- Urine color: pale yellow is ideal; dark yellow means drink more
- Dry mouth or lips
- Headache or dizziness
- Fatigue or brain fog
- Reduced urine frequency (aim for 4–8 times per day)

## Best Hydration Sources

Water is the gold standard, but you also get fluid from:
- **Fruits and vegetables** (cucumber, watermelon, strawberries are 90%+ water)
- **Coffee and tea** (despite the mild diuretic effect, they contribute net hydration)
- **Milk and smoothies**
- **Soups and broths**

## Hydration for Exercise

### Before Exercise
Drink 400–600ml of water 2–3 hours before training. This gives your kidneys time to process excess fluid.

### During Exercise
For sessions under 60 minutes, water is sufficient. For longer sessions or in heat, add electrolytes (sodium, potassium, magnesium) to maintain fluid balance.

### After Exercise
Replace 150% of fluid lost through sweat. Weigh yourself before and after a workout — each kg lost represents approximately 1 litre of sweat.

## Electrolytes: The Forgotten Factor

Water without electrolytes can actually cause hyponatremia (dangerously low sodium) in extreme cases. Active people and heavy sweaters should ensure adequate sodium, potassium, and magnesium intake through food or electrolyte supplements.

## Practical Tips

1. Start every morning with a large glass of water
2. Keep a reusable bottle visible on your desk
3. Eat water-rich foods at every meal
4. Set hourly reminders if you often forget to drink
5. Track your urine color — it's the best real-time hydration indicator

Optimal hydration isn't about hitting an arbitrary number — it's about listening to your body and building consistent habits.`,
    category: 'health',
    coverEmoji: '💧',
    author: 'FitTrack Team',
    readTime: 6,
    tags: 'hydration,water,health,performance,nutrition',
  },
];

async function seedBlogPosts(strapi: Core.Strapi) {
  const existingCount = await strapi.query('api::blog.blog').count({});
  if (existingCount > 0) {
    return;
  }

  strapi.log.info('Bootstrap: seeding blog posts...');
  for (const post of SAMPLE_POSTS) {
    await strapi.query('api::blog.blog').create({
      data: {
        ...post,
        publishedAt: new Date().toISOString(),
      },
    });
  }
  strapi.log.info(`Bootstrap: seeded ${SAMPLE_POSTS.length} blog posts`);
}
