import React, { useEffect } from 'react'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import '../../styles/cover-screen.css'

interface CoverScreenProps {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

export const CoverScreen: React.FC<CoverScreenProps> = ({
  onNavigate,
  backgroundImage
}) => {
  // Solicitar permissão de device orientation e motion quando a tela montar
  useEffect(() => {
    const requestDevicePermissions = async () => {
      try {
        // Solicitar permissão de DeviceOrientationEvent (iOS 13+)
        if (typeof DeviceOrientationEvent !== 'undefined' && 
            typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          try {
            const permission = await (DeviceOrientationEvent as any).requestPermission()
            if (permission === 'granted') {
              console.log('✅ Permissão de device orientation concedida')
            } else {
              console.warn('⚠️ Permissão de device orientation negada')
            }
          } catch (err) {
            console.warn('⚠️ Erro ao solicitar permissão de device orientation:', err)
          }
        }

        // Solicitar permissão de DeviceMotionEvent (iOS 13+)
        if (typeof DeviceMotionEvent !== 'undefined' && 
            typeof (DeviceMotionEvent as any).requestPermission === 'function') {
          try {
            const permission = await (DeviceMotionEvent as any).requestPermission()
            if (permission === 'granted') {
              console.log('✅ Permissão de device motion concedida')
            } else {
              console.warn('⚠️ Permissão de device motion negada')
            }
          } catch (err) {
            console.warn('⚠️ Erro ao solicitar permissão de device motion:', err)
          }
        }

        // Android e outros navegadores não requerem permissão explícita
        if (typeof (DeviceOrientationEvent as any)?.requestPermission !== 'function' &&
            typeof (DeviceMotionEvent as any)?.requestPermission !== 'function') {
          console.log('ℹ️ Device orientation/motion disponível sem permissão explícita')
        }
      } catch (error) {
        console.warn('⚠️ Erro ao solicitar permissões de device:', error)
      }
    }

    // Pequeno delay para garantir que a tela está totalmente montada
    const timer = setTimeout(() => {
      requestDevicePermissions()
    }, 300)

    return () => clearTimeout(timer)
  }, [])

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

  const bgImage = backgroundImage || normalizePath('assets/images/bg-capa.png')
  const headerImage = normalizePath('assets/images/header-capa.png')
  const bottomImage = normalizePath('assets/images/bottom-capa.png')
  const btnJogarImage = normalizePath('assets/images/btn-jogar.png')

  return (
    <div
      className="cover-screen"
      style={{
        backgroundImage: `url("${bgImage}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Header Image */}
      <div className="cover-header-image">
        <img
          src={headerImage}
          alt="Header"
          className="cover-header-img"
        />
      </div>

      {/* Button - Começar Tutorial */}
      <div className="cover-content">
        <button
          className="cover-button-jogar"
          onClick={() => onNavigate('tutorial', 'zoom-out', 'right')}
          style={{
            backgroundImage: `url(${btnJogarImage})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center'
          }}
        />
      </div>

      {/* Bottom Image */}
      <div className="cover-bottom-image">
        <img
          src={bottomImage}
          alt="Bottom"
          className="cover-bottom-img"
        />
      </div>
    </div>
  )
}
