import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { NgrokSessionBuilder } from '@ngrok/ngrok';

async function bootstrap() {
  const port = 3000;
  const app = await NestFactory.create(AppModule);
  await app.listen(port);

  // Setup ngrok ingress
  const session = await new NgrokSessionBuilder().authtokenFromEnv().connect();
  const tunnel = await session.httpEndpoint().listen();
  new Logger('main').log(`Ingress established at ${tunnel.url()}`);
  tunnel.forwardTcp(`localhost:${port}`);
}
bootstrap();
