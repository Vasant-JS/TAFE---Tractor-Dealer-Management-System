export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface KPI {
  label: string
  value: string
  helper: string
  tone: StatusTone
}

export interface WorkItem {
  id: string
  customer: string
  vehicle: string
  owner: string
  status: string
  due: string
  amount?: string
}

export interface ModuleConfig {
  key: string
  title: string
  subtitle: string
  route: string
  icon: string
  prs: string
  primaryAction: string
  vehicleStatus: string
  kpis: KPI[]
  fields: string[]
  workflow: string[]
  checklist: string[]
  documents: string[]
  rows: WorkItem[]
}

export const roles = ['Owner', 'Admin', 'Sales', 'Svc Recpt', 'Technician', 'Accounts', 'RTO Clerk']

export const sampleVehicles = [
  { code: 'VEH-2026-00041', engine: 'TAF2502EN7812', chassis: 'TAFCH2502X991', model: 'TAFE 7502 DI', status: 'Pending PDI' },
  { code: 'VEH-2026-00042', engine: 'TAF2502EN7813', chassis: 'TAFCH2502X992', model: 'TAFE 6028 M', status: 'Ready for Installation' },
  { code: 'VEH-2026-00043', engine: 'TAF2502EN7814', chassis: 'TAFCH2502X993', model: 'TAFE 45 DI', status: 'Allocated to Customer' },
]

const baseRows: WorkItem[] = [
  { id: 'TAFE-DMS-1048', customer: 'Rajeshwar Singh Yadav', vehicle: 'TAFE 7502 DI', owner: 'Amit Sharma', status: 'OTP Pending', due: 'Today 04:30 PM', amount: '₹8,75,000' },
  { id: 'TAFE-DMS-1049', customer: 'Meena Agro Farms', vehicle: 'TAFE 6028 M', owner: 'Neha Verma', status: 'In Review', due: 'Tomorrow', amount: '₹7,42,500' },
  { id: 'TAFE-DMS-1050', customer: 'Balaji Krishi Kendra', vehicle: 'TAFE 45 DI', owner: 'Sanjay Kumar', status: 'Complete', due: '03 May 2026', amount: '₹6,18,200' },
]

export const modules: ModuleConfig[] = [
  {
    key: 'purchase',
    title: 'Purchase Invoices',
    subtitle: 'Register tractors received from TAFE company stock and create vehicle records.',
    route: '/purchase-invoices',
    icon: 'receipt_long',
    prs: 'Module 1',
    primaryAction: 'Create Invoice',
    vehicleStatus: 'Pending PDI',
    kpis: [
      { label: 'Open invoices', value: '18', helper: '5 received today', tone: 'info' },
      { label: 'Vehicles created', value: '64', helper: 'Auto-coded VEH-YYYY-XXXXX', tone: 'success' },
      { label: 'Duplicate holds', value: '02', helper: 'Serial checks active', tone: 'warning' },
    ],
    fields: ['Invoice Serial Number', 'Invoice Date', 'E-Way Bill Number', 'E-Way Bill Date', 'Number of Vehicles Received', 'Total Purchase Value', 'Consignment Details', 'Consigner Name', 'Consigner Invoice Number'],
    workflow: ['Validate invoice and e-way bill', 'Generate one vehicle record per tractor', 'Assign system vehicle code', 'Set vehicle status to Pending PDI'],
    checklist: ['Future-date blocking', 'Duplicate invoice detection', 'Positive INR amount', 'Integer vehicle quantity'],
    documents: ['Company invoice PDF', 'E-way bill', 'LR receipt', 'Consignment note'],
    rows: baseRows,
  },
  {
    key: 'pdi',
    title: 'Pre-Delivery Inspection',
    subtitle: '43-point quality inspection with PASS, FAIL, N/A results and OTP-controlled submission.',
    route: '/pdi',
    icon: 'verified',
    prs: 'Module 2',
    primaryAction: 'Submit PDI',
    vehicleStatus: 'Ready for Installation',
    kpis: [
      { label: 'Pending PDI', value: '23', helper: 'Across 7 invoices', tone: 'warning' },
      { label: 'Failed points', value: '04', helper: 'Admin alerts queued', tone: 'danger' },
      { label: 'Pass rate', value: '91%', helper: 'Current month', tone: 'success' },
    ],
    fields: ['Invoice Number', 'Vehicle Code', 'Engine Number', 'Chassis Number', 'Authorized Signatory Photo', 'Inspector Remarks', 'Inspector OTP'],
    workflow: ['Select invoice', 'Fetch vehicles with Pending PDI status', 'Complete configurable checklist', 'Verify inspector OTP', 'Move vehicle to Ready for Installation'],
    checklist: ['Engine oil level', 'Hydraulic operation', 'Battery terminal condition', 'Lighting and horn', 'Tyre pressure', 'Body panel damage', 'Tool kit availability', 'Operator manual'],
    documents: ['Inspector photo', 'Defect photos if failed', 'Signed PDI PDF'],
    rows: baseRows,
  },
  {
    key: 'installation',
    title: 'Installation Certificate',
    subtitle: 'Assign inspected tractor to customer and generate printable certificate.',
    route: '/installation',
    icon: 'assignment_ind',
    prs: 'Module 3',
    primaryAction: 'Generate Certificate',
    vehicleStatus: 'Allocated to Customer',
    kpis: [
      { label: 'Ready vehicles', value: '16', helper: 'Available for allocation', tone: 'info' },
      { label: 'OTP verified', value: '12', helper: 'Customer mobile checks', tone: 'success' },
      { label: 'Certificates', value: '48', helper: 'Generated this month', tone: 'success' },
    ],
    fields: ['Engine Number', 'Chassis Number', 'Invoice Number', 'Customer Name', 'Mobile Number', 'Aadhaar Number', 'Address', 'Google Map Location', 'Digital Signature'],
    workflow: ['Select Ready for Installation vehicle', 'Register or select customer', 'Verify customer OTP', 'Capture signature', 'Store certificate PDF'],
    checklist: ['Customer name as per Aadhaar', '12-digit masked Aadhaar', '10-digit mobile', 'Registered owner name', 'Full address'],
    documents: ['Installation certificate PDF', 'Customer signature', 'Authorized signatory'],
    rows: baseRows,
  },
  {
    key: 'delivery',
    title: 'Customer Delivery Sheet',
    subtitle: 'Final handover confirmation with delivered items, uploads, agreement, and signature.',
    route: '/delivery',
    icon: 'local_shipping',
    prs: 'Module 4',
    primaryAction: 'Complete Handover',
    vehicleStatus: 'Delivered',
    kpis: [
      { label: 'Deliveries due', value: '09', helper: 'Next 48 hours', tone: 'warning' },
      { label: 'Docs complete', value: '73%', helper: 'Mandatory upload coverage', tone: 'info' },
      { label: 'Receipts issued', value: '31', helper: 'This month', tone: 'success' },
    ],
    fields: ['Customer Name', 'Vehicle Details', 'Installation Certificate Ref', 'Delivery Date', 'Agreement Checkbox', 'Customer Signature'],
    workflow: ['Prefill customer and vehicle', 'Confirm physical item checklist', 'Upload mandatory documents', 'Capture delivery signature', 'Generate receipt PDF'],
    checklist: ['Tractor', 'Top Link', 'S Letter', 'F Form', 'TP Record', 'Tool Kit', 'Key / Tank Key', 'Insurance Copy', 'Tri Raksha Bond', 'Front Bumper', 'Operator Manual', 'Delivery Challan Copy'],
    documents: ['Aadhaar Card', 'PAN Card', 'Customer Photo', 'Delivery Photo', 'Delivery Challan', 'Gate Pass', 'Tractor Invoice', 'Quotation', 'Video Byte'],
    rows: baseRows,
  },
  {
    key: 'exchange',
    title: 'Exchange Registry',
    subtitle: 'Manage old tractor exchange valuation, RTO forms, stock entry, and liquidation.',
    route: '/exchange',
    icon: 'swap_horiz',
    prs: 'Module 5',
    primaryAction: 'Start Evaluation',
    vehicleStatus: 'Exchange Under Valuation',
    kpis: [
      { label: 'Exchange cases', value: '11', helper: '4 pending forms', tone: 'info' },
      { label: 'Target value', value: '₹34.8L', helper: 'Liquidation pipeline', tone: 'success' },
      { label: 'Missing RC', value: '03', helper: 'Follow-up needed', tone: 'warning' },
    ],
    fields: ['Previous Owner', 'Ownership Chain', 'Loan / Hypothecation', 'Make', 'Model', 'Year', 'Hours on Meter', 'Offered Price', 'Liquidation Target Price'],
    workflow: ['Capture previous owner history', 'Collect Form 28/29/30', 'Score technical condition', 'Upload four angle photos', 'Approve valuation'],
    checklist: ['Engine condition rating', 'Body condition rating', 'Tyre condition rating', 'Evaluator name', 'Evaluation date'],
    documents: ['RC Card Tractor', 'RC Card Trailer', 'Form 28', 'Form 29', 'Form 30', 'Exchange agreement'],
    rows: baseRows,
  },
  {
    key: 'safety',
    title: 'Safety & Maintenance',
    subtitle: 'Digital customer education workflow with acknowledgement and service readiness.',
    route: '/safety',
    icon: 'construction',
    prs: 'Safety Workflow',
    primaryAction: 'Capture Acknowledgement',
    vehicleStatus: 'Safety Acknowledged',
    kpis: [
      { label: 'Pending sessions', value: '07', helper: 'Before delivery close', tone: 'warning' },
      { label: 'Acknowledged', value: '96%', helper: 'OTP plus signature', tone: 'success' },
      { label: 'Hindi guides', value: '42', helper: 'Issued this month', tone: 'info' },
    ],
    fields: ['Customer Mobile', 'Language Preference', 'Safety Topics', 'Maintenance Schedule', 'OTP Verification', 'Digital Signature'],
    workflow: ['Run safety briefing', 'Share maintenance schedule', 'Verify OTP', 'Capture customer acknowledgement', 'Store audit trail'],
    checklist: ['PTO safety', 'Hydraulic safety', 'Daily oil check', 'Tyre pressure', 'Service interval', 'Warranty precautions'],
    documents: ['Acknowledgement PDF', 'Maintenance guide', 'Safety video proof'],
    rows: baseRows,
  },
  {
    key: 'insurance',
    title: 'Insurance Management',
    subtitle: 'Track asset coverage, policy documents, renewals, and claim readiness.',
    route: '/insurance',
    icon: 'policy',
    prs: 'Insurance',
    primaryAction: 'Add Policy',
    vehicleStatus: 'Insured',
    kpis: [
      { label: 'Active policies', value: '128', helper: 'Dealer portfolio', tone: 'success' },
      { label: 'Renewal due', value: '14', helper: 'Next 30 days', tone: 'warning' },
      { label: 'Coverage gap', value: '02', helper: 'Needs action', tone: 'danger' },
    ],
    fields: ['Policy Number', 'Provider', 'Premium Amount', 'Start Date', 'End Date', 'Nominee', 'Vehicle Code', 'Coverage Type'],
    workflow: ['Attach policy to vehicle', 'Validate period', 'Upload insurance copy', 'Schedule renewal reminders', 'Expose delivery copy'],
    checklist: ['Own damage cover', 'Third-party cover', 'Nominee details', 'Hypothecation endorsement'],
    documents: ['Insurance copy', 'Premium receipt', 'Policy schedule', 'Claim form'],
    rows: baseRows,
  },
  {
    key: 'rto',
    title: 'RTO Documents',
    subtitle: 'Track registration documents, tax receipts, forms, and clerk workflows.',
    route: '/rto',
    icon: 'description',
    prs: 'RTO Documentation',
    primaryAction: 'File RTO Packet',
    vehicleStatus: 'RTO Filed',
    kpis: [
      { label: 'Packets pending', value: '19', helper: 'Awaiting clerk action', tone: 'warning' },
      { label: 'RC received', value: '64', helper: 'Current quarter', tone: 'success' },
      { label: 'Govt fees', value: '₹2.7L', helper: 'Open liabilities', tone: 'info' },
    ],
    fields: ['Customer Aadhaar', 'PAN', 'Form 20', 'Form 21', 'Form 22', 'Tax Receipt', 'Dealer Authorization', 'RTO Clerk'],
    workflow: ['Prepare form packet', 'Submit to RTO clerk', 'Track government receipt', 'Receive registration number', 'Upload RC copy'],
    checklist: ['Form 20 complete', 'Form 21 sale certificate', 'Form 22 roadworthiness', 'Tax receipt', 'Address proof'],
    documents: ['Form 20', 'Form 21', 'Form 22', 'Tax receipt', 'RC copy', 'Address proof'],
    rows: baseRows,
  },
  {
    key: 'accounts',
    title: 'Accounts Module',
    subtitle: 'Track payments, deal closure, balances, receipts, and ATS handoff.',
    route: '/accounts',
    icon: 'account_balance',
    prs: 'Accounts',
    primaryAction: 'Post Receipt',
    vehicleStatus: 'Financially Closed',
    kpis: [
      { label: 'Receivables', value: '₹18.4L', helper: 'Across 26 deals', tone: 'warning' },
      { label: 'Closed deals', value: '38', helper: 'This month', tone: 'success' },
      { label: 'ATS pending', value: '08', helper: 'Needs charge sheet', tone: 'info' },
    ],
    fields: ['Customer Ledger', 'Booking Amount', 'Loan Disbursal', 'Cash Receipt', 'Discount Approval', 'Final Balance', 'Deal Closure Date'],
    workflow: ['Create customer ledger', 'Post receipts', 'Reconcile discounts and finance', 'Close deal', 'Trigger ATS charge sheet'],
    checklist: ['Receipt number', 'Payment mode', 'Bank reference', 'Approver', 'Final balance'],
    documents: ['Receipts', 'Loan sanction', 'Ledger PDF', 'Discount approval'],
    rows: baseRows,
  },
  {
    key: 'ats',
    title: 'ATS Charge Sheet',
    subtitle: 'Prepare account transfer and settlement charge sheets for closed deals.',
    route: '/ats',
    icon: 'assignment_turned_in',
    prs: 'ATS Module',
    primaryAction: 'Generate ATS',
    vehicleStatus: 'ATS Generated',
    kpis: [
      { label: 'Charge sheets', value: '22', helper: 'Ready for approval', tone: 'info' },
      { label: 'Mismatch cases', value: '03', helper: 'Amount variance', tone: 'danger' },
      { label: 'Approved value', value: '₹1.2Cr', helper: 'Current month', tone: 'success' },
    ],
    fields: ['Deal ID', 'Vehicle Code', 'Customer Ledger', 'Taxable Amount', 'Discount', 'Charges', 'Net Settlement', 'Approver'],
    workflow: ['Pull closed account ledger', 'Validate taxes and deductions', 'Generate charge sheet', 'Approve and archive'],
    checklist: ['GST calculation', 'Discount approval attached', 'All receipts posted', 'Final settlement amount'],
    documents: ['ATS PDF', 'Ledger copy', 'Approval note'],
    rows: baseRows,
  },
  {
    key: 'service',
    title: 'Service Operations',
    subtitle: 'Register complaints, allocate mechanics, and track workshop or field service.',
    route: '/service',
    icon: 'build',
    prs: 'Service Module',
    primaryAction: 'Create Job Card',
    vehicleStatus: 'Service In Progress',
    kpis: [
      { label: 'Open complaints', value: '27', helper: '9 field visits', tone: 'warning' },
      { label: 'Mechanics live', value: '12', helper: 'Tablet links active', tone: 'success' },
      { label: 'SLA risk', value: '05', helper: 'Escalate today', tone: 'danger' },
    ],
    fields: ['Complaint Number', 'Customer', 'Vehicle Code', 'Issue Category', 'Priority', 'Mechanic', 'Visit Type', 'Spares Used'],
    workflow: ['Raise complaint', 'Allocate service technician', 'Share tablet job link', 'Capture work and signature', 'Close job card'],
    checklist: ['Complaint notes', 'Mechanic allocation', 'Before photos', 'Spares consumed', 'Customer signature'],
    documents: ['Job card', 'Service photos', 'Customer acknowledgement', 'Parts bill'],
    rows: baseRows,
  },
  {
    key: 'admin',
    title: 'Admin Control Center',
    subtitle: 'Configure RBAC, inspection checklists, users, audit trails, and reports.',
    route: '/admin',
    icon: 'admin_panel_settings',
    prs: 'Admin & Reporting',
    primaryAction: 'Save Configuration',
    vehicleStatus: 'Configured',
    kpis: [
      { label: 'Users', value: '46', helper: '7 role groups', tone: 'info' },
      { label: 'Audit events', value: '1,248', helper: 'This month', tone: 'success' },
      { label: 'Disabled checks', value: '03', helper: 'PDI checklist items', tone: 'warning' },
    ],
    fields: ['User Name', 'Role', 'Dealer Code', 'Module Permission', 'Checklist Item', 'Mandatory Flag', 'Audit Context'],
    workflow: ['Manage users and roles', 'Configure PDI checklist', 'Review audit logs', 'Export reports'],
    checklist: ['Add checklist item', 'Edit description', 'Enable or disable item', 'Reorder item', 'Mark mandatory'],
    documents: ['Audit export', 'Role matrix', 'Checklist template'],
    rows: baseRows,
  },
]

export const moduleByKey = Object.fromEntries(modules.map((item) => [item.key, item])) as Record<string, ModuleConfig>

export const dashboardKpis: KPI[] = [
  { label: 'Vehicles in lifecycle', value: '214', helper: 'Purchase to delivery pipeline', tone: 'info' },
  { label: 'Ready for delivery', value: '31', helper: 'Certificate generated', tone: 'success' },
  { label: 'SLA alerts', value: '12', helper: 'Service and RTO follow-ups', tone: 'danger' },
  { label: 'Open receivables', value: '₹18.4L', helper: 'Accounts follow-up', tone: 'warning' },
]
