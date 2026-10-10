import { useEffect, useRef, useState } from 'react'
import './App.css'

const EPIS = [
  'Capacete',
  'Óculos de proteção',
  'Luvas',
  'Colete refletivo',
  'Botas de segurança',
]

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [erroCamera, setErroCamera] = useState<string | null>(null)

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
    setCameraAtiva(false)
  }

  // Desliga a câmera ao sair da página
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

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
          <input type="file" accept="image/*" />
          <strong>Escolher imagem</strong>
          <span>JPG, PNG ou WEBP</span>
        </label>

        <div className="preview">
          <video
            ref={videoRef}
            className="video"
            style={{ display: cameraAtiva ? 'block' : 'none' }}
            autoPlay
            playsInline
            muted
          />
          {!cameraAtiva && <span>A imagem aparece aqui</span>}
        </div>

        {erroCamera && <p role="alert">{erroCamera}</p>}

        {cameraAtiva ? (
          <button type="button" className="btn" onClick={desligarCamera}>
            Desligar câmera
          </button>
        ) : (
          <button type="button" className="btn" onClick={ligarCamera}>
            Ligar câmera
          </button>
        )}

        <button type="button" className="btn">
          Verificar EPIs
        </button>
      </section>

      <section className="card">
        <h2>Resultado</h2>
        <p className="summary">Nenhuma imagem analisada ainda.</p>

        <ul className="checklist">
          {EPIS.map((nome) => (
            <li key={nome}>
              <span>{nome}</span>
              <span className="status">Aguardando</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

export default App