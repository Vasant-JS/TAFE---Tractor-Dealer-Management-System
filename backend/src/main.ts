import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import helmet from 'helmet'
import compression = require('compression')
import cookieParser = require('cookie-parser')
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')
  app.enableCors({ origin: true, credentials: true })
  app.use(json({ limit: '15mb' }))
  app.use(urlencoded({ extended: true, limit: '15mb' }))
  app.use(helmet())
  app.use(compression())
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000)
}

bootstrap()
