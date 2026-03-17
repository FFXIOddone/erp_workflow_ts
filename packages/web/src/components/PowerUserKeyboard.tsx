/**
 * PowerUserKeyboardSystem (SSS-COMP-012)
 * 
 * Advanced keyboard navigation system for power users:
 * - Vim-like modal navigation (Normal, Insert, Visual modes)
 * - Macro recording and playback
 * - Custom shortcut chaining (leader key patterns)
 * - Context-sensitive shortcuts
 * - Visual shortcut hints overlay
 * - Shortcut analytics tracking
 * 
 * @example
 * // Wrap your app with the provider
 * <KeyboardProvider>
 *   <App />
 *   <ShortcutHintsOverlay />
 * </KeyboardProvider>
 * 
 * // Use in components
 * const { registerShortcut, startMacro, mode } = useKeyboard();
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { clsx } from 'clsx';
import {
  Keyboard,
  Circle,
  Play,
  Square,
  Pause,
  Trash2,
  Copy,
  Edit3,
  Eye,
  Zap,
  ChevronRight,
  Command,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  X,
  Check,
  Info,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

type KeyboardMode = 'normal' | 'insert' | 'visual' | 'leader';

interface KeyBinding {
  id: string;
  keys: string[];
  description: string;
  action: () => void;
  context?: string;
  modes?: KeyboardMode[];
  category?: string;
}

interface RecordedAction {
  type: 'keypress' | 'shortcut';
  keys: string[];
  timestamp: number;
}

interface Macro {
  id: string;
  name: string;
  actions: RecordedAction[];
  trigger?: string[];
  createdAt: Date;
  playCount: number;
}

interface ShortcutAnalytics {
  shortcutId: string;
  useCount: number;
  lastUsed: Date;
  avgTimeBetweenUses: number;
}

interface KeyboardContextValue {
  mode: KeyboardMode;
  setMode: (mode: KeyboardMode) => void;
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => Macro | null;
  cancelRecording: () => void;
  macros: Macro[];
  playMacro: (id: string) => void;
  deleteMacro: (id: string) => void;
  registerShortcut: (binding: Omit<KeyBinding, 'id'>) => string;
  unregisterShortcut: (id: string) => void;
  leaderKey: string;
  setLeaderKey: (key: string) => void;
  leaderTimeout: number;
  setLeaderTimeout: (ms: number) => void;
  showHints: boolean;
  toggleHints: () => void;
  analytics: ShortcutAnalytics[];
  currentContext: string;
  setContext: (context: string) => void;
  pendingLeaderKeys: string[];
}

// ============================================================
// Context
// ============================================================

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function useKeyboard() {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboard must be used within KeyboardProvider');
  }
  return context;
}

// ============================================================
// Utility Functions
// ============================================================

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function normalizeKey(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  
  let key = event.key;
  if (key === ' ') key = 'Space';
  if (key.length === 1) key = key.toUpperCase();
  
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    parts.push(key);
  }
  
  return parts.join('+');
}

function keysMatch(binding: string[], pressed: string[]): boolean {
  if (binding.length !== pressed.length) return false;
  return binding.every((k, i) => k.toLowerCase() === pressed[i]?.toLowerCase());
}

function formatKeyCombo(keys: string[]): string {
  return keys.join(' → ');
}

const KEY_SYMBOLS: Record<string, string> = {
  'Ctrl': '⌃',
  'Alt': '⌥',
  'Shift': '⇧',
  'Meta': '⌘',
  'Enter': '↵',
  'Space': '␣',
  'Escape': 'Esc',
  'ArrowUp': '↑',
  'ArrowDown': '↓',
  'ArrowLeft': '←',
  'ArrowRight': '→',
  'Backspace': '⌫',
  'Tab': '⇥',
};

function formatKeyForDisplay(key: string): string {
  const parts = key.split('+');
  return parts.map(p => KEY_SYMBOLS[p] || p).join('');
}

// ============================================================
// KeyboardProvider
// ============================================================

interface KeyboardProviderProps {
  children: React.ReactNode;
  defaultLeaderKey?: string;
  defaultLeaderTimeout?: number;
  persistMacros?: boolean;
  onModeChange?: (mode: KeyboardMode) => void;
}

export function KeyboardProvider({
  children,
  defaultLeaderKey = 'Space',
  defaultLeaderTimeout = 1000,
  persistMacros = true,
  onModeChange,
}: KeyboardProviderProps) {
  // Mode management
  const [mode, setModeState] = useState<KeyboardMode>('insert');
  const [showHints, setShowHints] = useState(false);
  
  // Leader key state
  const [leaderKey, setLeaderKey] = useState(defaultLeaderKey);
  const [leaderTimeout, setLeaderTimeout] = useState(defaultLeaderTimeout);
  const [pendingLeaderKeys, setPendingLeaderKeys] = useState<string[]>([]);
  const leaderTimerRef = useRef<number | null>(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const recordedActionsRef = useRef<RecordedAction[]>([]);
  const recordingStartRef = useRef<number>(0);
  
  // Shortcuts and macros
  const [shortcuts, setShortcuts] = useState<KeyBinding[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [analytics, setAnalytics] = useState<ShortcutAnalytics[]>([]);
  const [currentContext, setCurrentContext] = useState('global');
  
  // Load persisted macros
  useEffect(() => {
    if (persistMacros) {
      try {
        const saved = localStorage.getItem('keyboard-macros');
        if (saved) {
          const parsed = JSON.parse(saved);
          setMacros(parsed.map((m: Macro) => ({
            ...m,
            createdAt: new Date(m.createdAt),
          })));
        }
      } catch {
        console.warn('Failed to load saved macros');
      }
    }
  }, [persistMacros]);
  
  // Save macros when they change
  useEffect(() => {
    if (persistMacros && macros.length > 0) {
      localStorage.setItem('keyboard-macros', JSON.stringify(macros));
    }
  }, [macros, persistMacros]);
  
  // Mode change handler
  const setMode = useCallback((newMode: KeyboardMode) => {
    setModeState(newMode);
    onModeChange?.(newMode);
    
    // Reset leader state when changing modes
    if (newMode !== 'leader') {
      setPendingLeaderKeys([]);
      if (leaderTimerRef.current) {
        clearTimeout(leaderTimerRef.current);
        leaderTimerRef.current = null;
      }
    }
  }, [onModeChange]);
  
  // Register shortcut
  const registerShortcut = useCallback((binding: Omit<KeyBinding, 'id'>): string => {
    const id = generateId();
    setShortcuts(prev => [...prev, { ...binding, id }]);
    return id;
  }, []);
  
  // Unregister shortcut
  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts(prev => prev.filter(s => s.id !== id));
  }, []);
  
  // Track analytics
  const trackShortcutUse = useCallback((shortcutId: string) => {
    setAnalytics(prev => {
      const existing = prev.find(a => a.shortcutId === shortcutId);
      const now = new Date();
      
      if (existing) {
        const timeSinceLast = now.getTime() - existing.lastUsed.getTime();
        const newAvg = (existing.avgTimeBetweenUses * existing.useCount + timeSinceLast) / (existing.useCount + 1);
        
        return prev.map(a => 
          a.shortcutId === shortcutId
            ? {
                ...a,
                useCount: a.useCount + 1,
                lastUsed: now,
                avgTimeBetweenUses: newAvg,
              }
            : a
        );
      }
      
      return [...prev, {
        shortcutId,
        useCount: 1,
        lastUsed: now,
        avgTimeBetweenUses: 0,
      }];
    });
  }, []);
  
  // Recording controls
  const startRecording = useCallback(() => {
    setIsRecording(true);
    recordedActionsRef.current = [];
    recordingStartRef.current = Date.now();
  }, []);
  
  const stopRecording = useCallback((): Macro | null => {
    if (!isRecording) return null;
    
    setIsRecording(false);
    const actions = recordedActionsRef.current;
    
    if (actions.length === 0) return null;
    
    const macro: Macro = {
      id: generateId(),
      name: `Macro ${macros.length + 1}`,
      actions,
      createdAt: new Date(),
      playCount: 0,
    };
    
    setMacros(prev => [...prev, macro]);
    recordedActionsRef.current = [];
    
    return macro;
  }, [isRecording, macros.length]);
  
  const cancelRecording = useCallback(() => {
    setIsRecording(false);
    recordedActionsRef.current = [];
  }, []);
  
  // Play macro
  const playMacro = useCallback((id: string) => {
    const macro = macros.find(m => m.id === id);
    if (!macro) return;
    
    // Execute actions with timing
    let delay = 0;
    macro.actions.forEach((action, i) => {
      const nextAction = macro.actions[i + 1];
      const actionDelay = nextAction ? nextAction.timestamp - action.timestamp : 0;
      
      setTimeout(() => {
        // Simulate the action
        const binding = shortcuts.find(s => keysMatch(s.keys, action.keys));
        if (binding) {
          binding.action();
        }
      }, delay);
      
      delay += Math.min(actionDelay, 100); // Cap delay at 100ms for responsiveness
    });
    
    // Update play count
    setMacros(prev => prev.map(m => 
      m.id === id ? { ...m, playCount: m.playCount + 1 } : m
    ));
  }, [macros, shortcuts]);
  
  // Delete macro
  const deleteMacro = useCallback((id: string) => {
    setMacros(prev => prev.filter(m => m.id !== id));
  }, []);
  
  // Toggle hints
  const toggleHints = useCallback(() => {
    setShowHints(prev => !prev);
  }, []);
  
  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = normalizeKey(event);
      
      // Record if recording
      if (isRecording) {
        recordedActionsRef.current.push({
          type: 'keypress',
          keys: [key],
          timestamp: Date.now() - recordingStartRef.current,
        });
      }
      
      // Mode switching (Escape always returns to normal mode)
      if (event.key === 'Escape') {
        if (mode === 'leader') {
          setPendingLeaderKeys([]);
          if (leaderTimerRef.current) {
            clearTimeout(leaderTimerRef.current);
          }
        }
        setMode('normal');
        return;
      }
      
      // Insert mode - pass through most keys except mode switches
      if (mode === 'insert') {
        // Check for insert-mode specific shortcuts
        const binding = shortcuts.find(s => 
          keysMatch(s.keys, [key]) &&
          (!s.modes || s.modes.includes('insert')) &&
          (!s.context || s.context === currentContext || s.context === 'global')
        );
        
        if (binding) {
          event.preventDefault();
          binding.action();
          trackShortcutUse(binding.id);
        }
        return;
      }
      
      // Normal mode - Vim-like navigation
      if (mode === 'normal') {
        // Check for leader key
        if (key === leaderKey || (pendingLeaderKeys.length === 0 && key === 'Space')) {
          event.preventDefault();
          setMode('leader');
          setPendingLeaderKeys([]);
          
          leaderTimerRef.current = window.setTimeout(() => {
            setMode('normal');
            setPendingLeaderKeys([]);
          }, leaderTimeout);
          return;
        }
        
        // Mode switches
        if (key === 'I') {
          event.preventDefault();
          setMode('insert');
          return;
        }
        if (key === 'V') {
          event.preventDefault();
          setMode('visual');
          return;
        }
        
        // Check bindings
        const binding = shortcuts.find(s => 
          keysMatch(s.keys, [key]) &&
          (!s.modes || s.modes.includes('normal')) &&
          (!s.context || s.context === currentContext || s.context === 'global')
        );
        
        if (binding) {
          event.preventDefault();
          binding.action();
          trackShortcutUse(binding.id);
        }
        return;
      }
      
      // Leader mode - wait for sequence
      if (mode === 'leader') {
        event.preventDefault();
        
        // Clear and reset timer
        if (leaderTimerRef.current) {
          clearTimeout(leaderTimerRef.current);
        }
        
        const newPending = [...pendingLeaderKeys, key];
        setPendingLeaderKeys(newPending);
        
        // Find matching binding
        const binding = shortcuts.find(s => 
          keysMatch(s.keys, newPending) &&
          (!s.context || s.context === currentContext || s.context === 'global')
        );
        
        if (binding) {
          binding.action();
          trackShortcutUse(binding.id);
          setMode('normal');
          setPendingLeaderKeys([]);
          return;
        }
        
        // Check if any binding starts with this sequence
        const hasPartialMatch = shortcuts.some(s => {
          if (s.keys.length <= newPending.length) return false;
          return newPending.every((k, i) => k.toLowerCase() === s.keys[i]?.toLowerCase());
        });
        
        if (hasPartialMatch) {
          // Keep waiting
          leaderTimerRef.current = window.setTimeout(() => {
            setMode('normal');
            setPendingLeaderKeys([]);
          }, leaderTimeout);
        } else {
          // No match found
          setMode('normal');
          setPendingLeaderKeys([]);
        }
        return;
      }
      
      // Visual mode
      if (mode === 'visual') {
        if (key === 'Escape' || key === 'V') {
          setMode('normal');
          return;
        }
        
        const binding = shortcuts.find(s => 
          keysMatch(s.keys, [key]) &&
          s.modes?.includes('visual') &&
          (!s.context || s.context === currentContext || s.context === 'global')
        );
        
        if (binding) {
          event.preventDefault();
          binding.action();
          trackShortcutUse(binding.id);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    mode,
    setMode,
    shortcuts,
    currentContext,
    isRecording,
    leaderKey,
    leaderTimeout,
    pendingLeaderKeys,
    trackShortcutUse,
  ]);
  
  const value: KeyboardContextValue = {
    mode,
    setMode,
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
    macros,
    playMacro,
    deleteMacro,
    registerShortcut,
    unregisterShortcut,
    leaderKey,
    setLeaderKey,
    leaderTimeout,
    setLeaderTimeout,
    showHints,
    toggleHints,
    analytics,
    currentContext,
    setContext: setCurrentContext,
    pendingLeaderKeys,
  };
  
  return (
    <KeyboardContext.Provider value={value}>
      {children}
    </KeyboardContext.Provider>
  );
}

// ============================================================
// Mode Indicator
// ============================================================

interface ModeIndicatorProps {
  className?: string;
  showKeySequence?: boolean;
}

export function ModeIndicator({ className, showKeySequence = true }: ModeIndicatorProps) {
  const { mode, pendingLeaderKeys, isRecording } = useKeyboard();
  
  const modeConfig = {
    normal: { label: 'NORMAL', icon: Eye, color: 'bg-blue-500' },
    insert: { label: 'INSERT', icon: Edit3, color: 'bg-green-500' },
    visual: { label: 'VISUAL', icon: Copy, color: 'bg-purple-500' },
    leader: { label: 'LEADER', icon: Zap, color: 'bg-yellow-500' },
  };
  
  const config = modeConfig[mode];
  const Icon = config.icon;
  
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-white font-mono text-sm',
        config.color,
        className
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="font-bold">{config.label}</span>
      
      {showKeySequence && pendingLeaderKeys.length > 0 && (
        <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">
          {formatKeyCombo(pendingLeaderKeys)}
        </span>
      )}
      
      {isRecording && (
        <span className="ml-2 flex items-center gap-1 text-red-200">
          <Circle className="w-3 h-3 fill-red-400 animate-pulse" />
          REC
        </span>
      )}
    </div>
  );
}

// ============================================================
// Shortcut Hints Overlay
// ============================================================

interface ShortcutHintsOverlayProps {
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export function ShortcutHintsOverlay({
  className,
  position = 'bottom-right',
}: ShortcutHintsOverlayProps) {
  const { showHints, mode, currentContext } = useKeyboard();
  const [bindings, setBindings] = useState<KeyBinding[]>([]);
  
  // Get relevant shortcuts for current mode and context
  // (In real app, this would come from registered shortcuts)
  useEffect(() => {
    // Demo bindings for display purposes (action is noop since these are just hints)
    const noop = () => {};
    const demoBindings: KeyBinding[] = [
      { id: '1', keys: ['J'], description: 'Move down', modes: ['normal'], category: 'Navigation', action: noop },
      { id: '2', keys: ['K'], description: 'Move up', modes: ['normal'], category: 'Navigation', action: noop },
      { id: '3', keys: ['G', 'G'], description: 'Go to top', modes: ['normal'], category: 'Navigation', action: noop },
      { id: '4', keys: ['Shift+G'], description: 'Go to bottom', modes: ['normal'], category: 'Navigation', action: noop },
      { id: '5', keys: ['Space', 'F'], description: 'Find files', modes: ['normal'], category: 'Leader', action: noop },
      { id: '6', keys: ['Space', 'S'], description: 'Save', modes: ['normal'], category: 'Leader', action: noop },
      { id: '7', keys: ['I'], description: 'Insert mode', modes: ['normal'], category: 'Mode', action: noop },
      { id: '8', keys: ['V'], description: 'Visual mode', modes: ['normal'], category: 'Mode', action: noop },
      { id: '9', keys: ['Escape'], description: 'Normal mode', modes: ['insert', 'visual'], category: 'Mode', action: noop },
      { id: '10', keys: ['Y'], description: 'Copy selection', modes: ['visual'], category: 'Edit', action: noop },
      { id: '11', keys: ['D'], description: 'Delete selection', modes: ['visual'], category: 'Edit', action: noop },
    ];
    
    setBindings(demoBindings.filter(b => !b.modes || b.modes.includes(mode)));
  }, [mode, currentContext]);
  
  if (!showHints) return null;
  
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };
  
  // Group by category
  const grouped = bindings.reduce((acc, b) => {
    const cat = b.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(b);
    return acc;
  }, {} as Record<string, KeyBinding[]>);
  
  return (
    <div
      className={clsx(
        'fixed z-50 max-w-xs w-full bg-gray-900/95 backdrop-blur-sm',
        'rounded-lg shadow-2xl border border-gray-700 overflow-hidden',
        positionClasses[position],
        className
      )}
    >
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-300">
          <Keyboard className="w-4 h-4" />
          <span className="font-medium text-sm">Keyboard Shortcuts</span>
        </div>
        <span className="text-xs text-gray-500 capitalize">{mode} mode</span>
      </div>
      
      <div className="max-h-80 overflow-y-auto p-2 space-y-3">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 px-2">
              {category}
            </div>
            <div className="space-y-0.5">
              {items.map(b => (
                <div
                  key={b.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-800"
                >
                  <span className="text-sm text-gray-300">{b.description}</span>
                  <div className="flex items-center gap-1">
                    {b.keys.map((key, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && (
                          <ChevronRight className="w-3 h-3 text-gray-600" />
                        )}
                        <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-700 rounded border border-gray-600 text-gray-300">
                          {formatKeyForDisplay(key)}
                        </kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          Press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-400">?</kbd> to toggle
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Macro Manager
// ============================================================

interface MacroManagerProps {
  className?: string;
}

export function MacroManager({ className }: MacroManagerProps) {
  const {
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
    macros,
    playMacro,
    deleteMacro,
  } = useKeyboard();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  const handleSaveName = (id: string) => {
    // In real implementation, would update macro name
    setEditingId(null);
  };
  
  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden',
        className
      )}
    >
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Macros
          </h3>
          
          <div className="flex items-center gap-2">
            {isRecording ? (
              <>
                <button
                  onClick={() => stopRecording()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={cancelRecording}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={startRecording}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <Circle className="w-3 h-3 fill-current" />
                Record
              </button>
            )}
          </div>
        </div>
        
        {isRecording && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <Circle className="w-3 h-3 fill-current animate-pulse" />
            Recording... Perform actions to capture
          </div>
        )}
      </div>
      
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {macros.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            <Keyboard className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No macros recorded yet</p>
            <p className="text-xs mt-1">Click Record to start capturing actions</p>
          </div>
        ) : (
          macros.map(macro => (
            <div
              key={macro.id}
              className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex-1 min-w-0">
                {editingId === macro.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => handleSaveName(macro.id)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName(macro.id)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                    autoFocus
                  />
                ) : (
                  <div
                    className="font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600"
                    onClick={() => {
                      setEditingId(macro.id);
                      setEditName(macro.name);
                    }}
                  >
                    {macro.name}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-0.5">
                  {macro.actions.length} actions • Played {macro.playCount} times
                </div>
              </div>
              
              <div className="flex items-center gap-1 ml-4">
                {macro.trigger && (
                  <div className="flex items-center gap-0.5 mr-2">
                    {macro.trigger.map((key, i) => (
                      <kbd
                        key={i}
                        className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                      >
                        {formatKeyForDisplay(key)}
                      </kbd>
                    ))}
                  </div>
                )}
                
                <button
                  onClick={() => playMacro(macro.id)}
                  className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                  title="Play macro"
                >
                  <Play className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => deleteMacro(macro.id)}
                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  title="Delete macro"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// Shortcut Key Display
// ============================================================

interface ShortcutKeyProps {
  keys: string[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ShortcutKey({ keys, size = 'md', className }: ShortcutKeyProps) {
  const sizeClasses = {
    sm: 'text-xs px-1 py-0.5',
    md: 'text-sm px-1.5 py-0.5',
    lg: 'text-base px-2 py-1',
  };
  
  return (
    <div className={clsx('inline-flex items-center gap-1', className)}>
      {keys.map((key, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span className="text-gray-400 dark:text-gray-500">+</span>
          )}
          <kbd
            className={clsx(
              'font-mono bg-gray-100 dark:bg-gray-700 rounded',
              'border border-gray-200 dark:border-gray-600',
              'text-gray-700 dark:text-gray-300',
              'shadow-sm',
              sizeClasses[size]
            )}
          >
            {formatKeyForDisplay(key)}
          </kbd>
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================
// Analytics Dashboard
// ============================================================

interface ShortcutAnalyticsDashboardProps {
  className?: string;
}

export function ShortcutAnalyticsDashboard({ className }: ShortcutAnalyticsDashboardProps) {
  const { analytics } = useKeyboard();
  
  const sortedByUse = [...analytics].sort((a, b) => b.useCount - a.useCount);
  const totalUses = analytics.reduce((sum, a) => sum + a.useCount, 0);
  
  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden',
        className
      )}
    >
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500" />
          Shortcut Analytics
        </h3>
      </div>
      
      <div className="p-4">
        <div className="text-3xl font-bold text-gray-900 dark:text-white">
          {totalUses}
        </div>
        <div className="text-sm text-gray-500 mb-4">Total shortcut uses</div>
        
        <div className="space-y-2">
          {sortedByUse.slice(0, 5).map((stat, i) => (
            <div
              key={stat.shortcutId}
              className="flex items-center justify-between"
            >
              <span className="text-sm text-gray-600 dark:text-gray-300">
                #{i + 1} Shortcut
              </span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${(stat.useCount / totalUses) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white w-8 text-right">
                  {stat.useCount}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// useShortcut Hook
// ============================================================

interface UseShortcutOptions {
  keys: string[];
  description: string;
  action: () => void;
  modes?: KeyboardMode[];
  context?: string;
  enabled?: boolean;
}

export function useShortcut({
  keys,
  description,
  action,
  modes,
  context,
  enabled = true,
}: UseShortcutOptions) {
  const { registerShortcut, unregisterShortcut } = useKeyboard();
  const idRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (enabled) {
      idRef.current = registerShortcut({
        keys,
        description,
        action,
        modes,
        context,
      });
    }
    
    return () => {
      if (idRef.current) {
        unregisterShortcut(idRef.current);
        idRef.current = null;
      }
    };
  }, [keys.join(','), description, enabled, modes?.join(','), context]);
  
  return idRef.current;
}

// ============================================================
// Default Exports
// ============================================================

export default KeyboardProvider;
