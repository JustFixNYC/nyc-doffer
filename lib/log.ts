export interface Log {
  (message: string): void;
}

export const defaultLog: Log = (message) => console.log(message);
