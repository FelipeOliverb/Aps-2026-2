import './App.css'

const EPIS = [
  'Capacete',
  'Óculos de proteção',
  'Luvas',
  'Colete refletivo',
  'Botas de segurança',
]

function App() {
  return (
    <main className="page">
      <header className="header">
        <h1>Verificador de EPI</h1>
        <p>
          Envie uma foto da obra e veja se todos os equipamentos de proteção
          estão presentes.
        </p>
      </header>

      <section className="card">
        <label className="upload">
          <input type="file" accept="image/*" />
          <strong>Escolher imagem</strong>
          <span>JPG, PNG ou WEBP</span>
        </label>

        <div className="preview">A imagem aparece aqui</div>

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