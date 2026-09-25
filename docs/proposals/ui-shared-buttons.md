# Share button styles between screens

`ConnectScreen` and `QrScanScreen` define near-identical primary and secondary button styles (same padding, radius, colors). Moving them into `src/theme.ts` would remove the duplication, but the two differ slightly (padding and font size), so unifying them would change how the QR screen looks. Left as is to keep the UI pixel-identical.
