import 'reflect-metadata';

import { controllersPlugin } from '@nextrush/controllers';
import { createApp, createRouter, listen } from 'nextrushx';

async function main() {
  const app = createApp();
  const router = createRouter();

  console.log('\n\x1b[36m⚡ NextRush Playground App\x1b[0m\n');

  // Register controllers FIRST (async - must await)
  await app.pluginAsync(
    controllersPlugin({
      router,
      root: './src',
      prefix: '/api',
      debug: true,
    })
  );

  // Then add router routes
  app.use(router.routes());

  const port = parseInt(process.env.PORT || '3000', 10);
  listen(app, port);
}

main().catch(console.error);
