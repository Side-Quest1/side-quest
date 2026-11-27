import * as ExpoCrypto from "expo-crypto";

type CryptoBridge = {
  getRandomValues(array: Uint32Array): Uint32Array;
  subtle: {
    digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer>;
  };
};

/**
 * Supabase Auth uses WebCrypto for PKCE. Expo Crypto exposes equivalent native
 * random-byte and digest primitives, but Expo Go does not install them on
 * globalThis.crypto. Install the small surface Auth needs before creating the
 * client so PKCE continues to use S256.
 */
export function installCryptoForAuth() {
  const current = globalThis.crypto as Partial<CryptoBridge> | undefined;
  if (current?.subtle?.digest && current.getRandomValues) return;

  const bridge: CryptoBridge = {
    getRandomValues:
      current?.getRandomValues ??
      ((array) => ExpoCrypto.getRandomValues(array) as Uint32Array),
    subtle: {
      ...current?.subtle,
      digest: current?.subtle?.digest ?? ((algorithm, data) => {
        const name = typeof algorithm === "string" ? algorithm : algorithm.name;
        if (name !== "SHA-256") return Promise.reject(new Error("Unsupported digest algorithm"));
        return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
      }),
    },
  };
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: bridge });
}
