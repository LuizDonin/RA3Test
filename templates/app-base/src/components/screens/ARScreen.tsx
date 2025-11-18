import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { LandscapeBlocker } from '../LandscapeBlocker'
import { useRA } from '../../contexts/RAContext'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { playClickSound } from '../../utils/soundUtils'
import { ARSceneAFrame, type ARSceneAFrameRef } from '../ARSceneAFrame'
import '../../styles/ar-screen.css'

interface ARScreenProps {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

type FolderName = 'Anita' | 'Chiquinha'
type Phase = 'initial' | 'ar' | 'dialogos' | 'menu' | 'historia' | 'quiz' | 'dicas'

// NOVO: Fase AR imutável após sair da splash inicial
export const ARScreen: React.FC<ARScreenProps> = ({
  onNavigate: _onNavigate
}) => {
  const { raData } = useRA()
  const config = raData?.configuracoes || {}
  const usarVideo = config.usarVideo !== false

  // Selecionar pasta aleatoriamente
  const [selectedFolder] = useState<FolderName>(() => {
    const folders: FolderName[] = ['Anita', 'Chiquinha']
    const selected = folders[Math.floor(Math.random() * folders.length)]
    console.log('📁 Pasta selecionada:', selected)
    return selected
  })

  // Estados principais
  const [phase, setPhase] = useState<Phase>('initial')
  const [arLoading, setArLoading] = useState(false)
  const [blackCanvasOpacity, setBlackCanvasOpacity] = useState(1)
  const [isFadingIn, setIsFadingIn] = useState(true)
  // NOVO: flag para saber se já inicializamos a AR (A-Frame/câmera)
  const [arMounted, setArMounted] = useState(false)

  // Novo: controla o fade da splash inicial
  const [initialFadeOpacity, setInitialFadeOpacity] = useState(1)

  // Debug: log da fase atual
  useEffect(() => {
    console.log('📱 Fase atual:', phase)
  }, [phase])
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const arSceneRef = useRef<ARSceneAFrameRef>(null)
  const pequenoEntityId = useRef<string>('')

  // Estados de diálogos
  const [dialogIndex, setDialogIndex] = useState(1)
  const [showBtVoltar, setShowBtVoltar] = useState(false)

  // Estados de história
  const [historiaIndex, setHistoriaIndex] = useState(1)

  // Estados de quiz
  const [quizPerguntaIndex, setQuizPerguntaIndex] = useState(1)
  const [showRespostas, setShowRespostas] = useState(false)

  // Estados de dicas
  const [dicaIndex, setDicaIndex] = useState(1)
  const [showDicas, setShowDicas] = useState(false)

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

  // Caminhos das imagens gerais
  const btAvancarImg = useMemo(() => normalizePath('assets/images/btavancar.png'), [normalizePath])
  const btVoltarImg = useMemo(() => normalizePath('assets/images/btvoltar.png'), [normalizePath])
  const btHistoriaImg = useMemo(() => normalizePath('assets/images/bthistoria.png'), [normalizePath])
  const btQuizImg = useMemo(() => normalizePath('assets/images/btquiz.png'), [normalizePath])
  const btConcluirImg = useMemo(() => normalizePath('assets/images/btconcluir.png'), [normalizePath])

  // Caminhos das imagens da pasta selecionada
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

  // Black canvas fade-in effect (executa só ao montar o componente)
  useEffect(() => {
    setBlackCanvasOpacity(1)
    const timeout = setTimeout(() => {
      setBlackCanvasOpacity(0)
    }, 50)
    return () => {
      clearTimeout(timeout)
    }
  }, [])

  // Implementa fade automático na splash inicial (bg + grande.png)
  useEffect(() => {
    if (phase !== 'initial') return
    setInitialFadeOpacity(1)
    // Espera um instante e começa fade automático
    const delay = 550 // espera pelo fade do canvas preto (1100ms/2, já que fade do canvas é 1.1s)
    const fakeSplashDuration = 1000 // quanto tempo fica splash visível antes do fade (pode ajustar)
    let fadeTimeout: NodeJS.Timeout
    let phaseTimeout: NodeJS.Timeout
    let frame: number

    const startFade = () => {
      const fadeDuration = 900 // ms: ajuste para suavidade desejada
      const start = Date.now()
      function step() {
        const elapsed = Date.now() - start
        const t = Math.min(1, elapsed / fadeDuration)
        setInitialFadeOpacity(1 - t)
        if (t < 1) {
          frame = requestAnimationFrame(step)
        } else {
          setInitialFadeOpacity(0)
          // Após fade, avança para diálogos/AR
          phaseTimeout = setTimeout(() => {
            handleTransitionToAR_auto()
          }, 100) // pequeno delay para garantir opacidade=0
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

  // Versão "auto" do handleTransitionToAR (ignora playClickSound)
  const handleTransitionToAR_auto = () => {
    setPhase('dialogos')
    setDialogIndex(1)
    setShowBtVoltar(false)
    if (!arMounted) { setArMounted(true) }
  }

  // AR scene/camera boot, etc - SÓ NO INÍCIO (NÃO DEPENDE DA PHASE)
  useEffect(() => {
    if (!arMounted || !usarVideo) {
      return
    }
    async function setupCamera() {
      setArLoading(true)
      try {
        const existingVideo = document.getElementById('arjs-video') as HTMLVideoElement
        if (existingVideo && existingVideo.srcObject) {
          existingVideo.style.display = 'block'
          existingVideo.style.visibility = 'visible'
          existingVideo.style.opacity = '0'
          existingVideo.style.zIndex = '0'
          existingVideo.style.transition = 'opacity 0.6s ease-in'
          videoRef.current = existingVideo
          mediaStreamRef.current = existingVideo.srcObject as MediaStream
          setArLoading(false)
          setTimeout(() => {
            setIsFadingIn(true)
            if (existingVideo) {
              existingVideo.style.opacity = '1'
            }
          }, 100)
          return
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: 'environment' }
          },
          audio: false
        })

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
        setTimeout(() => {
          setIsFadingIn(true)
          if (video) {
            video.style.opacity = '1'
          }
        }, 100)
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
    // Só arMounted e usarVideo: NÃO mais phase!
  }, [arMounted, usarVideo])

  // Monta a entidade (pequeno) SÓ UMA VEZ, e re-renderiza a cada troca de imagem (pequenoImg)
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
    // IMPORTANTE: NÃO depende mais de phase, só arMounted e pequenoImg!
  }, [arMounted, pequenoImg])

  // Troca de fase (manual - pelo clique, mas não é mais usada na splash)
  const handleTransitionToAR = () => {
    playClickSound()
    setPhase('dialogos')
    setDialogIndex(1)
    setShowBtVoltar(false)
    if (!arMounted) setArMounted(true)
  }

  // Handlers
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
    playClickSound()
    console.log('Resposta certa')
    // TODO: Implementar lógica de resposta certa
  }

  const handleResposta2 = () => {
    playClickSound()
    console.log('Resposta errada')
    // TODO: Implementar lógica de resposta errada
  }

  const handleResposta3 = () => {
    playClickSound()
    setShowDicas(true)
    setDicaIndex(1)
    setShowRespostas(false)
  }

  const handleAvancarDica = () => {
    playClickSound()
    if (dicaIndex === 1) {
      setDicaIndex(2)
    } else if (dicaIndex === 2) {
      setShowDicas(false)
      setDicaIndex(1)
      setShowRespostas(true)
    }
  }

  // Sempre retorna a imagem do topo da cena atual
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
    if (phase === 'dicas' || showDicas) {
      if (dicaIndex === 1) return dica1Img
      if (dicaIndex === 2) return dica2Img
    }
    if (dialogIndex === 1) return dialogo1Img
    if (dialogIndex === 2) return dialogo2Img
    return dialogo1Img
  }

  // Botões Avançar/Voltar usam as imagens btAvancarImg, btVoltarImg direto no <img> (tamanhos nativos)
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
          // Removido width/height para usar tamanho nativo da imagem
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
          // Removido width/height para usar tamanho nativo da imagem
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
    } else if (phase === 'quiz' && !showDicas) {
      handleAvancarQuiz()
    } else if (showDicas) {
      handleAvancarDica()
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
      <LandscapeBlocker />
      {/* Black overlay canvas */}
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
            pointerEvents: 'none', // não clica mais; autom.
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

      {/* Fase AR: A-Frame Scene */}
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

      {/* Canvas 2D overlay para diálogos e botões */}
      {(phase !== 'initial') && (
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
          {/* Diálogos iniciais */}
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
                {/* Botão Avançar sempre à direita do topo da imagem, a 10px da borda inferior */}
                {renderAvancarButton(handleAvancar)}
                {/* Botão Voltar sempre sobreposto à esquerda da imagem */}
                {showBtVoltar && (
                  <div style={{ position: 'absolute', left: 0, bottom: '-10px' }}>
                    {renderVoltarButton(handleVoltar)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Menu: bthistoria e btquiz */}
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

          {/* História */}
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
                {/* Botão Avançar/Concluir sempre à direita do topo da imagem, a 10px da borda inferior */}
                {renderAvancarButton(handleAvancar)}
                {/* Botão Voltar sobreposto à esquerda da imagem, caso showBtVoltar */}
                {showBtVoltar && (
                  <div style={{ position: 'absolute', left: 0, bottom: '-10px' }}>
                    {renderVoltarButton(handleVoltar)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quiz */}
          {phase === 'quiz' && !showDicas && (
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
                {/* Botão Avançar: só em quizPerguntaIndex === 1 */}
                {quizPerguntaIndex === 1 && renderAvancarButton(handleAvancarQuiz)}
              </div>
              {/* Respostas abaixo da imagem (mantém como antes) */}
              {showRespostas && quizPerguntaIndex === 2 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    alignItems: 'center',
                    marginTop: '20px'
                  }}
                >
                  <button
                    onClick={handleResposta1}
                    style={{
                      backgroundImage: `url("${resposta1Img}")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'block'
                    }}
                    draggable={false}
                  />
                  <button
                    onClick={handleResposta2}
                    style={{
                      backgroundImage: `url("${resposta2Img}")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'block'
                    }}
                    draggable={false}
                  />
                  <button
                    onClick={handleResposta3}
                    style={{
                      backgroundImage: `url("${resposta3Img}")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'block'
                    }}
                    draggable={false}
                  />
                </div>
              )}
            </div>
          )}

          {/* Dicas */}
          {showDicas && (
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
                  alt="Dica"
                  style={{
                    userSelect: 'none',
                    display: 'block'
                  }}
                  draggable={false}
                />
                {/* Botão Avançar sobreposto à direita da imagem, a 10px da borda inferior */}
                {renderAvancarButton(handleAvancarDica)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
