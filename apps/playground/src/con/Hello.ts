import { Controller, Ctx, Get } from '@nextrush/controllers';
import type { Context } from 'nextrushx';

// Note: Constructor DI requires decorator metadata (emitDecoratorMetadata)
// which is NOT available when using tsx/esbuild
// For tsx dev mode, use parameter-less controllers or manual DI

@Controller('/hello')
export class HelloController {
  @Get('/')
  hello(@Ctx() ctx: Context) {
    ctx.json({ message: 'Hello from Controller!' });
  }

  @Get('/service')
  highPrecisionTimer() {
    // Without DI, we can instantiate manually if needed
    return { message: 'Hello from manual service!' };
  }

  @Get('/simple')
  simple() {
    return { message: 'Auto-returned JSON!' };
  }
}
