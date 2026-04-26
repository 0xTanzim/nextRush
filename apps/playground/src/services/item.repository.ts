import { Repository } from '@nextrush/di';

export interface Item {
  id: number;
  name: string;
  price: number;
}

const ITEMS: Item[] = [
  { id: 1, name: 'Keyboard', price: 99.99 },
  { id: 2, name: 'Mouse', price: 49.99 },
  { id: 3, name: 'Monitor', price: 299.99 },
];

@Repository()
export class ItemRepository {
  private items = [...ITEMS];

  findAll(): Item[] {
    return this.items;
  }

  findById(id: number): Item | undefined {
    return this.items.find((i) => i.id === id);
  }

  create(data: { name: string; price: number }): Item {
    const item: Item = { id: this.items.length + 1, ...data };
    this.items.push(item);
    return item;
  }
}
