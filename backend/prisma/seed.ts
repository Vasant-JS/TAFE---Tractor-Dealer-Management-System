import { randomBytes, scryptSync } from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const pdiChecklistLabels = [
  'Verify tractor and engine serial numbers with invoice number',
  'Assembly removed parts for transport',
  'Ensure tool box contains and literature to specification',
  'Cooling system: water / coolant',
  'Battery: electrolyte',
  'Engine oil',
  'Air cleaner',
  'Transmission oil level / steering box oil level',
  'Power steering reservoir, if fitted',
  'Lubricate all grease nipples',
  'Lightly oil clutch linkage, throttle linkage hand and foot, differential lock linkage and hinges',
  'Drain plugs for tightness',
  'Tightness of engine air intake and cooling system hose and pipe connections',
  'Ensure pipes, hoses and wiring are not fouling exhaust system or sharp edges',
  'Fan belt tension',
  'Clutch linkage: free pedal clearance',
  'Tightness of transmission nuts and bolts',
  'Torque front wheel bolt/nut and rear wheel bolt/nut',
  'Tyre pressure: front 20 psi, rear 20 psi for haulage',
  'Front wheel alignment: toe-in 2-8 mm',
  'Check front wheel bearings end float',
  'Three-point linkage for correct fitting',
  'Lights: indicator, head, side and panel',
  'Plough lamp / hazard warning lights / horn',
  'Clutch and brake pedal adjustments',
  'Headlight alignment and warning light',
  'Safety start switch function',
  'All warning lights function, if provided',
  'Check idling and maximum off-load speeds to specification',
  'Remove oil, fuel and coolant traces before leak check',
  'Gear selection is normal for the model',
  'Operation of brakes: LH / RH',
  'Steering feel, lock to lock',
  'Differential lock function, if fitted',
  'Handbrake effectiveness',
  'Operation of gauges and instruments',
  'Draft control, if applicable',
  'Position control: correct position',
  'Constant pumping correctly positioned, if applicable',
  'Response control effectiveness',
  'Leakages in cooling, air, lubrication and fuel system',
  'Adjust brake, if necessary',
  'Ensure no leaks are apparent from areas previously cleaned',
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
    fields: [
      'IRN',
      'Ack Number',
      'Ack Date',
      'E-Way Bill Number',
      'E-Way Bill Date',
      'Consigner GST Number',
      'Consigner Name',
      'Consigner Address',
      'Invoice Serial Number',
      'Invoice Date',
      'CIN Number',
      'PAN',
      'PO Number',
      'RTGS Date',
      'Receiver Name',
      'Receiver Address',
      'Receiver State',
      'Receiver GSTIN',
      'Place of Supply',
      'Consignor Name',
      'Consignor Address',
      'Consignor State',
      'Consignor GSTIN',
      'Consignor PAN',
      'Number of Vehicles Received',
      'Total Purchase Value',
      'Engine Number',
      'Chassis Number',
      'Model',
      'LR Copy File Name',
      'LR GC Number',
      'LR Date',
      'LR Destination',
      'LR Truck Number',
      'LR Transporter Name',
      'LR Transporter Address',
      'LR Consignor',
      'LR Consignee',
      'LR Model Number',
      'LR Tractor Serial Number',
      'LR Invoice Number',
      'LR Invoice Date',
      'LR Invoice Value',
      'LR Freight',
      'LR Remarks',
      'Consignment Details',
    ],
    workflow: ['Validate IRN, acknowledgement, invoice, and e-way bill', 'Capture billed-to receiver and consigner GST details', 'Attach LR copy and logistics receipt values', 'Generate one vehicle record per tractor', 'Set vehicle status to Pending PDI'],
    checklist: ['IRN and acknowledgement captured', 'Duplicate invoice/e-way bill detection', 'Receiver and consigner GSTIN captured', 'LR copy attached or LR details entered', 'Positive INR amount', 'Integer vehicle quantity'],
  },
  {
    key: 'pdi',
    title: 'Pre-Delivery Inspection',
    subtitle: 'Capture configurable PDI checklist results and clear tractors for installation.',
    route: '/pdi',
    icon: 'verified',
    prs: 'Module 2',
    primaryAction: 'Submit PDI',
    statusAfter: 'Pending Installation',
    fields: ['Model', 'Serial Number', 'Engine Number', "Dealer Name", 'Job Card Number', 'PDI Date', 'Observation', 'Action Taken', 'Inspector Remarks', 'Authorized Signatory Photo', 'Inspector OTP'],
    workflow: ['Select vehicle created from purchase invoice', 'Record report header and job card number', 'Mark each checkpoint observation', 'Capture action taken for exceptions', 'Verify OTP', 'Move vehicle to Pending Installation'],
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
    fields: ['Dealer Code', 'OSM Number', 'Dealer Name', 'Dealer City', 'Tractor Number', 'Engine Number', 'Installation Date', 'TAFE Invoice Number', 'TAFE Invoice Date', 'Customer Name', 'Customer First Name', 'Customer Second Name', 'Customer Last Name', 'Door Number', 'Street Number', 'Village Name', 'PO Name', 'PIN Code', 'Taluk', 'District', 'State', 'Mobile Number', 'Customer Satisfaction Confirmation', 'Dealer Installation Confirmation', 'Digital Signature', 'Dealer Stamp and Signature', 'Dealer Signature Date'],
    workflow: ['Select vehicle cleared by PDI', 'Capture dealer, OSM and tractor details', 'Capture customer name and full address blocks', 'Verify OTP', 'Capture customer signature and dealer stamp', 'Generate certificate', 'Move vehicle to Allocated to Customer'],
    checklist: ['Customer name as per Aadhaar', '10-digit mobile', 'Valid email', 'Address mandatory', 'OTP verified'],
  },
  {
    key: 'delivery',
    title: 'Sales History',
    subtitle: 'Capture customer agreement, voucher and sheets, customer KYC, gate pass, invoice, quotation, delivery media, and final sales history.',
    route: '/delivery',
    icon: 'history_edu',
    prs: 'Module 4',
    primaryAction: 'Finalize Sales History',
    statusAfter: 'Delivered',
    fields: ['Customer Name', 'Customer Address', 'Mobile Number', 'Aadhaar Number', 'PAN Number', 'Model', 'Chassis Number', 'Engine Number', 'Battery Make', 'Battery SN', 'FIP Number', 'Tyre Make', 'Customer Agreement Accepted', 'Gate Pass Job Card No', 'Gate Pass Date', 'Gate Pass Time'],
    workflow: ['Select vehicle cleared by PDI', 'Capture customer history details', 'Upload voucher, sheets, customer KYC, invoice, quotation, photo and video', 'Generate gate pass from popup', 'Finalize Sales History'],
    checklist: ['Customer Agreement', 'Voucher', 'Customer History Sheet', 'Aadhaar Card', 'PAN Card', 'Customer Details Form', 'Delivery Challan', 'Gate Pass', 'Tractor Invoice', 'Quotation', 'Delivery Photo', 'Video Byte'],
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
    fields: ['Previous Owner', 'Insurance Number', 'Insurance Provider', 'Insurance Due Date', 'Tractor RC Number', 'Trailer Attached', 'Trailer RC Number', 'Old Tractor Stock Number', 'Accounts Ledger Number', 'Accounts Book Link', 'Make', 'Model', 'Year', 'Hours on Meter', 'Price Matrix A', 'Actual Deduction B', 'Evaluated Price A-B', 'Liquidation Target Price'],
    workflow: ['Capture old tractor ownership, tractor RC and insurance details', 'Upload tractor RC, insurance, agreement, stock and ledger documents', 'Collect trailer RC only when trailer is attached', 'Complete commercial and technical evaluation sheet', 'Link old tractor stock with accounts book and ledger', 'Generate old tractor gatepass'],
    checklist: ['Insurance Copy', 'Tractor RC', 'Trailer RC if attached', 'Old Tractor Agreement Copy', 'Old Tractor Stock Proof', 'Accounts Ledger Copy', 'Old Tractor Gate Pass', 'Evaluation Sheet'],
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
    key: 'rto',
    title: 'RTO Documents',
    subtitle: 'Track mandatory registration documents, numbers, upload state, and filing progress.',
    route: '/rto',
    icon: 'description',
    prs: 'Module 7',
    primaryAction: 'File RTO Packet',
    statusAfter: 'RTO Filed',
    fields: ['Customer Aadhaar', 'PAN', 'Form 20', 'Form 21', 'Form 22', 'Tax Receipt', 'Bonafide Certificate Number', 'Dealer Authorization', 'RTO Clerk'],
    workflow: ['Prepare packet', 'Upload document set', 'Track filing', 'Capture registration number'],
    checklist: ['RC Card', 'Aadhaar Card', 'Form 19-22', 'GST Invoice', 'Bonafide Cert', 'Bank Form 35', 'Passport Photo', 'Shaddow Trace'],
  },
  {
    key: 'insurance',
    title: 'Insurance Management',
    subtitle: 'Track policy issue, period, provider, nominee, and renewal visibility.',
    route: '/insurance',
    icon: 'policy',
    prs: 'Module 8',
    primaryAction: 'Add Policy',
    statusAfter: 'Insured',
    fields: ['Cover Note Number', 'Company', 'Policy Number', 'Coverage Ratio', 'Model', 'Start Cover Date', 'End Cover Date', 'Premium Amount', 'Contact Number'],
    workflow: ['Attach policy to vehicle after RTO packet', 'Capture cover note and company details', 'Validate coverage dates', 'Upload copy', 'Schedule renewal'],
    checklist: ['Cover note number', 'Policy number', 'Coverage ratio', 'Premium amount', 'Contact number'],
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
    fields: ['Deal Value', 'Closed Value', 'Balance', 'Account Details', 'Handled By'],
    workflow: ['Capture deal value', 'Capture closed value', 'Validate balance', 'Assign account handler', 'Open ATS when balance is pending'],
    checklist: ['Deal value', 'Closed value', 'Balance', 'Account details', 'Handled by'],
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
  ['SERIAL_VERIFY', 'Before Checking', 'Verify tractor and engine serial numbers with invoice number', 1],
  ['TRANSPORT_PARTS', 'Before Checking', 'Assembly removed parts for transport', 2],
  ['TOOLBOX_LITERATURE', 'Before Checking', 'Ensure tool box contains and literature to specification', 3],
  ['COOLANT', 'Checking Levels', 'Cooling system: water / coolant', 4],
  ['BATTERY_ELECTROLYTE', 'Checking Levels', 'Battery: electrolyte', 5],
  ['ENGINE_OIL', 'Checking Levels', 'Engine oil', 6],
  ['AIR_CLEANER', 'Checking Levels', 'Air cleaner', 7],
  ['TRANSMISSION_STEERING_OIL', 'Checking Levels', 'Transmission oil level / steering box oil level', 8],
  ['POWER_STEERING_RESERVOIR', 'Checking Levels', 'Power steering reservoir, if fitted', 9],
  ['GREASE_NIPPLES', 'Lubrication', 'Lubricate all grease nipples', 10],
  ['LINKAGE_OILING', 'Lubrication', 'Lightly oil clutch linkage, throttle linkage hand and foot, differential lock linkage and hinges', 11],
  ['DRAIN_PLUGS', 'Adjustments', 'Drain plugs for tightness', 12],
  ['INTAKE_COOLING_CONNECTIONS', 'Adjustments', 'Tightness of engine air intake and cooling system hose and pipe connections', 13],
  ['PIPE_HOSE_WIRING_CLEARANCE', 'Adjustments', 'Ensure pipes, hoses and wiring are not fouling exhaust system or sharp edges', 14],
  ['FAN_BELT_TENSION', 'Adjustments', 'Fan belt tension', 15],
  ['CLUTCH_FREE_PEDAL', 'Adjustments', 'Clutch linkage: free pedal clearance', 16],
  ['TRANSMISSION_NUTS_BOLTS', 'Adjustments', 'Tightness of transmission nuts and bolts', 17],
  ['WHEEL_BOLT_TORQUE', 'Adjustments', 'Torque front wheel bolt/nut and rear wheel bolt/nut', 18],
  ['TYRE_PRESSURE', 'Adjustments', 'Tyre pressure: front 20 psi, rear 20 psi for haulage', 19],
  ['FRONT_WHEEL_ALIGNMENT', 'Adjustments', 'Front wheel alignment: toe-in 2-8 mm', 20],
  ['FRONT_WHEEL_BEARINGS', 'Adjustments', 'Check front wheel bearings end float', 21],
  ['THREE_POINT_LINKAGE', 'Adjustments', 'Three-point linkage for correct fitting', 22],
  ['LIGHTS_INDICATOR_PANEL', 'Before Checking', 'Lights: indicator, head, side and panel', 23],
  ['PLOUGH_HAZARD_HORN', 'Before Checking', 'Plough lamp / hazard warning lights / horn', 24],
  ['CLUTCH_BRAKE_PEDAL', 'Before Checking', 'Clutch and brake pedal adjustments', 25],
  ['HEADLIGHT_WARNING', 'Before Checking', 'Headlight alignment and warning light', 26],
  ['SAFETY_START_SWITCH', 'Before Checking', 'Safety start switch function', 27],
  ['WARNING_LIGHTS', 'Before Checking', 'All warning lights function, if provided', 28],
  ['IDLING_MAX_SPEED', 'Before Checking', 'Check idling and maximum off-load speeds to specification', 29],
  ['LEAK_CHECK_PREP', 'Before Checking', 'Remove oil, fuel and coolant traces before leak check', 30],
  ['GEAR_SELECTION', 'Road Test', 'Gear selection is normal for the model', 31],
  ['BRAKES_LH_RH', 'Road Test', 'Operation of brakes: LH / RH', 32],
  ['STEERING_LOCK', 'Road Test', 'Steering feel, lock to lock', 33],
  ['DIFF_LOCK', 'Road Test', 'Differential lock function, if fitted', 34],
  ['HANDBRAKE', 'Road Test', 'Handbrake effectiveness', 35],
  ['GAUGES_INSTRUMENTS', 'Road Test', 'Operation of gauges and instruments', 36],
  ['DRAFT_CONTROL', 'After Road Test', 'Draft control, if applicable', 37],
  ['POSITION_CONTROL', 'After Road Test', 'Position control: correct position', 38],
  ['CONSTANT_PUMPING', 'After Road Test', 'Constant pumping correctly positioned, if applicable', 39],
  ['RESPONSE_CONTROL', 'After Road Test', 'Response control effectiveness', 40],
  ['LEAKAGES', 'After Road Test', 'Leakages in cooling, air, lubrication and fuel system', 41],
  ['BRAKE_ADJUST', 'After Road Test', 'Adjust brake, if necessary', 42],
  ['FINAL_LEAK_CHECK', 'Final Checks', 'Ensure no leaks are apparent from areas previously cleaned', 43],
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

