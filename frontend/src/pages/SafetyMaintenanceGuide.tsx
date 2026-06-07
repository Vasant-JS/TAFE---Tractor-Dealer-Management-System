const maintenanceChecklist = [
  'Check engine oil level before starting.',
  'Check radiator coolant level and inspect for leaks.',
  'Inspect fuel level, fuel pipe joints, and sediment bowl.',
  'Check air cleaner indicator and clean element if required.',
  'Inspect fan belt tension and battery terminals.',
  'Check brake, clutch, steering, and hydraulic controls.',
  'Inspect tyre pressure, wheel nuts, and visible tyre damage.',
  'Confirm lights, horn, indicators, and warning lamps are working.',
]

const dailyChecks = [
  ['Engine oil', 'Before start', 'Top up if below mark'],
  ['Coolant level', 'Before start', 'Use recommended coolant mix'],
  ['Air cleaner', 'Daily / dusty work', 'Clean or service as required'],
  ['Fuel system', 'Daily', 'Drain water or sediments if visible'],
  ['Tyres and wheel nuts', 'Daily', 'Check pressure and tightness'],
  ['Brakes and clutch', 'Before operation', 'Confirm free play and response'],
  ['Hydraulic oil leaks', 'Daily', 'Inspect hoses, joints, and lift area'],
  ['Lights and horn', 'Before road use', 'Repair before road movement'],
]

const maintenanceSchedule = [
  ['Daily / 10 hrs', 'Oil, coolant, fuel leak, tyre, brake, clutch, lights, horn, and visual safety checks'],
  ['50 hrs', 'Initial service inspection, fastener tightening, filter inspection, and lubrication points'],
  ['250 hrs', 'Engine oil and filter service, air cleaner service, fuel filter inspection, brake and clutch adjustment'],
  ['500 hrs', 'Transmission and hydraulic checks, steering system inspection, battery and electrical inspection'],
  ['800 hrs', 'Fuel injection pump oil level check and scheduled filter replacement as recommended'],
  ['1200 hrs', 'Fuel tank cleaning, full system inspection, coolant and lubrication review'],
]

const lubricants = [
  ['Engine oil', 'Recommended tractor engine oil grade as per operator manual', 'Check daily and replace by schedule'],
  ['Transmission oil', 'Approved transmission / hydraulic oil', 'Check level and leaks periodically'],
  ['Hydraulic oil', 'Approved hydraulic oil', 'Keep clean; avoid contamination during top-up'],
  ['Grease points', 'Recommended multipurpose grease', 'Grease all nipples as per service schedule'],
  ['Coolant', 'Recommended coolant mix', 'Maintain level and avoid plain-water operation for long periods'],
  ['Fuel', 'Clean diesel', 'Use sealed storage and filter before filling if needed'],
]

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden border border-slate-300">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-[11px] uppercase tracking-[0.12em] text-slate-600">
          <tr>
            {headers.map((header) => (
              <th key={header} className="border border-slate-300 px-3 py-2">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join(':')} className="odd:bg-white even:bg-slate-50">
              {row.map((cell) => (
                <td key={cell} className="border border-slate-300 px-3 py-2 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SafetyMaintenanceGuide() {
  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto max-w-[1120px] border border-slate-400 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="border-b border-slate-400 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Operator Instruction Book</p>
          <h1 className="mt-2 text-3xl font-bold uppercase tracking-[0.12em] text-slate-950">Maintenance Reference Document</h1>
          <p className="mt-2 text-sm text-slate-500">Maintenance checklist, daily check chart, maintenance schedule chart, and lubricants reference.</p>
        </header>

        <section className="mt-6">
          <h2 className="text-lg font-bold uppercase tracking-[0.12em] text-green-950">Maintenance Checklist</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {maintenanceChecklist.map((item, index) => (
              <div key={item} className="flex gap-3 border border-slate-300 bg-white p-3 text-sm">
                <span className="font-mono font-bold text-green-900">{String(index + 1).padStart(2, '0')}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold uppercase tracking-[0.12em] text-green-950">Daily Check Chart</h2>
          <div className="mt-3">
            <Table headers={['Check Item', 'Frequency', 'Action']} rows={dailyChecks} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold uppercase tracking-[0.12em] text-green-950">Maintenance Schedule Chart</h2>
          <div className="mt-3">
            <Table headers={['Interval', 'Work to be Done']} rows={maintenanceSchedule} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold uppercase tracking-[0.12em] text-green-950">Lubricants</h2>
          <div className="mt-3">
            <Table headers={['Area', 'Lubricant / Fluid', 'Remarks']} rows={lubricants} />
          </div>
        </section>
      </div>
    </main>
  )
}
