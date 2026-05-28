declare module 'passport-github2' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface Profile {
    id: string | number;
    username?: string;
    displayName?: string;
    emails?: Array<{ value: string; primary?: boolean }>;
  }

  export class Strategy extends PassportStrategy {
    constructor(
      options: {
        clientID: string;
        clientSecret: string;
        callbackURL: string;
        scope?: string[];
      },
      verify: (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: (err?: Error | null, user?: unknown) => void,
      ) => void,
    );
    authenticate(
      req: import('express').Request,
      options?: Record<string, unknown>,
    ): void;
  }
}
