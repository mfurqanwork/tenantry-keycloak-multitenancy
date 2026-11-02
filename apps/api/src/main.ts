import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { loadConfig } from './config/config.js';

const config = loadConfig(process.env);
const app = await NestFactory.create(AppModule.forConfig(config), { bufferLogs: true });
app.useLogger(app.get(Logger));
app.setGlobalPrefix('api');
app.enableShutdownHooks();
await app.listen(config.port, '0.0.0.0');
