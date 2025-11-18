import React, { useState, useEffect } from 'react'

export const LandscapeBlocker: React.FC = () => {
  const [isBlocked, setIsBlocked] = useState(false)

  const checkOrientation = () => {
    // Múltiplas formas de detectar landscape
    const width = window.innerWidth
    const height = window.innerHeight
    const isLandscape = width > height
    
    // SEMPRE bloquear se estiver em landscape (forçado)
    if (isLandscape) {
      setIsBlocked(true)
      // Desabilitar interações com elementos abaixo
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
    } else {
      setIsBlocked(false)
      // Reabilitar interações
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }

  useEffect(() => {
    // Verificar orientação inicial
    checkOrientation()

    // Adicionar listeners com debounce para evitar muitas chamadas
    let resizeTimeout: NodeJS.Timeout
    let orientationTimeout: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        checkOrientation()
      }, 100)
    }

    const handleOrientationChange = () => {
      clearTimeout(orientationTimeout)
      orientationTimeout = setTimeout(() => {
        checkOrientation()
      }, 300)
    }

    const handleScreenOrientationChange = () => {
      clearTimeout(orientationTimeout)
      orientationTimeout = setTimeout(() => {
        checkOrientation()
      }, 300)
    }

    const handleMediaQueryChange = (e: MediaQueryListEvent) => {
      clearTimeout(orientationTimeout)
      orientationTimeout = setTimeout(() => {
        checkOrientation()
      }, 100)
    }

    // Listener para redimensionamento da janela
    window.addEventListener('resize', handleResize)
    
    // Listener para mudança de orientação
    window.addEventListener('orientationchange', handleOrientationChange)
    
    // Listener para mudança de orientação em dispositivos móveis
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handleScreenOrientationChange)
    }
    
    // Listener para mudança de orientação usando matchMedia
    const mediaQuery = window.matchMedia('(orientation: landscape)')
    mediaQuery.addEventListener('change', handleMediaQueryChange)

    // Verificar periodicamente para garantir que não perdeu nenhum evento
    const intervalCheck = setInterval(() => {
      checkOrientation()
    }, 2000)

    return () => {
      clearTimeout(resizeTimeout)
      clearTimeout(orientationTimeout)
      clearInterval(intervalCheck)
      
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', handleScreenOrientationChange)
      }
      mediaQuery.removeEventListener('change', handleMediaQueryChange)
      
      // Reabilitar interações ao desmontar
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [])

  // Só renderizar o overlay quando bloqueado
  if (!isBlocked) return null

  return (
    <div 
      className="landscape-blocker"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999999,
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        pointerEvents: 'auto'
      }}
    >
      {/* Ícone de rotação */}
      <div 
        style={{
          width: '80px',
          height: '80px',
          marginBottom: '20px',
          fontSize: '60px',
          animation: 'rotate 2s ease-in-out infinite'
        }}
      >
        📱
      </div>
      
      {/* Texto informativo */}
      <h2 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>
        Gire seu dispositivo
      </h2>
      
      <p style={{ margin: '0', fontSize: '16px', opacity: 0.9 }}>
        Para uma melhor experiência de Realidade Aumentada, 
        mantenha seu dispositivo na orientação retrato (vertical).
      </p>
      
      {/* CSS para animação */}
      <style>
        {`
          @keyframes rotate {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(90deg); }
          }
        `}
      </style>
    </div>
  )
}
