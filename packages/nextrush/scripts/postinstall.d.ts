export function shouldSkip(): boolean;
export function isMonorepo(): boolean;
export function shouldAutoInstall(): boolean;
export function isDevInstalled(): boolean;
export function detectPackageManager(): string;
export function getInstallCommand(pm: string): string[];
export function installDevPackage(pm: string): void;
export function printDevNotice(pm: string): void;
