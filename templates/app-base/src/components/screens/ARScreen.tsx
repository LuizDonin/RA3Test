import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react'
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
  // O overlay preto inicia em 1 (opaco) e faz fade para 0 (transparente) no início
  const [blackCanvasOpacity, setBlackCanvasOpacity] = useState(1)
  const [isFadingIn, setIsFadingIn] = useState(true)

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

  // Corrigido: Fase inicial cobre TUDO com um canvas-like DIV, assim "grande" fica acima de tudo
  // Para garantir que o background e o grande aparecem acima de tudo, devemos garantir:
  // - O A-Frame não está renderizando enquanto phase === 'initial'
  // - O overlay para 'initial' está NUM Z-INDEX MAIOR que todo resto

  // Black canvas fade-in effect (executa só ao montar o componente)
  useEffect(() => {
    // Executa o fade-in apenas uma vez ao montar (ou sempre que fase muda para initial)
    setBlackCanvasOpacity(1)
    const timeout = setTimeout(() => {
      setBlackCanvasOpacity(0)
    }, 50) // start fade-in logo ao montar, delay pequeno, mais fluido
    return () => {
      clearTimeout(timeout)
    }
  }, []) // Executa só uma vez ao montar

  useLayoutEffect(() => {
    // Procura o elemento de vídeo que o AR.js cria/reutiliza
    const video = document.getElementById('arjs-video');
    if (video) {
      // Força invisibilidade imediata
      video.style.opacity = '0';
      video.style.display = 'none'; 
      // Se quiser ser agressivo, pause o vídeo para limpar o buffer visual
      // (video as HTMLVideoElement).pause();
    }
  }, []);

  // Se quiser que o fade-in aconteça toda vez que muda para 'initial',
  // troque para: }, [phase]) e abaixo: if (phase === 'initial') { ... }

  // Configurar câmera quando entrar na fase AR ou diálogos
  useEffect(() => {
    if ((phase !== 'ar' && phase !== 'dialogos') || !usarVideo) {
      return
    }

    async function setupCamera() {
      setArLoading(true)
      try {
        let video = document.getElementById('arjs-video') as HTMLVideoElement
        
        // Se não existir, cria. Se existir, usa.
        if (!video) {
          video = document.createElement('video')
          video.id = 'arjs-video'
          video.setAttribute('playsinline', '')
          video.setAttribute('autoplay', '')
          video.muted = true
          // CSS CRÍTICO PARA EVITAR FLASH
          video.style.position = 'fixed'
          video.style.top = '0'
          video.style.left = '0'
          video.style.width = '100vw'
          video.style.height = '100vh'
          video.style.objectFit = 'cover'
          video.style.zIndex = '0'
          document.body.appendChild(video)
        }

        // 1. Garante que está invisível antes de mexer
        video.style.opacity = '0'
        video.style.transition = 'opacity 0.6s ease-in'
        
        // 2. Se já tiver stream, só reativa
        if (video.srcObject) {
           // Pequeno delay para garantir que o navegador processou o opacity: 0
           requestAnimationFrame(() => {
             video.style.display = 'block'
             video.style.visibility = 'visible'
             video.play().catch(() => {})
           })
        } else {
          // 3. Se for novo stream
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: { ideal: 'environment' }
            },
            audio: false
          })
          video.srcObject = stream
          video.style.display = 'block'
          video.style.visibility = 'visible'
          await video.play()
        }

        mediaStreamRef.current = video.srcObject as MediaStream
        videoRef.current = video

        setArLoading(false)
        
        // 4. Fade-in suave APÓS tudo estar pronto e carregado
        setTimeout(() => {
          setIsFadingIn(true)
          if (video) video.style.opacity = '1'
        }, 200) // Aumentei levemente para 200ms para garantir estabilidade

      } catch (err) {
        console.error('Erro ao configurar câmera:', err)
        setArLoading(false)
        setTimeout(() => setIsFadingIn(true), 100)
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
  }, [phase, usarVideo])

  // Adicionar pequeno.png no A-Frame quando entrar na fase AR ou diálogos
  useEffect(() => {
    // Só adicionar se não for fase inicial!
    if (phase === 'initial' || !arSceneRef.current) return

    console.log('🎨 Adicionando pequeno.png ao A-Frame, fase:', phase)

    const addPequenoToScene = () => {
      const scene = arSceneRef.current?.getScene()
      if (!scene) {
        console.log('⏳ A-Frame scene ainda não está pronto, tentando novamente...')
        setTimeout(addPequenoToScene, 100)
        return
      }

      // Remover entidade anterior se existir
      if (pequenoEntityId.current) {
        arSceneRef.current?.removeEntity(pequenoEntityId.current)
        console.log('🗑️ Removendo entidade anterior:', pequenoEntityId.current)
      }

      // Adicionar pequeno.png a 3 unidades no eixo Z
      const entityId = arSceneRef.current?.addEntity({
        geometry: { primitive: 'plane' },
        material: { src: pequenoImg, transparent: true },
        position: '0 0 -3',
        scale: '1 1 1',
        rotation: '0 0 0'
      })
      pequenoEntityId.current = entityId || ''
      console.log('✅ Entidade pequeno.png adicionada com ID:', pequenoEntityId.current)
    }

    setTimeout(addPequenoToScene, 500)
  }, [phase, pequenoImg])

  // Transição da fase inicial para AR
  const handleTransitionToAR = () => {
    playClickSound()
    console.log('🔄 Transicionando para fase AR/diálogos')
    setPhase('dialogos')
    setDialogIndex(1)
    setShowBtVoltar(false)
  }

  // --- Funções e renderização continuam igual ---

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

  const getDialogoImg = () => {
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

  const getAvancarButton = () => {
    if (phase === 'historia' && historiaIndex === 3) {
      return btConcluirImg
    }
    return btAvancarImg
  }

  const handleAvancar = () => {
    if (phase === 'historia' && historiaIndex === 3) {
      handleConcluirHistoria()
    } else if (phase === 'historia') {
      handleAvancarHistoria()
    } else if (phase === 'quiz' && !showDicas) {
      handleAvancarQuiz()
    } else if (showDicas) {
      handleAvancarDica()
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

  // Aqui está a correção principal:
  // - Só renderizamos o A-Frame para fases que NÃO SÃO 'initial'.
  // - O DIV de fundo e a imagem "grande" SEMPRE aparecem na fase 'initial', acima de todo resto (zIndex alto).

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
      <style>{`
        #arjs-video {
          opacity: 0 !important;
          transition: opacity 0.5s ease-in;
        }
        /* Quando quisermos mostrar, removemos o !important via JS inline style ou adicionamos uma classe .visible */
      `}</style>
      <LandscapeBlocker />
      
      {/* Black overlay canvas (always in Canvas 2D, zIndex altíssimo) */}
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

      {/* Loading overlay */}
      {arLoading && (
        <div className="ar-loading-overlay">
          <div className="ar-loading-content">
            <div className="ar-loading-spinner"></div>
            <p className="ar-loading-text">Preparando AR...</p>
          </div>
        </div>
      )}

      {/* Fase inicial: Mostra canvas-like DIV acima de todo o resto */}
      {phase === 'initial' && (
        <div
          className="ar-initial-phase"
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
            zIndex: 99999, // garantir acima de tudo
            pointerEvents: 'auto'
          }}
          onClick={handleTransitionToAR}
        >
          <img
            src={grandeImg}
            alt="Grande"
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              maxWidth: '90vw',
              maxHeight: '90vh',
              zIndex: 100000
            }}
            draggable={false}
          />
        </div>
      )}

      {/* Fase AR: A-Frame Scene (mostrar quando NÃO estiver na fase initial) */}
      {(phase !== 'initial') && (
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
                pointerEvents: 'auto'
              }}
            >
              <img
                src={getDialogoImg()}
                alt="Diálogo"
                style={{
                  userSelect: 'none',
                  display: 'block'
                }}
                draggable={false}
              />
              
              {/* Botão Avançar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-60px',
                  right: '20px',
                  pointerEvents: 'auto'
                }}
              >
                <button
                  onClick={handleAvancar}
                  style={{
                    backgroundImage: `url("${getAvancarButton()}")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: 0,
                    margin: 0
                  }}
                  draggable={false}
                />
              </div>

              {/* Botão Voltar */}
              {showBtVoltar && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-60px',
                    left: '20px',
                    pointerEvents: 'auto'
                  }}
                >
                  <button
                    onClick={handleVoltar}
                    style={{
                      backgroundImage: `url("${btVoltarImg}")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: 0,
                      margin: 0
                    }}
                    draggable={false}
                  />
                </div>
              )}
            </div>
          )}

          {/* Menu: bthistoria e btquiz */}
          {phase === 'menu' && (
            <div
              style={{
                position: 'absolute',
                top: '5vh',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                alignItems: 'center',
                pointerEvents: 'auto'
              }}
            >
              <button
                onClick={handleHistoria}
                style={{
                  backgroundImage: `url("${btHistoriaImg}")`,
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
                onClick={handleQuiz}
                style={{
                  backgroundImage: `url("${btQuizImg}")`,
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

          {/* História */}
          {phase === 'historia' && (
            <div
              style={{
                position: 'absolute',
                top: '10vh',
                left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'auto'
              }}
            >
              <img
                src={getDialogoImg()}
                alt="História"
                style={{
                  userSelect: 'none',
                  display: 'block'
                }}
                draggable={false}
              />
              
              {/* Botão Avançar/Concluir */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-60px',
                  right: '20px',
                  pointerEvents: 'auto'
                }}
              >
                <button
                  onClick={handleAvancar}
                  style={{
                    backgroundImage: `url("${getAvancarButton()}")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: 0,
                    margin: 0
                  }}
                  draggable={false}
                />
              </div>

              {/* Botão Voltar */}
              {showBtVoltar && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-60px',
                    left: '20px',
                    pointerEvents: 'auto'
                  }}
                >
                  <button
                    onClick={handleVoltar}
                    style={{
                      backgroundImage: `url("${btVoltarImg}")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: 0,
                      margin: 0
                    }}
                    draggable={false}
                  />
                </div>
              )}
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
              <img
                src={getDialogoImg()}
                alt="Pergunta"
                style={{
                  userSelect: 'none',
                  display: 'block'
                }}
                draggable={false}
              />
              
              {quizPerguntaIndex === 1 && (
                <div
                  style={{
                    position: 'relative',
                    marginTop: '20px'
                  }}
                >
                  <button
                    onClick={handleAvancarQuiz}
                    style={{
                      backgroundImage: `url("${btAvancarImg}")`,
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
                pointerEvents: 'auto'
              }}
            >
              <img
                src={getDialogoImg()}
                alt="Dica"
                style={{
                  userSelect: 'none',
                  display: 'block'
                }}
                draggable={false}
              />
              
              <div
                style={{
                  position: 'absolute',
                  bottom: '-60px',
                  right: '20px',
                  pointerEvents: 'auto'
                }}
              >
                <button
                  onClick={handleAvancarDica}
                  style={{
                    backgroundImage: `url("${btAvancarImg}")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: 0,
                    margin: 0
                  }}
                  draggable={false}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
