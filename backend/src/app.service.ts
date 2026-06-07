import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { promises as fs } from 'fs'
import { extname, join } from 'path'
import { PrismaService } from './prisma.service'

type PlainBody = Record<string, unknown>
type AuthUser = {
  id: string
  role: string
  email: string
  name: string
  dealerCode: string
  dealerName: string
}

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000
const STORAGE_ROOT = join(process.cwd(), 'storage')

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async login(body: { email: string; password: string; role?: string }) {
    if (!body.email || !body.password) {
      throw new UnauthorizedException('Email and password are required')
    }
    const user = await this.prisma.user.findUnique({ where: { email: body.email.toLowerCase().trim() } })
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password')
    }
    if (body.role && user.role !== body.role) {
      throw new UnauthorizedException('Selected role does not match this account')
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked after repeated login failures')
    }
    const validPassword = this.verifyPassword(body.password, user.passwordHash)
    if (!validPassword) {
      const attempts = user.failedAttempts + 1
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: attempts >= 5 ? 0 : attempts,
          lockedUntil: attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null,
        },
      })
      throw new UnauthorizedException('Invalid email or password')
    }

    const accessToken = this.createAccessToken(user)
    const refreshToken = this.randomToken()
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    })
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    return {
      accessToken,
      access_token: accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        dealerCode: user.dealerCode,
        dealerName: user.dealerName,
      },
    }
  }

  async refresh(body?: { refreshToken?: string }) {
    const token = body?.refreshToken?.trim()
    if (!token) {
      throw new UnauthorizedException('Refresh token is required')
    }
    const session = await this.prisma.refreshSession.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    })
    if (!session) throw new UnauthorizedException('Refresh session expired')
    const nextRefreshToken = this.randomToken()
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    })
    await this.prisma.refreshSession.create({
      data: {
        userId: session.userId,
        tokenHash: this.hashToken(nextRefreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    return {
      access_token: this.createAccessToken(session.user),
      refreshToken: nextRefreshToken,
      expiresIn: 3600,
    }
  }

  async requestPasswordReset(body: { email: string }) {
    const email = body.email?.toLowerCase().trim()
    if (!email || !this.isValidEmail(email)) {
      throw new BadRequestException('Enter a valid registered email')
    }
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      return { ok: true, message: 'If the email is registered, a reset link has been generated.', expiresInMinutes: 15 }
    }
    const token = this.randomToken()
    await this.prisma.otpLog.create({
      data: {
        mobile: email,
        context: 'password_reset',
        contextRef: user.id,
        otpHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    })
    const resetLink = `/login?resetToken=${token}&email=${encodeURIComponent(email)}`
    await this.audit({ actorId: user.id, module: 'auth', action: 'PASSWORD_RESET_REQUESTED', refId: user.id, context: { email, resetLink } })
    return {
      ok: true,
      message: 'Password reset link generated.',
      expiresInMinutes: 15,
      resetLink,
    }
  }

  async resetPassword(body: { email: string; token: string; password: string }) {
    const email = body.email?.toLowerCase().trim()
    const token = body.token?.trim()
    const password = body.password ?? ''
    if (!email || !token || !password) {
      throw new BadRequestException('Email, reset token, and new password are required')
    }
    if (!this.isValidEmail(email)) throw new BadRequestException('Enter a valid email address')
    if (!this.isStrongPassword(password)) {
      throw new BadRequestException('Password must be at least 8 characters and include one special character')
    }
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) throw new BadRequestException('Invalid password reset request')
    const resetRecord = await this.prisma.otpLog.findFirst({
      where: {
        mobile: email,
        context: 'password_reset',
        contextRef: user.id,
      },
      orderBy: { createdAt: 'desc' },
    })
    const valid = Boolean(resetRecord && resetRecord.expiresAt > new Date() && resetRecord.otpHash === this.hashToken(token))
    if (!valid) {
      throw new BadRequestException('Password reset token is invalid or expired')
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: this.hashPassword(password),
        failedAttempts: 0,
        lockedUntil: null,
      },
    })
    await this.prisma.refreshSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await this.prisma.otpLog.update({ where: { id: resetRecord.id }, data: { verified: true } })
    await this.audit({ actorId: user.id, module: 'auth', action: 'PASSWORD_RESET_COMPLETED', refId: user.id, context: { email } })
    return { ok: true, message: 'Password reset successful' }
  }

  async authorizeRequest(authHeader?: string, allowedRoles?: string[]) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) throw new UnauthorizedException('Login required')
    const claims = this.verifyAccessToken(token)
    const user = await this.prisma.user.findUnique({ where: { id: claims.userId } })
    if (!user || !user.isActive) throw new UnauthorizedException('Session is no longer valid')
    if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
      throw new ForbiddenException('You do not have access to this module')
    }
    return {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
      dealerCode: user.dealerCode,
      dealerName: user.dealerName,
    } satisfies AuthUser
  }

  async dashboard() {
    const [vehicleCount, readyCount, workItems, receivable, vehicles, modules, queue, pendingPdiCount, readyInstallCount, allocatedCount, deliveredCount] = await Promise.all([
      this.prisma.vehicle.count(),
      this.prisma.vehicle.count({ where: { status: { in: ['Allocated to Customer', 'Delivered', 'RTO Filed'] } } }),
      this.prisma.workItem.count({ where: { status: { notIn: ['Complete', 'Closed'] } } }),
      this.prisma.accountsDeal.aggregate({ _sum: { finalBalance: true }, where: { status: { not: 'Financially Closed' } } }),
      this.prisma.vehicle.findMany({ include: { customer: true }, take: 8, orderBy: { createdAt: 'desc' } }),
      this.modules(),
      this.prisma.workItem.findMany({
        include: { customer: true, vehicle: true, owner: true, documents: true },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.vehicle.count({ where: { status: { in: ['Pending Installation', 'Ready for Installation'] } } }),
      this.prisma.vehicle.count({ where: { status: 'Pending PDI' } }),
      this.prisma.vehicle.count({ where: { status: 'Allocated to Customer' } }),
      this.prisma.vehicle.count({ where: { status: { in: ['Delivered', 'RTO Filed'] } } }),
    ])

    return {
      kpis: [
        { label: 'Vehicles in lifecycle', value: vehicleCount, helper: 'Counted from Vehicle master', tone: 'info' },
        { label: 'Ready for delivery', value: readyCount, helper: 'Vehicle workflow state from database', tone: 'success' },
        { label: 'SLA alerts', value: workItems, helper: 'Open workflow items', tone: 'danger' },
        { label: 'Open receivables', value: receivable._sum.finalBalance ?? 0, helper: 'Pending balances from Accounts', tone: 'warning' },
      ],
      pipeline: {
        pending: pendingPdiCount,
        ready: readyInstallCount,
        allocated: allocatedCount,
        delivered: deliveredCount,
      },
      vehicles,
      modules,
      queue,
      alerts: [
        { id: 'ALT-001', module: 'PDI', message: 'Checklist failures require branch review' },
        { id: 'ALT-002', module: 'RTO', message: 'Delivered vehicles pending RTO packet filing' },
      ],
    }
  }

  async systemHealth() {
    const userCount = await this.prisma.user.count()
    const vehicleCount = await this.prisma.vehicle.count()
    const dbUrl = process.env.DATABASE_URL ?? ''
    return {
      ok: true,
      service: 'TAFE DMS API',
      timestamp: new Date().toISOString(),
      database: {
        provider: dbUrl.startsWith('file:') ? 'sqlite' : dbUrl.startsWith('postgres') ? 'postgresql' : 'unknown',
        connected: true,
        userCount,
        vehicleCount,
      },
      storage: {
        uploadsPath: join(process.cwd(), 'storage', 'uploads'),
        generatedPath: join(process.cwd(), 'storage', 'generated'),
      },
    }
  }

  async modules() {
    const rows = await this.prisma.dmsModule.findMany()
    const order = ['purchase', 'pdi', 'installation', 'delivery', 'exchange', 'safety', 'rto', 'insurance', 'accounts', 'ats', 'service', 'admin']
    return rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).map((row) => this.presentModule(row))
  }

  async module(key: string) {
    const found = await this.prisma.dmsModule.findUnique({ where: { key } })
    if (!found) throw new NotFoundException('Module not found')
    return this.presentModule(found)
  }

  vehicles() {
    return this.prisma.vehicle.findMany({ include: { customer: true, purchaseInvoice: true }, orderBy: { createdAt: 'desc' } })
  }

  async vehicleFlow(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        customer: true,
        purchaseInvoice: true,
        pdiRecord: true,
        installation: true,
        deliverySheet: true,
        safetyRecord: true,
        insuranceRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
        rtoRecord: true,
        accountsDeal: true,
        atsSheet: true,
        serviceRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
        workItems: {
          orderBy: { updatedAt: 'desc' },
          include: { owner: true, documents: true, customer: true },
        },
      },
    })
    if (!vehicle) throw new NotFoundException('Vehicle not found')

    const trackerOrder = [
      { key: 'purchase', title: 'Purchase Invoice', route: '/purchase-invoices' },
      { key: 'pdi', title: 'Pre-Delivery Inspection', route: '/pdi' },
      { key: 'installation', title: 'Installation Certificate', route: '/installation' },
      { key: 'delivery', title: 'Sales History', route: '/delivery' },
      { key: 'safety', title: 'Safety & Maintenance', route: '/safety' },
      { key: 'rto', title: 'RTO Documents', route: '/rto' },
      { key: 'insurance', title: 'Insurance Management', route: '/insurance' },
      { key: 'accounts', title: 'Accounts Module', route: '/accounts' },
      { key: 'ats', title: 'ATS Charge Sheet', route: '/ats' },
    ] as const

    const payloadOf = (moduleKey: string) => {
      const found = vehicle.workItems.find((item) => item.moduleKey === moduleKey)
      if (!found?.payload) return {}
      try {
        return JSON.parse(found.payload)
      } catch {
        return {}
      }
    }

    const deliveryPayload = payloadOf('delivery')
    const progressedPastDelivery =
      Boolean(vehicle.safetyRecord) ||
      vehicle.insuranceRecords.length > 0 ||
      Boolean(vehicle.rtoRecord) ||
      Boolean(vehicle.accountsDeal) ||
      Boolean(vehicle.atsSheet) ||
      ['Safety Acknowledged', 'Safety Completed', 'Insured', 'RTO Verification In Progress', 'RTO Filed', 'Financially Closed', 'Closed'].includes(vehicle.status)
    const completedMap: Record<string, boolean> = {
      purchase: Boolean(vehicle.purchaseInvoice),
      pdi: Boolean(vehicle.pdiRecord),
      installation: Boolean(vehicle.installation),
      delivery: (Boolean(vehicle.deliverySheet) && Boolean(deliveryPayload['Delivery Finalized'])) || progressedPastDelivery,
      safety: Boolean(vehicle.safetyRecord),
      insurance: vehicle.insuranceRecords.length > 0,
      rto: Boolean(vehicle.rtoRecord),
      accounts: Boolean(vehicle.accountsDeal),
      ats: Boolean(vehicle.atsSheet),
    }

      const currentStepByStatus: Record<string, string> = {
        'Pending PDI': 'pdi',
        'Pending Installation': 'installation',
        'Ready for Installation': 'installation',
        'Allocated to Customer': 'delivery',
        Delivered: 'safety',
        'Safety Acknowledged': 'rto',
        'Safety Completed': 'rto',
        'RTO Verification In Progress': 'insurance',
        'RTO Filed': 'insurance',
        Insured: 'accounts',
        'Financially Closed': 'ats',
        Closed: 'ats',
      }

      let currentKey = currentStepByStatus[vehicle.status] ?? trackerOrder.find((step) => !completedMap[step.key])?.key ?? 'ats'
      if (completedMap.rto && !completedMap.insurance) currentKey = 'insurance'
      if (completedMap.insurance && !completedMap.accounts) currentKey = 'accounts'
      if (completedMap.accounts && !completedMap.ats) currentKey = 'ats'
      const currentIndex = trackerOrder.findIndex((step) => step.key === currentKey)

    const steps = trackerOrder.map((step, index) => {
      const workItem = vehicle.workItems.find((item) => item.moduleKey === step.key)
      const completed = completedMap[step.key]
      const active = !completed && index === currentIndex
      const available = index <= currentIndex
      return {
        key: step.key,
        title: step.title,
        route: step.route,
        completed,
        active,
        available,
        workItemId: workItem?.id ?? null,
        workItemRef: workItem?.ref ?? null,
        workItemStatus: workItem?.status ?? null,
        updatedAt: workItem?.updatedAt ?? null,
      }
    })

    const currentStep = steps.find((step) => step.active) ?? steps.find((step) => !step.completed) ?? steps[steps.length - 1] ?? null
    const nextPending = steps.find((step) => !step.completed) ?? null

    return {
      vehicle: {
        id: vehicle.id,
        code: vehicle.code,
        model: vehicle.model,
        engineNo: vehicle.engineNo,
        chassisNo: vehicle.chassisNo,
        registrationNo: vehicle.registrationNo,
        status: vehicle.status,
      },
      customer: vehicle.customer
        ? {
            id: vehicle.customer.id,
            name: vehicle.customer.name,
            mobile: vehicle.customer.mobile,
            email: vehicle.customer.email,
          }
        : null,
      steps,
      currentStep,
      nextPending,
      summary: {
        completedCount: steps.filter((step) => step.completed).length,
        totalCount: steps.length,
        deliveryFinalized: Boolean(deliveryPayload['Delivery Finalized']),
        latestServiceRequest: vehicle.serviceRequests[0]
          ? {
              id: vehicle.serviceRequests[0].id,
              complaintNumber: vehicle.serviceRequests[0].complaintNumber,
              status: vehicle.serviceRequests[0].status,
            }
          : null,
      },
    }
  }

  async pdiVehicleRecord(vehicleId: string) {
    const record = await this.prisma.pDIRecord.findUnique({
      where: { vehicleId },
      include: {
        vehicle: true,
        inspector: true,
        results: {
          include: { checklist: true },
          orderBy: { checklist: { sortOrder: 'asc' } },
        },
      },
    })
    if (!record) return null
    return {
      id: record.id,
      vehicleId: record.vehicleId,
      status: record.status,
      remarks: record.remarks,
      signatoryPhoto: record.signatoryPhoto,
      otpVerified: record.otpVerified,
      completedAt: record.completedAt,
      inspector: record.inspector ? { id: record.inspector.id, name: record.inspector.name } : null,
      results: record.results.map((item) => ({
        id: item.id,
        code: item.checklist.code,
        label: item.checklist.label,
        section: item.checklist.section,
        result: item.result,
        remarks: item.remarks,
      })),
    }
  }

  customers() {
    return this.prisma.customer.findMany({ include: { vehicles: true }, orderBy: { createdAt: 'desc' } })
  }

  async users() {
    const rows = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
    return rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      dealerCode: user.dealerCode,
      dealerName: user.dealerName,
      createdAt: user.createdAt,
      isActive: user.isActive,
    }))
  }

  workItems() {
    return this.prisma.workItem.findMany({
      include: { customer: true, vehicle: true, owner: true, documents: true },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async createCustomer(body: PlainBody) {
    const name = this.pick(body, ['name', 'Customer Name', 'FULL NAME'])
    const mobile = this.onlyDigits(this.pick(body, ['mobile', 'Mobile Number', 'Customer Mobile']))
    const email = this.pick(body, ['email', 'Email Address'])
    const address = this.pick(body, ['address', 'Address', 'PRIMARY ADDRESS'])
    if (!name || !mobile || mobile.length !== 10 || !address) {
      throw new BadRequestException('Customer Name, 10-digit Mobile Number, and Address are required')
    }
    if (email && !this.isValidEmail(email)) throw new BadRequestException('Enter a valid customer email')
    const existing = await this.prisma.customer.findFirst({
      where: {
        OR: [
          { mobile },
          email ? { email } : undefined,
          this.pick(body, ['aadhaar', 'Aadhaar Number', 'Aadhaar Number (Masked)', 'Customer Aadhaar'])
            ? { aadhaar: this.onlyDigits(this.pick(body, ['aadhaar', 'Aadhaar Number', 'Aadhaar Number (Masked)', 'Customer Aadhaar'])) }
            : undefined,
        ].filter(Boolean) as any[],
      },
    })
    if (existing) return existing
    const customer = await this.prisma.customer.create({
      data: {
        name,
        fatherName: this.pick(body, ['Father Name']),
        registeredOwnerName: this.pick(body, ['Registered Owner Name']) || name,
        mobile,
        secondaryMobile: this.onlyDigits(this.pick(body, ['Secondary Mobile'])) || null,
        email: email || null,
        address,
        district: this.pick(body, ['District']) || null,
        state: this.pick(body, ['State']) || null,
        pincode: this.onlyDigits(this.pick(body, ['Pincode', 'PIN Code'])) || null,
        panNumber: this.pick(body, ['PAN Number', 'PAN']) || null,
        aadhaar: this.onlyDigits(this.pick(body, ['aadhaar', 'Aadhaar Number', 'Customer Aadhaar'])) || null,
      },
    })
    await this.audit({ module: 'customers', action: 'CUSTOMER_CREATED', refId: customer.id, context: { customerId: customer.id } })
    return customer
  }

  async createVehicle(body: PlainBody) {
    const engineNo = this.pick(body, ['engineNo', 'Engine Number'])
    const chassisNo = this.pick(body, ['chassisNo', 'Chassis Number'])
    const model = this.pick(body, ['model', 'Model'])
    if (!engineNo || !chassisNo || !model) {
      throw new BadRequestException('Engine Number, Chassis Number, and Model are required to create a vehicle')
    }
    const existing = await this.prisma.vehicle.findFirst({ where: { OR: [{ engineNo }, { chassisNo }] } })
    if (existing) return existing
    const count = await this.prisma.vehicle.count()
    const vehicle = await this.prisma.vehicle.create({
      data: {
        code: `VEH-2026-${String(count + 1).padStart(5, '0')}`,
        engineNo,
        chassisNo,
        model,
        variant: this.pick(body, ['Variant']) || null,
        registrationNo: this.pick(body, ['Vehicle Registration Number']) || null,
      status: this.pick(body, ['status']) || 'Pending Installation',
      },
    })
    await this.audit({ module: 'vehicles', action: 'VEHICLE_CREATED', refId: vehicle.id, context: { code: vehicle.code } })
    return vehicle
  }

  async moduleWorkItems(key: string) {
    await this.module(key)
    return this.prisma.workItem.findMany({
      where: { moduleKey: key },
      include: { customer: true, vehicle: true, owner: true, documents: true },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async createWorkItem(key: string, body: PlainBody, actor?: AuthUser) {
    const module = await this.module(key)
    const payload = this.enteredPayload(body)
    if (!Object.keys(payload).length) {
      throw new BadRequestException('Enter at least one field before creating a record')
    }
    switch (key) {
      case 'purchase':
        return this.createPurchaseWorkflow(module, body, actor)
      case 'pdi':
        return this.createPdiWorkflow(module, body, actor)
      case 'installation':
        return this.createInstallationWorkflow(module, body, actor)
      case 'delivery':
        return this.createDeliveryWorkflow(module, body, actor)
      case 'safety':
        return this.createSafetyWorkflow(module, body, actor)
      case 'insurance':
        return this.createInsuranceWorkflow(module, body, actor)
      case 'rto':
        return this.createRtoWorkflow(module, body, actor)
      case 'accounts':
        return this.createAccountsWorkflow(module, body, actor)
      case 'ats':
        return this.createAtsWorkflow(module, body, actor)
      case 'service':
        return this.createServiceWorkflow(module, body, actor)
      case 'exchange':
        return this.createExchangeWorkflow(module, body, actor)
      default:
        return this.createGenericWorkItem(module, body, actor)
    }
  }

  async updateWorkItemStatus(id: string, status: string) {
    const workItem = await this.prisma.workItem.findUnique({
      where: { id },
      include: { customer: true, vehicle: true, owner: true, documents: true, module: true },
    })
    if (!workItem) throw new NotFoundException('Work item not found')

    const updated = await this.prisma.workItem.update({
      where: { id },
      data: { status },
      include: { customer: true, vehicle: true, owner: true, documents: true, module: true },
    })

    if (updated.vehicleId) {
      let nextVehicleStatus = ''
      if (['Complete', 'Closed', 'Verification In Progress'].includes(status)) {
        nextVehicleStatus = status === 'Verification In Progress' ? 'RTO Verification In Progress' : updated.module.statusAfter
      }
      if (status === 'Rejected' && updated.moduleKey === 'rto') {
        nextVehicleStatus = 'Safety Acknowledged'
      }
      if (nextVehicleStatus) {
        await this.prisma.vehicle.update({ where: { id: updated.vehicleId }, data: { status: nextVehicleStatus } })
      }
    }

    await this.audit({ module: updated.moduleKey, action: 'WORK_ITEM_STATUS_UPDATED', refId: updated.id, context: { ref: updated.ref, status } })
    return updated
  }

  async updateWorkItemPayload(id: string, body: PlainBody) {
    const current = await this.prisma.workItem.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Work item not found')
    const existing = current.payload ? JSON.parse(current.payload) : {}
    const updates = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined && value !== null))
    const payload = { ...existing, ...updates }
    const due = this.pick(body, ['RTO Submission Deadline', 'Due Date', 'Delivery Date', 'End Date']) || current.due
    const updated = await this.prisma.workItem.update({
      where: { id },
      data: { payload: JSON.stringify(payload), due },
      include: { customer: true, vehicle: true, owner: true, documents: true },
    })

    if (updated.moduleKey === 'rto' && updated.rtoRecordId) {
      await this.prisma.rTORecord.update({
        where: { id: updated.rtoRecordId },
        data: {
          remarks: this.pick(body, ['Verification Remarks']) || undefined,
          submissionDeadline: this.parseDate(this.pick(body, ['RTO Submission Deadline'])) || undefined,
          registrationNumber: this.pick(body, ['Vehicle Registration Number']) || undefined,
        },
      })
    }

    if (updated.moduleKey === 'delivery' && updated.deliverySheetId) {
      const deliveredItemsJson = JSON.stringify(
        ['Tractor Unit (Cleaned)', 'Ignition Keys (2 Sets)', 'Operator Manual', 'Standard Tool Kit', 'Jack & Handle', 'Warranty Booklet'].map((label) => ({
          label,
          checked: String(payload[label] ?? '').toLowerCase() === 'true' || Boolean(payload[label]),
        })),
      )
      await this.prisma.deliverySheet.update({
        where: { id: updated.deliverySheetId },
        data: {
          deliveryDate: this.parseDate(this.pick(payload, ['Delivery Date'])) || undefined,
          deliveredItemsJson,
          agreementAccepted: Boolean(payload['Agreement Confirmation']),
          signatureData: this.pick(payload, ['Customer Signature']) || undefined,
        },
      })
    }

    if (updated.moduleKey === 'safety' && updated.safetyRecordId) {
      await this.prisma.safetyAcknowledgement.update({
        where: { id: updated.safetyRecordId },
        data: {
          language: this.pick(payload, ['Language Preference']) || undefined,
          topicsJson: JSON.stringify(this.defaultSafetyTopics()),
          otpVerified: Boolean(this.pick(payload, ['OTP Verification']) || payload['OTP Verification']),
          acknowledgedAt: Boolean(this.pick(payload, ['Acknowledged']) || payload['Acknowledged']) ? new Date() : undefined,
        },
      })
    }

    if (updated.moduleKey === 'insurance' && updated.insuranceRecordId) {
      await this.prisma.insuranceRecord.update({
        where: { id: updated.insuranceRecordId },
        data: {
          policyNumber: this.pick(payload, ['Policy Number']) || undefined,
          provider: this.pick(payload, ['Company', 'Provider']) || undefined,
          premiumAmount: this.parseCurrency(this.pick(payload, ['Premium Amount'])) || undefined,
          startDate: this.parseDate(this.pick(payload, ['Start Cover Date', 'Start Date'])) || undefined,
          endDate: this.parseDate(this.pick(payload, ['End Cover Date', 'End Date'])) || undefined,
          nominee: this.pick(payload, ['Contact Number']) || undefined,
          coverageType: this.pick(payload, ['Coverage Ratio', 'Coverage Type']) || undefined,
          fileName: this.pick(payload, ['Policy Copy']) || undefined,
        },
      })
    }

    if (updated.moduleKey === 'accounts' && updated.accountsDealId) {
      await this.prisma.accountsDeal.update({
        where: { id: updated.accountsDealId },
        data: {
          bookingAmount: this.parseCurrency(this.pick(payload, ['Deal Value', 'Total Deal Value'])) || undefined,
          cashReceipt: this.parseCurrency(this.pick(payload, ['Closed Value'])) || undefined,
          finalBalance: this.parseCurrency(this.pick(payload, ['Balance', 'Final Balance'])) || undefined,
          receiptsJson: JSON.stringify({
            accountDetails: this.pick(payload, ['Account Details']) || '',
            handledBy: this.pick(payload, ['Handled By']) || '',
          }),
        },
      })
    }

    await this.audit({ module: updated.moduleKey, action: 'WORK_ITEM_PAYLOAD_UPDATED', refId: updated.id, context: { ref: updated.ref } })
    return updated
  }

  async toggleDocument(id: string) {
    const current = await this.prisma.documentRecord.findUnique({ where: { id } })
    if (!current) throw new NotFoundException('Document not found')
    return this.prisma.documentRecord.update({
      where: { id },
      data: {
        status: current.status === 'Uploaded' ? 'Pending' : 'Uploaded',
        fileName: current.status === 'Uploaded' ? null : `${current.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
      },
    })
  }

  async uploadDocument(id: string, fileName: string, contentBase64?: string, mimeType?: string) {
    if (!fileName) throw new BadRequestException('Select a document file before uploading')
    const current = await this.prisma.documentRecord.findUnique({ where: { id }, include: { workItem: true } })
    if (!current) throw new NotFoundException('Document not found')
    await this.persistUploadedFile(current.workItem.moduleKey, id, fileName, contentBase64, mimeType)
    const document = await this.prisma.documentRecord.update({
      where: { id },
      data: { status: 'Uploaded', fileName },
    })
    if (current.workItem.moduleKey === 'rto' && current.workItem.rtoRecordId) {
      await this.prisma.rTODocument.upsert({
        where: {
          id: `${current.workItem.rtoRecordId}:${current.name}`,
        } as any,
        update: { status: 'Uploaded', fileName },
        create: {
          id: `${current.workItem.rtoRecordId}:${current.name}`,
          rtoRecordId: current.workItem.rtoRecordId,
          name: current.name,
          status: 'Uploaded',
          fileName,
        },
      }).catch(async () => {
        const existing = await this.prisma.rTODocument.findFirst({ where: { rtoRecordId: current.workItem.rtoRecordId!, name: current.name } })
        if (existing) {
          await this.prisma.rTODocument.update({ where: { id: existing.id }, data: { status: 'Uploaded', fileName } })
        } else {
          await this.prisma.rTODocument.create({ data: { rtoRecordId: current.workItem.rtoRecordId!, name: current.name, status: 'Uploaded', fileName } })
        }
      })
    }
    await this.audit({ module: 'documents', action: 'DOCUMENT_UPLOADED', refId: id, context: { documentId: id, fileName } })
    return document
  }

  async removeDocument(id: string) {
    const current = await this.prisma.documentRecord.findUnique({ where: { id }, include: { workItem: true } })
    if (!current) throw new NotFoundException('Document not found')

    if (current.fileName) {
      const filePath = join(STORAGE_ROOT, 'uploads', current.workItem.moduleKey, `${id}-${current.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_')}`)
      await fs.unlink(filePath).catch(() => undefined)
    }

    const document = await this.prisma.documentRecord.update({
      where: { id },
      data: { status: 'Pending', fileName: null },
    })

    if (current.workItem.moduleKey === 'rto' && current.workItem.rtoRecordId) {
      const existing = await this.prisma.rTODocument.findFirst({ where: { rtoRecordId: current.workItem.rtoRecordId, name: current.name } })
      if (existing) {
        await this.prisma.rTODocument.update({ where: { id: existing.id }, data: { status: 'Pending', fileName: null } })
      }
    }

    await this.audit({ module: 'documents', action: 'DOCUMENT_REMOVED', refId: id, context: { documentId: id } })
    return document
  }

  async viewDocumentFile(id: string) {
    const current = await this.prisma.documentRecord.findUnique({ where: { id }, include: { workItem: true } })
    if (!current || !current.fileName) throw new NotFoundException('Saved file not found')
    const filePath = join(STORAGE_ROOT, 'uploads', current.workItem.moduleKey, `${id}-${current.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_')}`)
    const buffer = await fs.readFile(filePath)
    return {
      buffer,
      fileName: current.fileName,
      mimeType: this.mimeTypeFromFileName(current.fileName),
    }
  }

  async addDocument(workItemId: string, name: string) {
    if (!name) throw new BadRequestException('Document name is required')
    const workItem = await this.prisma.workItem.findUnique({ where: { id: workItemId } })
    if (!workItem) throw new NotFoundException('Work item not found')
    const document = await this.prisma.documentRecord.create({
      data: { workItemId, name, status: 'Pending', fileName: null },
    })
    if (workItem.moduleKey === 'rto' && workItem.rtoRecordId) {
      await this.prisma.rTODocument.create({ data: { rtoRecordId: workItem.rtoRecordId, name, status: 'Pending' } })
    }
    await this.audit({ module: workItem.moduleKey, action: 'DOCUMENT_ADDED', refId: workItem.id, context: { workItemId, name } })
    return document
  }

  async sendOtp(body: { mobile: string; context: string }) {
    const mobile = this.onlyDigits(body.mobile)
    if (mobile.length !== 10) throw new BadRequestException('Enter a valid 10-digit mobile number')
    const otp = '123456'
    await this.prisma.otpLog.create({
      data: {
        mobile,
        context: body.context,
        otpHash: this.hashToken(otp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    })
    return {
      mobile,
      context: body.context,
      otpValidityMinutes: 10,
      resendAfterSeconds: 60,
      demoOtp: otp,
    }
  }

  async verifyOtp(body: { mobile: string; otp: string; context: string }) {
    const mobile = this.onlyDigits(body.mobile)
    const latest = await this.prisma.otpLog.findFirst({
      where: { mobile, context: body.context },
      orderBy: { createdAt: 'desc' },
    })
    const verified = Boolean(latest && latest.otpHash === this.hashToken(body.otp) && latest.expiresAt > new Date())
    if (latest) {
      await this.prisma.otpLog.update({
        where: { id: latest.id },
        data: { verified, attempts: { increment: 1 } },
      })
    }
    return {
      mobile,
      context: body.context,
      verified,
      attemptsRemaining: verified ? 3 : Math.max(0, 2 - (latest?.attempts ?? 0)),
      loggedAt: new Date().toISOString(),
    }
  }

  async audit(body: Record<string, unknown>) {
    return this.prisma.auditLog.create({
      data: {
        actorId: typeof body.actorId === 'string' ? body.actorId : undefined,
        module: String(body.module ?? 'system'),
        action: String(body.action ?? 'EVENT'),
        refId: typeof body.refId === 'string' ? body.refId : undefined,
        context: JSON.stringify((body.context as object) ?? body),
        beforeJson: body.beforeJson ? JSON.stringify(body.beforeJson) : undefined,
        afterJson: body.afterJson ? JSON.stringify(body.afterJson) : undefined,
      },
    })
  }

  auditLogs() {
    return this.prisma.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: 'desc' }, take: 50 })
  }

  async notifications() {
    const [pendingDocs, openItems, audits] = await Promise.all([
      this.prisma.documentRecord.count({ where: { status: 'Pending' } }),
      this.prisma.workItem.count({ where: { status: { notIn: ['Complete', 'Closed'] } } }),
      this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    ])
    return [
      { id: 'NOT-001', title: 'Pending documents', message: `${pendingDocs} documents need upload or review`, tone: 'warning' },
      { id: 'NOT-002', title: 'Open workflow items', message: `${openItems} workflow transactions are active`, tone: 'info' },
      ...audits.map((audit) => ({ id: audit.id, title: audit.action, message: `${audit.module} updated`, tone: 'success' })),
    ]
  }

  async search(query: string) {
    const contains = decodeURIComponent(query)
    const [customers, vehicles, workItems] = await Promise.all([
      this.prisma.customer.findMany({ where: { OR: [{ name: { contains } }, { mobile: { contains } }, { aadhaar: { contains } }] }, take: 10 }),
      this.prisma.vehicle.findMany({ where: { OR: [{ code: { contains } }, { engineNo: { contains } }, { chassisNo: { contains } }, { model: { contains } }, { registrationNo: { contains } }] }, take: 10 }),
      this.prisma.workItem.findMany({ where: { OR: [{ ref: { contains } }, { status: { contains } }] }, include: { customer: true, vehicle: true }, take: 10 }),
    ])
    return { query: contains, customers, vehicles, workItems }
  }

  private async createPurchaseWorkflow(module: any, body: PlainBody, actor?: AuthUser) {
    const irn = this.pick(body, ['IRN'])
    const ackNumber = this.pick(body, ['Ack Number'])
    const ackDate = this.parseDate(this.pick(body, ['Ack Date']))
    const invoiceNumber = this.pick(body, ['Invoice Serial Number'])
    const eWayBillNumber = this.pick(body, ['E-Way Bill Number'])
    const invoiceDate = this.parseDate(this.pick(body, ['Invoice Date']))
    const eWayBillDate = this.parseDate(this.pick(body, ['E-Way Bill Date']))
    const vehicleCount = this.parseInteger(this.pick(body, ['Number of Vehicles Received']))
    const totalValue = this.parseCurrency(this.pick(body, ['Total Purchase Value']))
    const consignerName = this.pick(body, ['Consigner Name'])
    const requiredTextFields = [
      'Consigner GST Number',
      'Consigner Address',
      'CIN Number',
      'PAN',
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
    ]
    const model = this.pick(body, ['Model'])
    const engineNo = this.pick(body, ['Engine Number'])
    const chassisNo = this.pick(body, ['Chassis Number'])

    if (
      !irn ||
      !ackNumber ||
      !ackDate ||
      !invoiceNumber ||
      !eWayBillNumber ||
      !invoiceDate ||
      !eWayBillDate ||
      vehicleCount < 1 ||
      !totalValue ||
      !consignerName ||
      requiredTextFields.some((field) => !this.pick(body, [field])) ||
      !model ||
      !engineNo ||
      !chassisNo
    ) {
      throw new BadRequestException('Fill the mandatory invoice, receiver, consigner, logistics, and tractor fields')
    }

    const duplicate = await this.prisma.purchaseInvoice.findFirst({
      where: { OR: [{ invoiceNumber }, { eWayBillNumber }] },
    })
    if (duplicate) throw new BadRequestException('Duplicate invoice or e-way bill detected')

    const owner = await this.prisma.user.findFirst({ where: { role: 'sales' } })
    const purchaseInvoice = await this.prisma.purchaseInvoice.create({
      data: {
        invoiceNumber,
        invoiceDate,
        eWayBillNumber,
        eWayBillDate,
        vehicleCount,
        totalValue,
        consignmentDetails: this.pick(body, ['Consignment Details']) || null,
        consignerName,
        consignerInvoiceNumber: this.pick(body, ['Consigner Invoice Number']) || null,
        status: 'Pending PDI',
        createdById: actor?.id ?? owner?.id,
      },
    })

    const vehicles = []
    for (let index = 0; index < vehicleCount; index += 1) {
      const vehicle = await this.prisma.vehicle.create({
        data: {
          code: `VEH-2026-${String((await this.prisma.vehicle.count()) + 1).padStart(5, '0')}`,
          engineNo: vehicleCount === 1 ? engineNo : `${engineNo}-${index + 1}`,
          chassisNo: vehicleCount === 1 ? chassisNo : `${chassisNo}-${index + 1}`,
          model,
          status: 'Pending PDI',
          purchaseInvoiceId: purchaseInvoice.id,
        },
      })
      vehicles.push(vehicle)
    }

    return this.createSummaryWorkItem(module.key, {
      module,
      customerId: null,
      vehicleId: vehicles[0]?.id,
      ownerId: actor?.id ?? owner?.id,
      amount: totalValue,
      due: this.pick(body, ['Invoice Date']) || '',
      payload: body,
      documentNames: this.defaultDocuments('purchase'),
      status: 'In Review',
      purchaseInvoiceId: purchaseInvoice.id,
    })
  }

  private async createPdiWorkflow(module: any, body: PlainBody, actor?: AuthUser) {
    const vehicle = await this.requireVehicle(body)
    this.requireVehicleWorkflowState(vehicle.status, ['Pending PDI', 'PDI Failed'], 'PDI can only be recorded after the purchase invoice is completed')
    const owner = await this.prisma.user.findFirst({ where: { role: 'technician' } })
    const existing = await this.prisma.pDIRecord.findUnique({ where: { vehicleId: vehicle.id } })
    if (existing && ['Pending Installation', 'Allocated to Customer'].includes(vehicle.status)) {
      throw new BadRequestException('This vehicle has already been inspected. Open the saved inspection result instead of creating a new one.')
    }
    const pdiStatusAfter = 'Pending Installation'
    const record =
      existing
        ? await this.prisma.pDIRecord.update({
            where: { vehicleId: vehicle.id },
            data: {
              remarks: this.pick(body, ['Inspector Remarks']) || null,
              signatoryPhoto: this.pick(body, ['Authorized Signatory Photo']) || null,
              otpVerified: Boolean(this.pick(body, ['Inspector OTP'])),
              completedAt: new Date(),
              status: pdiStatusAfter,
            },
          })
        : await this.prisma.pDIRecord.create({
            data: {
              vehicleId: vehicle.id,
              inspectorId: actor?.id ?? owner?.id,
              remarks: this.pick(body, ['Inspector Remarks']) || null,
              signatoryPhoto: this.pick(body, ['Authorized Signatory Photo']) || null,
              otpVerified: Boolean(this.pick(body, ['Inspector OTP'])),
              completedAt: new Date(),
              status: pdiStatusAfter,
            },
          })

    const checklist = await this.prisma.pdiChecklistDefinition.findMany({ orderBy: { sortOrder: 'asc' } })
    for (const item of checklist) {
      const fieldKeys = [`PDI:${item.code}`, `PDI:${item.label}`]
      const result = this.pick(body, fieldKeys) || 'N/A'
      const remarkKeys = fieldKeys.map((key) => `${key}:remarks`)
      await this.prisma.pdiChecklistResult.upsert({
        where: { id: `${record.id}:${item.id}` } as any,
        update: { result, remarks: this.pick(body, remarkKeys) || null },
        create: { id: `${record.id}:${item.id}`, pdiRecordId: record.id, checklistId: item.id, result, remarks: this.pick(body, remarkKeys) || null },
      }).catch(async () => {
        const existingResult = await this.prisma.pdiChecklistResult.findFirst({ where: { pdiRecordId: record.id, checklistId: item.id } })
        if (existingResult) {
          await this.prisma.pdiChecklistResult.update({ where: { id: existingResult.id }, data: { result, remarks: this.pick(body, remarkKeys) || null } })
        } else {
          await this.prisma.pdiChecklistResult.create({ data: { pdiRecordId: record.id, checklistId: item.id, result, remarks: this.pick(body, remarkKeys) || null } })
        }
      })
    }

    await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: pdiStatusAfter } })
    return this.createSummaryWorkItem(module.key, {
      module,
      customerId: vehicle.customerId,
      vehicleId: vehicle.id,
      ownerId: actor?.id ?? owner?.id,
      due: '',
      payload: body,
      documentNames: this.defaultDocuments('pdi'),
      status: 'Complete',
      pdiRecordId: record.id,
    })
  }

  private async createInstallationWorkflow(module: any, body: PlainBody, actor?: AuthUser) {
    const customer = await this.createCustomer(body)
    const vehicle = await this.requireVehicle(body)
    this.requireVehicleWorkflowState(vehicle.status, ['Pending Installation', 'Ready for Installation'], 'Complete PDI before creating the installation certificate')
    const owner = await this.prisma.user.findFirst({ where: { role: 'sales' } })
    const existing = await this.prisma.installationCertificate.findUnique({ where: { vehicleId: vehicle.id } })
    const installationStatusAfter = 'Allocated to Customer'
    const certificate =
      existing
        ? await this.prisma.installationCertificate.update({
            where: { vehicleId: vehicle.id },
            data: {
              customerId: customer.id,
              ownerId: actor?.id ?? owner?.id,
              otpVerified: Boolean(this.pick(body, ['OTP Verified']) || true),
              signatureData: this.pick(body, ['Digital Signature']) || null,
              handoverPhoto: this.pick(body, ['Handover Photo']) || null,
              generatedPdf: `installation-${vehicle.code}.pdf`,
              status: installationStatusAfter,
            },
          })
        : await this.prisma.installationCertificate.create({
            data: {
              certificateNo: `IC-${new Date().getFullYear()}-${String((await this.prisma.installationCertificate.count()) + 1).padStart(4, '0')}`,
              vehicleId: vehicle.id,
              customerId: customer.id,
              ownerId: actor?.id ?? owner?.id,
              otpVerified: Boolean(this.pick(body, ['OTP Verified']) || true),
              signatureData: this.pick(body, ['Digital Signature']) || null,
              handoverPhoto: this.pick(body, ['Handover Photo']) || null,
              generatedPdf: `installation-${vehicle.code}.pdf`,
              status: installationStatusAfter,
            },
          })
    await this.writeGeneratedPdf('installation', certificate.generatedPdf ?? `installation-${vehicle.code}.pdf`, 'Installation Certificate', [
      `Certificate No: ${certificate.certificateNo}`,
      `Dealer Code: ${this.pick(body, ['Dealer Code'])}`,
      `OSM No: ${this.pick(body, ['OSM Number'])}`,
      `Dealer Name: ${this.pick(body, ['Dealer Name'])}`,
      `Dealer City: ${this.pick(body, ['Dealer City'])}`,
      `Vehicle Code: ${vehicle.code}`,
      `Tractor No: ${this.pick(body, ['Tractor Number']) || vehicle.chassisNo}`,
      `Vehicle Model: ${vehicle.model}`,
      `TAFE Invoice No: ${this.pick(body, ['TAFE Invoice Number'])}`,
      `Customer: ${customer.name}`,
      `Mobile: ${customer.mobile}`,
      `Address: ${customer.address}`,
      `Status: ${certificate.status}`,
    ])
    await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: { customerId: customer.id, status: installationStatusAfter } })
    return this.createSummaryWorkItem(module.key, {
      module,
      customerId: customer.id,
      vehicleId: vehicle.id,
      ownerId: actor?.id ?? owner?.id,
      due: '',
      payload: body,
      documentNames: this.defaultDocuments('installation'),
      status: 'Complete',
      installationId: certificate.id,
    })
  }

  private async createDeliveryWorkflow(module: any, body: PlainBody, actor?: AuthUser) {
    const vehicle = await this.requireVehicle(body)
    this.requireVehicleWorkflowState(vehicle.status, ['Allocated to Customer', 'Delivered'], 'Complete PDI before creating Sales History')
    const customer = vehicle.customerId ? await this.prisma.customer.findUnique({ where: { id: vehicle.customerId } }) : await this.createCustomer(body)
    if (!customer) throw new BadRequestException('Delivery requires a customer')
    const owner = await this.prisma.user.findFirst({ where: { role: 'sales' } })
    const deliveredItems = JSON.stringify(
      ['Tractor Unit (Cleaned)', 'Ignition Keys (2 Sets)', 'Operator Manual', 'Standard Tool Kit', 'Jack & Handle', 'Warranty Booklet'].map((label) => ({
        label,
        checked: String(body[label] ?? '').toLowerCase() === 'true' || Boolean(body[label]),
      })),
    )
    const uploadsJson = JSON.stringify(this.defaultDocuments('delivery').map((name) => ({ name, uploaded: false })))
    const delivery = await this.prisma.deliverySheet.upsert({
      where: { vehicleId: vehicle.id },
      update: {
        customerId: customer.id,
        ownerId: actor?.id ?? owner?.id,
        deliveryDate: this.parseDate(this.pick(body, ['Delivery Date'])) || new Date(),
        deliveredItemsJson: deliveredItems,
        uploadsJson,
        agreementAccepted: Boolean(body['Agreement Confirmation']),
        signatureData: this.pick(body, ['Customer Signature']) || null,
        receiptPdf: `delivery-${vehicle.code}.pdf`,
        status: module.statusAfter,
      },
      create: {
        sheetNo: `DS-${new Date().getFullYear()}-${String((await this.prisma.deliverySheet.count()) + 1).padStart(4, '0')}`,
        vehicleId: vehicle.id,
        customerId: customer.id,
        ownerId: actor?.id ?? owner?.id,
        deliveryDate: this.parseDate(this.pick(body, ['Delivery Date'])) || new Date(),
        deliveredItemsJson: deliveredItems,
        uploadsJson,
        agreementAccepted: Boolean(body['Agreement Confirmation']),
        signatureData: this.pick(body, ['Customer Signature']) || null,
        receiptPdf: `delivery-${vehicle.code}.pdf`,
        status: module.statusAfter,
      },
    })
    await this.writeGeneratedPdf('delivery', delivery.receiptPdf ?? `delivery-${vehicle.code}.pdf`, 'Sales History Receipt', [
      `Sheet No: ${delivery.sheetNo}`,
      `Vehicle Code: ${vehicle.code}`,
      `Customer: ${customer.name}`,
      `Delivery Date: ${delivery.deliveryDate.toISOString().slice(0, 10)}`,
      `Agreement Accepted: ${delivery.agreementAccepted ? 'Yes' : 'No'}`,
      `Status: ${delivery.status}`,
    ])
    await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: { customerId: customer.id, status: module.statusAfter } })
    return this.createSummaryWorkItem(module.key, {
      module,
      customerId: customer.id,
      vehicleId: vehicle.id,
      ownerId: actor?.id ?? owner?.id,
      due: this.pick(body, ['Delivery Date']) || '',
      payload: body,
      documentNames: this.defaultDocuments('delivery'),
      status: 'Complete',
      deliverySheetId: delivery.id,
    })
  }

  private async createSafetyWorkflow(module: any, body: PlainBody, actor?: AuthUser) {
    const vehicle = await this.requireVehicle(body)
    this.requireVehicleWorkflowState(vehicle.status, ['Delivered', 'Safety Completed'], 'Finalize Sales History before saving safety acknowledgement')
    const record = await this.prisma.safetyAcknowledgement.upsert({
      where: { vehicleId: vehicle.id },
      update: {
        language: this.pick(body, ['Language Preference']) || null,
        topicsJson: JSON.stringify(this.defaultSafetyTopics()),
        otpVerified: Boolean(body['OTP Verification']),
        acknowledgedAt: new Date(),
        status: module.statusAfter,
      },
      create: {
        vehicleId: vehicle.id,
        language: this.pick(body, ['Language Preference']) || null,
        topicsJson: JSON.stringify(this.defaultSafetyTopics()),
        otpVerified: Boolean(body['OTP Verification']),
        acknowledgedAt: new Date(),
        status: module.statusAfter,
      },
    })
    await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: module.statusAfter } })
    return this.createSummaryWorkItem(module.key, {
      module,
      customerId: vehicle.customerId,
      vehicleId: vehicle.id,
      ownerId: actor?.id,
      due: '',
      payload: body,
      documentNames: this.defaultDocuments('safety'),
      status: 'Complete',
      safetyRecordId: record.id,
    })
  }

  private async createInsuranceWorkflow(module: any, body: PlainBody, actor?: AuthUser) {
    const vehicle = await this.requireVehicle(body)
    this.requireVehicleWorkflowState(vehicle.status, ['RTO Verification In Progress', 'RTO Filed', 'Insured'], 'Complete RTO before adding insurance')
    const policyNumber = this.pick(body, ['Policy Number'])
    const provider = this.pick(body, ['Company', 'Provider'])
    const premiumAmount = this.parseCurrency(this.pick(body, ['Premium Amount']))
    const startDate = this.parseDate(this.pick(body, ['Start Cover Date', 'Start Date']))
    const endDate = this.parseDate(this.pick(body, ['End Cover Date', 'End Date']))
    const coverageType = this.pick(body, ['Coverage Ratio', 'Coverage Type'])
    if (!policyNumber || !provider || !premiumAmount || !startDate || !endDate || !coverageType) {
      throw new BadRequestException('Complete the policy number, provider, premium, dates, and coverage type')
    }
    const record = await this.prisma.insuranceRecord.upsert({
      where: { policyNumber },
      update: {
        vehicleId: vehicle.id,
        provider,
        premiumAmount,
        startDate,
        endDate,
        nominee: this.pick(body, ['Contact Number']) || null,
        coverageType,
        status: module.statusAfter,
      },
      create: {
        policyNumber,
        vehicleId: vehicle.id,
        provider,
        premiumAmount,
        startDate,
        endDate,
        nominee: this.pick(body, ['Contact Number']) || null,
        coverageType,
        status: module.statusAfter,
      },
    })
    await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: module.statusAfter } })
    return this.createSummaryWorkItem(module.key, {
      module,
      customerId: vehicle.customerId,
      vehicleId: vehicle.id,
      ownerId: actor?.id,
      amount: premiumAmount,
      due: this.pick(body, ['End Cover Date', 'End Date']) || '',
      payload: body,
      documentNames: this.defaultDocuments('insurance'),
      status: 'Complete',
      insuranceRecordId: record.id,
    })
  }

  private async createRtoWorkflow(module: any, body: PlainBody, actor?: AuthUser) {
    const vehicle = await this.requireVehicle(body)
    this.requireVehicleWorkflowState(vehicle.status, ['Safety Acknowledged', 'Safety Completed', 'RTO Verification In Progress', 'RTO Filed'], 'Complete Safety & Maintenance before filing the RTO packet')
    const customer = vehicle.customerId ? await this.prisma.customer.findUnique({ where: { id: vehicle.customerId } }) : await this.createCustomer(body)
    if (!customer) throw new BadRequestException('RTO requires an allocated customer')
    const packet = await this.prisma.rTORecord.upsert({
      where: { vehicleId: vehicle.id },
      update: {
        customerId: customer.id,
        registrationNumber: this.pick(body, ['Vehicle Registration Number']) || null,
        remarks: this.pick(body, ['Verification Remarks']) || null,
        submissionDeadline: this.parseDate(this.pick(body, ['RTO Submission Deadline'])),
        status: 'Draft',
      },
      create: {
        packetNo: `RTO-${new Date().getFullYear()}-${String((await this.prisma.rTORecord.count()) + 1).padStart(4, '0')}`,
        vehicleId: vehicle.id,
        customerId: customer.id,
        registrationNumber: this.pick(body, ['Vehicle Registration Number']) || null,
        remarks: this.pick(body, ['Verification Remarks']) || null,
        submissionDeadline: this.parseDate(this.pick(body, ['RTO Submission Deadline'])),
        status: 'Draft',
      },
    })
    for (const docName of this.defaultDocuments('rto')) {
      const existingDoc = await this.prisma.rTODocument.findFirst({ where: { rtoRecordId: packet.id, name: docName } })
      if (!existingDoc) {
        await this.prisma.rTODocument.create({ data: { rtoRecordId: packet.id, name: docName, status: 'Pending' } })
      }
    }
    return this.createSummaryWorkItem(module.key, {
      module,
      customerId: customer.id,
      vehicleId: vehicle.id,
      ownerId: actor?.id,
      due: this.pick(body, ['RTO Submission Deadline']) || '',
      payload: body,
      documentNames: this.defaultDocuments('rto'),
      status: 'Draft',
      rtoRecordId: packet.id,
    })
  }

  private async createAccountsWorkflow(module: any, body: PlainBody, actor?: AuthUser) {
    const vehicle = await this.requireVehicle(body)
    this.requireVehicleWorkflowState(vehicle.status, ['Insured', 'Financially Closed'], 'Insurance should be completed before closing accounts')
    const customer = vehicle.customerId ? await this.prisma.customer.findUnique({ where: { id: vehicle.customerId } }) : await this.createCustomer(body)
    if (!customer) throw new BadRequestException('Accounts requires a customer')
    const owner = await this.prisma.user.findFirst({ where: { role: 'accounts' } })
    const deal = await this.prisma.accountsDeal.upsert({
      where: { vehicleId: vehicle.id },
      update: {
        customerId: customer.id,
        ownerId: actor?.id ?? owner?.id,
        bookingAmount: this.parseCurrency(this.pick(body, ['Deal Value', 'Total Deal Value'])),
        loanDisbursal: null,
        cashReceipt: this.parseCurrency(this.pick(body, ['Closed Value'])),
        discountApproval: null,
        finalBalance: this.parseCurrency(this.pick(body, ['Balance', 'Final Balance'])),
        closureDate: new Date(),
        status: module.statusAfter,
      },
      create: {
        dealNo: `DEAL-${new Date().getFullYear()}-${String((await this.prisma.accountsDeal.count()) + 1).padStart(4, '0')}`,
        vehicleId: vehicle.id,
        customerId: customer.id,
        ownerId: actor?.id ?? owner?.id,
        bookingAmount: this.parseCurrency(this.pick(body, ['Deal Value', 'Total Deal Value'])),
        loanDisbursal: null,
        cashReceipt: this.parseCurrency(this.pick(body, ['Closed Value'])),
        discountApproval: null,
        finalBalance: this.parseCurrency(this.pick(body, ['Balance', 'Final Balance'])),
        closureDate: new Date(),
        status: module.statusAfter,
      },
    })
    await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: module.statusAfter } })
    return this.createSummaryWorkItem(module.key, {
      module,
      customerId: customer.id,
      vehicleId: vehicle.id,
      ownerId: actor?.id ?? owner?.id,
      amount: deal.finalBalance ?? 0,
      due: this.pick(body, ['Balance', 'Final Balance']) || '',
      payload: body,
      documentNames: this.defaultDocuments('accounts'),
      status: 'Complete',
      accountsDealId: deal.id,
    })
  }

  private async createAtsWorkflow(module: any, body: PlainBody, actor?: AuthUser) {
    const vehicle = await this.requireVehicle(body)
    this.requireVehicleWorkflowState(vehicle.status, ['Financially Closed', 'ATS Generated', 'Closed'], 'Complete Accounts before generating ATS')
    const deal = await this.prisma.accountsDeal.findUnique({ where: { vehicleId: vehicle.id } })
    if (!deal) throw new BadRequestException('Create and close the accounts deal first')
    const owner = await this.prisma.user.findFirst({ where: { role: 'accounts' } })
    const taxableAmount = this.parseCurrency(this.pick(body, ['Taxable Amount']))
    const charges = this.parseCurrency(this.pick(body, ['Charges']))
    const discount = this.parseCurrency(this.pick(body, ['Discount']))
    const netSettlement = this.parseCurrency(this.pick(body, ['Net Settlement'])) || taxableAmount + charges - discount
    const ats = await this.prisma.aTSRecord.upsert({
      where: { dealId: deal.id },
      update: { vehicleId: vehicle.id, ownerId: actor?.id ?? owner?.id, taxableAmount, charges, discount, netSettlement, approver: this.pick(body, ['Approver']) || null, dueColor: this.resolveDueColor(new Date()), status: module.statusAfter },
      create: { atsNo: `ATS-${new Date().getFullYear()}-${String((await this.prisma.aTSRecord.count()) + 1).padStart(4, '0')}`, dealId: deal.id, vehicleId: vehicle.id, ownerId: actor?.id ?? owner?.id, taxableAmount, charges, discount, netSettlement, approver: this.pick(body, ['Approver']) || null, dueColor: this.resolveDueColor(new Date()), status: module.statusAfter },
    })
    await this.prisma.vehicle.update({ where: { id: vehicle.id }, data: { status: module.statusAfter } })
    return this.createSummaryWorkItem(module.key, {
      module,
      customerId: deal.customerId,
      vehicleId: vehicle.id,
      ownerId: actor?.id ?? owner?.id,
      amount: netSettlement,
      due: '',
      payload: body,
      documentNames: this.defaultDocuments('ats'),
      status: 'Complete',
      atsRecordId: ats.id,
    })
  }

  private async createServiceWorkflow(module: any, body: PlainBody, actor?: AuthUser) {
    const vehicle = await this.requireVehicle(body)
    this.requireVehicleWorkflowState(
      vehicle.status,
      ['Delivered', 'Safety Acknowledged', 'Safety Completed', 'Insured', 'RTO Verification In Progress', 'RTO Filed', 'Financially Closed', 'Closed', 'ATS Generated', 'Service In Progress'],
      'Service requests are only for vehicles already handed over to the customer or moved into after-sales flow',
    )
    const customer = vehicle.customerId ? await this.prisma.customer.findUnique({ where: { id: vehicle.customerId } }) : await this.createCustomer(body)
    if (!customer) throw new BadRequestException('Service requires a customer')
    const owner = await this.prisma.user.findFirst({ where: { role: 'technician' } })
    const request = await this.prisma.serviceRequest.create({
      data: {
        complaintNumber: this.pick(body, ['Complaint Number']) || `COM-${new Date().getFullYear()}-${String((await this.prisma.serviceRequest.count()) + 1).padStart(4, '0')}`,
        vehicleId: vehicle.id,
        customerId: customer.id,
        ownerId: actor?.id ?? owner?.id,
        issueCategory: this.pick(body, ['Issue Category']) || 'General',
        priority: this.pick(body, ['Priority']) || 'Medium',
        mechanic: this.pick(body, ['Mechanic']) || null,
        visitType: this.pick(body, ['Visit Type']) || 'Workshop',
        sparesUsed: this.pick(body, ['Spares Used']) || null,
        complaintNotes: this.pick(body, ['Complaint Notes']) || null,
        beforePhotos: null,
        afterPhotos: null,
        otpVerified: Boolean(body['OTP Verification']),
        signatureData: this.pick(body, ['Customer Signature']) || null,
        status: module.statusAfter,
      },
    })
    return this.createSummaryWorkItem(module.key, {
      module,
      customerId: customer.id,
      vehicleId: vehicle.id,
      ownerId: actor?.id ?? owner?.id,
      due: '',
      payload: body,
      documentNames: this.defaultDocuments('service'),
      status: 'In Progress',
      serviceRequestId: request.id,
    })
  }

  private async createExchangeWorkflow(module: any, body: PlainBody, actor?: AuthUser) {
    const record = await this.prisma.exchangeRecord.create({
      data: {
        exchangeNo: `EX-${new Date().getFullYear()}-${String((await this.prisma.exchangeRecord.count()) + 1).padStart(4, '0')}`,
        previousOwner: this.pick(body, ['Previous Owner']) || 'Unknown',
        ownershipChain: this.pick(body, ['Ownership Chain']) || null,
        loanStatus: this.pick(body, ['Loan / Hypothecation']) || null,
        make: this.pick(body, ['Make']) || 'TAFE',
        model: this.pick(body, ['Model']) || 'Unspecified',
        year: this.parseInteger(this.pick(body, ['Year'])) || null,
        hoursOnMeter: this.parseInteger(this.pick(body, ['Hours on Meter'])) || null,
        offeredPrice: this.parseCurrency(this.pick(body, ['Offered Price'])) || null,
        liquidationTargetPrice: this.parseCurrency(this.pick(body, ['Liquidation Target Price'])) || null,
        evaluationPhotos: null,
        status: module.statusAfter,
      },
    })
    return this.createSummaryWorkItem(module.key, {
      module,
      ownerId: actor?.id,
      due: '',
      payload: body,
      documentNames: this.exchangeDocumentsFor(body),
      status: 'In Review',
      exchangeRecordId: record.id,
      amount: record.offeredPrice ?? 0,
    })
  }

  private async createGenericWorkItem(module: any, body: PlainBody, actor?: AuthUser) {
    return this.createSummaryWorkItem(module.key, {
      module,
      ownerId: actor?.id,
      due: this.pick(body, ['Due Date', 'Delivery Date', 'Invoice Date', 'End Date']) || '',
      payload: body,
      documentNames: this.defaultDocuments(module.key),
      status: 'In Review',
    })
  }

  private async createSummaryWorkItem(
    moduleKey: string,
    options: {
      module: any
      customerId?: string | null
      vehicleId?: string | null
      ownerId?: string | null
      amount?: number | null
      due: string
      payload: PlainBody
      documentNames: string[]
      status: string
      purchaseInvoiceId?: string
      pdiRecordId?: string
      installationId?: string
      deliverySheetId?: string
      safetyRecordId?: string
      insuranceRecordId?: string
      rtoRecordId?: string
      accountsDealId?: string
      atsRecordId?: string
      serviceRequestId?: string
      exchangeRecordId?: string
    },
  ) {
    const count = await this.prisma.workItem.count()
    const workItem = await this.prisma.workItem.create({
      data: {
        ref: `TAFE-DMS-${2000 + count + 1}`,
        moduleKey,
        customerId: options.customerId || undefined,
        vehicleId: options.vehicleId || undefined,
        ownerId: options.ownerId || undefined,
        purchaseInvoiceId: options.purchaseInvoiceId,
        pdiRecordId: options.pdiRecordId,
        installationId: options.installationId,
        deliverySheetId: options.deliverySheetId,
        safetyRecordId: options.safetyRecordId,
        insuranceRecordId: options.insuranceRecordId,
        rtoRecordId: options.rtoRecordId,
        accountsDealId: options.accountsDealId,
        atsRecordId: options.atsRecordId,
        serviceRequestId: options.serviceRequestId,
        exchangeRecordId: options.exchangeRecordId,
        status: options.status,
        due: options.due,
        amount: options.amount ?? null,
        payload: JSON.stringify(this.enteredPayload(options.payload)),
        documents: {
          create: options.documentNames.map((name) => ({ name, status: 'Pending', fileName: null })),
        },
      },
      include: { customer: true, vehicle: true, owner: true, documents: true },
    })
    await this.audit({ module: moduleKey, action: 'WORK_ITEM_CREATED', refId: workItem.id, context: { ref: workItem.ref } })
    return workItem
  }

  private async requireVehicle(body: PlainBody) {
    const vehicle = await this.findVehicleFromPayload(body)
    if (!vehicle) {
      throw new BadRequestException('Select or enter a valid vehicle before continuing')
    }
    return vehicle
  }

  private requireVehicleWorkflowState(currentStatus: string, allowedStatuses: string[], errorMessage: string) {
    if (!allowedStatuses.includes(currentStatus)) {
      throw new BadRequestException(errorMessage)
    }
  }

  private defaultDocuments(key: string) {
    const docs: Record<string, string[]> = {
      purchase: ['Company Invoice PDF', 'E-Way Bill', 'LR Copy / Receipt'],
      pdi: ['Inspector Photo', 'Signed PDI PDF', 'Defect Photos'],
      installation: ['Certificate PDF', 'Customer Signature', 'Authorized Signatory'],
      delivery: ['Customer Agreement', 'Voucher', 'Customer History Sheet', 'Aadhaar Card', 'PAN Card', 'Customer Details Form', 'Delivery Challan', 'Gate Pass', 'Tractor Invoice', 'Quotation', 'Delivery Photo', 'Video Byte'],
      exchange: ['Insurance Copy', 'Tractor RC', 'Old Tractor Agreement Copy', 'Old Tractor Stock Proof', 'Accounts Ledger Copy', 'Old Tractor Gate Pass', 'Form 28', 'Form 29', 'Form 30', 'Form 35'],
      safety: ['Acknowledgement PDF', 'Maintenance Guide'],
      insurance: ['Insurance Copy', 'Premium Receipt'],
      rto: ['RC Card', 'Aadhaar Card', 'Form 19-22', 'GST Invoice', 'Bonafide Cert', 'Bank Form 35', 'Passport Photo', 'Shaddow Trace'],
      accounts: ['Receipt', 'Loan Sanction', 'Ledger PDF'],
      ats: ['ATS PDF', 'Ledger Copy', 'Approval Note'],
      service: ['Job Card', 'Service Photos', 'Customer Acknowledgement'],
      admin: ['Audit Export', 'Role Matrix'],
    }
    return docs[key] ?? ['Generated Form', 'Approval Proof']
  }

  private exchangeDocumentsFor(body: PlainBody) {
    const docs = this.defaultDocuments('exchange')
    return String(body['Trailer Attached'] ?? '').toLowerCase() === 'true' ? [...docs, 'Trailer RC'] : docs
  }

  private defaultSafetyTopics() {
    return ['PTO safety', 'Hydraulic safety', 'Daily oil check', 'Tyre pressure', 'Service interval', 'Warranty precautions']
  }

  private presentModule(row: any) {
    const overrides: Record<string, Partial<{ prs: string; statusAfter: string; workflow: string[] }>> = {
      purchase: {
        statusAfter: 'Pending PDI',
        workflow: ['Validate IRN, acknowledgement, invoice, and e-way bill', 'Capture billed-to receiver and consigner GST details', 'Attach LR copy and logistics receipt values', 'Generate one vehicle record per tractor', 'Set vehicle status to Pending PDI'],
      },
      pdi: {
        prs: 'Module 2',
        statusAfter: 'Pending Installation',
        workflow: ['Select vehicle created from purchase invoice', 'Record report header and job card number', 'Mark each checkpoint observation', 'Capture action taken for exceptions', 'Verify OTP', 'Move vehicle to Pending Installation'],
      },
      installation: {
        prs: 'Module 3',
        statusAfter: 'Allocated to Customer',
        workflow: ['Select vehicle cleared by PDI', 'Capture dealer, OSM and tractor details', 'Capture customer name and full address blocks', 'Verify OTP', 'Capture customer signature and dealer stamp', 'Generate certificate', 'Move vehicle to Allocated to Customer'],
      },
    }
    const parsedWorkflow = JSON.parse(row.workflow || '[]')
    const override = overrides[row.key] ?? {}
    return {
      ...row,
      ...override,
      fields: JSON.parse(row.fields || '[]'),
      workflow: override.workflow ?? parsedWorkflow,
      checklist: JSON.parse(row.checklist || '[]'),
    }
  }

  private pick(body: PlainBody, keys: string[]) {
    for (const key of keys) {
      const value = body[key]
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim()
    }
    return ''
  }

  private enteredPayload(body: PlainBody) {
    const ignored = new Set(['action', 'createCustomer', 'createVehicle'])
    return Object.fromEntries(
      Object.entries(body).filter(([key, value]) => !ignored.has(key) && value !== undefined && value !== null && String(value).trim() !== ''),
    )
  }

  private async findVehicleFromPayload(body: PlainBody) {
    const code = this.pick(body, ['Vehicle Code', 'Vehicle Details'])
    const engineNo = this.pick(body, ['Engine Number'])
    const chassisNo = this.pick(body, ['Chassis Number'])
    const registrationNo = this.pick(body, ['Vehicle Registration Number'])
    if (!code && !engineNo && !chassisNo && !registrationNo) return null
    return this.prisma.vehicle.findFirst({
      where: {
        OR: [
          code ? { code } : undefined,
          engineNo ? { engineNo } : undefined,
          chassisNo ? { chassisNo } : undefined,
          registrationNo ? { registrationNo } : undefined,
        ].filter(Boolean) as any[],
      },
    })
  }

  private parseDate(value: string) {
    if (!value) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  private parseInteger(value: string) {
    const digits = String(value || '').replace(/[^\d-]/g, '')
    return digits ? Number(digits) : 0
  }

  private parseCurrency(value: string) {
    const digits = String(value || '').replace(/[^\d.]/g, '')
    return digits ? Math.round(Number(digits)) : 0
  }

  private onlyDigits(value: string) {
    return String(value || '').replace(/\D/g, '')
  }

  private isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }

  private isStrongPassword(value: string) {
    return value.length >= 8 && /[^A-Za-z0-9]/.test(value)
  }

  private randomToken() {
    return randomBytes(24).toString('hex')
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex')
    const hash = scryptSync(password, salt, 64).toString('hex')
    return `${salt}:${hash}`
  }

  private createAccessToken(user: { id: string; role: string; email: string }) {
    const payload = {
      userId: user.id,
      role: user.role,
      email: user.email,
      exp: Date.now() + ACCESS_TOKEN_TTL_MS,
    }
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
    const signature = this.hashToken(encoded).slice(0, 48)
    return `${encoded}.${signature}`
  }

  private verifyAccessToken(token: string) {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) throw new UnauthorizedException('Invalid access token')
    const expected = this.hashToken(encoded).slice(0, 48)
    if (expected !== signature) throw new UnauthorizedException('Invalid access token')
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { userId: string; role: string; email: string; exp: number }
    if (!payload.userId || !payload.role || !payload.exp || payload.exp < Date.now()) {
      throw new UnauthorizedException('Access token expired')
    }
    return payload
  }

  private async persistUploadedFile(moduleKey: string, documentId: string, fileName: string, contentBase64?: string, mimeType?: string) {
    const folder = join(STORAGE_ROOT, 'uploads', moduleKey)
    await fs.mkdir(folder, { recursive: true })
    const safeName = `${documentId}-${fileName.replace(/[^a-zA-Z0-9._-]+/g, '_')}`
    const fullPath = join(folder, safeName)
    if (contentBase64) {
      await fs.writeFile(fullPath, Buffer.from(contentBase64, 'base64'))
    } else {
      const placeholder = `Uploaded file placeholder\nOriginal Name: ${fileName}\nMime Type: ${mimeType ?? 'unknown'}\nSaved At: ${new Date().toISOString()}\n`
      await fs.writeFile(fullPath, placeholder, 'utf8')
    }
  }

  private mimeTypeFromFileName(fileName: string) {
    const extension = extname(fileName).toLowerCase()
    switch (extension) {
      case '.pdf':
        return 'application/pdf'
      case '.png':
        return 'image/png'
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg'
      case '.webp':
        return 'image/webp'
      case '.mp4':
        return 'video/mp4'
      case '.mov':
        return 'video/quicktime'
      default:
        return 'application/octet-stream'
    }
  }

  private async writeGeneratedPdf(folderName: string, fileName: string, title: string, lines: string[]) {
    const folder = join(STORAGE_ROOT, 'generated', folderName)
    await fs.mkdir(folder, { recursive: true })
    const fullPath = join(folder, fileName.replace(/[^a-zA-Z0-9._-]+/g, '_'))
    await fs.writeFile(fullPath, this.buildSimplePdf(title, lines))
  }

  private buildSimplePdf(title: string, lines: string[]) {
    const contentLines = [title, ...lines].map((line, index) => `BT /F1 ${index === 0 ? 16 : 11} Tf 50 ${780 - index * 22} Td (${this.escapePdfText(line)}) Tj ET`)
    const stream = contentLines.join('\n')
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
      `4 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`,
      '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    ]
    let pdf = '%PDF-1.4\n'
    const offsets: number[] = [0]
    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'))
      pdf += `${object}\n`
    }
    const xrefStart = Buffer.byteLength(pdf, 'utf8')
    pdf += `xref\n0 ${objects.length + 1}\n`
    pdf += '0000000000 65535 f \n'
    for (let index = 1; index <= objects.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
    return Buffer.from(pdf, 'utf8')
  }

  private escapePdfText(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  }

  private hashToken(value: string) {
    return scryptSync(value, 'tafe-dms', 32).toString('hex')
  }

  private verifyPassword(password: string, stored: string) {
    const [salt, existingHash] = stored.split(':')
    if (!salt || !existingHash) return false
    const candidate = scryptSync(password, salt, 64)
    const saved = Buffer.from(existingHash, 'hex')
    return candidate.length === saved.length && timingSafeEqual(candidate, saved)
  }

  private resolveDueColor(date: Date) {
    const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (days <= 2) return 'red'
    if (days <= 5) return 'yellow'
    return 'green'
  }
}
