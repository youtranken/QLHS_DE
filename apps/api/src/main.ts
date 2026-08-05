import 'reflect-metadata'
import './load-env'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { loadEnv } from './config/env'
import { DomainErrorFilter } from './http/common/domain-error.filter'
import { applyHardening } from './http/common/hardening'

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env)
  // rawBody: the PMH ID webhook verifies HMAC over the exact bytes received.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })
  applyHardening(app)
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.useGlobalFilters(new DomainErrorFilter())
  await app.listen(env.PORT)
  // eslint-disable-next-line no-console
  console.log(`QLHS api listening on :${env.PORT}`)
}

void bootstrap()
