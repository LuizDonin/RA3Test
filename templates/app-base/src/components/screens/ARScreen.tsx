import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { FaceTracker } from '../FaceTracker'
import { ARSceneAFrame } from '../ARSceneAFrame'
import { LandscapeEnforcer } from '../LandscapeEnforcer'
import { useRA } from '../../contexts/RAContext'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import '../../styles/ar-screen.css'

interface ARScreenProps {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

const PELICANO_INITIAL_POSITION = { x: 0, y: 1.6, z: -3 }

const DEBUG_CIRCLE_RADIUS_PX = 80
const DEBUG_CIRCLE_RADIUS_PX_SECOND = 80

const PELICANO_INITIAL_SCALE = 1
const PELICANO_MAX_SCALE = 2
const PELICANO_SCALE_TIMER_DURATION = 1.5 // segundos

export const ARScreen: React.FC<ARScreenProps> = ({
  onNavigate
}) => {
  const { raData } = useRA()
  const config = raData?.configuracoes || {}
  const usarAFrame = config.usarAFrame !== false
  const usarVideo = config.usarVideo !== false
  const usarFaceTracking = config.usarFaceTracking !== false

  const [arLoading, setArLoading] = useState(true)
  const [showComecarButton, setShowComecarButton] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const pelicanoKeysRef = useRef<Record<string, boolean>>({})
  const pelicanoMoveAnimationRef = useRef<number | null>(null)
  const pelicanoPositionRef = useRef<{ x: number, y: number, z: number }>({ ...PELICANO_INITIAL_POSITION })
  const pelicanoHandlersRef = useRef<{
    handleKeyDown: ((e: KeyboardEvent) => void) | null
    handleKeyUp: ((e: KeyboardEvent) => void) | null
  }>({ handleKeyDown: null, handleKeyUp: null })

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const binoculosImgRef = useRef<HTMLImageElement | null>(null)
  const [binoculosRect, setBinoculosRect] = useState<{left: number, top: number, width: number, height: number} | null>(null)
  const lastIsInsideRef = useRef<boolean>(false)
  const lastIsInsideRefRight = useRef<boolean>(false)

  const pelicanoTimerRef = useRef<number>(0)
  const pelicanoTimerStartRef = useRef<number | null>(null)
  const pelicanoScalingRef = useRef<boolean>(false)
  const pelicanoLastInCircleRef = useRef<boolean>(false)
  const pelicanoScaleRef = useRef<number>(PELICANO_INITIAL_SCALE)
  const buttonAlreadySpawnedRef = useRef<boolean>(false)

  const getDebugCircleProps = useCallback(() => {
    if (binoculosRect) {
      return {
        centerX: binoculosRect.left + binoculosRect.width / 4,
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

  const getDebugCirclePropsRight = useCallback(() => {
    if (binoculosRect) {
      return {
        centerX: binoculosRect.left + (3 * binoculosRect.width) / 4,
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
      updateRect()
      const observer = new window.ResizeObserver(updateRect)
      observer.observe(binoculosImgRef.current)
      return () => observer.disconnect()
    }
  }, [usarAFrame, arLoading, binoculosImgRef.current])

  useEffect(() => {
    if (!usarVideo) {
      setArLoading(false)
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
            return
          }
        }

        const videoElement = video || (document.getElementById('arjs-video') as HTMLVideoElement)
        if (videoElement && videoElement.srcObject) {
          videoElement.classList.add('ar-video-visible')
          videoRef.current = videoElement
          mediaStreamRef.current = videoElement.srcObject as MediaStream

          setArLoading(false)
        } else {
          console.error('Vídeo não tem stream')
          setArLoading(false)
        }
      } catch (err) {
        console.error('Erro ao configurar câmera:', err)
        setArLoading(false)
      }
    }

    setupCamera()

    return () => {
      // Deixe o vídeo para o FaceTracker
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

  // Corrigido: loop sempre lê a posição ATUAL do pelicano da entidade a-entity,
  // funcionando tanto por teclado (desktop/dev) quanto atualização AR (celular/mobile)
  useEffect(() => {
    if (!usarAFrame) return

    const sceneEl = document.querySelector('a-scene#ar-scene-main') as any
    if (!sceneEl) {
      console.warn('A-Frame Scene não encontrado')
      return
    }

    // Setup da cena e entidades, igual ao código anterior
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

    let assets = sceneEl.querySelector('a-assets')
    if (!assets) {
      assets = document.createElement('a-assets')
      sceneEl.appendChild(assets)
    }

    let pelicanoImg = assets.querySelector('#pelicanoTexture')
    if (!pelicanoImg) {
      pelicanoImg = document.createElement('img')
      pelicanoImg.id = 'pelicanoTexture'
      pelicanoImg.src = normalizePath('assets/images/pelicano.png')
      pelicanoImg.setAttribute('crossorigin', 'anonymous')
      assets.appendChild(pelicanoImg)
    }

    let binoculosImg = assets.querySelector('#binoculosTexture')
    if (!binoculosImg) {
      binoculosImg = document.createElement('img')
      binoculosImg.id = 'binoculosTexture'
      binoculosImg.src = normalizePath('assets/images/binoculos.png')
      binoculosImg.setAttribute('crossorigin', 'anonymous')
      assets.appendChild(binoculosImg)
    }

    let pelicano = document.getElementById('pelicano-entity')
    if (!pelicano) {
      pelicano = document.createElement('a-image')
      pelicano.id = 'pelicano-entity'
      pelicano.setAttribute('src', '#pelicanoTexture')
      pelicano.setAttribute('width', '0.8')
      pelicano.setAttribute('height', '0.8')
      pelicano.setAttribute('position', `${PELICANO_INITIAL_POSITION.x} ${PELICANO_INITIAL_POSITION.y} ${PELICANO_INITIAL_POSITION.z}`)
      pelicano.setAttribute('look-at', '[camera]')
      pelicano.setAttribute('scale', `${PELICANO_INITIAL_SCALE} ${PELICANO_INITIAL_SCALE} ${PELICANO_INITIAL_SCALE}`)
      sceneEl.appendChild(pelicano)
      pelicanoPositionRef.current = { ...PELICANO_INITIAL_POSITION }
      pelicanoScaleRef.current = PELICANO_INITIAL_SCALE
    } else {
      let position = pelicano.getAttribute('position')
      if (position && typeof position === 'string') {
        const [x, y, z] = position.split(' ').map(Number)
        pelicanoPositionRef.current = {
          x: typeof x === 'number' && !isNaN(x) ? x : PELICANO_INITIAL_POSITION.x,
          y: typeof y === 'number' && !isNaN(y) ? y : PELICANO_INITIAL_POSITION.y,
          z: typeof z === 'number' && !isNaN(z) ? z : PELICANO_INITIAL_POSITION.z
        }
      }
      pelicano.setAttribute('scale', `${PELICANO_INITIAL_SCALE} ${PELICANO_INITIAL_SCALE} ${PELICANO_INITIAL_SCALE}`)
      pelicanoScaleRef.current = PELICANO_INITIAL_SCALE
    }

    const binoculosOld = document.getElementById('binoculos-entity')
    if (binoculosOld) {
      binoculosOld.remove()
    }

    const moveSpeed = 0.1

    const handleKeyDown = (e: KeyboardEvent) => {
      let key = e.key
      if (key === 'PageUp' || key === 'PageDown') {
        pelicanoKeysRef.current[key] = true
      } else {
        pelicanoKeysRef.current[key.toLowerCase()] = true
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      let key = e.key
      if (key === 'PageUp' || key === 'PageDown') {
        pelicanoKeysRef.current[key] = false
      } else {
        pelicanoKeysRef.current[key.toLowerCase()] = false
      }
    }
    pelicanoHandlersRef.current.handleKeyDown = handleKeyDown
    pelicanoHandlersRef.current.handleKeyUp = handleKeyUp

    // Corrigido: pega sempre .x, .y, .z com verificação robusta para evitar erro TS
    function updatePelicanoPositionFromEntity() {
      const pelicanoEl = document.getElementById('pelicano-entity')
      if (pelicanoEl) {
        const pos = pelicanoEl.getAttribute('position')
        let px: number, py: number, pz: number;
        if (
          pos &&
          typeof pos === 'object' &&
          'x' in pos && 'y' in pos && 'z' in pos
        ) {
          px = Number((pos as {x: any, y: any, z: any}).x)
          py = Number((pos as {x: any, y: any, z: any}).y)
          pz = Number((pos as {x: any, y: any, z: any}).z)
        } else if (typeof pos === 'string') {
          const [x, y, z] = pos.split(' ').map(Number)
          px = typeof x === 'number' && !isNaN(x) ? x : PELICANO_INITIAL_POSITION.x
          py = typeof y === 'number' && !isNaN(y) ? y : PELICANO_INITIAL_POSITION.y
          pz = typeof z === 'number' && !isNaN(z) ? z : PELICANO_INITIAL_POSITION.z
        } else {
          return
        }
        pelicanoPositionRef.current = { x: px, y: py, z: pz }
      }
    }

    const projectPelicanoToScreen = (pelicanoPosition: {x:number, y:number, z:number}) => {
      const cameraY = 1.6
      const cameraPos = [0, cameraY, 0]
      const fov = 80 * Math.PI / 180
      const aspect = window.innerWidth / window.innerHeight

      const relX = pelicanoPosition.x - cameraPos[0]
      const relY = pelicanoPosition.y - cameraPos[1]
      const relZ = pelicanoPosition.z - cameraPos[2]

      if (relZ >= 0) return null

      const projectionPlaneZ = 1
      const scale = projectionPlaneZ / -relZ
      const projectedX = relX * scale
      const projectedY = relY * scale

      const screenHalfHeight = Math.tan(fov / 2) * projectionPlaneZ
      const screenHalfWidth = screenHalfHeight * aspect

      const ndcX = projectedX / screenHalfWidth
      const ndcY = -projectedY / screenHalfHeight

      const screenX = ((ndcX + 1) / 2) * window.innerWidth
      const screenY = ((ndcY + 1) / 2) * window.innerHeight

      return { x: screenX, y: screenY }
    }

    // Loop principal: sempre atualiza a posição do pelicano a partir do entity (mesmo sem WASD)
    const animationLoop = (nowTs?: number) => {
      const pelicanoEl = document.getElementById('pelicano-entity')
      if (!pelicanoEl) {
        pelicanoMoveAnimationRef.current = null
        return
      }

      // 1. Mover por teclado, se necessário
      let moved = false
      let pos = pelicanoPositionRef.current
      let newX = pos.x
      let newY = pos.y
      let newZ = pos.z

      if (pelicanoKeysRef.current['w']) {
        newZ += moveSpeed
        moved = true
      }
      if (pelicanoKeysRef.current['s']) {
        newZ -= moveSpeed
        moved = true
      }
      if (pelicanoKeysRef.current['a']) {
        newX -= moveSpeed
        moved = true
      }
      if (pelicanoKeysRef.current['d']) {
        newX += moveSpeed
        moved = true
      }
      if (pelicanoKeysRef.current['PageUp']) {
        newY += moveSpeed
        moved = true
      }
      if (pelicanoKeysRef.current['PageDown']) {
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
        pelicanoPositionRef.current = { x: newX, y: newY, z: newZ }
        pelicanoEl.setAttribute('position', `${newX} ${newY} ${newZ}`)
      } else {
        // Sempre pegar a posição ATUAL do entity (isso permite detectar RA dinâmico)
        updatePelicanoPositionFromEntity()
      }

      // 2. Detecção do pelicano nos círculos
      let isInside = false
      let isInsideR = false

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

          const screenPt = projectPelicanoToScreen(pelicanoPositionRef.current)

          const {centerX, centerY, radius} = getDebugCircleProps()
          ctx.globalAlpha = 0.5
          ctx.beginPath()
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
          ctx.strokeStyle = 'red'
          ctx.lineWidth = 3
          ctx.stroke()
          ctx.globalAlpha = 1

          const {centerX: rightX, centerY: rightY, radius: rightRadius} = getDebugCirclePropsRight()
          ctx.globalAlpha = 0.5
          ctx.beginPath()
          ctx.arc(rightX, rightY, rightRadius, 0, Math.PI * 2)
          ctx.strokeStyle = 'blue'
          ctx.lineWidth = 3
          ctx.stroke()
          ctx.globalAlpha = 1

          if (screenPt) {
            ctx.beginPath()
            ctx.arc(screenPt.x, screenPt.y, 12, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(50,120,240,0.90)'
            ctx.fill()

            const dx = screenPt.x - centerX
            const dy = screenPt.y - centerY
            const dist = Math.sqrt(dx*dx + dy*dy)
            isInside = dist <= radius

            if (isInside && !lastIsInsideRef.current) {
              lastIsInsideRef.current = true
              console.log("[DEBUG] Pelicano projetado está ENTRANDO no círculo de debug dos binóculos (central)!")
            } else if (!isInside && lastIsInsideRef.current) {
              lastIsInsideRef.current = false
            }

            const dxR = screenPt.x - rightX
            const dyR = screenPt.y - rightY
            const distR = Math.sqrt(dxR*dxR + dyR*dyR)
            isInsideR = distR <= rightRadius

            if (isInsideR && !lastIsInsideRefRight.current) {
              lastIsInsideRefRight.current = true
              console.log("[DEBUG] Pelicano projetado está ENTRANDO no círculo de debug da direita dos binóculos!")
            } else if (!isInsideR && lastIsInsideRefRight.current) {
              lastIsInsideRefRight.current = false
            }
          } else {
            lastIsInsideRef.current = false
            lastIsInsideRefRight.current = false
          }
        }
      }

      const isPelicanoInAnyCircle = isInside || isInsideR
      const now = typeof nowTs === 'number' ? nowTs : performance.now();

      if (isPelicanoInAnyCircle) {
        if (!pelicanoLastInCircleRef.current) {
          pelicanoTimerStartRef.current = now
          pelicanoTimerRef.current = 0
          pelicanoScalingRef.current = true
        } else {
          if (pelicanoTimerStartRef.current != null) {
            pelicanoTimerRef.current = (now - pelicanoTimerStartRef.current) / 1000
          } else {
            pelicanoTimerRef.current = 0
          }
        }
        let progress = Math.min(pelicanoTimerRef.current / PELICANO_SCALE_TIMER_DURATION, 1)
        let targetScale = PELICANO_INITIAL_SCALE + (PELICANO_MAX_SCALE - PELICANO_INITIAL_SCALE) * progress

        if (pelicanoScaleRef.current !== targetScale) {
          pelicanoEl.setAttribute('scale', `${targetScale} ${targetScale} ${targetScale}`)
          pelicanoScaleRef.current = targetScale
        }
        if (
          pelicanoTimerRef.current >= PELICANO_SCALE_TIMER_DURATION &&
          !buttonAlreadySpawnedRef.current
        ) {
          setShowComecarButton(true)
          buttonAlreadySpawnedRef.current = true
        }
      } else {
        if (pelicanoLastInCircleRef.current || pelicanoScalingRef.current) {
          pelicanoTimerRef.current = 0
          pelicanoTimerStartRef.current = null
          pelicanoScalingRef.current = false

          if (pelicanoScaleRef.current !== PELICANO_INITIAL_SCALE) {
            pelicanoEl.setAttribute('scale', `${PELICANO_INITIAL_SCALE} ${PELICANO_INITIAL_SCALE} ${PELICANO_INITIAL_SCALE}`)
            pelicanoScaleRef.current = PELICANO_INITIAL_SCALE
          }
        }
        setShowComecarButton(false)
        buttonAlreadySpawnedRef.current = false
      }
      pelicanoLastInCircleRef.current = isPelicanoInAnyCircle
      pelicanoMoveAnimationRef.current = requestAnimationFrame(animationLoop)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    animationLoop()

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth
        canvasRef.current.height = window.innerHeight
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      if (pelicanoMoveAnimationRef.current !== null) {
        cancelAnimationFrame(pelicanoMoveAnimationRef.current)
        pelicanoMoveAnimationRef.current = null
      }
      if (pelicanoHandlersRef.current.handleKeyDown) {
        window.removeEventListener('keydown', pelicanoHandlersRef.current.handleKeyDown)
      }
      if (pelicanoHandlersRef.current.handleKeyUp) {
        window.removeEventListener('keyup', pelicanoHandlersRef.current.handleKeyUp)
      }
      window.removeEventListener('resize', handleResize)

      pelicanoKeysRef.current = {}
      pelicanoHandlersRef.current = { handleKeyDown: null, handleKeyUp: null }

      pelicanoTimerRef.current = 0
      pelicanoTimerStartRef.current = null
      pelicanoScalingRef.current = false
      pelicanoLastInCircleRef.current = false
      pelicanoScaleRef.current = PELICANO_INITIAL_SCALE
      buttonAlreadySpawnedRef.current = false

      const cube = document.getElementById('head-cube')
      if (cube) {
        cube.remove()
      }
      const pelicanoEl = document.getElementById('pelicano-entity')
      if (pelicanoEl) {
        pelicanoEl.remove()
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

  const binoculosImgPath = useMemo(() => normalizePath('assets/images/binoculos.png'), [normalizePath])
  const btnComecarImgPath = useMemo(() => normalizePath('assets/images/btn-comecar.png'), [normalizePath])

  return (
    <div className="ar-game-screen">
      <LandscapeEnforcer enabled={true} />
      {arLoading && (
        <div className="ar-loading-overlay">
          <div className="ar-loading-content">
            <div className="ar-loading-spinner"></div>
            <p className="ar-loading-text">Preparando AR...</p>
          </div>
        </div>
      )}

      {usarAFrame && (
        <ARSceneAFrame />
      )}

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
          <img
            ref={binoculosImgRef}
            src={binoculosImgPath}
            alt="Binóculos"
            className="ar-binoculos-overlay"
            style={{
              transform: 'rotateZ(-90deg)',
              maxWidth: '100vw',
              maxHeight: '100vh',
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

      {showComecarButton && (
        <button
          onClick={() => onNavigate('quiz1', 'zoom-out', 'up')}
          style={{
            position: 'fixed',
            left: '50%',
            top: '62%',
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

      {usarFaceTracking && (
        <FaceTracker enabled={true} />
      )}
    </div>
  )
}
