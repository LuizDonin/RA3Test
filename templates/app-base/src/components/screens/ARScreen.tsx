import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { LandscapeBlocker } from '../LandscapeBlocker'
import { useRA } from '../../contexts/RAContext'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { playClickSound, playErrorSound, playSuccessSound } from '../../utils/soundUtils'
import { ARSceneAFrame, type ARSceneAFrameRef } from '../ARSceneAFrame'
import '../../styles/ar-screen.css'

interface ARScreenProps {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

type FolderName = 'Anita' | 'Chiquinha'
type Phase = 'initial' | 'ar' | 'dialogos' | 'menu' | 'historia' | 'quiz' | 'feedback-negativo' | 'feedback-positivo' | 'dicas'

export const ARScreen: React.FC<ARScreenProps> = ({
  onNavigate: _onNavigate
}) => {
  const { raData } = useRA()
  const config = raData?.configuracoes || {}
  const usarVideo = config.usarVideo !== false

  const [selectedFolder] = useState<FolderName>(() => {
    const folders: FolderName[] = ['Anita', 'Chiquinha']
    const selected = folders[Math.floor(Math.random() * folders.length)]
    console.log('📁 Pasta selecionada:', selected)
    return selected
  })

  const [phase, setPhase] = useState<Phase>('initial')
  const [arLoading, setArLoading] = useState(false)
  const [blackCanvasOpacity, setBlackCanvasOpacity] = useState(1)
  const [isFadingIn, setIsFadingIn] = useState(true)
  const [arMounted, setArMounted] = useState(false)
  const [initialFadeOpacity, setInitialFadeOpacity] = useState(1)

  const [frontCameraActive, setFrontCameraActive] = useState(false)
  const [showPequenoOverlay, setShowPequenoOverlay] = useState(false)
  const [registrouPequeno, setRegistrouPequeno] = useState(false)
  const [pequenoImgSize, setPequenoImgSize] = useState<{width: number, height: number}>({width: 0, height: 0})
  const pequenoImgRef = useRef<HTMLImageElement>(null)

  // ------ CAMERA OVERLAY SHOT FUNCTIONALITY ------
  // New refs for dom capturing
  const overlayContainerRef = useRef<HTMLDivElement>(null)
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    console.log('📱 Fase atual:', phase)
  }, [phase])

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const arSceneRef = useRef<ARSceneAFrameRef>(null)
  const pequenoEntityId = useRef<string>('')

  const [dialogIndex, setDialogIndex] = useState(1)
  const [showBtVoltar, setShowBtVoltar] = useState(false)
  const [historiaIndex, setHistoriaIndex] = useState(1)
  const [quizPerguntaIndex, setQuizPerguntaIndex] = useState(1)
  const [showRespostas, setShowRespostas] = useState(false)
  const [mostrarDicaDialog, setMostrarDicaDialog] = useState(false)
  const [dicaDialogIndex, setDicaDialogIndex] = useState(1)

  // Shake state for quiz respostas (for error animation)
  const [shake, setShake] = useState(false)
  const shakeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const getBaseUrl = () => {
    const base = (import.meta as any)?.env?.BASE_URL || (document?.baseURI ? new URL(document.baseURI).pathname : '/')
    const b = base && base !== '/' ? (base.endsWith('/') ? base : base + '/') : '/'
    return b === '/' ? '' : b.endsWith('/') ? b.slice(0, -1) : b
  }

  const baseUrl = useMemo(() => getBaseUrl(), [])
  const normalizePath = useCallback((path: string) => {
    if (baseUrl === '') {
      return path.startsWith('/') ? path : `/${path}`
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `${baseUrl}/${cleanPath}`
  }, [baseUrl])

  const btAvancarImg = useMemo(() => normalizePath('assets/images/btavancar.png'), [normalizePath])
  const btVoltarImg = useMemo(() => normalizePath('assets/images/btvoltar.png'), [normalizePath])
  const btnVoltarImg = useMemo(() => normalizePath('assets/images/btn-voltar.png'), [normalizePath])
  const btHistoriaImg = useMemo(() => normalizePath('assets/images/bthistoria.png'), [normalizePath])
  const btQuizImg = useMemo(() => normalizePath('assets/images/btquiz.png'), [normalizePath])
  const btConcluirImg = useMemo(() => normalizePath('assets/images/btconcluir.png'), [normalizePath])
  const btnRegistrarImg = useMemo(() => normalizePath('assets/images/btn-registrar.png'), [normalizePath])
  const btnInicioImg = useMemo(() => normalizePath('assets/images/btn-inicio.png'), [normalizePath])
  const feedbackNegativoImg = useMemo(() => normalizePath('assets/images/feedbacknegativo.png'), [normalizePath])
  const feedbackPositivoImg = useMemo(() => normalizePath('assets/images/feedbackpositivo.png'), [normalizePath])
  const bgClaroImg = useMemo(() => normalizePath(`assets/images/${selectedFolder}/bgclaro.png`), [normalizePath, selectedFolder])
  const grandeImg = useMemo(() => normalizePath(`assets/images/${selectedFolder}/grande.png`), [normalizePath, selectedFolder])
  const pequenoImg = useMemo(() => normalizePath(`assets/images/${selectedFolder}/pequeno.png`), [normalizePath, selectedFolder])
  const dialogo1Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/dialogo1.png`), [normalizePath, selectedFolder])
  const dialogo2Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/dialogo2.png`), [normalizePath, selectedFolder])
  const historia1Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/historia1.png`), [normalizePath, selectedFolder])
  const historia2Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/historia2.png`), [normalizePath, selectedFolder])
  const historia3Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/historia3.png`), [normalizePath, selectedFolder])
  const pergunta1Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/pergunta1.png`), [normalizePath, selectedFolder])
  const pergunta2Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/pergunta2.png`), [normalizePath, selectedFolder])
  const resposta1Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/resposta1.png`), [normalizePath, selectedFolder])
  const resposta2Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/resposta2.png`), [normalizePath, selectedFolder])
  const resposta3Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/resposta3.png`), [normalizePath, selectedFolder])
  const dica1Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/dica1.png`), [normalizePath, selectedFolder])
  const dica2Img = useMemo(() => normalizePath(`assets/images/${selectedFolder}/dica2.png`), [normalizePath, selectedFolder])

  // New overlays
  const hjeUConheciImg = useMemo(() => normalizePath('assets/images/hjeuconheci.png'), [normalizePath])
  const cameraIconImg = useMemo(() => normalizePath('assets/images/camera-icon.png'), [normalizePath])

  useEffect(() => {
    setBlackCanvasOpacity(1)
    const timeout = setTimeout(() => {
      setBlackCanvasOpacity(0)
    }, 50)
    return () => {
      clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'initial') return
    setInitialFadeOpacity(1)
    const delay = 550
    const fakeSplashDuration = 1000
    let fadeTimeout: NodeJS.Timeout
    let phaseTimeout: NodeJS.Timeout
    let frame: number

    const startFade = () => {
      const fadeDuration = 900
      const start = Date.now()
      function step() {
        const elapsed = Date.now() - start
        const t = Math.min(1, elapsed / fadeDuration)
        setInitialFadeOpacity(1 - t)
        if (t < 1) {
          frame = requestAnimationFrame(step)
        } else {
          setInitialFadeOpacity(0)
          phaseTimeout = setTimeout(() => {
            handleTransitionToAR_auto()
          }, 100)
        }
      }
      frame = requestAnimationFrame(step)
    }

    fadeTimeout = setTimeout(() => {
      startFade()
    }, fakeSplashDuration + delay)

    return () => {
      if (fadeTimeout) clearTimeout(fadeTimeout)
      if (phaseTimeout) clearTimeout(phaseTimeout)
      if (frame) cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line
  }, [phase, grandeImg, bgClaroImg])

  const handleTransitionToAR_auto = () => {
    setPhase('dialogos')
    setDialogIndex(1)
    setShowBtVoltar(false)
    if (!arMounted) { setArMounted(true) }
  }

  // ---- Camera setup logic supporting front camera for "registrar" ----
  useEffect(() => {
    if (!arMounted || !usarVideo) {
      return
    }
    async function setupCamera() {
      // Usar o valor atualizado de frontCameraActive diretamente
      const shouldUseFront = frontCameraActive
      
      setArLoading(true)
      try {
        // Verificar se já existe um stream e se precisa trocar
        const currentStream = mediaStreamRef.current
        const currentVideo = videoRef.current
        let needsSwitch = false

        if (currentStream && currentVideo) {
          // Verificar qual câmera está sendo usada atualmente
          const videoTrack = currentStream.getVideoTracks()[0]
          if (videoTrack) {
            const currentSettings = videoTrack.getSettings()
            const currentFacingMode = currentSettings.facingMode
            const desiredFacingMode = shouldUseFront ? 'user' : 'environment'
            
            // Se a câmera atual é diferente da desejada, precisa trocar
            needsSwitch = currentFacingMode !== desiredFacingMode
            console.log(`[ARScreen] Câmera atual: ${currentFacingMode}, desejada: ${desiredFacingMode}, precisa trocar: ${needsSwitch}`)
          }
        }

        // Se não precisa trocar e o vídeo já existe, apenas mostrar
        if (!needsSwitch && currentVideo && currentStream) {
          currentVideo.style.display = 'block'
          currentVideo.style.visibility = 'visible'
          currentVideo.style.opacity = '0'
          currentVideo.style.zIndex = '0'
          currentVideo.style.transition = 'opacity 0.6s ease-in'
          setArLoading(false)
          setTimeout(() => {
            setIsFadingIn(true)
            if (currentVideo) {
              currentVideo.style.opacity = '1'
            }
          }, 100)
          return
        }

        // Stop old stream if switching camera
        if (currentVideo && currentStream) {
          const tracks = currentStream.getTracks()
          tracks.forEach((t) => t.stop())
          currentVideo.remove()
          videoRef.current = null
          mediaStreamRef.current = null
        }

        // IGNORAR cameraFacing do ra.json quando forçar câmera frontal para selfie
        // Sempre usar 'user' (frontal) quando shouldUseFront=true, independente da configuração
        const facingMode = shouldUseFront ? 'user' : (config.cameraFacing || 'environment')

        // Tentar primeiro com 'exact' para garantir que a câmera correta seja usada
        // Se falhar, tentar com 'ideal' como fallback
        let constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { exact: facingMode as 'user' | 'environment' }
          },
          audio: false
        }

        console.log(`[ARScreen] Tentando configurar câmera com exact: ${facingMode} (front=${shouldUseFront})`)

        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch (exactError) {
          // Se falhar com 'exact', tentar com 'ideal'
          console.warn(`[ARScreen] Falha com exact, tentando com ideal:`, exactError)
          constraints = {
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: { ideal: facingMode as 'user' | 'environment' }
            },
            audio: false
          }
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        }

        const video = document.createElement('video')
        video.id = 'arjs-video'
        video.setAttribute('playsinline', '')
        video.setAttribute('autoplay', '')
        video.muted = true
        video.style.position = 'fixed'
        video.style.top = '0'
        video.style.left = '0'
        video.style.width = '100vw'
        video.style.height = '100vh'
        video.style.objectFit = 'cover'
        video.style.zIndex = '0'
        video.style.display = 'block'
        video.style.visibility = 'visible'
        video.style.opacity = '0'
        video.style.transition = 'opacity 0.6s ease-in'
        document.body.appendChild(video)

        video.srcObject = stream
        mediaStreamRef.current = stream
        videoRef.current = video

        await video.play()
        setArLoading(false)
        setIsFadingIn(true)
        setTimeout(() => {
          video.style.opacity = '1'
        }, 100)
        console.log(`[ARScreen] Câmera configurada com sucesso: ${facingMode} (frontCameraActive=${shouldUseFront})`)
      } catch (err) {
        console.error('Erro ao configurar câmera:', err)
        setArLoading(false)
        setTimeout(() => {
          setIsFadingIn(true)
        }, 100)
      }
    }

    setupCamera()

    return () => {
      if (videoRef.current) {
        videoRef.current.style.display = 'none'
        videoRef.current.style.visibility = 'hidden'
        videoRef.current.style.opacity = '0'
      }
    }
  }, [arMounted, usarVideo, frontCameraActive, config])

  // Mudança para garantir que a câmera esteja na frontal durante o "feedback-positivo" com pequeno no canto
  useEffect(() => {
    // Quando mostrar o overlay do pequeno (registrouPequeno OU showPequenoOverlay), garantir que frontCameraActive esteja true
    if (
      phase === 'feedback-positivo' &&
      (showPequenoOverlay || registrouPequeno)
    ) {
      // FORÇAR câmera frontal sempre que estiver na fase de selfie
      // Usar setTimeout para garantir que o estado seja atualizado após o handleRegistrar
      if (!frontCameraActive) {
        console.log('[ARScreen] Forçando ativação da câmera frontal para selfie com personagem pequeno')
        // Pequeno delay para garantir que o estado seja processado
        setTimeout(() => {
          setFrontCameraActive(true)
        }, 50)
      }
    }
  // eslint-disable-next-line
  }, [phase, showPequenoOverlay, registrouPequeno])

  // --- AR overlay logic (pequeno overlay in feedback-positivo) ----
  useEffect(() => {
    if (phase === 'feedback-positivo' && showPequenoOverlay) {
      // nothing needed here: just state for showing overlay
    } else if (phase === 'feedback-positivo' && registrouPequeno) {
      // nada (a exibição está controlada no jsx)
    } else {
      setShowPequenoOverlay(false)
      setRegistrouPequeno(false)
    }
  }, [phase, showPequenoOverlay, registrouPequeno])

  useEffect(() => {
    if (!arMounted || !arSceneRef.current) return

    const addPequenoToScene = () => {
      const scene = arSceneRef.current?.getScene()
      if (!scene) {
        setTimeout(addPequenoToScene, 100)
        return
      }

      const sceneEl = scene as any

      let camera = sceneEl.querySelector('a-camera')
      if (!camera) {
        camera = document.createElement('a-camera')
        camera.setAttribute('look-controls', 'enabled: true')
        camera.setAttribute('wasd-controls', 'enabled: false')
        sceneEl.appendChild(camera)
      }

      if (pequenoEntityId.current) {
        arSceneRef.current?.removeEntity(pequenoEntityId.current)
      }

      const entityId = arSceneRef.current?.addEntity({
        geometry: { primitive: 'plane' },
        material: { src: pequenoImg, transparent: true },
        position: '0 0.65 -2',
        scale: '1 1 1',
        rotation: '0 0 0'
      })
      pequenoEntityId.current = entityId || ''

      setTimeout(() => {
        const width = window.innerWidth
        const height = window.innerHeight

        if (sceneEl.renderer) {
          sceneEl.renderer.setSize(width, height)
          sceneEl.renderer.setPixelRatio(window.devicePixelRatio)
        }

        if (camera) {
          const cameraEl = camera as any
          if (cameraEl.components && cameraEl.components['camera']) {
            const cameraComponent = cameraEl.components['camera']
            if (cameraComponent.camera) {
              cameraComponent.camera.aspect = width / height
              cameraComponent.camera.updateProjectionMatrix()
            }
          }
        }
        if (sceneEl.render) {
          sceneEl.render()
        }
        window.dispatchEvent(new Event('resize'))
      }, 200)
    }

    setTimeout(addPequenoToScene, 500)

    const handleResize = () => {
      if (pequenoEntityId.current && arSceneRef.current) {
        const scene = arSceneRef.current.getScene()
        if (scene) {
          const sceneEl = scene as any
          const width = window.innerWidth
          const height = window.innerHeight

          if (sceneEl.renderer) {
            sceneEl.renderer.setSize(width, height)
            sceneEl.renderer.setPixelRatio(window.devicePixelRatio)
          }

          const camera = sceneEl.querySelector('a-camera')
          if (camera) {
            const cameraEl = camera as any
            if (cameraEl.components && cameraEl.components['camera'] && cameraEl.components['camera'].camera) {
              cameraEl.components['camera'].camera.aspect = width / height
              cameraEl.components['camera'].camera.updateProjectionMatrix()
            }
          }

          if (sceneEl.render) {
            sceneEl.render()
          }
        }
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [arMounted, pequenoImg])

  // ---- Standard logic for rest of flow ----
  const handleTransitionToAR = () => {
    playClickSound()
    setPhase('dialogos')
    setDialogIndex(1)
    setShowBtVoltar(false)
    if (!arMounted) setArMounted(true)
  }

  const handleAvancarDialogo = () => {
    playClickSound()
    if (dialogIndex === 1) {
      setDialogIndex(2)
      setShowBtVoltar(true)
    } else if (dialogIndex === 2) {
      setPhase('menu')
      setDialogIndex(1)
      setShowBtVoltar(false)
    }
  }

  const handleVoltarDialogo = () => {
    playClickSound()
    if (dialogIndex === 2) {
      setDialogIndex(1)
      setShowBtVoltar(false)
    }
  }

  const handleHistoria = () => {
    playClickSound()
    setPhase('historia')
    setHistoriaIndex(1)
    setShowBtVoltar(false)
  }

  const handleAvancarHistoria = () => {
    playClickSound()
    if (historiaIndex === 1) {
      setHistoriaIndex(2)
      setShowBtVoltar(true)
    } else if (historiaIndex === 2) {
      setHistoriaIndex(3)
      setShowBtVoltar(true)
    }
  }

  const handleVoltarHistoria = () => {
    playClickSound()
    if (historiaIndex === 2) {
      setHistoriaIndex(1)
      setShowBtVoltar(false)
    } else if (historiaIndex === 3) {
      setHistoriaIndex(2)
    }
  }

  const handleConcluirHistoria = () => {
    playClickSound()
    setPhase('menu')
    setHistoriaIndex(1)
    setShowBtVoltar(false)
  }

  const handleQuiz = () => {
    playClickSound()
    setPhase('quiz')
    setQuizPerguntaIndex(1)
    setShowRespostas(false)
    setShowBtVoltar(false)
  }

  const handleAvancarQuiz = () => {
    playClickSound()
    if (quizPerguntaIndex === 1) {
      setQuizPerguntaIndex(2)
      setShowRespostas(true)
      setShowBtVoltar(false)
    }
  }

  const handleResposta1 = () => {
    playSuccessSound()
    setPhase('feedback-positivo')
    setShowPequenoOverlay(false)
    // NÃO resetar frontCameraActive aqui - será ativado quando o usuário clicar em "Registrar"
    setRegistrouPequeno(false)
  }

  const handleResposta2 = () => {
    playErrorSound()
    setPhase('feedback-negativo')
    setShake(false)
    setRegistrouPequeno(false)
  }

  const handleResposta3 = () => {
    playClickSound()
    setMostrarDicaDialog(true)
    setDicaDialogIndex(1)
    setShowBtVoltar(false)
    setShowRespostas(false)
  }

  const handleAvancarDicaDialog = () => {
    playClickSound()
    if (dicaDialogIndex === 1) {
      setDicaDialogIndex(2)
      setShowBtVoltar(true)
    } else if (dicaDialogIndex === 2) {
      setMostrarDicaDialog(false)
      setDicaDialogIndex(1)
      setShowRespostas(true)
      setShowBtVoltar(false)
    }
  }
  const handleVoltarDicaDialog = () => {
    playClickSound()
    if (dicaDialogIndex === 2) {
      setDicaDialogIndex(1)
      setShowBtVoltar(false)
    }
  }

  const handleVoltarAfterNegativo = () => {
    playClickSound()
    setPhase('quiz')
    setShowRespostas(true)
    setFrontCameraActive(false)
    setRegistrouPequeno(false)
  }
  const handleRegistrar = async () => {
    playClickSound()
    // FORÇAR câmera frontal antes de mostrar o overlay
    console.log('[ARScreen] handleRegistrar: Forçando câmera frontal para selfie')
    
    // Primeiro, mostrar o overlay (isso vai acionar o useEffect que força a câmera frontal)
    setShowPequenoOverlay(true)
    setRegistrouPequeno(true)
    
    // Depois, forçar a troca de câmera (isso vai acionar o useEffect de setupCamera)
    setFrontCameraActive(true)
  }
  const handleInicio = () => {
    playClickSound()
    setPhase('initial')
    setIsFadingIn(true)
    setFrontCameraActive(false)
    setShowPequenoOverlay(false)
    setRegistrouPequeno(false)
    _onNavigate('cover')
  }

  // --- IMAGE HELPERS ---
  const getTopImage = () => {
    if (phase === 'historia') {
      if (historiaIndex === 1) return historia1Img
      if (historiaIndex === 2) return historia2Img
      if (historiaIndex === 3) return historia3Img
    }
    if (phase === 'quiz') {
      if (quizPerguntaIndex === 1) return pergunta1Img
      if (quizPerguntaIndex === 2) return pergunta2Img
    }
    if (dialogIndex === 1) return dialogo1Img
    if (dialogIndex === 2) return dialogo2Img
    return dialogo1Img
  }
  const getDicaDialogImage = () => {
    if (dicaDialogIndex === 1) return dica1Img
    if (dicaDialogIndex === 2) return dica2Img
    return dica1Img
  }

  const renderVoltarButton = (onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        left: 0,
        bottom: '-55px',
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        cursor: 'pointer',
        userSelect: 'none',
        display: 'block',
        opacity: 1,
        visibility: 'visible',
        zIndex: 1002
      }}
      draggable={false}
      aria-label="Voltar"
    >
      <img
        src={btVoltarImg}
        style={{
          objectFit: 'contain',
          pointerEvents: 'none',
          userSelect: 'none',
          display: 'block'
        }}
        alt="Voltar"
        draggable={false}
      />
    </button>
  )

  const renderAvancarButton = (onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        right: 0,
        bottom: '-65px',
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        cursor: 'pointer',
        userSelect: 'none',
        display: 'block',
        opacity: 1,
        visibility: 'visible',
        zIndex: 1002
      }}
      draggable={false}
      aria-label="Avançar"
    >
      <img
        src={
          phase === 'historia' && historiaIndex === 3
            ? btConcluirImg
            : btAvancarImg
        }
        style={{
          objectFit: 'contain',
          pointerEvents: 'none',
          userSelect: 'none',
          display: 'block'
        }}
        alt="Avançar"
        draggable={false}
      />
    </button>
  )

  const handleAvancar = () => {
    if (phase === 'historia' && historiaIndex === 3) {
      handleConcluirHistoria()
    } else if (phase === 'historia') {
      handleAvancarHistoria()
    } else if (phase === 'quiz' && !mostrarDicaDialog) {
      handleAvancarQuiz()
    } else if (phase === 'dialogos') {
      handleAvancarDialogo()
    } else {
      handleAvancarDialogo()
    }
  }

  const handleVoltar = () => {
    if (phase === 'historia') {
      handleVoltarHistoria()
    } else {
      handleVoltarDialogo()
    }
  }

  const shakeClass = shake ? 'shake-resposta' : ''

  // MUDANÇA: Aumentando a opacidade do background overlay do feedback e blur mais intenso
  const shakeKeyframesStyle = (
    <style>
      {`
        @keyframes shakeKey {
          0% { transform: translateX(0); }
          14% { transform: translateX(-8px); }
          28% { transform: translateX(8px); }
          42% { transform: translateX(-8px); }
          56% { transform: translateX(8px); }
          70% { transform: translateX(-6px); }
          85% { transform: translateX(6px); }
          100% { transform: translateX(0); }
        }
        .shake-resposta {
          animation: shakeKey 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        .blur-bg-feedback {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          z-index: 2000000 !important;
          background: rgba(30, 30, 30, 0.94);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
      `}
    </style>
  )

  // --- Selfie Photo Handler ---
  const handleSelfiePhoto = async () => {
    setPhotoError(null)
    setIsTakingPhoto(true)
    try {
      // Option 1: Take snapshot from <video> (front cam already ON)
      const video = document.getElementById('arjs-video') as HTMLVideoElement | null
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        // Prepare a canvas the size of the viewport (or video)
        const width = window.innerWidth
        const height = window.innerHeight
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context not available')

        // Draw the current video frame
        ctx.drawImage(video, 0, 0, width, height)

        // Now draw the overlays (pequeno in lower right, hjeuconheci/camera-icon overlays not drawn)
        // Draw the "pequeno" img in exactly same position/size as displayed
        if (pequenoImgRef.current && pequenoImgRef.current.complete) {
          const img = pequenoImgRef.current
          // In overlay: fixed, right: 0, bottom: 0, width: 300px (no scaling of height)
          // For more responsive, check if less then 300px width (not mandatory for your design)
          const imgWidth = 300
          const imgHeight = img.naturalHeight * (imgWidth / img.naturalWidth)
          ctx.drawImage(img, width - imgWidth, height - imgHeight, imgWidth, imgHeight)
        }

        // Also draw the hjeuconheci on upper LEFT
        const hjeImg = new window.Image()
        hjeImg.src = hjeUConheciImg
        // Camera icon is NOT drawn (as it's a button only)
        await new Promise<void>((resolve, reject) => {
          hjeImg.onload = () => resolve()
          hjeImg.onerror = () => resolve()
        })
        // Let's define the left/top margin (same as .png, or 20px)
        if (hjeImg.complete) {
          ctx.drawImage(hjeImg, 20, 20)
        }

        // Convert to photo
        const dataUrl = canvas.toDataURL('image/png')

        // Download the image
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = 'selfie-ar.png'
        link.click()
      } else {
        setPhotoError('Câmera não disponível')
      }
    } catch (err) {
      setPhotoError('Erro ao tirar foto. Tente novamente.')
    } finally {
      setTimeout(() => setIsTakingPhoto(false), 400)
    }
  }

  // ---- MAIN RENDER ----
  return (
    <div 
      className={`ar-game-screen ${isFadingIn ? 'ar-screen-fade-in' : 'ar-screen-fade-out'}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1
      }}
    >
      {shakeKeyframesStyle}
      <LandscapeBlocker />
      <div
        className="ar-black-fade-in"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '100vw',
          height: '100vh',
          background: 'black',
          pointerEvents: blackCanvasOpacity === 0 ? 'none' : 'auto',
          zIndex: 10000000,
          opacity: blackCanvasOpacity,
          transition: 'opacity 1.1s cubic-bezier(.39,.58,.57,1)'
        }}
      />

      {/* Fade inicial do bg + grande.png */}
      {phase === 'initial' && (
        <div
          className="ar-initial-fade"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: `url("${bgClaroImg}") center center / cover no-repeat`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            pointerEvents: 'none',
            opacity: initialFadeOpacity,
            transition: 'opacity 850ms cubic-bezier(.39,.58,.57,1)'
          }}
        >
          <img
            src={grandeImg}
            alt="Grande"
            style={{
              userSelect: 'none',
              maxWidth: '90vw',
              maxHeight: '90vh',
              zIndex: 100000,
              pointerEvents: 'none'
            }}
            draggable={false}
          />
        </div>
      )}

      {arMounted && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 5,
            pointerEvents: 'none'
          }}
        >
          <ARSceneAFrame
            ref={arSceneRef}
            onSceneReady={() => {
              console.log('A-Frame Scene ready')
            }}
          />
        </div>
      )}

      {phase === 'feedback-negativo' && (
        <div className="blur-bg-feedback" style={{
          zIndex: 2000000,
          background: 'rgba(30,30,30,0.85)',   // Certo: ajuste aqui também em inline caso necessário
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)'
        }}>
          <img
            src={feedbackNegativoImg}
            alt="Feedback Negativo"
            style={{
              maxWidth: '90vw',
              maxHeight: '45vh',
              marginBottom: 24,
              userSelect: 'none'
            }}
            draggable={false}
          />
          <button
            onClick={handleVoltarAfterNegativo}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginTop: 16,
              outline: 'none',
              display: 'block',
              userSelect: 'none'
            }}
            aria-label="Voltar"
            draggable={false}
          >
            <img
              src={btnVoltarImg}
              alt="Voltar"
              style={{
                display: 'block',
                maxWidth: '60vw',
                pointerEvents: 'none',
                userSelect: 'none'
              }}
              draggable={false}
            />
          </button>
        </div>
      )}

      {phase === 'feedback-positivo' && !registrouPequeno && (
        <div className="blur-bg-feedback" style={{
          zIndex: 2000000,
          background: 'rgba(30,30,30,0.85)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)'
        }}>
          <img
            src={feedbackPositivoImg}
            alt="Feedback Positivo"
            style={{
              maxWidth: '90vw',
              maxHeight: '45vh',
              marginBottom: 24,
              userSelect: 'none'
            }}
            draggable={false}
          />

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginTop: 0,
            alignItems: 'center'
          }}>
            <button
              onClick={handleRegistrar}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                outline: 'none',
                display: 'block',
                userSelect: 'none'
              }}
              aria-label="Registrar"
              draggable={false}
            >
              <img
                src={btnRegistrarImg}
                alt="Registrar"
                style={{
                  display: 'block',
                  maxWidth: '60vw',
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
                draggable={false}
              />
            </button>
            <button
              onClick={handleInicio}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                outline: 'none',
                display: 'block',
                userSelect: 'none'
              }}
              aria-label="Início"
              draggable={false}
            >
              <img
                src={btnInicioImg}
                alt="Início"
                style={{
                  display: 'block',
                  maxWidth: '60vw',
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
                draggable={false}
              />
            </button>
          </div>

          {showPequenoOverlay && (
            <img
              src={pequenoImg}
              alt="Personagem Pequeno"
              ref={pequenoImgRef}
              onLoad={
                (e) => {
                  const img = e.currentTarget
                  if (
                    img.naturalWidth !== pequenoImgSize.width ||
                    img.naturalHeight !== pequenoImgSize.height
                  ) {
                    setPequenoImgSize({
                      width: img.naturalWidth,
                      height: img.naturalHeight
                    })
                  }
                }
              }
              style={{
                position: 'absolute',
                right: '3vw',
                bottom: '3vh',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 2000002
              }}
              draggable={false}
            />
          )}
        </div>
      )}

      {/* --- NOVO: Overlay Selfie c/ personagem pequeno e overlays no canto -- */}
      {phase === 'feedback-positivo' && registrouPequeno && (
        <div
          ref={overlayContainerRef}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none', // allow camera icon click, rest passes through
            zIndex: 3804764,
          }}
        >
          {/* Pequeno personagem renderizado sempre */}
          <img
            src={pequenoImg}
            alt="Personagem Pequeno"
            ref={pequenoImgRef}
            onLoad={
              (e) => {
                const img = e.currentTarget
                if (
                  img.naturalWidth !== pequenoImgSize.width ||
                  img.naturalHeight !== pequenoImgSize.height
                ) {
                  setPequenoImgSize({
                    width: img.naturalWidth,
                    height: img.naturalHeight
                  })
                }
              }
            }
            style={{
              position: 'fixed',
              right: 0,
              bottom: 20,
              width: 300,
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 2000002
            }}
            draggable={false}
          />

          {/* HJEUCONHECI - upper left */}
          <img
            src={hjeUConheciImg}
            alt="Eu conheci"
            style={{
              position: 'fixed',
              top: 16,
              left: 16,
              //width: 110,
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 4000000,
              filter: 'drop-shadow(0 1px 8px rgba(0,0,0,0.1))'
            }}
            draggable={false}
          />

          {/* Camera Icon - upper right */}
          <button
            onClick={handleSelfiePhoto}
            style={{
              position: 'fixed',
              top: 18,
              right: 16,
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              width: 72,
              height: 72,
              zIndex: 4000001,
              cursor: isTakingPhoto ? 'progress' : 'pointer',
              pointerEvents: isTakingPhoto ? 'none' : 'auto',
              userSelect: 'none'
            }}
            aria-label="Tirar foto/selfie"
            disabled={isTakingPhoto}
            draggable={false}
          >
            <img
              src={cameraIconImg}
              alt="Câmera/Selfie"
              style={{
                width: 72,
                height: 72,
                display: 'block',
                pointerEvents: 'none',
                userSelect: 'none',
                opacity: isTakingPhoto ? 0.4 : 1
              }}
              draggable={false}
            />
          </button>
          {/* erro ao tirar foto */}
          {photoError && (
            <div style={{
              position: 'fixed', top: 100, right: 18, zIndex: 4900000,
              pointerEvents: 'none', background: 'rgba(255,50,60,0.99)', color: '#fff',
              fontWeight: 'bold', borderRadius: 7, padding: '8px 14px', fontSize: 16}}
            >
              {photoError}
            </div>
          )}
        </div>
      )}

      {(phase !== 'initial' && phase !== 'feedback-negativo' && phase !== 'feedback-positivo') && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          {phase === 'dialogos' && (
            <div
              style={{
                position: 'absolute',
                top: '10vh',
                left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
                zIndex: 1001
              }}
            >
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={getTopImage()}
                  alt="Diálogo"
                  style={{
                    userSelect: 'none',
                    display: 'block'
                  }}
                  draggable={false}
                />
                {renderAvancarButton(handleAvancar)}
                {showBtVoltar && (
                  <div style={{ position: 'absolute', left: 0, bottom: '-10px' }}>
                    {renderVoltarButton(handleVoltar)}
                  </div>
                )}
              </div>
            </div>
          )}

          {phase === 'menu' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                pointerEvents: 'auto',
                zIndex: 1001
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '32px',
                  alignItems: 'center',
                  marginTop: '32px'
                }}
              >
                <button
                  onClick={() => {
                    handleHistoria()
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'block',
                    opacity: 1,
                    visibility: 'visible',
                    zIndex: 1002
                  }}
                  draggable={false}
                >
                  <img
                    src={btHistoriaImg}
                    alt="História"
                    style={{
                      display: 'block',
                      width: 'auto',
                      height: 'auto',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      pointerEvents: 'none',
                      userSelect: 'none'
                    }}
                    draggable={false}
                  />
                </button>
                <button
                  onClick={() => {
                    handleQuiz()
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'block',
                    opacity: 1,
                    visibility: 'visible',
                    zIndex: 1002
                  }}
                  draggable={false}
                >
                  <img
                    src={btQuizImg}
                    alt="Quiz"
                    style={{
                      display: 'block',
                      width: 'auto',
                      height: 'auto',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      pointerEvents: 'none',
                      userSelect: 'none'
                    }}
                    draggable={false}
                  />
                </button>
              </div>
            </div>
          )}

          {phase === 'historia' && (
            <div
              style={{
                position: 'absolute',
                top: '10vh',
                left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px'
              }}
            >
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={getTopImage()}
                  alt="História"
                  style={{
                    userSelect: 'none',
                    display: 'block'
                  }}
                  draggable={false}
                />
                {renderAvancarButton(handleAvancar)}
                {showBtVoltar && (
                  <div style={{ position: 'absolute', left: 0, bottom: '-10px' }}>
                    {renderVoltarButton(handleVoltar)}
                  </div>
                )}
              </div>
            </div>
          )}

          {phase === 'quiz' && !mostrarDicaDialog && (
            <div
              style={{
                position: 'absolute',
                top: '10vh',
                left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px'
              }}
            >
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={getTopImage()}
                  alt="Pergunta"
                  style={{
                    userSelect: 'none',
                    display: 'block'
                  }}
                  draggable={false}
                />
                {quizPerguntaIndex === 1 && renderAvancarButton(handleAvancarQuiz)}
              </div>
              {showRespostas && quizPerguntaIndex === 2 && (
                <div
                  className={shakeClass}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    alignItems: 'center',
                    marginTop: '20px',
                    pointerEvents: 'auto',
                  }}
                >
                  <button
                    onClick={handleResposta1}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      cursor: 'pointer',
                      userSelect: 'none',
                      display: 'block'
                    }}
                    draggable={false}
                  >
                    <img
                      src={resposta1Img}
                      alt="Resposta 1"
                      style={{
                        display: 'block',
                        userSelect: 'none',
                        pointerEvents: 'none',
                        width: 'auto',
                        height: 'auto',
                        maxWidth: '90vw',
                      }}
                      draggable={false}
                    />
                  </button>
                  <button
                    onClick={handleResposta2}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      cursor: 'pointer',
                      userSelect: 'none',
                      display: 'block'
                    }}
                    draggable={false}
                  >
                    <img
                      src={resposta2Img}
                      alt="Resposta 2"
                      style={{
                        display: 'block',
                        userSelect: 'none',
                        pointerEvents: 'none',
                        width: 'auto',
                        height: 'auto',
                        maxWidth: '90vw',
                      }}
                      draggable={false}
                    />
                  </button>
                  <button
                    onClick={handleResposta3}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      cursor: 'pointer',
                      userSelect: 'none',
                      display: 'block'
                    }}
                    draggable={false}
                  >
                    <img
                      src={resposta3Img}
                      alt="Resposta 3"
                      style={{
                        display: 'block',
                        userSelect: 'none',
                        pointerEvents: 'none',
                        width: 'auto',
                        height: 'auto',
                        maxWidth: '90vw',
                      }}
                      draggable={false}
                    />
                  </button>
                </div>
              )}
            </div>
          )}

          {mostrarDicaDialog && (
            <div
              style={{
                position: 'absolute',
                top: '10vh',
                left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
                zIndex: 1001
              }}
            >
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={getDicaDialogImage()}
                  alt={`Dica ${dicaDialogIndex}`}
                  style={{
                    userSelect: 'none',
                    display: 'block'
                  }}
                  draggable={false}
                />
                {renderAvancarButton(handleAvancarDicaDialog)}
                {dicaDialogIndex > 1 && (
                  <div style={{ position: 'absolute', left: 0, bottom: '-10px' }}>
                    {renderVoltarButton(handleVoltarDicaDialog)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
