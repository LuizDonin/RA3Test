import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { FaceTracker } from '../FaceTracker'
import { ARSceneAFrame } from '../ARSceneAFrame'
import { LandscapeEnforcer } from '../LandscapeEnforcer'
import { useRA } from '../../contexts/RAContext'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import '../../styles/ar-screen.css'

interface ARScreen2Props {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

const MACACO_INITIAL_POSITION = { x: 0, y: 1.6, z: -3 }

// Parâmetro: raio do círculo de referência do binóculo em px
const DEBUG_CIRCLE_RADIUS_PX = 80
const DEBUG_CIRCLE_RADIUS_PX_SECOND = 80 // Pode ajustar o tamanho caso deseje

const MACACO_INITIAL_SCALE = 1
const MACACO_MAX_SCALE = 2
const MACACO_SCALE_TIMER_DURATION = 1.5 // segundos

export const ARScreen2: React.FC<ARScreen2Props> = ({
  onNavigate
}) => {
  const { raData } = useRA()
  const config = raData?.configuracoes || {}
  const usarAFrame = config.usarAFrame !== false
  const usarVideo = config.usarVideo !== false
  const usarFaceTracking = config.usarFaceTracking !== false

  const [arLoading, setArLoading] = useState(true)
  const [showComecarButton, setShowComecarButton] = useState(false)
  const [isFadingIn, setIsFadingIn] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const macacoKeysRef = useRef<Record<string, boolean>>({})
  const macacoMoveAnimationRef = useRef<number | null>(null)
  const macacoPositionRef = useRef<{ x: number, y: number, z: number }>({ ...MACACO_INITIAL_POSITION })
  const macacoHandlersRef = useRef<{
    handleKeyDown: ((e: KeyboardEvent) => void) | null
    handleKeyUp: ((e: KeyboardEvent) => void) | null
  }>({ handleKeyDown: null, handleKeyUp: null })

  // -- Círculo de debug dos binóculos (em relação ao binóculos, não mais à janela)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const binoculosImgRef = useRef<HTMLImageElement | null>(null)
  const [binoculosRect, setBinoculosRect] = useState<{left: number, top: number, width: number, height: number} | null>(null)
  const lastIsInsideRef = useRef<boolean>(false)
  const lastIsInsideRefRight = useRef<boolean>(false)

  // Novos: refs para timer e scale (imperativo)
  const macacoTimerRef = useRef<number>(0) // tempo dentro do círculo, em segundos
  const macacoTimerStartRef = useRef<number | null>(null)
  const macacoScalingRef = useRef<boolean>(false) // indica se está em processo de scale
  const macacoLastInCircleRef = useRef<boolean>(false) // true se estava dentro de qualquer círculo no último frame
  const macacoScaleRef = useRef<number>(MACACO_INITIAL_SCALE)

  // Para garantir condição de exibir o botão "começar" apenas uma vez se for necessário
  const buttonAlreadySpawnedRef = useRef<boolean>(false)

  // O círculo fica agora no centro do binóculo.
  const getDebugCircleProps = useCallback(() => {
    if (binoculosRect) {
      return {
        centerX: binoculosRect.left + binoculosRect.width / 2.8,
        centerY: binoculosRect.top + binoculosRect.height / 2,
        radius: DEBUG_CIRCLE_RADIUS_PX
      }
    }
    return {
      centerX: window.innerWidth / 2,
      centerY: window.innerHeight / 2,
      radius: DEBUG_CIRCLE_RADIUS_PX
    }
  }, [binoculosRect])

  // NOVO: função para círculo mais à direita do binóculos
  const getDebugCirclePropsRight = useCallback(() => {
    if (binoculosRect) {
      return {
        centerX: binoculosRect.left + (2.6 * binoculosRect.width) / 4,
        centerY: binoculosRect.top + binoculosRect.height / 2,
        radius: DEBUG_CIRCLE_RADIUS_PX_SECOND
      }
    }
    return {
      centerX: window.innerWidth / 2,
      centerY: window.innerHeight / 2,
      radius: DEBUG_CIRCLE_RADIUS_PX_SECOND
    }
  }, [binoculosRect])

  // Atualiza o bounding box do binóculos sempre que ele muda ou quando tela redimensiona
  useEffect(() => {
    function updateRect() {
      if (binoculosImgRef.current) {
        const rect = binoculosImgRef.current.getBoundingClientRect()
        setBinoculosRect({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        })
      }
    }
    // Atualizar em resize/orientação
    window.addEventListener('resize', updateRect)
    window.addEventListener('orientationchange', updateRect)
    updateRect()

    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('orientationchange', updateRect)
    }
  }, [])

  useEffect(() => {
    if (binoculosImgRef.current) {
      const updateRect = () => {
        const rect = binoculosImgRef.current!.getBoundingClientRect()
        setBinoculosRect({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        })
      }
      // Observador para o clique inicial (em load) e para qualquer mudança
      updateRect()
      const observer = new window.ResizeObserver(updateRect)
      observer.observe(binoculosImgRef.current)
      return () => observer.disconnect()
    }
  }, [usarAFrame, arLoading, binoculosImgRef.current])

  // Verificar orientação para mostrar/esconder tela preta
  useEffect(() => {
    const checkOrientation = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const isCurrentlyPortrait = height > width
      setIsPortrait(isCurrentlyPortrait)
    }

    // Verificar orientação inicial
    checkOrientation()

    // Listeners para mudanças de orientação
    let resizeTimeout: NodeJS.Timeout
    let orientationTimeout: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        checkOrientation()
      }, 50)
    }

    const handleOrientationChange = () => {
      clearTimeout(orientationTimeout)
      orientationTimeout = setTimeout(() => {
        checkOrientation()
      }, 100)
    }

    const handleScreenOrientationChange = () => {
      clearTimeout(orientationTimeout)
      orientationTimeout = setTimeout(() => {
        checkOrientation()
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)
    
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handleScreenOrientationChange)
    }

    // Verificar periodicamente
    const intervalCheck = setInterval(() => {
      checkOrientation()
    }, 200)

    return () => {
      clearTimeout(resizeTimeout)
      clearTimeout(orientationTimeout)
      clearInterval(intervalCheck)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', handleScreenOrientationChange)
      }
    }
  }, [])

  useEffect(() => {
    if (!usarVideo) {
      setArLoading(false)
      // Iniciar fade-in mesmo sem vídeo após delay
      setTimeout(() => {
        const macacoEl = document.getElementById('macaco-entity')
        if (macacoEl || !usarAFrame) {
          setIsFadingIn(true)
        } else {
          setTimeout(() => setIsFadingIn(true), 200)
        }
      }, 500)
      return
    }

    async function setupCamera() {
      try {
        const video = document.getElementById('arjs-video') as HTMLVideoElement
        if (!video || !video.srcObject) {
          console.warn('Vídeo global não encontrado, aguardando...')
          await new Promise(resolve => setTimeout(resolve, 1000))
          const retryVideo = document.getElementById('arjs-video') as HTMLVideoElement
          if (!retryVideo || !retryVideo.srcObject) {
            console.error('Vídeo ainda não disponível')
            setArLoading(false)
            // Mesmo sem vídeo, iniciar fade-in após delay
            setTimeout(() => {
              const macacoEl = document.getElementById('macaco-entity')
              if (macacoEl || !usarAFrame) {
                setIsFadingIn(true)
              } else {
                setTimeout(() => setIsFadingIn(true), 200)
              }
            }, 500)
            return
          }
        }

        const videoElement = video || (document.getElementById('arjs-video') as HTMLVideoElement)
        if (videoElement && videoElement.srcObject) {
          videoElement.classList.add('ar-video-visible')
          videoRef.current = videoElement
          mediaStreamRef.current = videoElement.srcObject as MediaStream

          setArLoading(false)
          // Iniciar fade-in após um delay para garantir que os objetos A-Frame estejam prontos
          setTimeout(() => {
            // Verificar se os objetos foram criados antes de fazer fade-in
            const macacoEl = document.getElementById('macaco-entity')
            if (macacoEl || !usarAFrame) {
              setIsFadingIn(true)
            } else {
              // Se ainda não estiver pronto, tentar novamente
              setTimeout(() => setIsFadingIn(true), 200)
            }
          }, 500)
        } else {
          console.error('Vídeo não tem stream')
          setArLoading(false)
          // Mesmo sem vídeo, iniciar fade-in após delay
          setTimeout(() => {
            const macacoEl = document.getElementById('macaco-entity')
            if (macacoEl || !usarAFrame) {
              setIsFadingIn(true)
            } else {
              setTimeout(() => setIsFadingIn(true), 200)
            }
          }, 500)
        }
      } catch (err) {
        console.error('Erro ao configurar câmera:', err)
        setArLoading(false)
        // Mesmo com erro, iniciar fade-in após delay
        setTimeout(() => {
          const macacoEl = document.getElementById('macaco-entity')
          if (macacoEl || !usarAFrame) {
            setIsFadingIn(true)
          } else {
            setTimeout(() => setIsFadingIn(true), 200)
          }
        }, 500)
      }
    }

    setupCamera()

    return () => {
      // Não limpar aqui - deixar o vídeo para o FaceTracker
    }
  }, [usarVideo])

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

  // Adiciona imagem dos binóculos nos assets apenas (não mais na cena 3D)
  useEffect(() => {
    if (!usarAFrame) return

    const sceneEl = document.querySelector('a-scene#ar-scene-main') as any
    if (!sceneEl) {
      console.warn('A-Frame Scene não encontrado')
      return
    }

    // Adicionar câmera
    let camera = document.getElementById('camera')
    if (!camera) {
      camera = document.createElement('a-entity')
      camera.id = 'camera'
      camera.setAttribute('camera', 'active: true')
      camera.setAttribute('look-controls', 'enabled: true; reverseMouseDrag: false; touchEnabled: true; magicWindowTrackingEnabled: true; pointerLockEnabled: false; touchSensitivity: 1; mouseSensitivity: 1')
      camera.setAttribute('wasd-controls', 'enabled: false')
      camera.setAttribute('position', '0 1.6 0')
      sceneEl.appendChild(camera)
    }

    // Adicionar luzes
    let ambientLight = sceneEl.querySelector('#ambient-light')
    if (!ambientLight) {
      ambientLight = document.createElement('a-entity')
      ambientLight.id = 'ambient-light'
      ambientLight.setAttribute('light', 'type: ambient; color: #888')
      sceneEl.appendChild(ambientLight)
    }

    let directionalLight = sceneEl.querySelector('#directional-light')
    if (!directionalLight) {
      directionalLight = document.createElement('a-entity')
      directionalLight.id = 'directional-light'
      directionalLight.setAttribute('light', 'type: directional; color: #fff; intensity: 0.6')
      directionalLight.setAttribute('position', '1 1 1')
      sceneEl.appendChild(directionalLight)
    }

    // Adicionar head-cube (seguir rotação da cabeça)
    let headCube = document.getElementById('head-cube')
    if (!headCube) {
      headCube = document.createElement('a-entity')
      headCube.id = 'head-cube'
      headCube.setAttribute('geometry', 'primitive: box; width: 0.3; height: 0.3; depth: 0.3')
      headCube.setAttribute('material', 'color: #FF6B6B; opacity: 0; transparent: true')
      headCube.setAttribute('position', '0 1 -1.2')
      headCube.setAttribute('rotation', '0 0 0')
      sceneEl.appendChild(headCube)
    }

    // Adicionar assets caso não existam
    let assets = sceneEl.querySelector('a-assets')
    if (!assets) {
      assets = document.createElement('a-assets')
      sceneEl.appendChild(assets)
    }

    // Macaco (usando macaco1.png)
    let macacoImg = assets.querySelector('#macacoTexture')
    if (!macacoImg) {
      macacoImg = document.createElement('img')
      macacoImg.id = 'macacoTexture'
      macacoImg.src = normalizePath('assets/images/macaco1.png')
      macacoImg.setAttribute('crossorigin', 'anonymous')
      assets.appendChild(macacoImg)
    }

    // Binóculos asset (mantido apenas para referência; imagem real será na tela, não mais como a-image)
    let binoculosImg = assets.querySelector('#binoculosTexture')
    if (!binoculosImg) {
      binoculosImg = document.createElement('img')
      binoculosImg.id = 'binoculosTexture'
      binoculosImg.src = normalizePath('assets/images/binoculos.png')
      binoculosImg.setAttribute('crossorigin', 'anonymous')
      assets.appendChild(binoculosImg)
    }

    // Macaco entity
    let macaco = document.getElementById('macaco-entity')
    if (!macaco) {
      macaco = document.createElement('a-image')
      macaco.id = 'macaco-entity'
      macaco.setAttribute('src', '#macacoTexture')
      macaco.setAttribute('width', '0.8')
      macaco.setAttribute('height', '0.8')
      macaco.setAttribute('position', `${MACACO_INITIAL_POSITION.x} ${MACACO_INITIAL_POSITION.y} ${MACACO_INITIAL_POSITION.z}`)
      macaco.setAttribute('look-at', '[camera]')
      // Inicializa escala no valor inicial
      macaco.setAttribute('scale', `${MACACO_INITIAL_SCALE} ${MACACO_INITIAL_SCALE} ${MACACO_INITIAL_SCALE}`)
      sceneEl.appendChild(macaco)
      macacoPositionRef.current = { ...MACACO_INITIAL_POSITION }
      macacoScaleRef.current = MACACO_INITIAL_SCALE
    } else {
      let position = macaco.getAttribute('position')
      if (position && typeof position === 'string') {
        const [x, y, z] = position.split(' ').map(Number)
        macacoPositionRef.current = {
          x: typeof x === 'number' && !isNaN(x) ? x : MACACO_INITIAL_POSITION.x,
          y: typeof y === 'number' && !isNaN(y) ? y : MACACO_INITIAL_POSITION.y,
          z: typeof z === 'number' && !isNaN(z) ? z : MACACO_INITIAL_POSITION.z
        }
      } else {
        macacoPositionRef.current = { ...MACACO_INITIAL_POSITION }
        macaco.setAttribute('position', `${MACACO_INITIAL_POSITION.x} ${MACACO_INITIAL_POSITION.y} ${MACACO_INITIAL_POSITION.z}`)
      }
      // Inicializa a escala do macaco ao valor inicial na reinstanciação
      macaco.setAttribute('scale', `${MACACO_INITIAL_SCALE} ${MACACO_INITIAL_SCALE} ${MACACO_INITIAL_SCALE}`)
      macacoScaleRef.current = MACACO_INITIAL_SCALE
    }

    // REMOVE binoculos-entity (não mais na cena 3D)
    const binoculosOld = document.getElementById('binoculos-entity')
    if (binoculosOld) {
      binoculosOld.remove()
    }

    const moveSpeed = 0.1

    const handleKeyDown = (e: KeyboardEvent) => {
      let key = e.key
      if (key === 'PageUp' || key === 'PageDown') {
        macacoKeysRef.current[key] = true
      } else {
        macacoKeysRef.current[key.toLowerCase()] = true
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      let key = e.key
      if (key === 'PageUp' || key === 'PageDown') {
        macacoKeysRef.current[key] = false
      } else {
        macacoKeysRef.current[key.toLowerCase()] = false
      }
    }

    macacoHandlersRef.current.handleKeyDown = handleKeyDown
    macacoHandlersRef.current.handleKeyUp = handleKeyUp

    // --- Projeção do macaco para tela/círculo de debug usando a câmera real do A-Frame
    const projectMacacoToScreen = (macacoPosition: {x:number, y:number, z:number}) => {
      // Obter a câmera do A-Frame
      const cameraEl = document.getElementById('camera') as any
      if (!cameraEl) {
        console.warn('Câmera não encontrada')
        return null
      }

      // Obter o objeto THREE.js da câmera
      const threeCam = cameraEl.getObject3D && cameraEl.getObject3D('camera')
      if (!threeCam || !(window as any).THREE) {
        console.warn('THREE.js ou câmera THREE não disponível')
        return null
      }

      const THREE = (window as any).THREE

      // Obter a posição do macaco no espaço 3D
      const macacoEl = document.getElementById('macaco-entity') as any
      if (!macacoEl) {
        return null
      }

      // Obter a posição do macaco no espaço mundial (world space)
      // Tentar obter o objeto 3D do macaco (pode ser 'mesh' ou o objeto raiz)
      let macacoObj3D = macacoEl.getObject3D && macacoEl.getObject3D('mesh')
      if (!macacoObj3D) {
        // Tentar obter o objeto raiz se não houver mesh
        macacoObj3D = macacoEl.object3D || (macacoEl.getObject3D && macacoEl.getObject3D('object3d'))
      }

      let worldPos: any

      if (macacoObj3D && macacoObj3D.getWorldPosition) {
        // Usar a posição mundial do objeto 3D (mais preciso, considera rotações e transformações)
        worldPos = new THREE.Vector3()
        macacoObj3D.getWorldPosition(worldPos)
      } else {
        // Fallback: usar a posição do atributo (menos preciso, mas funciona)
        const posAttr = macacoEl.getAttribute('position')
        if (posAttr && typeof posAttr === 'object' && 'x' in posAttr) {
          worldPos = new THREE.Vector3(posAttr.x, posAttr.y, posAttr.z)
        } else {
          // Último fallback: usar a posição de referência
          worldPos = new THREE.Vector3(macacoPosition.x, macacoPosition.y, macacoPosition.z)
        }
      }
      
      // Projetar no espaço da câmera usando THREE.js
      const vector = worldPos.clone()
      vector.project(threeCam)

      // Converter de NDC (-1 a 1) para coordenadas de tela (0 a width/height)
      const screenX = ((vector.x + 1) / 2) * window.innerWidth
      const screenY = ((1 - vector.y) / 2) * window.innerHeight // Inverter Y

      // Verificar se está na frente da câmera (z entre -1 e 1 em NDC significa que está visível)
      // z < -1 significa muito longe, z > 1 significa atrás da câmera
      if (vector.z > 1 || vector.z < -1) {
        return null // Está atrás da câmera ou muito longe
      }

      return { x: screenX, y: screenY }
    }

    // -- Loop principal da animação + detecção do círculo + scale
    const moveMacaco = (nowTs?: number) => {
      const macacoEl = document.getElementById('macaco-entity')
      if (!macacoEl) {
        macacoMoveAnimationRef.current = null
        return
      }

      let pos = macacoPositionRef.current
      let newX = pos.x
      let newY = pos.y
      let newZ = pos.z

      let moved = false
      if (macacoKeysRef.current['w']) {
        newZ += moveSpeed
        moved = true
      }
      if (macacoKeysRef.current['s']) {
        newZ -= moveSpeed
        moved = true
      }
      if (macacoKeysRef.current['a']) {
        newX -= moveSpeed
        moved = true
      }
      if (macacoKeysRef.current['d']) {
        newX += moveSpeed
        moved = true
      }
      if (macacoKeysRef.current['PageUp']) {
        newY += moveSpeed
        moved = true
      }
      if (macacoKeysRef.current['PageDown']) {
        newY -= moveSpeed
        moved = true
      }

      const minX = -3, maxX = 3
      const minY = 0, maxY = 4
      const minZ = -6, maxZ = 0
      newX = Math.max(minX, Math.min(maxX, newX))
      newY = Math.max(minY, Math.min(maxY, newY))
      newZ = Math.max(minZ, Math.min(maxZ, newZ))

      if (moved) {
        macacoPositionRef.current = { x: newX, y: newY, z: newZ }
        macacoEl.setAttribute('position', `${newX} ${newY} ${newZ}`)
      }

      // === 2D debug: projeta macaco e verifica se colide com círculos relativos ao binóculo
      let isInside = false
      let isInsideR = false

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

          // Usar a posição atual do macaco (pode ter mudado devido à rotação da câmera)
          const screenPt = projectMacacoToScreen(macacoPositionRef.current)

          // Desenha o círculo central do binóculos
          const {centerX, centerY, radius} = getDebugCircleProps()
          ctx.globalAlpha = 0.5
          ctx.beginPath()
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
          ctx.strokeStyle = 'red'
          ctx.lineWidth = 3
          ctx.stroke()
          ctx.globalAlpha = 1

          // Desenha o segundo círculo mais para a direita
          const {centerX: rightX, centerY: rightY, radius: rightRadius} = getDebugCirclePropsRight()
          ctx.globalAlpha = 0.5
          ctx.beginPath()
          ctx.arc(rightX, rightY, rightRadius, 0, Math.PI * 2)
          ctx.strokeStyle = 'blue'
          ctx.lineWidth = 3
          ctx.stroke()
          ctx.globalAlpha = 1

          // Desenha a posição projetada do macaco
          if (screenPt) {
            ctx.beginPath()
            ctx.arc(screenPt.x, screenPt.y, 12, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(50,120,240,0.90)'
            ctx.fill()

            // Checa se está dentro dos círculos
            const dx = screenPt.x - centerX
            const dy = screenPt.y - centerY
            const dist = Math.sqrt(dx*dx + dy*dy)
            isInside = dist <= radius

            if (isInside && !lastIsInsideRef.current) {
              lastIsInsideRef.current = true
              console.log("[DEBUG] Macaco projetado está ENTRANDO no círculo de debug dos binóculos (central)!")
            } else if (!isInside && lastIsInsideRef.current) {
              lastIsInsideRef.current = false
            }

            // Círculo da direita
            const dxR = screenPt.x - rightX
            const dyR = screenPt.y - rightY
            const distR = Math.sqrt(dxR*dxR + dyR*dyR)
            isInsideR = distR <= rightRadius

            if (isInsideR && !lastIsInsideRefRight.current) {
              lastIsInsideRefRight.current = true
              console.log("[DEBUG] Macaco projetado está ENTRANDO no círculo de debug da direita dos binóculos!")
            } else if (!isInsideR && lastIsInsideRefRight.current) {
              lastIsInsideRefRight.current = false
            }
          } else {
            lastIsInsideRef.current = false
            lastIsInsideRefRight.current = false
          }
        }
      }

      // ================================
      // --- Lógica do scale animado  ---
      // ================================
      const isMacacoInAnyCircle = isInside || isInsideR;

      const now = typeof nowTs === 'number' ? nowTs : performance.now();
      // now em ms, precisamos segundos para timer

      if (isMacacoInAnyCircle) {
        if (!macacoLastInCircleRef.current) {
          // Entrou em círculo: inicia timer
          macacoTimerStartRef.current = now
          macacoTimerRef.current = 0
          macacoScalingRef.current = true
        } else {
          // Já está dentro, atualiza timer
          if (macacoTimerStartRef.current != null) {
            macacoTimerRef.current = (now - macacoTimerStartRef.current) / 1000 // em segundos
          } else {
            macacoTimerRef.current = 0
          }
        }
        // Calcula o novo scale proporcional
        let progress = Math.min(macacoTimerRef.current / MACACO_SCALE_TIMER_DURATION, 1)
        let targetScale = MACACO_INITIAL_SCALE + (MACACO_MAX_SCALE - MACACO_INITIAL_SCALE) * progress

        // Aplica o scale no macaco (A-Frame entity)
        if (macacoScaleRef.current !== targetScale) {
          macacoEl.setAttribute('scale', `${targetScale} ${targetScale} ${targetScale}`)
          macacoScaleRef.current = targetScale
        }

        // ----------- Lógica para mostrar o botão "começar" -------------
        if (
          macacoTimerRef.current >= MACACO_SCALE_TIMER_DURATION &&
          !buttonAlreadySpawnedRef.current
        ) {
          setShowComecarButton(true)
          buttonAlreadySpawnedRef.current = true
        }
      } else {
        if (macacoLastInCircleRef.current || macacoScalingRef.current) {
          // Saiu dos círculos: reseta timer e scale
          macacoTimerRef.current = 0
          macacoTimerStartRef.current = null
          macacoScalingRef.current = false

          if (macacoScaleRef.current !== MACACO_INITIAL_SCALE) {
            macacoEl.setAttribute('scale', `${MACACO_INITIAL_SCALE} ${MACACO_INITIAL_SCALE} ${MACACO_INITIAL_SCALE}`)
            macacoScaleRef.current = MACACO_INITIAL_SCALE
          }
        }
        // Se sair dos círculos, esconde o botão
        setShowComecarButton(false)
        buttonAlreadySpawnedRef.current = false
      }
      macacoLastInCircleRef.current = isMacacoInAnyCircle

      macacoMoveAnimationRef.current = requestAnimationFrame(moveMacaco)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    moveMacaco()

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth
        canvasRef.current.height = window.innerHeight
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      if (macacoMoveAnimationRef.current !== null) {
        cancelAnimationFrame(macacoMoveAnimationRef.current)
        macacoMoveAnimationRef.current = null
      }

      if (macacoHandlersRef.current.handleKeyDown) {
        window.removeEventListener('keydown', macacoHandlersRef.current.handleKeyDown)
      }
      if (macacoHandlersRef.current.handleKeyUp) {
        window.removeEventListener('keyup', macacoHandlersRef.current.handleKeyUp)
      }
      window.removeEventListener('resize', handleResize)

      macacoKeysRef.current = {}
      macacoHandlersRef.current = { handleKeyDown: null, handleKeyUp: null }

      macacoTimerRef.current = 0
      macacoTimerStartRef.current = null
      macacoScalingRef.current = false
      macacoLastInCircleRef.current = false
      macacoScaleRef.current = MACACO_INITIAL_SCALE
      buttonAlreadySpawnedRef.current = false

      const cube = document.getElementById('head-cube')
      if (cube) {
        cube.remove()
      }
      const macacoEl = document.getElementById('macaco-entity')
      if (macacoEl) {
        macacoEl.remove()
      }
      const cameraEl = document.getElementById('camera')
      if (cameraEl) {
        cameraEl.remove()
      }
      const ambientLightEl = sceneEl.querySelector('#ambient-light')
      if (ambientLightEl) {
        ambientLightEl.remove()
      }
      const directionalLightEl = sceneEl.querySelector('#directional-light')
      if (directionalLightEl) {
        directionalLightEl.remove()
      }
      const assetsEl = sceneEl.querySelector('a-assets')
      if (assetsEl) {
        assetsEl.remove()
      }
    }
  }, [usarAFrame, normalizePath, getDebugCircleProps, getDebugCirclePropsRight])

  // Caminho para imagem dos binóculos para uso na tela
  const binoculosImgPath = useMemo(() => normalizePath('assets/images/binoculos.png'), [normalizePath])

  // Caminho para btn-comecar
  const btnComecarImgPath = useMemo(() => normalizePath('assets/images/btn-comecar.png'), [normalizePath])

  // Ao exibir overlay dos binóculos, desenha também o círculo no mesmo local
  return (
    <div className={`ar-game-screen ${isFadingIn ? 'ar-screen-fade-in' : 'ar-screen-fade-out'}`}>
      {/* Landscape Enforcer - força orientação landscape */}
      <LandscapeEnforcer enabled={true} />
      
      {/* Tela preta quando em portrait - cobre tudo incluindo a câmera */}
      {isPortrait && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000000',
            zIndex: 999999998,
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease-out'
          }}
        />
      )}
      
      {/* Loading overlay */}
      {arLoading && (
        <div className="ar-loading-overlay">
          <div className="ar-loading-content">
            <div className="ar-loading-spinner"></div>
            <p className="ar-loading-text">Preparando AR...</p>
          </div>
        </div>
      )}

      {/* A-Frame Scene (se habilitado) */}
      {usarAFrame && (
        <ARSceneAFrame />
      )}

      {/* Binóculos na tela, centralizado, sem escala, com tamanho nativo + círculo de debug */}
      {usarAFrame && !arLoading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {
          <img
            ref={binoculosImgRef}
            src={binoculosImgPath}
            alt="Binóculos"
            className="ar-binoculos-overlay"
            style={{
              transform: 'rotateZ(-90deg)',
              maxWidth: '300vw',
              maxHeight: '300vh',
              width: 'auto',
              height: 'auto',
              display: 'block',
              pointerEvents: 'none',
            }}
            draggable={false}
            onLoad={() => {
              if (binoculosImgRef.current) {
                const rect = binoculosImgRef.current.getBoundingClientRect()
                setBinoculosRect({
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                })
              }
            }}
          />
          }
          {/* Canvas de overlay para círculos de debug */}
          <canvas
            ref={canvasRef}
            width={typeof window !== 'undefined' ? window.innerWidth : 1920}
            height={typeof window !== 'undefined' ? window.innerHeight : 1080}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: '100vw',
              height: '100vh',
              pointerEvents: 'none',
              zIndex: 999999,
            }}
          />
        </div>
      )}

      {/* Botão "Começar" - centralizado horizontalmente, mas cerca de 30% abaixo do topo da tela */}
      {showComecarButton && (
        <button
          onClick={() => onNavigate('quiz2', 'zoom-out', 'up')}
          style={{
            position: 'fixed',
            left: '50%',
            top: '62%', // ~a little bit below center vertically
            transform: 'translate(-50%, -50%)',
            zIndex: 9999999,
            background: 'none',
            border: 'none',
            outline: 'none',
            padding: 0,
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}
        >
          <img
            src={btnComecarImgPath}
            alt="Começar"
            draggable={false}
            style={{
              width: '240px',
              height: 'auto',
              display: 'block',
              pointerEvents: 'auto',
              userSelect: 'none'
            }}
          />
        </button>
      )}

      {/* Face Tracker (se habilitado) */}
      {usarFaceTracking && (
        <FaceTracker enabled={true} />
      )}
    </div>
  )
}

