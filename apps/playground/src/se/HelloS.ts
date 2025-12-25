import { Service } from '@nextrush/di';

@Service()
export class HelloService {
  private readonly message: object = { message: 'Hello from Service!' };
  getMessage() {
    return this.message;
  }
}
