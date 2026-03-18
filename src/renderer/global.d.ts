export {};

declare global {
  interface Window {
    inventoryApi: {
      openInventory: () => Promise<{ filePath: string; content: string } | null>;
      saveInventory: (payload: { filePath?: string; content: string }) => Promise<{ filePath: string } | null>;
      minimizeWindow: () => Promise<void>;
      toggleMaximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      setWindowSize: (payload: { width: number; height: number }) => Promise<void>;
    };
  }
}
