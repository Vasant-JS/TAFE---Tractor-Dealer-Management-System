import { randomBytes, scryptSync } from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const pdiChecklistLabels = [
  'Engine oil level',
  'Coolant level and leakage',
  'Fuel line and sediment bowl condition',
  'Air filter cleanliness',
  'Fan belt tension',
  'Battery terminal condition',
  'Headlight and indicator operation',
  'Horn operation',
  'Starter motor response',
  'Instrument cluster function',
  'Hydraulic operation',
  'Lift arm movement',
  'PTO engagement',
  'Hydraulic lever free play',
  'Hydraulic hose oil leakage',
  'Clutch free play',
  'Gear shifting smoothness',
  'Brake pedal function',
  'Parking brake hold',
  'Differential lock operation',
  'Steering free movement',
  'Power steering oil level',
  'Wheel alignment visual check',
  'Tyre pressure',
  'Tyre tread and damage',
  'Wheel nut tightness',
  'Front axle visual inspection',
  'Body panel damage',
  'Safety and model decals present',
  'Paint finish and scratches',
  'Mirror and reflectors condition',
  'Seat adjustment and latch',
  'Seat belt and buckle',
  'Pedal pad wear and return',
  'Canopy or ROPS structure',
  'Tool kit availability',
  'Jack and handle availability',
  'Operator manual',
  'Key set count',
  'Front bumper fitment',
  'Delivery accessory pack',
  'Road test result',
  'Final inspector sign-off',
]

const moduleRows = [
  {
    key: 'purchase',
    title: 'Purchase Invoices',
    subtitle: 'Register tractors received from company stock and create vehicle master records.',
    route: '/purchase-invoices',
    icon: 'receipt_long',
    prs: 'Module 1',
    primaryAction: 'Create Invoice',
    statusAfter: 'Pending PDI',
    fields: ['Invoice Serial Number', 'Invoice Date', 'E-Way Bill Number', 'E-Way Bill Date', 'Number of Vehicles Received', 'Total Purchase Value', 'Consignment Details', 'Consigner Name', 'Consigner Invoice Number', 'Engine Number', 'Chassis Number', 'Model'],
    workflow: ['Validate invoice and e-way bill', 'Generate one vehicle record per tractor', 'Assign system vehicle code', 'Set vehicle status to Pending PDI'],
    checklist: ['Future-date blocking', 'Duplicate invoice detection', 'Positive INR amount', 'Integer vehicle quantity'],
  },
  {
    key: 'pdi',
    title: 'Pre-Delivery Inspection',
    subtitle: 'Capture configurable PDI checklist results and clear tractors for installation.',
    route: '/pdi',
    icon: 'verified',
    prs: 'Module 2',
    primaryAction: 'Submit PDI',
    statusAfter: 'Ready for Installation',
    fields: ['Vehicle Code', 'Engine Number', 'Chassis Number', 'Inspector Remarks', 'Authorized Signatory Photo', 'Inspector OTP'],
    workflow: ['Select Pending PDI vehicle', 'Complete checklist', 'Record remarks and photo', 'Verify OTP', 'Move vehicle to Ready for Installation'],
    checklist: pdiChecklistLabels,
  },
  {
    key: 'installation',
    title: 'Installation Certificate',
    subtitle: 'Allocate a ready tractor to a customer and generate the installation certificate.',
    route: '/installation',
    icon: 'assignment_turned_in',
    prs: 'Module 3',
    primaryAction: 'Generate Certificate',
    statusAfter: 'Allocated to Customer',
    fields: ['Customer Name', 'Father Name', 'Mobile Number', 'Email Address', 'Aadhaar Number', 'PAN Number', 'Address', 'Engine Number', 'Chassis Number', 'Digital Signature'],
    workflow: ['Select Ready for Installation vehicle', 'Select or create customer', 'Verify OTP', 'Capture signature', 'Generate certificate'],
    checklist: ['Customer name as per Aadhaar', '10-digit mobile', 'Valid email', 'Address mandatory', 'OTP verified'],
  },
  {
    key: 'delivery',
    title: 'Customer Delivery Sheet',
    subtitle: 'Capture handover items, documents, customer consent, and receipt generation.',
    route: '/delivery',
    icon: 'local_shipping',
    prs: 'Module 4',
    primaryAction: 'Finalize Delivery',
    statusAfter: 'Delivered',
    fields: ['Customer Name', 'Vehicle Code', 'Delivery Date', 'Customer Signature', 'Agreement Confirmation'],
    workflow: ['Prefill customer and vehicle', 'Confirm delivered items', 'Upload handover docs', 'Capture signature', 'Generate receipt'],
    checklist: ['Tractor', 'Ignition Keys', 'Operator Manual', 'Tool Kit', 'Jack & Handle', 'Warranty Booklet'],
  },
  {
    key: 'exchange',
    title: 'Exchange Registry',
    subtitle: 'Track old tractor exchange evaluation, valuation, and liquidation readiness.',
    route: '/exchange',
    icon: 'swap_horiz',
    prs: 'Module 5',
    primaryAction: 'Record Exchange',
    statusAfter: 'Exchange Under Valuation',
    fields: ['Previous Owner', 'Ownership Chain', 'Loan / Hypothecation', 'Make', 'Model', 'Year', 'Hours on Meter', 'Offered Price', 'Liquidation Target Price'],
    workflow: ['Capture old tractor details', 'Rate condition', 'Upload four-angle photos', 'Approve valuation'],
    checklist: ['Engine condition rating', 'Body condition rating', 'Tyre condition rating', 'Evaluation date'],
  },
  {
    key: 'safety',
    title: 'Safety & Maintenance',
    subtitle: 'Record briefing acknowledgement and service-readiness confirmation.',
    route: '/safety',
    icon: 'construction',
    prs: 'Module 6',
    primaryAction: 'Capture Acknowledgement',
    statusAfter: 'Safety Acknowledged',
    fields: ['Customer Name', 'Mobile Number', 'Language Preference', 'Safety Topics', 'Maintenance Schedule', 'OTP Verification'],
    workflow: ['Run briefing', 'Share maintenance schedule', 'Verify OTP', 'Capture acknowledgement'],
    checklist: ['PTO safety', 'Hydraulic safety', 'Daily oil check', 'Tyre pressure', 'Service interval', 'Warranty precautions'],
  },
  {
    key: 'insurance',
    title: 'Insurance Management',
    subtitle: 'Track policy issue, period, provider, nominee, and renewal visibility.',
    route: '/insurance',
    icon: 'policy',
    prs: 'Module 7',
    primaryAction: 'Add Policy',
    statusAfter: 'Insured',
    fields: ['Policy Number', 'Provider', 'Premium Amount', 'Start Date', 'End Date', 'Nominee', 'Vehicle Code', 'Coverage Type'],
    workflow: ['Attach policy to vehicle', 'Validate dates', 'Upload copy', 'Schedule renewal'],
    checklist: ['Own damage cover', 'Third-party cover', 'Nominee details', 'Hypothecation endorsement'],
  },
  {
    key: 'rto',
    title: 'RTO Documents',
    subtitle: 'Track mandatory registration documents, numbers, upload state, and filing progress.',
    route: '/rto',
    icon: 'description',
    prs: 'Module 8',
    primaryAction: 'File RTO Packet',
    statusAfter: 'RTO Filed',
    fields: ['Customer Aadhaar', 'PAN', 'Form 20', 'Form 21', 'Form 22', 'Tax Receipt', 'Dealer Authorization', 'RTO Clerk'],
    workflow: ['Prepare packet', 'Upload document set', 'Track filing', 'Capture registration number'],
    checklist: ['RC Card', 'Aadhaar Card', 'Form 19-22', 'GST Invoice', 'Bonafide Cert', 'Bank Form 35', 'Passport Photo'],
  },
  {
    key: 'accounts',
    title: 'Accounts Module',
    subtitle: 'Capture booking, disbursal, receipts, discount approvals, and deal closure.',
    route: '/accounts',
    icon: 'account_balance',
    prs: 'Module 9',
    primaryAction: 'Close Deal',
    statusAfter: 'Financially Closed',
    fields: ['Customer Ledger', 'Booking Amount', 'Loan Disbursal', 'Cash Receipt', 'Discount Approval', 'Final Balance', 'Deal Closure Date'],
    workflow: ['Create ledger', 'Post receipts', 'Validate balances', 'Close deal', 'Trigger ATS'],
    checklist: ['Receipt number', 'Payment mode', 'Bank reference', 'Approver', 'Final balance'],
  },
  {
    key: 'ats',
    title: 'ATS Charge Sheet',
    subtitle: 'Generate charge sheet from financially closed deals.',
    route: '/ats',
    icon: 'assignment_turned_in',
    prs: 'Module 10',
    primaryAction: 'Generate ATS',
    statusAfter: 'ATS Generated',
    fields: ['Deal ID', 'Vehicle Code', 'Customer Ledger', 'Taxable Amount', 'Discount', 'Charges', 'Net Settlement', 'Approver'],
    workflow: ['Pull closed ledger', 'Validate charges', 'Generate sheet', 'Approve and archive'],
    checklist: ['GST calculation', 'Discount approval attached', 'All receipts posted', 'Final settlement amount'],
  },
  {
    key: 'service',
    title: 'Service Operations',
    subtitle: 'Track complaint creation, mechanic allocation, work capture, and closure.',
    route: '/service',
    icon: 'build',
    prs: 'Module 11',
    primaryAction: 'Create Job Card',
    statusAfter: 'Service In Progress',
    fields: ['Complaint Number', 'Customer Name', 'Vehicle Code', 'Issue Category', 'Priority', 'Mechanic', 'Visit Type', 'Spares Used'],
    workflow: ['Raise complaint', 'Allocate mechanic', 'Capture before/after work', 'Verify closure', 'Close job card'],
    checklist: ['Complaint notes', 'Mechanic allocation', 'Before photos', 'Spares consumed', 'Customer signature'],
  },
  {
    key: 'admin',
    title: 'Admin Control Center',
    subtitle: 'Manage users, role access, checklist definitions, and reporting.',
    route: '/admin',
    icon: 'admin_panel_settings',
    prs: 'Administration',
    primaryAction: 'Save Configuration',
    statusAfter: 'Configured',
    fields: ['User Name', 'Role', 'Dealer Code', 'Module Permission', 'Checklist Item', 'Mandatory Flag', 'Audit Context'],
    workflow: ['Manage users', 'Manage checklists', 'Review audit', 'Export reports'],
    checklist: ['Add checklist item', 'Disable item', 'Reorder item', 'Audit trail review'],
  },
]

const pdiChecklist: Array<[string, string, string, number]> = [
  ['ENG_OIL', 'Engine & Fluids', 'Engine oil level', 1],
  ['COOLANT', 'Engine & Fluids', 'Coolant level and leakage', 2],
  ['FUEL', 'Engine & Fluids', 'Fuel line and sediment bowl condition', 3],
  ['AIR_FILTER', 'Engine & Fluids', 'Air filter cleanliness', 4],
  ['BELT', 'Engine & Fluids', 'Fan belt tension', 5],
  ['BATTERY', 'Electrical', 'Battery terminal condition', 6],
  ['LIGHTS', 'Electrical', 'Headlight and indicator operation', 7],
  ['HORN', 'Electrical', 'Horn operation', 8],
  ['STARTER', 'Electrical', 'Starter motor response', 9],
  ['INSTRUMENTS', 'Electrical', 'Instrument cluster function', 10],
  ['HYDRO', 'Hydraulics', 'Hydraulic operation', 11],
  ['LIFT_ARM', 'Hydraulics', 'Lift arm movement', 12],
  ['PTO', 'Hydraulics', 'PTO engagement', 13],
  ['LEVER_PLAY', 'Hydraulics', 'Hydraulic lever free play', 14],
  ['OIL_LEAK', 'Hydraulics', 'Hydraulic hose oil leakage', 15],
  ['CLUTCH', 'Transmission', 'Clutch free play', 16],
  ['GEAR_SHIFT', 'Transmission', 'Gear shifting smoothness', 17],
  ['BRAKE', 'Transmission', 'Brake pedal function', 18],
  ['PARK_BRAKE', 'Transmission', 'Parking brake hold', 19],
  ['DIFF_LOCK', 'Transmission', 'Differential lock operation', 20],
  ['STEERING', 'Steering', 'Steering free movement', 21],
  ['STEERING_OIL', 'Steering', 'Power steering oil level', 22],
  ['ALIGNMENT', 'Steering', 'Wheel alignment visual check', 23],
  ['TYRES', 'Running', 'Tyre pressure', 24],
  ['TYRE_TREAD', 'Running', 'Tyre tread and damage', 25],
  ['WHEEL_NUT', 'Running', 'Wheel nut tightness', 26],
  ['AXLE', 'Running', 'Front axle visual inspection', 27],
  ['BODY', 'Body', 'Body panel damage', 28],
  ['DECALS', 'Body', 'Safety and model decals present', 29],
  ['PAINT', 'Body', 'Paint finish and scratches', 30],
  ['MIRRORS', 'Body', 'Mirror and reflectors condition', 31],
  ['SEAT', 'Cabin', 'Seat adjustment and latch', 32],
  ['SEAT_BELT', 'Cabin', 'Seat belt and buckle', 33],
  ['PEDALS', 'Cabin', 'Pedal pad wear and return', 34],
  ['CANOPY', 'Cabin', 'Canopy or ROPS structure', 35],
  ['TOOLKIT', 'Accessories', 'Tool kit availability', 36],
  ['JACK', 'Accessories', 'Jack and handle availability', 37],
  ['MANUAL', 'Accessories', 'Operator manual', 38],
  ['KEYS', 'Accessories', 'Key set count', 39],
  ['BUMPER', 'Accessories', 'Front bumper fitment', 40],
  ['DELIVERY_KIT', 'Accessories', 'Delivery accessory pack', 41],
  ['ROAD_TEST', 'Testing', 'Road test result', 42],
  ['FINAL_SIGN', 'Testing', 'Final inspector sign-off', 43],
]

async function main() {
  await prisma.documentRecord.deleteMany()
  await prisma.workItem.deleteMany()
  await prisma.refreshSession.deleteMany()
  await prisma.pdiChecklistResult.deleteMany()
  await prisma.pDIRecord.deleteMany()
  await prisma.pdiChecklistDefinition.deleteMany()
  await prisma.installationCertificate.deleteMany()
  await prisma.deliverySheet.deleteMany()
  await prisma.safetyAcknowledgement.deleteMany()
  await prisma.rTODocument.deleteMany()
  await prisma.rTORecord.deleteMany()
  await prisma.insuranceRecord.deleteMany()
  await prisma.aTSRecord.deleteMany()
  await prisma.accountsDeal.deleteMany()
  await prisma.serviceRequest.deleteMany()
  await prisma.exchangeRecord.deleteMany()
  await prisma.purchaseInvoice.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.otpLog.deleteMany()
  await prisma.vehicle.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.user.deleteMany()
  await prisma.dmsModule.deleteMany()

  await prisma.user.createMany({
    data: [
      { name: 'Owner User', email: 'owner@tafe.local', passwordHash: hashPassword('Owner@123'), role: 'owner', dealerCode: 'TAFE-OWN', dealerName: 'TAFE DMS HQ' },
      { name: 'Admin User', email: 'admin@tafe.local', passwordHash: hashPassword('Admin@123'), role: 'admin', dealerCode: 'TAFE-ADM', dealerName: 'TAFE DMS HQ' },
      { name: 'Sales User', email: 'sales@tafe.local', passwordHash: hashPassword('Sales@123'), role: 'sales', dealerCode: 'TAFE-SAL', dealerName: 'TAFE Salem' },
      { name: 'Reception User', email: 'reception@tafe.local', passwordHash: hashPassword('Reception@123'), role: 'receptionist', dealerCode: 'TAFE-REC', dealerName: 'TAFE Salem' },
      { name: 'Technician User', email: 'technician@tafe.local', passwordHash: hashPassword('Technician@123'), role: 'technician', dealerCode: 'TAFE-SVC', dealerName: 'TAFE Salem' },
      { name: 'Accounts User', email: 'accounts@tafe.local', passwordHash: hashPassword('Accounts@123'), role: 'accounts', dealerCode: 'TAFE-ACC', dealerName: 'TAFE Salem' },
      { name: 'RTO User', email: 'rto@tafe.local', passwordHash: hashPassword('Rto@12345'), role: 'rto_clerk', dealerCode: 'TAFE-RTO', dealerName: 'TAFE Salem' },
    ],
  })

  await prisma.dmsModule.createMany({
    data: moduleRows.map((module) => ({
      key: module.key,
      title: module.title,
      subtitle: module.subtitle,
      route: module.route,
      icon: module.icon,
      prs: module.prs,
      primaryAction: module.primaryAction,
      statusAfter: module.statusAfter,
      fields: JSON.stringify(module.fields),
      workflow: JSON.stringify(module.workflow),
      checklist: JSON.stringify(module.checklist),
    })),
  })

  await prisma.pdiChecklistDefinition.createMany({
    data: pdiChecklist.map(([code, section, label, sortOrder]) => ({
      code,
      section,
      label,
      sortOrder,
      mandatory: true,
    })),
  })

  await prisma.auditLog.create({
    data: {
      module: 'system',
      action: 'CONFIGURATION_SEEDED',
      context: JSON.stringify({ modules: moduleRows.length, checklistItems: pdiChecklist.length }),
    },
  })
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
