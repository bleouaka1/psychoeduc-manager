export default function Home() {
  return (
    <main className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold text-blue-900 mb-4">
        PsychoÉduc Manager
      </h1>

      <p className="text-xl text-gray-700 text-center max-w-2xl">
        Plateforme africaine de gestion psycho-éducative,
        d'insertion socio-professionnelle et de suivi des jeunes.
      </p>

      <div className="mt-8 flex gap-4">
        <button className="bg-blue-600 text-white px-6 py-3 rounded-lg">
          Commencer
        </button>

        <button className="bg-white border px-6 py-3 rounded-lg">
          En savoir plus
        </button>
      </div>
    </main>
  );
}