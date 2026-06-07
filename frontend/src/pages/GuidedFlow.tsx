import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import PageHeader from '../components/ui/PageHeader'
import StatusPill from '../components/ui/StatusPill'

const flowOrder = ['purchase', 'pdi', 'installation', 'delivery', 'safety', 'rto', 'insurance', 'accounts', 'ats', 'service', 'exchange']

const sampleFlow: Record<string, { intro: string; prerequisite: string; action: string; data: Array<[string, string]>; docs: string[]; next: string }> = {
  purchase: {
    intro: 'Create the tractor entry first. This record becomes the base for the rest of the lifecycle.',
    prerequisite: 'Start here. No earlier module is required.',
    action: 'Open Add Invoice, fill both invoice and logistics sections, then submit the purchase invoice.',
    data: [
      ['Invoice Serial Number', 'PI-2026-0001'],
      ['Invoice Date', '2026-05-05'],
      ['E-Way Bill Number', 'EWB-260505-001'],
      ['E-Way Bill Date', '2026-05-05'],
      ['Number of Vehicles Received', '1'],
      ['Total Purchase Value', '817500'],
      ['Consigner Name', 'TAFE Regional Stock Yard'],
      ['Consignment Note / LR Detail', 'LR-260505-11'],
      ['Consigner Invoice Number', 'CN-260505-77'],
      ['Engine Number', 'ENG7502DI260501'],
      ['Chassis Number', 'CHS7502DI260501'],
      ['Model', 'TAFE 7502 DI'],
    ],
    docs: ['Company_Invoice_PI-2026-0001.pdf', 'EWayBill_EWB-260505-001.pdf', 'LR_Receipt_260505.pdf'],
    next: 'Go to Pre-Delivery Inspection and inspect the same tractor before installation.',
  },
  pdi: {
    intro: 'Inspect the same vehicle created in Purchase Invoices.',
    prerequisite: 'At least one vehicle must exist from Purchase Invoices.',
    action: 'Select the generated vehicle, complete the checklist, add signatory photo/OTP, then finalize PDI.',
    data: [
      ['Invoice Number', 'PI-2026-0001'],
      ['Vehicle Code', 'Use the generated code from Purchase Invoices'],
      ['Engine Number', 'ENG7502DI260501'],
      ['Chassis Number', 'CHS7502DI260501'],
      ['Authorized Signatory Photo', 'signatory_harish.png'],
      ['Inspector Remarks', 'All delivery checks completed'],
      ['Inspector OTP', '123456'],
    ],
    docs: ['Inspector_Photo_260505.jpg', 'Signed_PDI_260505.pdf', 'Checklist_Closeout_260505.pdf'],
    next: 'Mark the checklist complete, then open Installation Certificate for the same tractor.',
  },
  installation: {
    intro: 'Register the buyer and bind the vehicle to that customer.',
    prerequisite: 'Vehicle must be cleared by PDI first.',
    action: 'Pick the ready vehicle, search an existing customer or use Add Customer to clear the form for a fresh registration, send OTP, upload the customer confirmation signature, optionally upload the handover photo, then generate the certificate.',
    data: [
      ['Customer Name', 'Harish Kumar'],
      ['Father Name', 'Muthuvel Kumar'],
      ['Mobile Number', '9876543210'],
      ['Email Address', 'harish.kumar@example.com'],
      ['Aadhaar Number', '456712341234'],
      ['PAN Number', 'AHKPK4123Q'],
      ['Address', '14 MGR Nagar, Salem, Tamil Nadu'],
      ['OTP', '123456'],
      ['Engine Number', 'ENG7502DI260501'],
      ['Chassis Number', 'CHS7502DI260501'],
      ['Customer Confirmation Signature', 'Customer_Signature_Harish.png'],
      ['Handover Photo', 'handover_harish_260505.jpg'],
    ],
    docs: ['Customer_Signature_Harish.png', 'Installation_Certificate_Harish.pdf', 'Authorized_Signature.png'],
    next: 'After this, open Sales History for the same tractor.',
  },
  delivery: {
    intro: 'Finish the sales history file with customer agreement, KYC, voucher, sheets, gate pass, invoice, quotation, delivery photo, and video byte.',
    prerequisite: 'Vehicle must already be allocated to the customer from Installation Certificate.',
    action: 'Choose the allocated vehicle, fill customer history details, upload all required documents, generate the gate pass from the popup, then finalize Sales History.',
    data: [
      ['Customer Name', 'Harish Kumar'],
      ['Vehicle Details', 'Use the generated vehicle code from Purchase Invoices'],
      ['Delivery Date', '2026-05-06'],
      ['Delivered Items', 'Tick all six items in the checklist'],
      ['Customer Signature', 'Harish Kumar'],
      ['Agreement Confirmation', 'Checked'],
    ],
    docs: ['Aadhaar_Harish.pdf', 'PAN_Harish.pdf', 'Customer_Photo_HK.jpg', 'Delivery_Photo_Harish.jpg', 'Delivery_Challan_HK.pdf', 'GatePass_HK.pdf', 'Tractor_Invoice_HK.pdf', 'Quotation_HK.pdf', 'Customer_Byte_HK.mp4'],
    next: 'Once Sales History is finalized, continue with Safety, RTO, Insurance, and Accounts.',
  },
  safety: {
    intro: 'Capture safety briefing acknowledgement from the same customer.',
    prerequisite: 'Customer Delivery must be finalized.',
    action: 'Select the delivered vehicle, fill briefing details, confirm OTP/signature, then save the acknowledgement.',
    data: [
      ['Customer Name', 'Harish Kumar'],
      ['Mobile Number', '9876543210'],
      ['Language Preference', 'Tamil'],
      ['Safety Topics', 'PTO safety, daily checks, hydraulic safety'],
      ['Maintenance Schedule', '50hr / 250hr / 500hr service plan'],
      ['OTP Verification', '123456'],
    ],
    docs: ['Safety_Acknowledgement_HK.pdf', 'Maintenance_Guide_HK.pdf'],
    next: 'Then prepare the RTO document packet.',
  },
  insurance: {
    intro: 'Add the vehicle policy after the RTO packet is prepared.',
    prerequisite: 'RTO should already be in verification / filed state.',
    action: 'Select the customer vehicle, enter policy details with calendar dates, add nominee details, then save the insurance record. After submit the page locks until Edit Policy is pressed.',
    data: [
      ['Policy Number', 'POL-TAFE-260506-01'],
      ['Provider', 'IFFCO Tokio'],
      ['Premium Amount', '18500'],
      ['Start Date', '2026-05-06'],
      ['End Date', '2027-05-05'],
      ['Nominee', 'Latha Harish'],
      ['Nominee Relationship', 'Spouse'],
      ['Nominee Age', '32'],
      ['Vehicle Code', 'Use the generated vehicle code from Purchase Invoices'],
      ['Coverage Type', 'Comprehensive'],
    ],
    docs: ['Insurance_Copy_HK.pdf', 'Premium_Receipt_HK.pdf'],
    next: 'After insurance, continue to Accounts.',
  },
  rto: {
    intro: 'Create the RTO packet after safety acknowledgement, then upload and verify the document set.',
    prerequisite: 'Safety acknowledgement should already be completed.',
    action: 'Open `/rto`, select the customer or vehicle at the top, click Create RTO Record first, then fill packet details and upload files card by card. After Submit for Verification the packet locks into view mode until Edit RTO Packet is pressed.',
    data: [
      ['Select Customer', 'Harish Kumar'],
      ['Select Vehicle', 'Use the generated vehicle code from Purchase Invoices'],
      ['Vehicle Registration Number', 'TN38AX4452'],
      ['Customer Aadhaar', '456712341234'],
      ['Form 20', 'F20-260506-001'],
      ['Form 21', 'F21-260506-001'],
      ['Form 22', 'F22-260506-001'],
      ['Tax Receipt', 'TAX-260506-778'],
      ['Bonafide Certificate Number', 'BC-260506-09'],
      ['Dealer Authorization', 'DA-TAFE-051'],
      ['RTO Clerk', 'Murugan'],
      ['Verification Remarks', 'Packet complete and ready for clerk verification'],
      ['RTO Submission Deadline', '2026-05-10'],
    ],
    docs: ['RC_Request_Form.pdf', 'Aadhaar_Harish.pdf', 'Form_19_22_Set.pdf', 'GST_Invoice_PI-2026-0001.pdf', 'Bonafide_Cert_HK.pdf', 'Bank_Form_35_HK.pdf', 'Passport_Photo_HK.jpg', 'Shaddow_Trace_HK.pdf'],
    next: 'Create the RTO record first, upload files, then Submit for Verification. The next sales-flow module after RTO is Insurance.',
  },
  accounts: {
    intro: 'Close the finance side after the customer and vehicle are fully registered.',
    prerequisite: 'Insurance should already be completed before final accounts closeout.',
    action: 'Open Accounts for the selected vehicle, enter payment breakup, choose payment mode, upload proof for any non-cash payment, and let Final Balance auto-calculate. After submit the settlement locks until Edit Settlement is pressed.',
    data: [
      ['Customer Vehicle', 'Use the selected vehicle from tracker or dropdown'],
      ['Payment Mode', 'Loan Disbursal'],
      ['Transaction Reference', 'LOAN-HK-260506'],
      ['Booking Amount', '150000'],
      ['Loan Disbursal', '500000'],
      ['Cash Receipt', '0'],
      ['Discount Approval', '10000'],
      ['Final Balance', '0'],
      ['Deal Closure Date', '2026-05-06'],
    ],
    docs: ['Loan_Sanction_HK.pdf'],
    next: 'After accounts closeout, generate ATS Charge Sheet.',
  },
  ats: {
    intro: 'Generate the ATS record from the closed accounts values. This is the last step in the sales flow.',
    prerequisite: 'Accounts deal must be saved first.',
    action: 'Pull the closed deal values, confirm settlement fields, then save the ATS record.',
    data: [
      ['Deal ID', 'DEAL-HK-260506'],
      ['Vehicle Code', 'Use the generated vehicle code from Purchase Invoices'],
      ['Customer Ledger', 'LEDGER-HK-260506'],
      ['Taxable Amount', '807500'],
      ['Discount', '10000'],
      ['Charges', '0'],
      ['Net Settlement', '797500'],
      ['Approver', 'Owner User'],
    ],
    docs: ['ATS_HK.pdf', 'Ledger_Copy_HK.pdf', 'Approval_Note_HK.pdf'],
    next: 'This closes the sales flow. Do not continue to Service from ATS. Use Service only later if the customer raises a complaint.',
  },
  service: {
    intro: 'Optional after-sales step. Enter this only when a service complaint exists.',
    prerequisite: 'Use this only after the sales flow is complete and the customer raises an issue.',
    action: 'Register the complaint, assign mechanic/visit type, upload job evidence, then close after acknowledgement.',
    data: [
      ['Complaint Number', 'CMP-HK-260601'],
      ['Customer Name', 'Harish Kumar'],
      ['Vehicle Code', 'Use the generated vehicle code from Purchase Invoices'],
      ['Issue Category', 'Hydraulic oil seepage'],
      ['Priority', 'Medium'],
      ['Mechanic', 'Suresh'],
      ['Visit Type', 'Field Visit'],
      ['Spares Used', 'Hydraulic seal kit'],
    ],
    docs: ['Job_Card_HK.pdf', 'Service_Photos_HK.zip', 'Customer_Acknowledgement_HK.pdf'],
    next: 'Close the job card after signature capture.',
  },
  exchange: {
    intro: 'Optional branch. Use this only if the customer is exchanging an old tractor.',
    prerequisite: 'This is separate from the main sales flow.',
    action: 'Enter old tractor ownership and valuation details, then save the exchange record.',
    data: [
      ['Previous Owner', 'Harish Kumar'],
      ['Ownership Chain', 'Single owner'],
      ['Loan / Hypothecation', 'No'],
      ['Make', 'TAFE'],
      ['Model', 'Used Tractor 2018'],
      ['Year', '2018'],
      ['Hours on Meter', '2450'],
      ['Offered Price', '235000'],
      ['Liquidation Target Price', '260000'],
    ],
    docs: ['Old_RC.pdf', 'Form28.pdf', 'Form29.pdf', 'Exchange_Agreement.pdf'],
    next: 'This branch is separate from the main sales path.',
  },
}

export default function GuidedFlow() {
  const [modules, setModules] = useState<any[]>([])

  useEffect(() => {
    api.get('/modules').then(({ data }) => setModules([...data].sort((a: any, b: any) => flowOrder.indexOf(a.key) - flowOrder.indexOf(b.key))))
  }, [])

  const orderedModules = useMemo(
    () => modules.filter((item) => item.key !== 'admin' && flowOrder.includes(item.key)),
    [modules],
  )

  return (
    <div>
      <PageHeader icon="route" title="Full Data Entry Flow" subtitle="This is the current in-app order to use the project. Follow one sample tractor from purchase to ATS without guessing values or opening modules out of sequence." />
      <div className="space-y-6 p-6">
        <section className="rounded border border-outline-variant bg-white p-5">
          <h2 className="font-display text-xl font-semibold text-green-950">How To Use This Project</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <div className="rounded border border-outline-variant bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Step Order</p>
              <p className="mt-2 text-sm text-on-surface-variant">Purchase Invoices {'>'} PDI {'>'} Installation {'>'} Sales History {'>'} Safety {'>'} RTO {'>'} Insurance {'>'} Accounts {'>'} ATS</p>
            </div>
            <div className="rounded border border-outline-variant bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Important Rule</p>
              <p className="mt-2 text-sm text-on-surface-variant">If a later page says no data is available, go back to the previous module and finish that step first. ATS is the end of the sales flow.</p>
            </div>
            <div className="rounded border border-outline-variant bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Customer</p>
              <p className="mt-2 text-sm font-semibold text-green-950">Harish Kumar</p>
              <p className="mt-1 text-sm text-on-surface-variant">9876543210</p>
              <p className="mt-1 text-sm text-on-surface-variant">harish.kumar@example.com</p>
              <p className="mt-1 text-sm text-on-surface-variant">14 MGR Nagar, Salem, Tamil Nadu</p>
              <p className="mt-1 text-sm text-on-surface-variant">Aadhaar: 456712341234</p>
              <p className="mt-1 text-sm text-on-surface-variant">PAN: AHKPK4123Q</p>
            </div>
            <div className="rounded border border-outline-variant bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Vehicle</p>
              <p className="mt-2 text-sm font-semibold text-green-950">TAFE 7502 DI</p>
              <p className="mt-1 text-sm text-on-surface-variant">Engine: ENG7502DI260501</p>
              <p className="mt-1 text-sm text-on-surface-variant">Chassis: CHS7502DI260501</p>
              <p className="mt-1 text-sm text-on-surface-variant">Registration: TN38AX4452</p>
            </div>
            <div className="rounded border border-outline-variant bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Documents</p>
              <p className="mt-2 text-sm text-on-surface-variant">Uploads accept your own files. Use the sample names below only as a naming guide while testing the flow. Delivery and RTO now unlock uploads only after the main record is created.</p>
            </div>
            <div className="rounded border border-outline-variant bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Login To Start</p>
              <p className="mt-2 text-sm font-semibold text-green-950">owner@tafe.local</p>
              <p className="mt-1 text-sm text-on-surface-variant">Owner@123</p>
            </div>
          </div>
        </section>

        <div className="grid gap-4">
          {orderedModules.map((module, index) => {
            const guide = sampleFlow[module.key]
            if (!guide) return null

            return (
              <section key={module.key} className="rounded border border-outline-variant bg-white p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded bg-green-900 font-mono text-xs text-white">{index + 1}</span>
                      <h2 className="font-display text-xl font-semibold text-green-950">{module.title}</h2>
                      <StatusPill tone="info">{module.prs}</StatusPill>
                    </div>
                    <p className="text-sm text-on-surface-variant">{guide.intro}</p>
                  </div>
                  <Link to={module.route} className="inline-flex items-center justify-center rounded bg-green-900 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
                    Open Step
                  </Link>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded border border-outline-variant bg-surface-container-low p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Prerequisite</p>
                    <p className="mt-2 text-sm text-on-surface-variant">{guide.prerequisite}</p>
                  </div>
                  <div className="rounded border border-outline-variant bg-surface-container-low p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">What To Do On This Page</p>
                    <p className="mt-2 text-sm text-on-surface-variant">{guide.action}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr]">
                  <div className="rounded border border-outline-variant bg-surface-container-low p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Type These Values</p>
                    <div className="space-y-2 text-sm text-on-surface">
                      {guide.data.map(([label, value]) => (
                        <div key={label} className="flex flex-col gap-0.5 border-b border-outline-variant/40 pb-2 last:border-b-0 last:pb-0">
                          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{label}</span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded border border-outline-variant bg-surface-container-low p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Upload Using Names Like</p>
                    <div className="space-y-2 text-sm text-on-surface-variant">
                      {guide.docs.map((doc) => (
                        <div key={doc} className="rounded border border-outline-variant bg-white px-3 py-2 font-mono text-xs">
                          {doc}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded border border-outline-variant bg-surface-container-low p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">After Save</p>
                    <p className="text-sm text-on-surface-variant">{guide.next}</p>
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Target Status</p>
                      <p className="text-sm font-semibold text-green-950">{module.statusAfter}</p>
                    </div>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
