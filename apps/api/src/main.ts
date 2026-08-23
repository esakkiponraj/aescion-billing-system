import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('AESCION_API');
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://billing-system-21d9a.web.app',
    'https://billing-system-21d9a.firebaseapp.com',
  ];

  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  // Enable CORS for frontend web client
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.web.app') || origin.endsWith('.firebaseapp.com')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Organization-Id',
      'X-Outlet-Id',
    ],
  });

  // Global DTO validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('AESCION Commerce OS API')
    .setDescription(
      'Multi-tenant enterprise-grade API for Billing, POS, Inventory, and Operations SaaS',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Organization-Id', in: 'header' }, 'X-Organization-Id')
    .addApiKey({ type: 'apiKey', name: 'X-Outlet-Id', in: 'header' }, 'X-Outlet-Id')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 AESCION API is running on http://127.0.0.1:${port}/api/v1`);
  logger.log(`📚 Swagger Documentation is available at http://127.0.0.1:${port}/api/docs`);
}

bootstrap();
