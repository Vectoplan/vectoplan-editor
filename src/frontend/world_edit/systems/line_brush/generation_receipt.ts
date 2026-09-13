/** A lost HTTP response does not undo a committed building generation. */
export async function confirmedBuildingGeneration<T extends { readonly ok: boolean }>(options: {
  send: () => Promise<T>;
  readReceipt?: () => Promise<T & { readonly commandStatus?: string }>;
  wait: () => Promise<void>;
  pending: () => void;
  signal: AbortSignal;
}): Promise<T> {
  let attempts = 0;
  while (!options.signal.aborted) {
    let result: T | undefined;
    try { result = await options.send(); } catch { /* Transport loss is ambiguous. */ }
    if (result?.ok) return result;
    const failed = result as any;
    const status = Number(failed?.error?.statusCode);
    const code = String(failed?.error?.code ?? '');
    if (result && (['chunk_api_invalid_config', 'chunk_api_invalid_url', 'chunk_api_unknown_block_type',
      'chunk_api_forbidden_debug_block_type'].includes(code)
      || (code === 'chunk_api_invalid_payload' && failed.request === null))) return result;
    // Validation/auth failures happen before a transaction commits. A gateway,
    // transport or server failure needs an authoritative receipt, not rollback.
    if (result && status >= 400 && status < 500 && ![408, 429].includes(status)) return result;
    if (!options.readReceipt) {
      if (result) return result; // Embedded adapters define their own result contract.
      throw new Error("Gebäudespeicherung konnte nicht bestätigt werden.");
    }
    options.pending();
    // Retry only the identical command ID/payload. The server serializes that
    // ID and returns its first receipt, so a delayed original cannot duplicate.
    for (let poll = 0; poll < Math.min(20, 10 + attempts * 5); poll++) {
      await options.wait();
      if (options.signal.aborted) break;
      try {
        const receipt = await options.readReceipt();
        if (receipt.ok && receipt.commandStatus === "applied") return receipt;
      } catch { /* A failed read says nothing about the mutation's outcome. */ }
    }
    attempts++;
  }
  throw new DOMException("Gebäudebestätigung unterbrochen", "AbortError");
}
