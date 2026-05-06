import { Body, Controller, Get, Param, Patch, Post, Req, StreamableFile } from '@nestjs/common'
import type { Request } from 'express'
import { AppService } from './app.service'

const moduleRoleAccess: Record<string, string[]> = {
  dashboard: ['owner', 'admin', 'sales', 'receptionist', 'technician', 'accounts', 'rto_clerk'],
  purchase: ['owner', 'admin'],
  pdi: ['owner', 'admin', 'sales'],
  installation: ['owner', 'admin', 'sales'],
  delivery: ['owner', 'admin', 'sales'],
  exchange: ['owner', 'admin', 'sales'],
  safety: ['owner', 'admin', 'sales', 'technician', 'receptionist'],
  insurance: ['owner', 'admin', 'sales'],
  rto: ['owner', 'admin', 'rto_clerk'],
  accounts: ['owner', 'admin', 'accounts'],
  ats: ['owner', 'admin', 'accounts'],
  service: ['owner', 'admin', 'sales', 'technician', 'receptionist'],
  fieldService: ['technician'],
  admin: ['owner', 'admin'],
  profile: ['owner', 'admin', 'sales', 'receptionist', 'technician', 'accounts', 'rto_clerk'],
}

@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}

  @Get('health')
  health() {
    return this.app.systemHealth()
  }

  @Post('auth/login')
  login(@Body() body: { email: string; password: string; role?: string }) {
    return this.app.login(body)
  }

  @Post('auth/refresh')
  refresh(@Body() body: { refreshToken?: string }) {
    return this.app.refresh(body)
  }

  @Post('auth/request-password-reset')
  requestPasswordReset(@Body() body: { email: string }) {
    return this.app.requestPasswordReset(body)
  }

  @Post('auth/reset-password')
  resetPassword(@Body() body: { email: string; token: string; password: string }) {
    return this.app.resetPassword(body)
  }

  @Get('dashboard')
  async dashboard(@Req() req: Request) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.dashboard()
  }

  @Get('work-items')
  async workItems(@Req() req: Request) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.workItems()
  }

  @Get('notifications')
  async notifications(@Req() req: Request) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.notifications()
  }

  @Get('search/:query')
  async search(@Req() req: Request, @Param('query') query: string) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.search(query)
  }

  @Get('modules')
  async modules(@Req() req: Request) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.modules()
  }

  @Get('modules/:key')
  async module(@Req() req: Request, @Param('key') key: string) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess[key] ?? moduleRoleAccess.dashboard)
    return this.app.module(key)
  }

  @Get('modules/:key/work-items')
  async moduleWorkItems(@Req() req: Request, @Param('key') key: string) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess[key] ?? moduleRoleAccess.dashboard)
    return this.app.moduleWorkItems(key)
  }

  @Post('modules/:key/work-items')
  async createWorkItem(@Req() req: Request, @Param('key') key: string, @Body() body: Record<string, unknown>) {
    const actor = await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess[key] ?? moduleRoleAccess.dashboard)
    return this.app.createWorkItem(key, body, actor)
  }

  @Patch('work-items/:id/status')
  async updateWorkItemStatus(@Req() req: Request, @Param('id') id: string, @Body() body: { status: string }) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.updateWorkItemStatus(id, body.status)
  }

  @Patch('work-items/:id/payload')
  async updateWorkItemPayload(@Req() req: Request, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.updateWorkItemPayload(id, body)
  }

  @Patch('documents/:id/toggle')
  async toggleDocument(@Req() req: Request, @Param('id') id: string) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.toggleDocument(id)
  }

  @Patch('documents/:id/upload')
  async uploadDocument(@Req() req: Request, @Param('id') id: string, @Body() body: { fileName: string; contentBase64?: string; mimeType?: string }) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.uploadDocument(id, body.fileName, body.contentBase64, body.mimeType)
  }

  @Patch('documents/:id/remove')
  async removeDocument(@Req() req: Request, @Param('id') id: string) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.removeDocument(id)
  }

  @Get('documents/:id/file')
  async viewDocumentFile(@Req() req: Request, @Param('id') id: string) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    const file = await this.app.viewDocumentFile(id)
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `inline; filename="${file.fileName}"`,
    })
  }

  @Post('work-items/:id/documents')
  async addDocument(@Req() req: Request, @Param('id') id: string, @Body() body: { name: string }) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.addDocument(id, body.name)
  }

  @Get('vehicles')
  async vehicles(@Req() req: Request) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.vehicles()
  }

  @Get('vehicles/:vehicleId/flow')
  async vehicleFlow(@Req() req: Request, @Param('vehicleId') vehicleId: string) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.vehicleFlow(vehicleId)
  }

  @Get('pdi/vehicle/:vehicleId')
  async pdiVehicleRecord(@Req() req: Request, @Param('vehicleId') vehicleId: string) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.pdi)
    return this.app.pdiVehicleRecord(vehicleId)
  }

  @Post('vehicles')
  async createVehicle(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.purchase)
    return this.app.createVehicle(body)
  }

  @Get('customers')
  async customers(@Req() req: Request) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.dashboard)
    return this.app.customers()
  }

  @Get('users')
  async users(@Req() req: Request) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.admin)
    return this.app.users()
  }

  @Post('customers')
  async createCustomer(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.installation)
    return this.app.createCustomer(body)
  }

  @Get('audit')
  async auditLogs(@Req() req: Request) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.admin)
    return this.app.auditLogs()
  }

  @Post('otp/send')
  async sendOtp(@Req() req: Request, @Body() body: { mobile: string; context: string }) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.installation)
    return this.app.sendOtp(body)
  }

  @Post('otp/verify')
  async verifyOtp(@Req() req: Request, @Body() body: { mobile: string; otp: string; context: string }) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.installation)
    return this.app.verifyOtp(body)
  }

  @Post('audit')
  async audit(@Req() req: Request, @Body() body: Record<string, unknown>) {
    await this.app.authorizeRequest(req.headers.authorization, moduleRoleAccess.admin)
    return this.app.audit(body)
  }
}
