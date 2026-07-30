import { CardTable } from './components/CardTable'

function App() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 text-neutral-100">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">
          Divination Card Profit Tracker
        </h1>
        <p className="text-sm text-neutral-400">
          Path of Exile 1 &mdash; hvilke divination cards er lønnsomme å kjøpe opp som sett?
        </p>
      </header>
      <CardTable />
    </div>
  )
}

export default App
