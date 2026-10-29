/**
 * Fixture-local conference-room storage for the Next.js real-server proof.
 *
 * The array below is PROCESS-LOCAL TEST STORAGE: it is seeded once when this
 * module is first imported and is neither durable nor shared across server
 * instances. Nothing here is framework code — this module exists only so the
 * HTTP matrix has state to read and write.
 */

/** One conference room as exposed over the fixture's HTTP API. */
export interface ConferenceRoom {
  readonly id: string;
  readonly name: string;
  readonly capacity: number;
}

/** The fields a client may supply when creating or replacing a room. */
export interface RoomInput {
  readonly name: string;
  readonly capacity: number;
}

/** Stable seed identifiers so the list assertion is deterministic. */
const SEED_ROOMS: readonly ConferenceRoom[] = [
  { id: 'atlas', name: 'Atlas', capacity: 12 },
  { id: 'orion', name: 'Orion', capacity: 6 },
];

const rooms: ConferenceRoom[] = SEED_ROOMS.map((room) => ({ ...room }));

/** Every room, as a copy so callers cannot mutate the store directly. */
export function listRooms(): ConferenceRoom[] {
  return rooms.map((room) => ({ ...room }));
}

/** One room by id, or `undefined` when it does not exist. */
export function findRoom(id: string): ConferenceRoom | undefined {
  return rooms.find((room) => room.id === id);
}

/** Create a room with a fresh UUID and return the stored record. */
export function createRoom(input: RoomInput): ConferenceRoom {
  const room: ConferenceRoom = { id: crypto.randomUUID(), ...input };
  rooms.push(room);
  return { ...room };
}

/** Replace every client-supplied field of an existing room. */
export function replaceRoom(id: string, input: RoomInput): ConferenceRoom | undefined {
  const index = rooms.findIndex((room) => room.id === id);
  if (index === -1) return undefined;

  const room: ConferenceRoom = { id, ...input };
  rooms[index] = room;
  return { ...room };
}

/** Apply a partial update, leaving unspecified fields untouched. */
export function patchRoom(id: string, patch: Partial<RoomInput>): ConferenceRoom | undefined {
  const index = rooms.findIndex((room) => room.id === id);
  if (index === -1) return undefined;

  const room: ConferenceRoom = { ...rooms[index], ...patch, id };
  rooms[index] = room;
  return { ...room };
}

/** Delete a room. Returns whether a record existed. */
export function deleteRoom(id: string): boolean {
  const index = rooms.findIndex((room) => room.id === id);
  if (index === -1) return false;

  rooms.splice(index, 1);
  return true;
}
