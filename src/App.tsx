import { useEffect, useRef, useState } from 'react'
import './App.css'

const CLASSES = [
  { name: 'helmet', label: 'Capacete' },
  { name: 'gloves', label: 'Luvas' },
  { name: 'vest', label: 'Colete' },
  { name: 'boots', label: 'Botas' },
  { name: 'goggles', label: 'Óculos de proteção' },
  { name: 'Person', label: 'Pessoa' },
] as const

const MIN_CONFIDENCE = 0.4

type Detection = {
  class_id: number
  class_name: string
  confidence: number
  box: { x1: number; y1: number; x2: number; y2: number }
}

const API_URL = 'http://localhost:8000'
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws/detect'

function removeDuplicateDetections(detections: Detection[]) {
  const uniqueDetections = new Map<string, Detection>()

  for (const detection of detections) {
    const key = detection.class_name
    const previous = uniqueDetections.get(key)

    if (!previous || detection.confidence > previous.confidence) {
      uniqueDetections.set(key, detection)
    }
  }

  return [...uniqueDetections.values()]
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [erroCamera, setErroCamera] = useState<string | null>(null)
  const [imagem, setImagem] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [detections, setDetections] = useState<Detection[]>([])
  const [analisada, setAnalisada] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erroAnalise, setErroAnalise] = useState<string | null>(null)
  const [statusWebsocket, setStatusWebsocket] = useState<string | null>(null)

  const visibleDetections = detections.filter(
    (detection) =>
      !detection.class_name.startsWith('no_') && detection.class_name !== 'none',
  )

  useEffect(() => {
    const canvas = overlayCanvasRef.current
    const video = videoRef.current
    if (!canvas || !video || !cameraAtiva || !video.videoWidth) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.lineWidth = 4
    context.font = 'bold 18px sans-serif'

    visibleDetections
      .filter((detection) => detection.confidence > MIN_CONFIDENCE)
      .forEach((detection) => {
        const { x1, y1, x2, y2 } = detection.box
        const label =
          CLASSES.find(({ name }) => name === detection.class_name)?.label ??
          detection.class_name
        const text = `${label} ${Math.round(detection.confidence * 100)}%`
        const textWidth = context.measureText(text).width

        context.strokeStyle = '#f26b0f'
        context.strokeRect(x1, y1, x2 - x1, y2 - y1)
        context.fillStyle = '#f26b0f'
        context.fillRect(x1, Math.max(0, y1 - 28), textWidth + 12, 28)
        context.fillStyle = '#fff'
        context.fillText(text, x1 + 6, Math.max(20, y1 - 8))
      })
  }, [cameraAtiva, visibleDetections])

  useEffect(() => {
    if (!cameraAtiva) return

    const video = videoRef.current
    const captureCanvas = captureCanvasRef.current
    if (!video || !captureCanvas) return

    const socket = new WebSocket(WS_URL)
    let frameInProgress = false
    websocketRef.current = socket
    setStatusWebsocket('Conectando à detecção em tempo real...')

    socket.onopen = () => {
      setStatusWebsocket('Detecção em tempo real ativa')
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        detections?: Detection[]
        error?: string
      }

      if (data.error) {
        setErroCamera(data.error)
        return
      }

      setDetections(
        Array.isArray(data.detections)
          ? removeDuplicateDetections(data.detections)
          : [],
      )
      setAnalisada(true)
    }

    socket.onerror = () => {
      setStatusWebsocket(null)
      setErroCamera('Não foi possível conectar à detecção em tempo real.')
    }

    socket.onclose = () => {
      websocketRef.current = null
      setStatusWebsocket(null)
    }

    const timer = window.setInterval(() => {
      if (
        socket.readyState !== WebSocket.OPEN ||
        frameInProgress ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth
      ) {
        return
      }

      captureCanvas.width = video.videoWidth
      captureCanvas.height = video.videoHeight
      const context = captureCanvas.getContext('2d')
      if (!context) return

      context.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height)
      frameInProgress = true
      captureCanvas.toBlob((blob) => {
        frameInProgress = false
        if (blob && socket.readyState === WebSocket.OPEN) socket.send(blob)
      }, 'image/jpeg', 0.75)
    }, 250)

    return () => {
      window.clearInterval(timer)
      socket.close()
      setStatusWebsocket(null)
    }
  }, [cameraAtiva])

  function selecionarImagem(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setImagem(file)
    setPreviewUrl(URL.createObjectURL(file))
    setDetections([])
    setAnalisada(false)
    setErroAnalise(null)
  }

  async function verificarImagem() {
    if (!imagem) {
      setErroAnalise('Escolha uma imagem antes de verificar.')
      return
    }

    setCarregando(true)
    setErroAnalise(null)
    try {
      const formData = new FormData()
      formData.append('file', imagem)

      const response = await fetch(`${API_URL}/detect`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`O servidor respondeu com ${response.status}.`)
      }

      const data = await response.json()
      setDetections(
        Array.isArray(data.detections)
          ? removeDuplicateDetections(data.detections)
          : [],
      )
      setAnalisada(true)
    } catch (error) {
      setErroAnalise(
        error instanceof TypeError
          ? 'Não foi possível conectar ao servidor em http://localhost:8000.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível analisar a imagem.',
      )
    } finally {
      setCarregando(false)
    }
  }

  async function ligarCamera() {
    setErroCamera(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // traseira no celular; no PC usa a webcam
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraAtiva(true)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        setErroCamera('Permissão da câmera negada. Libere o acesso no navegador.')
      } else if (e instanceof DOMException && e.name === 'NotFoundError') {
        setErroCamera('Nenhuma câmera encontrada.')
      } else {
        setErroCamera('Não foi possível acessar a câmera.')
      }
    }
  }

  function desligarCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setDetections([])
    setAnalisada(false)
    setCameraAtiva(false)
  }

  // Desliga a câmera ao sair da página
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <main className="page">
      <header className="header">
        <h1>Verificador de EPI</h1>
        <p>
          Envie uma foto da obra ou use a câmera e veja se todos os
          equipamentos de proteção estão presentes.
        </p>
      </header>

      <section className="card">
        <label className="upload">
          <input type="file" accept="image/*" onChange={selecionarImagem} />
          <strong>Escolher imagem</strong>
          <span>{imagem?.name ?? 'JPG, PNG ou WEBP'}</span>
        </label>

        <div className="preview">
          {previewUrl && !cameraAtiva && (
            <img className="image" src={previewUrl} alt="Imagem selecionada" />
          )}
          <video
            ref={videoRef}
            className="video"
            style={{ display: cameraAtiva ? 'block' : 'none' }}
            autoPlay
            playsInline
            muted
          />
          <canvas ref={overlayCanvasRef} className="overlay" aria-hidden="true" />
          <canvas ref={captureCanvasRef} className="capture" aria-hidden="true" />
          {!cameraAtiva && !previewUrl && <span>A imagem aparece aqui</span>}
        </div>

        {erroCamera && <p role="alert">{erroCamera}</p>}
        {statusWebsocket && <p className="camera-status">{statusWebsocket}</p>}

        {cameraAtiva ? (
          <button type="button" className="btn" onClick={desligarCamera}>
            Desligar câmera
          </button>
        ) : (
          <button type="button" className="btn" onClick={ligarCamera}>
            Ligar câmera
          </button>
        )}

        {erroAnalise && <p className="error" role="alert">{erroAnalise}</p>}

        <button type="button" className="btn" onClick={verificarImagem} disabled={carregando}>
          {carregando ? 'Analisando...' : 'Verificar EPIs'}
        </button>
      </section>

      <section className="card">
        <h2>Resultado</h2>
        <p className="summary">
          {!analisada
            ? 'Envie uma imagem para consultar a API.'
            : visibleDetections.length
              ? `A API detectou ${visibleDetections.length} item(ns) na imagem.`
              : 'A API não detectou nenhum objeto na imagem.'}
        </p>

        <ul className="checklist">
          {CLASSES.map(({ name, label }) => (
            <li key={name}>
              <span>{label}</span>
              <span className="status">
                {detections.some(
                  (detection) =>
                    detection.class_name === name &&
                    detection.confidence > MIN_CONFIDENCE,
                )
                  ? 'Encontrado'
                  : analisada
                    ? 'Não encontrado'
                    : 'Aguardando'}
              </span>
            </li>
          ))}
        </ul>

        {visibleDetections.length > 0 ? (
          <ul className="detections" aria-label="Objetos detectados">
            {visibleDetections.map((detection, index) => (
              <li key={`${detection.class_id}-${index}`}>
                <span>
                  <strong>
                    {CLASSES.find(({ name }) => name === detection.class_name)?.label ??
                      detection.class_name}
                  </strong>
                  <small>
                    ({detection.box.x1}, {detection.box.y1}) - ({detection.box.x2},{' '}
                    {detection.box.y2})
                  </small>
                </span>
                <strong>{Math.round(detection.confidence * 100)}%</strong>
              </li>
            ))}
          </ul>
        ) : analisada ? (
          <p className="empty-detections">Nenhum objeto foi identificado.</p>
        ) : null}
      </section>
    </main>
  )
}

export default App