import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';

interface AchievementData {
  key: string;
  name: string;
  description: string;
}

export function AchievementOverlay({ achievement, onDone }: { achievement: AchievementData | null; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDone, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onDone]);

  if (!achievement) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-[100] pointer-events-none transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-2xl shadow-2xl p-8 text-center max-w-sm mx-4 transform transition-transform duration-300 scale-100">
        <div className="bg-white/20 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
          <Trophy className="w-10 h-10 text-white" />
        </div>
        <p className="text-white/80 text-sm font-medium mb-1">Achievement Unlocked!</p>
        <p className="text-white text-2xl font-bold mb-2">{achievement.name}</p>
        <p className="text-white/80 text-sm">{achievement.description}</p>
      </div>
    </div>
  );
}
