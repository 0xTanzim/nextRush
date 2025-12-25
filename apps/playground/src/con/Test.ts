import { Controller, Get } from '@nextrush/controllers';

@Controller('/test')
export class TestController {
  @Get()
  test() {
    return { message: 'New controller discovered!' };
  }
}
