import React, { useEffect, useState } from 'react'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { LandscapeBlocker } from '../LandscapeBlocker'
import { initializeGlobal, requestDeviceOrientationPermission } from '../../utils/globalInit'
import { playClickSound } from '../../utils/soundUtils'
import '../../styles/tutorial-screen.css'

interface TutorialScreenProps {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

export const TutorialScreen: React.FC<TutorialScreenProps> = ({
  onNavigate
}) => {
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [showBlackScreen, setShowBlackScreen] = useState(false)
  const [showFadeOut, setShowFadeOut] = useState(false)
  const [showTutorialText, setShowTutorialText] = useState(false)
  const [showBtChamar, setShowBtChamar] = useState(false)

  // Inicializar A-Frame quando a tela montar (caso não tenha sido inicializado na CoverScreen)
  useEffect(() => {
    console.log('🎬 TutorialScreen montada - verificando A-Frame...')
    // Verificar se já foi inicializado
    const scene = document.querySelector('a-scene')
    if (!scene) {
      console.log('🎬 A-Frame não encontrado - inicializando...')
      initializeGlobal()
        .then(() => {
          console.log('✅ A-Frame inicializado na TutorialScreen')
        })
        .catch((error) => {
          console.error('❌ Erro ao inicializar A-Frame na TutorialScreen:', error)
        })
    } else {
      console.log('✅ A-Frame já estava inicializado')
    }
  }, [])

  // Função para iniciar a sequência de animações ao clicar em "Começar"
  const handleNavigateToAR = () => {
    if (isRequestingPermission) return

    playClickSound()
    setIsRequestingPermission(true)
    
    // Iniciar sequência de animações
    // 1. Fade out da tela
    setShowFadeOut(true)
    
    // 2. Após fade out, mostrar tutorialtext com scaleUp
    setTimeout(() => {
      setShowTutorialText(true)
    }, 500) // Tempo do fade out
    
    // 3. Após scaleUp, mostrar btchamar vindo de baixo
    setTimeout(() => {
      setShowBtChamar(true)
      setIsRequestingPermission(false) // Reabilitar após animações
    }, 1000) // Tempo do fade out + scaleUp
  }

  // Função para lidar com a navegação para ARScreen ao clicar no btchamar
  const handleBtChamarClick = async () => {
    if (isRequestingPermission) return

    playClickSound()
    setIsRequestingPermission(true)
    
    // Mostrar tela preta antes de navegar
    setShowBlackScreen(true)
    
    try {
      // Solicitar permissão de orientação do dispositivo antes de navegar
      console.log('Solicitando permissão de orientação do dispositivo...')
      const permission = await requestDeviceOrientationPermission()
      
      if (permission === 'granted' || permission === null) {
        // Permissão concedida ou não necessária - navegar para AR
        console.log('Permissão concedida ou não necessária, navegando para ARScreen')
        onNavigate('ar', 'fade', 'right')
      } else if (permission === 'denied') {
        // Permissão negada - ainda assim navegar, mas avisar o usuário
        console.warn('Permissão de orientação negada, mas navegando mesmo assim')
        onNavigate('ar', 'fade', 'right')
      } else {
        // Prompt ainda pendente - navegar mesmo assim
        console.log('Prompt de permissão pendente, navegando para ARScreen')
        onNavigate('ar', 'fade', 'right')
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error)
      // Em caso de erro, navegar mesmo assim
      onNavigate('ar', 'fade', 'right')
    } finally {
      setIsRequestingPermission(false)
    }
  }

  // Get base URL from vite config or use current location
  const getBaseUrl = () => {
    const base = (import.meta as any)?.env?.BASE_URL || (document?.baseURI ? new URL(document.baseURI).pathname : '/')
    const b = base && base !== '/' ? (base.endsWith('/') ? base : base + '/') : '/'
    return b === '/' ? '' : b.endsWith('/') ? b.slice(0, -1) : b
  }

  const baseUrl = getBaseUrl()
  // Garantir que o caminho comece com / se baseUrl estiver vazio
  const normalizePath = (path: string) => {
    if (baseUrl === '') {
      return path.startsWith('/') ? path : `/${path}`
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `${baseUrl}/${cleanPath}`
  }

  const bgImage = normalizePath('assets/images/bg.png')
  const tutorialPanelImage = normalizePath('assets/images/tutorial-panel.png')
  const btnComecarImage = normalizePath('assets/images/btn-comecar.png')
  const tutorialTextImage = normalizePath('assets/images/tutorialtext.png')
  const btChamarImage = normalizePath('assets/images/btchamar.png')

  return (
    <>
      <LandscapeBlocker />
      {/* Tela preta que aparece imediatamente ao clicar em "Começar" */}
      {showBlackScreen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000000',
            zIndex: 999999999,
            pointerEvents: 'none',
            transition: 'opacity 0.1s ease-out'
          }}
        />
      )}
      <div
        className="tutorial-screen"
        style={{
          backgroundImage: `url("${bgImage}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
      {/* Overlay de fade out */}
      {showFadeOut && (
        <div className="tutorial-fade-overlay" />
      )}

      {/* Imagem central do tutorial */}
      <div className="tutorial-panel-container">
        <img
          src={tutorialPanelImage}
          alt="Tutorial Panel"
          className="tutorial-panel-image"
        />
      </div>

      {/* Imagem tutorialtext com scaleUp */}
      {showTutorialText && (
        <div className="tutorial-text-container">
          <img
            src={tutorialTextImage}
            alt="Tutorial Text"
            className="tutorial-text-image"
          />
        </div>
      )}

      {/* Botão Começar RA */}
      <div className="tutorial-button-container">
        <button
          className="tutorial-button-comecar"
          onClick={handleNavigateToAR}
          disabled={isRequestingPermission}
          style={{
            backgroundImage: `url("${btnComecarImage}")`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: isRequestingPermission ? 0.7 : 1,
            cursor: isRequestingPermission ? 'wait' : 'pointer'
          }}
        />
      </div>

      {/* Botão Chamar vindo de baixo */}
      {showBtChamar && (
        <div className="tutorial-btchamar-container">
          <button
            className="tutorial-button-chamar"
            onClick={handleBtChamarClick}
            disabled={isRequestingPermission}
            style={{
              backgroundImage: `url("${btChamarImage}")`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              opacity: isRequestingPermission ? 0.7 : 1,
              cursor: isRequestingPermission ? 'wait' : 'pointer'
            }}
          />
        </div>
      )}
    </div>
    </>
  )
}
