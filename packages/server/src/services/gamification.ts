import { prisma } from '../db/client.js';
import { broadcast, broadcastToUser } from '../ws/server.js';

// Achievement definitions
const ACHIEVEMENTS: Record<string, { name: string; description: string; check: (stats: UserStats) => boolean }> = {
  FIRST_ORDER: {
    name: 'First Order',
    description: 'Complete your first station',
    check: (stats) => stats.totalCompleted >= 1,
  },
  ON_A_ROLL: {
    name: 'On a Roll',
    description: 'Complete 5 stations in one day',
    check: (stats) => stats.todayCompleted >= 5,
  },
  STREAK_3: {
    name: '3-Day Streak',
    description: 'Complete stations 3 days in a row',
    check: (stats) => stats.currentStreak >= 3,
  },
  STREAK_5: {
    name: '5-Day Streak',
    description: 'Complete stations 5 days in a row',
    check: (stats) => stats.currentStreak >= 5,
  },
  STREAK_10: {
    name: '10-Day Streak',
    description: 'Complete stations 10 days in a row',
    check: (stats) => stats.currentStreak >= 10,
  },
  STREAK_30: {
    name: 'Monthly Machine',
    description: 'Complete stations 30 days in a row',
    check: (stats) => stats.currentStreak >= 30,
  },
  SPEED_DEMON: {
    name: 'Speed Demon',
    description: 'Complete 10 stations in one day',
    check: (stats) => stats.todayCompleted >= 10,
  },
  EARLY_BIRD: {
    name: 'Early Bird',
    description: 'Complete a station before 7 AM',
    check: (stats) => stats.earlyBird,
  },
  NIGHT_OWL: {
    name: 'Night Owl',
    description: 'Complete a station after 8 PM',
    check: (stats) => stats.nightOwl,
  },
  CENTURY: {
    name: 'Century Club',
    description: 'Complete 100 stations total',
    check: (stats) => stats.totalCompleted >= 100,
  },
};

interface UserStats {
  totalCompleted: number;
  todayCompleted: number;
  currentStreak: number;
  earlyBird: boolean;
  nightOwl: boolean;
}

async function getUserStats(userId: string): Promise<UserStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Get or create streak
  let streak = await prisma.userStreak.findUnique({ where: { userId } });
  if (!streak) {
    streak = await prisma.userStreak.create({
      data: { userId, currentStreak: 0, longestStreak: 0, totalCompleted: 0 },
    });
  }

  // Count today's completions
  const todayCompleted = await prisma.workEvent.count({
    where: {
      userId,
      eventType: 'STATION_COMPLETED',
      createdAt: { gte: todayStart, lt: todayEnd },
    },
  });

  const hour = now.getHours();

  return {
    totalCompleted: streak.totalCompleted,
    todayCompleted,
    currentStreak: streak.currentStreak,
    earlyBird: hour < 7,
    nightOwl: hour >= 20,
  };
}

export async function checkAchievements(userId: string): Promise<string[]> {
  const stats = await getUserStats(userId);
  const unlocked: string[] = [];

  // Get existing achievements
  const existing = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementKey: true },
  });
  const existingKeys = new Set(existing.map((a) => a.achievementKey));

  for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
    if (existingKeys.has(key)) continue;
    if (achievement.check(stats)) {
      await prisma.userAchievement.create({
        data: { userId, achievementKey: key, metadata: { name: achievement.name, description: achievement.description } },
      });
      unlocked.push(key);

      // Broadcast to the specific user
      broadcastToUser(userId, {
        type: 'ACHIEVEMENT_UNLOCKED',
        payload: { key, name: achievement.name, description: achievement.description },
        timestamp: new Date(),
      });
    }
  }

  return unlocked;
}

export async function updateStreak(userId: string): Promise<void> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let streak = await prisma.userStreak.findUnique({ where: { userId } });

  if (!streak) {
    await prisma.userStreak.create({
      data: {
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
        totalCompleted: 1,
      },
    });
    return;
  }

  const lastActive = streak.lastActiveDate ? new Date(streak.lastActiveDate) : null;
  const lastActiveDay = lastActive
    ? new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate())
    : null;

  let newStreak = streak.currentStreak;

  if (!lastActiveDay) {
    newStreak = 1;
  } else {
    const diffDays = Math.floor((today.getTime() - lastActiveDay.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      // Same day, just increment total
    } else if (diffDays === 1) {
      newStreak = streak.currentStreak + 1;
    } else {
      newStreak = 1; // Streak broken
    }
  }

  await prisma.userStreak.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, streak.longestStreak),
      lastActiveDate: today,
      totalCompleted: streak.totalCompleted + 1,
    },
  });
}

export function getAchievementInfo(key: string) {
  return ACHIEVEMENTS[key] || null;
}

export function getAllAchievements() {
  return Object.entries(ACHIEVEMENTS).map(([key, val]) => ({
    key,
    name: val.name,
    description: val.description,
  }));
}
