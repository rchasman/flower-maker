// Stub — replaced by `spacetime generate` output.
// This file exists so TypeScript doesn't error on the dynamic import.

export const DbConnection = {
  builder() {
    return {
      withUri(_uri: string) { return this },
      withModuleName(_name: string) { return this },
      withToken(_token: string | undefined) { return this },
      onConnect(_cb: (...args: unknown[]) => void) { return this },
      onConnectError(_cb: (...args: unknown[]) => void) { return this },
      onDisconnect(_cb: (...args: unknown[]) => void) { return this },
      build() {
        console.warn('[spacetimedb] Using stub bindings — run `spacetime generate` to get real ones')
        return {} as unknown
      },
    }
  },
}
