import { Service } from '@nextrush/di';

export interface User {
  id: number;
  name: string;
  email: string;
}

const USERS: User[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' },
];

@Service()
export class UserService {
  private users = [...USERS];
  private nextId = 4;

  findAll(): User[] {
    return this.users;
  }

  findById(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  create(data: { name: string; email: string }): User {
    const user: User = { id: this.nextId++, ...data };
    this.users.push(user);
    return user;
  }

  update(id: number, data: Partial<{ name: string; email: string }>): User | undefined {
    const user = this.findById(id);
    if (!user) return undefined;
    Object.assign(user, data);
    return user;
  }

  delete(id: number): boolean {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    this.users.splice(idx, 1);
    return true;
  }
}
