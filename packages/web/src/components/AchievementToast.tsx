import { useEffect } from 'react';
import { Trophy } from 'lucide-react';
import toast from 'react-hot-toast';

// Listen for WebSocket achievement events and show celebratory toasts
export function useAchievementListener(wsMessage: any) {
  useEffect(() => {
    if (wsMessage?.type === 'ACHIEVEMENT_UNLOCKED') {
      const { name, description } = wsMessage.payload || {};
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-sm w-full bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg rounded-xl pointer-events-auto flex items-center p-4 gap-3`}
          >
            <div className="bg-white/20 rounded-full p-2">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Achievement Unlocked!</p>
              <p className="text-white/90 text-sm">{name}</p>
              {description && <p className="text-white/70 text-xs">{description}</p>}
            </div>
          </div>
        ),
        { duration: 5000 }
      );
    }
  }, [wsMessage]);
}
