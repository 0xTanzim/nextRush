import { Controller, Ctx, Get } from '@nextrush/controllers';
import type { Context } from 'nextrushx';
import { HelloService } from '../se/HelloS';

// @Controller automatically includes DI registration - no need for @Service()!
@Controller('/hello')
export class HelloController {
  constructor(private readonly helloService: HelloService) {}

  @Get('/')
  hello(@Ctx() ctx: Context) {
    ctx.json({ message: 'Hello from Controller!' });
  }

  @Get('/service')
  highPrecisionTimer() {
    return this.helloService.getMessage();
  }

  @Get('/simple')
  simple() {
    return { message: 'Auto-returned JSON!' };
  }
}
