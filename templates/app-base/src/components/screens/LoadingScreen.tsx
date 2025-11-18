import React, { useEffect, useState } from 'react'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { initializeGlobal } from '../../utils/globalInit'
import '../../styles/loading-screen.css'

interface LoadingScreenProps {
    onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
    onLoadingComplete?: () => void
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    onNavigate,
    onLoadingComplete
}) => {
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState('Inicializando...')

    useEffect(() => {
        const loadResources = async () => {
            const resources = [
                // Imagens da tela cover
                '/assets/images/bg-capa.png',
                '/assets/images/header-capa.png',
                '/assets/images/bottom-capa.png',
                '/assets/images/btn-jogar.png',
                '/assets/images/Anita/bgclaro.png',
                '/assets/images/Anita/grande.png',
                '/assets/images/Anita/pequeno.png',
                '/assets/images/Anita/dialogo1.png',
                '/assets/images/Anita/dialogo2.png',
                '/assets/images/Anita/historia1.png',
                '/assets/images/Anita/historia2.png',
                '/assets/images/Anita/historia3.png',
                '/assets/images/Anita/pergunta1.png',
                '/assets/images/Anita/pergunta2.png',
                '/assets/images/Anita/resposta1.png',
                '/assets/images/Anita/resposta2.png',
                '/assets/images/Anita/resposta3.png',
                '/assets/images/Anita/dica1.png',
                '/assets/images/Anita/dica2.png',
                '/assets/images/Chiquinha/bgclaro.png',
                '/assets/images/Chiquinha/grande.png',
                '/assets/images/Chiquinha/pequeno.png',
                '/assets/images/Chiquinha/dialogo1.png',
                '/assets/images/Chiquinha/dialogo2.png',
                '/assets/images/Chiquinha/historia1.png',
                '/assets/images/Chiquinha/historia2.png',
                '/assets/images/Chiquinha/historia3.png',
                '/assets/images/Chiquinha/pergunta1.png',
                '/assets/images/Chiquinha/pergunta2.png',
                '/assets/images/Chiquinha/resposta1.png',
                '/assets/images/Chiquinha/resposta2.png',
                '/assets/images/Chiquinha/resposta3.png',
                '/assets/images/Chiquinha/dica1.png',
                '/assets/images/Chiquinha/dica2.png',
                // Imagens da tela tutorial
                '/assets/images/tutorial-panel.png',
                '/assets/images/btn-comecar.png',
                // Imagens do jogo AR
                '/assets/images/sprites/nave.png',
                '/assets/images/sprites/estrela.png',
                '/assets/images/sprites/cometa.png',
                '/assets/images/sprites/barra-progresso.png',
                '/assets/images/sprites/contador.png',
                '/assets/images/sprites/feedback-acerto.png',
                '/assets/images/sprites/feedback-erro.png',
                // Imagens do modal de resultado
                '/assets/images/modal-acerto.png',
                '/assets/images/modal-erro.png',
                '/assets/images/btn-registrar.png',
                '/assets/images/btn-inicio.png',
                '/assets/images/btn-voltar.png',
                '/assets/images/Titulo.png',
                '/assets/images/btJogar.png',
                '/assets/images/btCreditos.png',
                // Outras imagens importantes
                '/assets/images/SKY.jpg',
                '/assets/images/mascara.png',
                // Dados
                '/assets/data/ra.json',

                '/assets/images/btn-next.png',
                '/assets/images/btn-back.png',

            ]

            const getBaseUrl = () => {
                const base = (import.meta as any)?.env?.BASE_URL || (document?.baseURI ? new URL(document.baseURI).pathname : '/')
                const b = base && base !== '/' ? (base.endsWith('/') ? base : base + '/') : '/'
                return b
            }

            const baseUrl = getBaseUrl()

            try {
                // A inicialização global já foi feita no main.tsx
                // Apenas aguardar ela completar
                setStatus('Aguardando inicialização...')
                await initializeGlobal()

                // Carregar imagens
                setStatus('Carregando recursos...')
                for (let i = 0; i < resources.length; i++) {
                    const resource = resources[i]
                    const fullUrl = `${baseUrl}${resource.startsWith('/') ? resource.slice(1) : resource}`

                    if (resource.endsWith('.json')) {
                        // Carregar JSON
                        try {
                            const response = await fetch(fullUrl)
                            if (!response.ok) throw new Error(`Failed to load ${resource}`)
                        } catch (error) {
                            console.warn(`Failed to load ${resource}:`, error)
                        }
                    } else {
                        // Carregar imagem
                        await new Promise((resolve) => {
                            const img = new Image()
                            img.onload = () => resolve(img)
                            img.onerror = () => {
                                console.warn(`Failed to load image: ${fullUrl}`)
                                resolve(null) // Continuar mesmo se falhar
                            }
                            img.src = fullUrl
                        })
                    }

                    const newProgress = Math.round(((i + 1) / resources.length) * 100)
                    setProgress(newProgress)
                }

                setStatus('Finalizando...')

                // Pequeno delay para animação suave
                await new Promise(resolve => setTimeout(resolve, 300))

                setProgress(100)
                setStatus('Concluído!')

                // Aguardar um pouco antes de navegar
                await new Promise(resolve => setTimeout(resolve, 200))

                onLoadingComplete?.()
                // Usar transição fade para saída suave
                onNavigate('cover', 'flip', 'left')
            } catch (error) {
                console.error('Erro ao carregar recursos:', error)
                setStatus('Erro ao carregar. Continuando...')
                // Mesmo com erro, continuar para a tela cover
                setTimeout(() => {
                    onNavigate('cover', 'flip', 'left')
                }, 1000)
            }
        }

        loadResources()

        // Cleanup ao desmontar
        return () => {
            // cleanupOrientation será chamado automaticamente quando necessário
        }
    }, [onNavigate, onLoadingComplete])

    return (
        <div className="loading-screen">
            <div className="loading-content">
                <div className="loading-logo">
                    <div className="loading-spinner"></div>
                </div>

                <h2 className="loading-title">Carregando</h2>

                <div className="loading-progress-container">
                    <div className="loading-progress-bar">
                        <div
                            className="loading-progress-fill"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <p className="loading-percentage">{progress}%</p>
                </div>

                <p className="loading-status">{status}</p>
            </div>
        </div>
    )
}

