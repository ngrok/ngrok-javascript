import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NgrokSessionBuilder } from '@ngrok/ngrok';

async function bootstrap() {
  // Added by ngrok
  const session = await new NgrokSessionBuilder().authtokenFromEnv().connect();
  const tunnel = await session.httpEndpoint().listen();
  console.log(`Ingress established at ${tunnel.url()}`);
  tunnel.forwardTcp("localhost:3000");
  // End added by ngrok

  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
