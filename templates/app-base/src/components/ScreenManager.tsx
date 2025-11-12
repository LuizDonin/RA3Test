import React, { useState, useEffect } from 'react'
import { LoadingScreen } from './screens/LoadingScreen'
import { CoverScreen } from './screens/CoverScreen'
import { TutorialScreen } from './screens/TutorialScreen'
import { TutorialScreen2 } from './screens/TutorialScreen2'
import { RocketScreen } from './screens/RocketScreen'
import { ARScreen } from './screens/ARScreen'
import { ResultScreen } from './screens/ResultScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { AboutScreen } from './screens/AboutScreen'
import { FinalScreen } from './screens/FinalScreen'
import { SelfieScreen } from './screens/SelfieScreen'
import { Quiz1 } from './screens/Quiz1'
// import { RADataDisplay } from './RADataDisplay' // Removido
import type { ScreenType, TransitionType, TransitionDirection } from '../types/screens'
import '../styles/screens.css'

interface ScreenManagerProps {
  initialScreen: ScreenType
  appConfig: {
    title: string
    subtitle: string
    version: string
    developer: string
  }
  // Configuração de transição padrão
  defaultTransition?: TransitionType
  defaultDirection?: TransitionDirection
}

// Transições
/*
fade: 'fade',
slide-horizontal: 'slide-horizontal',
slide-vertical: 'slide-vertical',
zoom-in: 'zoom-in',
zoom-out: 'zoom-out',
flip: 'flip',
none: 'none'
 */

export const ScreenManager: React.FC<ScreenManagerProps> = ({
  initialScreen = 'loading',
  appConfig,
  defaultTransition = 'zoom-out',
  defaultDirection = 'right'
}) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(initialScreen || 'loading')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionType, setTransitionType] = useState<TransitionType>(defaultTransition)
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>(defaultDirection)
  const [previousScreen, setPreviousScreen] = useState<ScreenType | null>(null)

  // Debug: logar a tela inicial
  useEffect(() => {
    console.log('🎬 ScreenManager inicializado com tela:', currentScreen)
  }, [])

  // Atualizar previousScreen quando a transição terminar
  useEffect(() => {
    if (!isTransitioning) {
      // Limpar previousScreen após um delay para não interferir em próximas transições
      const timeout = setTimeout(() => {
        if (currentScreen !== 'loading') {
          setPreviousScreen(null)
        }
      }, 1000)

      return () => clearTimeout(timeout)
    }
  }, [currentScreen, isTransitioning])

  // Função para determinar direção automática baseada na ordem das telas
  const getAutoDirection = (from: ScreenType, to: ScreenType): TransitionDirection => {
    const screenOrder = ['loading', 'cover', 'tutorial', 'ar', 'quiz1', 'resultado', 'final', 'settings', 'about', 'selfie']
    const fromIndex = screenOrder.indexOf(from)
    const toIndex = screenOrder.indexOf(to)

    // Se alguma tela não estiver na lista, usar direção padrão
    if (fromIndex === -1 || toIndex === -1) {
      return 'right'
    }

    if (toIndex > fromIndex) return 'right'
    if (toIndex < fromIndex) return 'left'
    return 'right'
  }

  const navigateTo = (
    screen: ScreenType,
    transition?: TransitionType,
    direction?: TransitionDirection
  ) => {
    console.log('🧭 navigateTo chamado:', { from: currentScreen, to: screen, transition, direction })
    
    const finalTransition = transition || transitionType
    const finalDirection = direction || getAutoDirection(currentScreen, screen)

    // Salvar tela atual antes de começar transição
    setPreviousScreen(currentScreen)
    setTransitionType(finalTransition)
    setTransitionDirection(finalDirection)

    // Duração maior para transição do loading
    const duration = currentScreen === 'loading' ? 800 : 300

    setIsTransitioning(true)

    setTimeout(() => {
      console.log('✅ Mudando tela de', currentScreen, 'para', screen)
      setCurrentScreen(screen)
      setIsTransitioning(false)
    }, duration)
  }

  // Função para mudar o tipo de transição globalmente
  // const setGlobalTransition = (type: TransitionType) => {
  //   setTransitionType(type)
  // }

  const renderScreen = () => {
    console.log('🎨 renderScreen chamado para:', currentScreen)
    
    switch (currentScreen) {
      case 'loading':
        return <LoadingScreen onNavigate={navigateTo} />
      case 'cover':
        return (
          <CoverScreen
            onNavigate={navigateTo}
            title={appConfig.title}
            subtitle={appConfig.subtitle}
          />
        )
      case 'tutorial':
        return <TutorialScreen onNavigate={navigateTo} />
      case 'rocket':
        return <RocketScreen onNavigate={navigateTo} />
      case 'tutorial2':
        return <TutorialScreen2 onNavigate={navigateTo} />
      case 'ar':
        return <ARScreen onNavigate={navigateTo} />
      case 'resultado':
        return <ResultScreen onNavigate={navigateTo} />
      case 'final':
        return <FinalScreen onNavigate={navigateTo} />
      case 'settings':
        return <SettingsScreen onNavigate={navigateTo} />
      case 'about':
        return <AboutScreen onNavigate={navigateTo} />
      case 'selfie':
        return <SelfieScreen onNavigate={navigateTo} />
      case 'quiz1':
        return <Quiz1 onNavigate={navigateTo} />
      default:
        console.warn('⚠️ Tela desconhecida:', currentScreen)
        return <LoadingScreen onNavigate={navigateTo} />
    }
  }

  // Gera classes CSS dinâmicas baseadas no tipo de transição
  const getTransitionClasses = () => {
    const baseClass = 'screen-manager'
    const transitionClass = `transition-${transitionType}`
    const directionClass = `direction-${transitionDirection}`
    const transitioningClass = isTransitioning ? 'transitioning' : ''
    const previousScreenClass = previousScreen ? `from-${previousScreen}` : ''

    return `${baseClass} ${transitionClass} ${directionClass} ${transitioningClass} ${previousScreenClass}`.trim()
  }

  return (
    <div className={getTransitionClasses()}>
      {/* Componente de dados do RA removido */}

      {renderScreen()}
    </div>
  )
}
