import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { SessionBuilder } from '@ngrok/ngrok';

async function bootstrap() {
  const port = 3000;
  const app = await NestFactory.create(AppModule);
  await app.listen(port);

  // Setup ngrok ingress
  const session = await new SessionBuilder().authtokenFromEnv().connect();
  const listener = await session.httpEndpoint().listen();
  new Logger('main').log(`Ingress established at ${listener.url()}`);
  listener.forward(`localhost:${port}`);
}
bootstrap();
