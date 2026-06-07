const dos = [
  {
    title: 'Engine - General',
    items: [
      'Release the starter key once the engine has started.',
      'Check the oil pressure warning lamp and battery charging indicator after the engine has started.',
      'Check cylinder head and manifold nut tightness regularly.',
    ],
  },
  {
    title: 'Air Induction System',
    items: ['Inspect the air cleaner element and clean it whenever required.'],
  },
  {
    title: 'Fuel System',
    items: [
      'Drain sediments from the fuel tank periodically.',
      'Clean the fuel tank thoroughly once in every 1200 hours.',
      'Drain water and sediments from the filters regularly.',
      'Change primary and secondary filters regularly as recommended.',
      'Check oil level in the fuel injection pump every 800 working hours.',
      "Fill diesel at the end of the day's work to avoid condensation.",
    ],
  },
]

const donts = [
  {
    title: 'Engine - General',
    items: [
      'Do not keep cranking the engine continuously with the starter key. It will shorten battery, starter pinion, and ring gear life.',
      'Do not accelerate the engine in neutral.',
    ],
  },
  {
    title: 'Air Induction System',
    items: [
      'Do not run the tractor if the air cleaner assembly is defective, as this causes impure air intake and excessive wear.',
    ],
  },
  {
    title: 'Fuel System',
    items: [
      'Do not keep the fuel tank without a proper sealing cap.',
      'Do not use contaminated fuel because it affects the fuel injection pump and injectors.',
      'Do not use bad quality spurious filters as replacement.',
      'Do not use bad quality high pressure pipes. Clean and flush pipes before use.',
      'Do not allow leakage through fuel pipe joints.',
    ],
  },
]

function GuidelineColumn({ title, sections }: { title: string; sections: typeof dos }) {
  return (
    <section className="border border-slate-300 bg-white p-6">
      <h2 className="text-center text-xl font-bold uppercase tracking-[0.12em] text-slate-900">{title}</h2>
      <div className="mt-6 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-700">{section.title}</h3>
            <ol className="mt-3 space-y-2 pl-5 text-sm leading-6 text-slate-800">
              {section.items.map((item) => (
                <li key={item} className="list-decimal">{item}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function SafetyDosDonts() {
  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto max-w-[1120px] border border-slate-400 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="border-b border-slate-400 pb-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">MF 6026 Max Pro / MF 6028 Max Pro</p>
          <h1 className="mt-2 text-3xl font-bold uppercase tracking-[0.16em] text-slate-950">Do's & Don'ts</h1>
          <p className="mt-2 text-sm text-slate-500">Operator instruction book safety guidance</p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <GuidelineColumn title="Do's" sections={dos} />
          <GuidelineColumn title="Don'ts" sections={donts} />
        </div>

        <footer className="mt-8 border-t border-slate-400 pt-4 text-sm font-bold uppercase tracking-[0.14em] text-slate-700">
          Operator Instruction Book
        </footer>
      </div>
    </main>
  )
}
