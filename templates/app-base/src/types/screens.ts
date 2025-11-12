export type ScreenType = 'loading' | 'cover' | 'tutorial' | 'tutorial2' | 'rocket' | 'ar' | 'resultado' | 'settings' | 'about' | 'final' | 'selfie' | 'custom' | 'quiz1'

export type TransitionType =
  | 'fade'
  | 'slide-horizontal'
  | 'slide-vertical'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'flip'
  | 'none'

export type TransitionDirection = 'left' | 'right' | 'up' | 'down'

export interface Screen {
  id: string
  type: ScreenType
  title: string
  description?: string
  component: React.ComponentType<any>
  props?: Record<string, any>
  isActive?: boolean
  canGoBack?: boolean
  canGoNext?: boolean
}

export interface ScreenTransition {
  from: ScreenType
  to: ScreenType
  animation: 'slide' | 'fade' | 'zoom' | 'none'
  duration?: number
}

export interface ScreenManagerState {
  currentScreen: ScreenType
  previousScreen: ScreenType | null
  screens: Screen[]
  isTransitioning: boolean
  history: ScreenType[]
}

export interface ScreenManagerActions {
  navigateTo: (screenType: ScreenType, props?: Record<string, any>) => void
  goBack: () => void
  goNext: () => void
  addScreen: (screen: Screen) => void
  removeScreen: (screenId: string) => void
  updateScreen: (screenId: string, updates: Partial<Screen>) => void
}
