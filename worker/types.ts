export interface Env {
  DB: D1Database;
  ADMIN_PASSCODE: string;
  SESSION_SECRET: string;
}

export interface AppVariables {
  voterKey: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
