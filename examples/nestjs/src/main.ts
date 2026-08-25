import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AgentBuilder } from '@ngrok/ngrok';

async function bootstrap() {
  const port = 3000;
  const app = await NestFactory.create(AppModule);
  await app.listen(port);

  // Setup ngrok ingress
  const agent = await new AgentBuilder().authtokenFromEnv().connect();
  const endpoint = await agent.httpEndpoint().forward(`localhost:${port}`);
  new Logger('main').log(`Ingress established at ${endpoint.url()}`);
}
bootstrap();
